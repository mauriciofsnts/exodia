import type { Database } from "@/core/database.js";
import type { Track } from "@/services/player/track.js";

// A resolved track without the per-request "requestedBy" field — that's filled
// in by whoever played it, not by what was cached.
export type CachedTrack = Omit<Track, "requestedBy">;

// A track plus its accumulated play count, for popularity rankings.
export interface TopTrack extends CachedTrack {
  plays: number;
}

// Collapse a query to a stable key so "FOO", " foo " and "foo" all map to the
// same saved entry — building the list of aliases that resolve to a track.
function normalizeQuery(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, " ");
}

// Persists query → track mappings so a previously searched song can be resolved
// from the database (one indexed lookup) instead of hitting YouTube again.
export class TrackSearchCache {
  constructor(private readonly db: Database) {}

  async init(): Promise<void> {
    // Scoped per guild: the same query can resolve to different tracks (and have
    // its own play count) in different servers — hence the composite primary key.
    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS track_searches (
        guild_id   TEXT NOT NULL,
        query      TEXT NOT NULL,
        url        TEXT NOT NULL,
        title      TEXT NOT NULL,
        duration   INTEGER NOT NULL,
        hits       INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (guild_id, query)
      )
    `);
  }

  // Returns the cached track for a query in a guild (bumping its hit counter) or null.
  async find(guildId: string, query: string): Promise<CachedTrack | null> {
    const rows = await this.db.query<CachedTrack>(
      `UPDATE track_searches
          SET hits = hits + 1, updated_at = now()
        WHERE guild_id = $1 AND query = $2
        RETURNING title, url, duration`,
      [guildId, normalizeQuery(query)],
    );
    return rows[0] ?? null;
  }

  // Records the query as an alias for this track within a guild. Re-running a
  // known query keeps the row fresh (and corrects the target if it changed).
  async save(guildId: string, query: string, track: CachedTrack): Promise<void> {
    await this.db.execute(
      `INSERT INTO track_searches (guild_id, query, url, title, duration)
            VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (guild_id, query) DO UPDATE
            SET url = EXCLUDED.url,
                title = EXCLUDED.title,
                duration = EXCLUDED.duration,
                updated_at = now()`,
      [guildId, normalizeQuery(query), track.url, track.title, track.duration],
    );
  }

  // A guild's most played tracks, ranked by total hits across all of a song's
  // query aliases. SUM(hits) is bigint in Postgres, so cast it back to a number.
  async topPlayed(guildId: string, limit: number): Promise<TopTrack[]> {
    return this.db.query<TopTrack>(
      `SELECT url,
              MAX(title) AS title,
              MAX(duration) AS duration,
              SUM(hits)::int AS plays
         FROM track_searches
        WHERE guild_id = $1
        GROUP BY url
        ORDER BY plays DESC, MAX(updated_at) DESC
        LIMIT $2`,
      [guildId, limit],
    );
  }
}
