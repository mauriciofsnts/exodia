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

const TICK_PATTERN = "* * * * *"; // announce / Discord-sync — every minute
const IMPORT_PATTERN = "*/15 * * * *"; // fetch fixtures + prune — every 15 minutes
const DEFAULT_DURATION_MS = 2 * 60 * 60_000; // External events need an end time
const EXTERNAL_LOCATION = "Online";

// Polls guild_events and, per guild config, mirrors events into Discord and
// announces them in the configured channel when they start. Fetching fixture
// data is a separate, slower job (importEvents) so the timely announce/sync work
// isn't coupled to provider calls.
export class EventScheduler {
  private job: Cron | null = null;
  private importJob: Cron | null = null;
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
    this.job = new Cron(TICK_PATTERN, { protect: true }, () => this.runTick());
    this.importJob = new Cron(IMPORT_PATTERN, { protect: true }, () => this.runImport());
    this.ctx.logger.info("Event scheduler started");

    // Cold start: if the DB has no upcoming fixture data, import now instead of
    // waiting up to a full IMPORT_PATTERN interval for the first scheduled run.
    void this.bootstrapImport();
  }

  stop(): void {
    this.job?.stop();
    this.importJob?.stop();
    this.job = null;
    this.importJob = null;
  }

  private async runTick(): Promise<void> {
    try {
      await this.tick();
    } catch (err) {
      this.ctx.logger.error({ err }, "Event scheduler tick failed");
    }
  }

  private async runImport(): Promise<void> {
    try {
      await this.importEvents();
    } catch (err) {
      this.ctx.logger.error({ err }, "Event import failed");
    }
  }

  private async tick(): Promise<void> {
    const events = this.ctx.events;
    if (!events) return;
    await this.syncDiscordEvents(events);
    await this.announceDueEvents(events);
  }

  // The dedicated data job: prune aged-out events, then pull fresh fixtures for
  // every guild's subscriptions. Provider fetches are themselves cache-throttled
  // (30 min), so the schedule just bounds how often we refresh and reconcile.
  private async importEvents(): Promise<void> {
    const events = this.ctx.events;
    if (!events) return;

    const pruned = await events.deleteStale();
    if (pruned > 0) this.ctx.logger.info({ pruned }, "Pruned aged-out events");

    await this.sportsImporter?.run(this.ctx.client.guilds.cache.keys());
  }

  // Runs once at startup. Only does work when there's no upcoming fixture data,
  // so a warm DB doesn't pay an extra provider round trip on every restart.
  private async bootstrapImport(): Promise<void> {
    const events = this.ctx.events;
    if (!events || !this.sportsImporter) return;

    try {
      if ((await events.countUpcomingSportsEvents()) > 0) return;
      this.ctx.logger.info("No upcoming fixture data — importing on bootstrap");
      await this.importEvents();
    } catch (err) {
      this.ctx.logger.error({ err }, "Bootstrap event import failed");
    }
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
