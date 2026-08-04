import type { Database } from "@/core/database";

// Provider enrichment persisted with auto-imported fixtures (JSONB `details`
// column) — everything needed to render a rich announcement card without a
// provider round trip. All fields best-effort; null for manual events.
export interface EventDetails {
  home?: string;
  away?: string;
  competition?: string;
  venue?: string;
  homeBadge?: string;
  awayBadge?: string;
  leagueBadge?: string;
  thumb?: string;
}

export interface GuildEvent {
  id: string;
  guildId: string;
  name: string;
  startAt: Date;
  discordEventId: string | null;
  announced: boolean;
  reminded: boolean;
  source: string | null; // SPORTS_CATALOG key (e.g. "football:premier") when auto-imported, else null
  externalId: string | null; // provider's event id when auto-imported, else null
  details: EventDetails | null;
  listed: boolean; // been through the follow-only digest pass (see dueForListing)
  cardChannelId: string | null; // channel of the posted reminder/announcement card, if any
  cardMessageId: string | null; // the card message itself — the "starting now" ping edits it instead of posting anew
}

interface EventRow {
  id: string;
  guild_id: string;
  name: string;
  start_at: Date;
  discord_event_id: string | null;
  announced: boolean;
  reminded: boolean;
  source: string | null;
  external_id: string | null;
  details: EventDetails | null;
  listed: boolean;
  card_channel_id: string | null;
  card_message_id: string | null;
}

// Shared column list so every SELECT returns a complete EventRow.
const COLUMNS =
  "id, guild_id, name, start_at, discord_event_id, announced, reminded, source, external_id, details, listed, card_channel_id, card_message_id";

function toEvent(row: EventRow): GuildEvent {
  return {
    id: row.id,
    guildId: row.guild_id,
    name: row.name,
    startAt: row.start_at,
    discordEventId: row.discord_event_id,
    announced: row.announced,
    reminded: row.reminded,
    source: row.source,
    externalId: row.external_id,
    details: row.details,
    listed: row.listed,
    cardChannelId: row.card_channel_id,
    cardMessageId: row.card_message_id,
  };
}

// Announce events from up to this far in the past on the next tick (covers
// downtime around the start time) and up to one tick ahead (so it fires on time).
const ANNOUNCE_BACKFILL = "1 hour";
const ANNOUNCE_LEAD = "70 seconds";
// Advance heads-up fired this far ahead of start (before the "starting now"
// window). Change this one constant to adjust how early the reminder goes out.
const REMINDER_LEAD = "15 minutes";

// Data aging: an event is kept only until it has occurred. Once its start time
// is past the announce backfill window (so it has had its chance to fire), it's
// no longer upcoming and gets pruned. The importer never re-imports past
// fixtures, so this can't resurrect them.
const EVENT_RETENTION = ANNOUNCE_BACKFILL; // prune once the event is over

// Persisted, per-guild scheduled events. A background scheduler reads these to
// create the matching Discord event and to announce when they start.
export class EventRepository {
  constructor(private readonly db: Database) {}

  async create(guildId: string, name: string, startAt: Date): Promise<void> {
    await this.db.execute(
      `INSERT INTO guild_events (guild_id, name, start_at) VALUES ($1, $2, $3)`,
      [guildId, name, startAt],
    );
  }

  // Used by the sports auto-importer: inserts a fixture unless this guild
  // already has one from the same source + external id. On re-import the
  // details are refreshed (badges/venue/TV data fill in over time upstream).
  async createIfNew(
    guildId: string,
    name: string,
    startAt: Date,
    source: string,
    externalId: string,
    details: EventDetails | null = null,
  ): Promise<void> {
    await this.db.execute(
      `INSERT INTO guild_events (guild_id, name, start_at, source, external_id, details)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (guild_id, source, external_id)
       DO UPDATE SET details = EXCLUDED.details`,
      [guildId, name, startAt, source, externalId, details ? JSON.stringify(details) : null],
    );
  }

