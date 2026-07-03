import { Cron } from "croner";
import type { BotContext } from "@/core/context";
import type { GuildConfig } from "@/services/guild/guildConfig";
import { claimButtonRow, renderFreeGameCard } from "./freeGameCard";
import type { StoredFreeGame } from "./freeGamesRepository";
import { FREE_GAME_STORES, fetchAllFreeGames } from "./index";

// Hourly is plenty: Epic rotates on Thursdays and giveaways last days, while
// the provider fetch itself is cache-throttled (15 min) on top.
const TICK_PATTERN = "0 * * * *";

// Polls the free-game providers into a global catalog, then fans each new offer
// out to every guild that enabled alerts. Per-guild posted tracking makes the
// fan-out idempotent — a restart or overlapping tick never double-posts.
export class FreeGamesScheduler {
  private job: Cron | null = null;

  constructor(private readonly ctx: BotContext) {}

  start(): void {
    if (!this.ctx.freeGames || this.job) return;
    // `protect` skips a tick if the previous one is still running (no overlap).
    this.job = new Cron(TICK_PATTERN, { protect: true }, () => this.runTick());
    this.ctx.logger.info("Free games scheduler started");

    // Bootstrap tick so a Thursday restart doesn't sit on stale data for up to
    // an hour — cheap thanks to the provider cache + posted-dedup.
    void this.runTick();
  }

  stop(): void {
    this.job?.stop();
    this.job = null;
  }

  private async runTick(): Promise<void> {
    try {
      await this.tick();
    } catch (err) {
      this.ctx.logger.error({ err }, "Free games scheduler tick failed");
    }
  }

  private async tick(): Promise<void> {
    const repo = this.ctx.freeGames;
    if (!repo) return;

    const games = await fetchAllFreeGames(this.ctx.cache, this.ctx.logger);
    for (const game of games) {
      await repo.upsert(game).catch((err) => {
        this.ctx.logger.error({ err, game: game.title }, "Failed to upsert free game");
      });
    }

    const pruned = await repo.deleteStale();
    if (pruned > 0) this.ctx.logger.info({ pruned }, "Pruned aged-out free games");

    for (const guildId of this.ctx.client.guilds.cache.keys()) {
      try {
        await this.notifyGuild(guildId);
      } catch (err) {
        this.ctx.logger.error({ err, guildId }, "Free games fan-out failed for guild");
      }
    }
  }

  private async notifyGuild(guildId: string): Promise<void> {
    const repo = this.ctx.freeGames;
    if (!repo) return;

    const cfg = await this.ctx.guildConfig.get(guildId);
    if (!cfg.freeGamesEnabled || !cfg.freeGamesChannelId) return;

    const due = await repo.unpostedActive(guildId, cfg.freeGamesStores ?? FREE_GAME_STORES);
    for (const game of due) {
      await this.post(guildId, cfg, game).catch((err) => {
        this.ctx.logger.error({ err, guildId, game: game.title }, "Failed to post free game");
      });
      // Marked regardless of outcome, like the event announcer — a broken
      // channel shouldn't queue up repeat posts forever.
      await repo.markPosted(guildId, game.id);
    }
  }

  private async post(guildId: string, cfg: GuildConfig, game: StoredFreeGame): Promise<void> {
    if (!cfg.freeGamesChannelId) return;
    const guild = this.ctx.client.guilds.cache.get(guildId);
    const channel = guild?.channels.cache.get(cfg.freeGamesChannelId);
    if (!channel?.isSendable()) return;

    const locale = this.ctx.i18n.resolveLocale(await this.ctx.guildConfig.resolveLocale(guildId));
    const t = this.ctx.i18n.bind(locale);

    await channel.send({
      content: cfg.freeGamesMentionEveryone ? "@everyone" : undefined,
      embeds: [renderFreeGameCard(game, t)],
      components: [claimButtonRow(game, t)],
      allowedMentions: { parse: cfg.freeGamesMentionEveryone ? ["everyone"] : [] },
    });
  }
}
