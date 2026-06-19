import { Cron } from "croner";
import {
  GuildScheduledEventEntityType,
  GuildScheduledEventPrivacyLevel,
  PermissionFlagsBits,
} from "discord.js";
import type { BotContext } from "@/core/context";
import { EmbedColor, embed } from "@/lib/embeds";
import { TheSportsDbProvider } from "@/services/sports/provider/theSportsDbProvider";
import { SportsImporter } from "@/services/sports/sportsImporter";
import type { EventRepository, GuildEvent } from "./eventRepository";

const TICK_PATTERN = "* * * * *"; // every minute
const DEFAULT_DURATION_MS = 2 * 60 * 60_000; // External events need an end time
const EXTERNAL_LOCATION = "Online";

// Polls guild_events and, per guild config, mirrors events into Discord and
// announces them in the configured channel when they start.
export class EventScheduler {
  private job: Cron | null = null;
  private readonly sportsImporter: SportsImporter | null;

  constructor(private readonly ctx: BotContext) {
    this.sportsImporter = ctx.events
      ? new SportsImporter(
          ctx.guildConfig,
          ctx.events,
          new TheSportsDbProvider(ctx.config.SPORTSDB_API_KEY),
          ctx.cache,
          ctx.logger,
        )
      : null;
  }

  start(): void {
    if (!this.ctx.events || this.job) return;
    // `protect` skips a tick if the previous one is still running (no overlap).
    this.job = new Cron(TICK_PATTERN, { protect: true }, async () => {
      try {
        await this.tick();
      } catch (err) {
        this.ctx.logger.error({ err }, "Event scheduler tick failed");
      }
    });
    this.ctx.logger.info("Event scheduler started");
  }

  stop(): void {
    this.job?.stop();
    this.job = null;
  }

  private async tick(): Promise<void> {
    const events = this.ctx.events;
    if (!events) return;
    // The fetch itself is cache-throttled (30 min) — running this every tick
    // just lets newly-subscribed guilds pick up fixtures within a minute.
    await this.sportsImporter?.run(this.ctx.client.guilds.cache.keys());
    await this.syncDiscordEvents(events);
    await this.announceDueEvents(events);
  }

  private async syncDiscordEvents(events: EventRepository): Promise<void> {
    for (const ev of await events.pendingDiscordCreation()) {
      const cfg = await this.ctx.guildConfig.get(ev.guildId);
      if (!cfg.eventsEnabled) continue;
      // "embed" mode only ever wants the channel announcement below — leave
      // discord_event_id null so this guild's events keep skipping this loop.
      if (cfg.eventsMode === "embed") continue;

      const guild = this.ctx.client.guilds.cache.get(ev.guildId);
      if (!guild) continue; // not ready yet or bot was removed — retry next tick

      if (!guild.members.me?.permissions.has(PermissionFlagsBits.ManageEvents)) continue;

      try {
        const created = await guild.scheduledEvents.create({
          name: ev.name,
          scheduledStartTime: ev.startAt,
          scheduledEndTime: new Date(ev.startAt.getTime() + DEFAULT_DURATION_MS),
          privacyLevel: GuildScheduledEventPrivacyLevel.GuildOnly,
          entityType: GuildScheduledEventEntityType.External,
          entityMetadata: { location: EXTERNAL_LOCATION },
        });
        await events.markDiscordCreated(ev.id, created.id);
      } catch (err) {
        this.ctx.logger.error({ err, eventId: ev.id }, "Failed to create Discord scheduled event");
      }
    }
  }

  private async announceDueEvents(events: EventRepository): Promise<void> {
    for (const ev of await events.dueForAnnouncement()) {
      const guild = this.ctx.client.guilds.cache.get(ev.guildId);
      if (!guild) continue; // retry once the guild is cached

      await this.announce(ev).catch((err) => {
        this.ctx.logger.error({ err, eventId: ev.id }, "Failed to announce event");
      });
      await events.markAnnounced(ev.id);
    }
  }

  private async announce(ev: GuildEvent): Promise<void> {
    const cfg = await this.ctx.guildConfig.get(ev.guildId);
    // "discord" mode relies on the native scheduled event to notify people —
    // no channel message to send.
    if (cfg.eventsMode === "discord") return;
    if (!cfg.eventsChannelId) return; // nothing configured — mark announced and move on

    const guild = this.ctx.client.guilds.cache.get(ev.guildId);
    const channel = guild?.channels.cache.get(cfg.eventsChannelId);
    if (!channel?.isSendable()) return;

    const locale = this.ctx.i18n.resolveLocale(
      await this.ctx.guildConfig.resolveLocale(ev.guildId),
    );
    const t = this.ctx.i18n.bind(locale);

    const card = embed(EmbedColor.primary)
      .setTitle(t("events.startingTitle"))
      .setDescription(t("events.starting", { name: ev.name }));

    await channel.send({
      content: cfg.eventsMentionEveryone ? "@everyone" : undefined,
      embeds: [card],
      allowedMentions: { parse: cfg.eventsMentionEveryone ? ["everyone"] : [] },
    });
  }
}