  // One upcoming event by id, scoped to the guild — used by the follow
  // components to validate the target before toggling.
  async getUpcoming(id: string, guildId: string): Promise<GuildEvent | null> {
    const rows = await this.db.query<EventRow>(
      `SELECT ${COLUMNS} FROM guild_events
        WHERE id = $1 AND guild_id = $2 AND start_at >= now()`,
      [id, guildId],
    );
    return rows[0] ? toEvent(rows[0]) : null;
  }

  // Name search over upcoming events — backs the /event autocomplete and its
  // free-typed fallback. Empty query matches everything (soonest first).
  async searchUpcoming(guildId: string, query: string, limit: number): Promise<GuildEvent[]> {
    const rows = await this.db.query<EventRow>(
      `SELECT ${COLUMNS}
         FROM guild_events
        WHERE guild_id = $1 AND start_at >= now() AND name ILIKE $2
        ORDER BY start_at ASC
        LIMIT $3`,
      [guildId, `%${query}%`, limit],
    );
    return rows.map(toEvent);
  }

  async listUpcoming(guildId: string, limit: number): Promise<GuildEvent[]> {
    const rows = await this.db.query<EventRow>(
      `SELECT ${COLUMNS}
         FROM guild_events
        WHERE guild_id = $1 AND start_at >= now()
        ORDER BY start_at ASC
        LIMIT $2`,
      [guildId, limit],
    );
    return rows.map(toEvent);
  }

  // Upcoming events starting within the next 7 days (manually added or
  // auto-imported from sports subscriptions alike).
  async listThisWeek(guildId: string, limit: number): Promise<GuildEvent[]> {
    const rows = await this.db.query<EventRow>(
      `SELECT ${COLUMNS}
         FROM guild_events
        WHERE guild_id = $1 AND start_at >= now() AND start_at < now() + interval '7 days'
        ORDER BY start_at ASC
        LIMIT $2`,
      [guildId, limit],
    );
    return rows.map(toEvent);
  }

  // Future events not yet mirrored as a Discord scheduled event.
  async pendingDiscordCreation(): Promise<GuildEvent[]> {
    const rows = await this.db.query<EventRow>(
      `SELECT ${COLUMNS}
         FROM guild_events
        WHERE discord_event_id IS NULL AND start_at > now()`,
    );
    return rows.map(toEvent);
  }

  async markDiscordCreated(id: string, discordEventId: string): Promise<void> {
    await this.db.execute(`UPDATE guild_events SET discord_event_id = $2 WHERE id = $1`, [
      id,
      discordEventId,
    ]);
  }

  // Events whose start time has just arrived (or recently passed) and that
  // haven't been announced yet.
  async dueForAnnouncement(): Promise<GuildEvent[]> {
    const rows = await this.db.query<EventRow>(
      `SELECT ${COLUMNS}
         FROM guild_events
        WHERE announced = FALSE
          AND start_at <= now() + interval '${ANNOUNCE_LEAD}'
          AND start_at >= now() - interval '${ANNOUNCE_BACKFILL}'`,
    );
    return rows.map(toEvent);
  }

  async markAnnounced(id: string): Promise<void> {
    await this.db.execute(`UPDATE guild_events SET announced = TRUE WHERE id = $1`, [id]);
  }

  // Upcoming events entering the heads-up window: more than ANNOUNCE_LEAD away
  // (so this stays distinct from the "starting now" ping) but within
  // REMINDER_LEAD of start, and not yet reminded. Fires the advance reminder.
  async dueForReminder(): Promise<GuildEvent[]> {
    const rows = await this.db.query<EventRow>(
      `SELECT ${COLUMNS}
         FROM guild_events
        WHERE reminded = FALSE
          AND start_at > now() + interval '${ANNOUNCE_LEAD}'
          AND start_at <= now() + interval '${REMINDER_LEAD}'`,
    );
    return rows.map(toEvent);
  }

