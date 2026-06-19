import type { Database } from "@/core/database.js";

export interface GuildEvent {
  id: string;
  guildId: string;
  name: string;
  startAt: Date;
  discordEventId: string | null;
  announced: boolean;
  source: string | null; // SPORTS_CATALOG key (e.g. "football:premier") when auto-imported, else null
}

interface EventRow {
  id: string;
  guild_id: string;
  name: string;
  start_at: Date;
  discord_event_id: string | null;
  announced: boolean;
  source: string | null;
}

function toEvent(row: EventRow): GuildEvent {
  return {
    id: row.id,
    guildId: row.guild_id,
    name: row.name,
    startAt: row.start_at,
    discordEventId: row.discord_event_id,
    announced: row.announced,
    source: row.source,
  };
}

// Announce events from up to this far in the past on the next tick (covers
// downtime around the start time) and up to one tick ahead (so it fires on time).
const ANNOUNCE_BACKFILL = "1 hour";
const ANNOUNCE_LEAD = "70 seconds";

// Persisted, per-guild scheduled events. A background scheduler reads these to
// create the matching Discord event and to announce when they start.
export class EventRepository {
  constructor(private readonly db: Database) {}

  async init(): Promise<void> {
    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS guild_events (
        id               BIGSERIAL PRIMARY KEY,
        guild_id         TEXT NOT NULL,
        name             TEXT NOT NULL,
        start_at         TIMESTAMPTZ NOT NULL,
        discord_event_id TEXT,
        announced        BOOLEAN NOT NULL DEFAULT FALSE,
        created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    // source/external_id identify auto-imported fixtures (e.g. "football:premier" +
    // the provider's event id) so re-running the importer never creates duplicates.
    await this.db.execute(`ALTER TABLE guild_events ADD COLUMN IF NOT EXISTS source TEXT`);
    await this.db.execute(`ALTER TABLE guild_events ADD COLUMN IF NOT EXISTS external_id TEXT`);
    // Not partial: ON CONFLICT can only target an index whose predicate it
    // repeats verbatim, and Postgres treats NULLs as distinct by default, so
    // manually-added events (both columns NULL) never collide with each other.
    await this.db.execute(`DROP INDEX IF EXISTS idx_guild_events_dedup`);
    await this.db.execute(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_guild_events_dedup
         ON guild_events (guild_id, source, external_id)`,
    );
    // listUpcoming: WHERE guild_id = $1 AND start_at >= now() ORDER BY start_at.
    await this.db.execute(
      `CREATE INDEX IF NOT EXISTS idx_guild_events_guild_start
         ON guild_events (guild_id, start_at)`,
    );
    // The scheduler scans these every minute — partial indexes keep them tiny by
    // covering only the rows still pending work.
    await this.db.execute(
      `CREATE INDEX IF NOT EXISTS idx_guild_events_pending_discord
         ON guild_events (start_at)
         WHERE discord_event_id IS NULL`,
    );
    await this.db.execute(
      `CREATE INDEX IF NOT EXISTS idx_guild_events_unannounced
         ON guild_events (start_at)
         WHERE announced = FALSE`,
    );
  }

  async create(guildId: string, name: string, startAt: Date): Promise<void> {
    await this.db.execute(
      `INSERT INTO guild_events (guild_id, name, start_at) VALUES ($1, $2, $3)`,
      [guildId, name, startAt],
    );
  }

  // Used by the sports auto-importer: inserts a fixture unless this guild
  // already has one from the same source + external id (dedup on re-import).
  async createIfNew(
    guildId: string,
    name: string,
    startAt: Date,
    source: string,
    externalId: string,
  ): Promise<void> {
    await this.db.execute(
      `INSERT INTO guild_events (guild_id, name, start_at, source, external_id)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (guild_id, source, external_id) DO NOTHING`,
      [guildId, name, startAt, source, externalId],
    );
  }

  async listUpcoming(guildId: string, limit: number): Promise<GuildEvent[]> {
    const rows = await this.db.query<EventRow>(
      `SELECT id, guild_id, name, start_at, discord_event_id, announced, source
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
      `SELECT id, guild_id, name, start_at, discord_event_id, announced, source
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
      `SELECT id, guild_id, name, start_at, discord_event_id, announced, source
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
      `SELECT id, guild_id, name, start_at, discord_event_id, announced, source
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
}