  async markReminded(id: string): Promise<void> {
    await this.db.execute(`UPDATE guild_events SET reminded = TRUE WHERE id = $1`, [id]);
  }

  // Remembers the channel message a reminder/announcement card was posted as,
  // so a later post for the same event (the "starting now" ping) can edit it
  // in place instead of sending a second message.
  async markCardMessage(id: string, channelId: string, messageId: string): Promise<void> {
    await this.db.execute(
      `UPDATE guild_events SET card_channel_id = $2, card_message_id = $3 WHERE id = $1`,
      [id, channelId, messageId],
    );
  }

  // Freshly imported fixtures that haven't been through the digest pass yet.
  // Only auto-imported events participate — manual events (source NULL) are
  // announced individually and never digested.
  async dueForListing(): Promise<GuildEvent[]> {
    const rows = await this.db.query<EventRow>(
      `SELECT ${COLUMNS}
         FROM guild_events
        WHERE listed = FALSE AND source IS NOT NULL AND start_at > now()
        ORDER BY guild_id, source, start_at`,
    );
    return rows.map(toEvent);
  }

  async markListed(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.db.execute(`UPDATE guild_events SET listed = TRUE WHERE id = ANY($1::bigint[])`, [
      ids,
    ]);
  }

  // When a league subscription flips to follow-only, put its still-pending
  // fixtures back through the digest pass so members get a list to follow from
  // — covers both mode changes and the subscribe flow, where the immediate
  // import can race the wizard's mode step.
  async relistUpcoming(guildId: string, source: string): Promise<void> {
    await this.db.execute(
      `UPDATE guild_events
          SET listed = FALSE
        WHERE guild_id = $1 AND source = $2 AND start_at > now()
          AND reminded = FALSE AND announced = FALSE`,
      [guildId, source],
    );
  }

  // Toggles a user's follow on an event. Returns the new state: true when the
  // user is now following, false when the click removed an existing follow.
  async toggleFollow(eventId: string, userId: string): Promise<boolean> {
    const inserted = await this.db.query(
      `INSERT INTO guild_event_followers (event_id, user_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING
       RETURNING 1`,
      [eventId, userId],
    );
    if (inserted.length > 0) return true;

    await this.db.execute(
      `DELETE FROM guild_event_followers WHERE event_id = $1 AND user_id = $2`,
      [eventId, userId],
    );
    return false;
  }

  // User ids to @mention when this event's reminder/announcement fires.
  async followers(eventId: string): Promise<string[]> {
    const rows = await this.db.query<{ user_id: string }>(
      `SELECT user_id FROM guild_event_followers WHERE event_id = $1 ORDER BY created_at`,
      [eventId],
    );
    return rows.map((r) => r.user_id);
  }

  // Number of auto-imported (sports) fixtures still upcoming. Zero means we have
  // no fresh fixture data — the bootstrap path uses this to run an import on
  // startup instead of waiting for the first scheduled one (cold DB, or every
  // previously-imported fixture has already aged out).
  async countUpcomingSportsEvents(): Promise<number> {
    const rows = await this.db.query<{ count: number }>(
      `SELECT count(*)::int AS count
         FROM guild_events
        WHERE source IS NOT NULL AND start_at >= now()`,
    );
    return rows[0]?.count ?? 0;
  }

  // Data aging: drop events that started more than EVENT_RETENTION ago. Returns
  // how many rows were removed (for logging). Follower rows go with them
  // (ON DELETE CASCADE).
  async deleteStale(): Promise<number> {
    const rows = await this.db.query<{ count: number }>(
      `WITH deleted AS (
         DELETE FROM guild_events
          WHERE start_at < now() - interval '${EVENT_RETENTION}'
          RETURNING 1
       )
       SELECT count(*)::int AS count FROM deleted`,
    );
    return rows[0]?.count ?? 0;
  }
}
