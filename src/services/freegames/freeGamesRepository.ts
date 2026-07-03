import type { Database } from "@/core/database";
import type { FreeGame, FreeGameStore } from "./types";

// A catalog row: the normalized offer plus its database id, which is what
// free_game_posts references.
export type StoredFreeGame = FreeGame & { id: string };

interface FreeGameRow {
  id: string;
  provider: string;
  external_id: string;
  store: FreeGameStore;
  title: string;
  url: string;
  original_price: string | null;
  image_url: string | null;
  description: string | null;
  ends_at: Date | null;
}

// Shared column list so every SELECT returns a complete FreeGameRow.
const COLUMNS =
  "id, provider, external_id, store, title, url, original_price, image_url, description, ends_at";

function toFreeGame(row: FreeGameRow): StoredFreeGame {
  return {
    id: row.id,
    provider: row.provider,
    externalId: row.external_id,
    store: row.store,
    title: row.title,
    url: row.url,
    originalPrice: row.original_price ?? undefined,
    imageUrl: row.image_url ?? undefined,
    description: row.description ?? undefined,
    endsAt: row.ends_at ?? undefined,
  };
}

// Expired offers linger briefly so a late tick can't re-insert them as "new";
// never-expiring giveaways age out on first_seen so a deleted row can't come
// back and re-post (45 days outlives virtually all giveaways).
const EXPIRED_RETENTION = "3 days";
const ENDLESS_RETENTION = "45 days";

// Global free-game catalog + per-guild posted tracking. The scheduler upserts
// what providers report, then fans out to guilds: unpostedActive → post →
// markPosted, mirroring EventRepository's due/mark idempotency pairs.
export class FreeGamesRepository {
  constructor(private readonly db: Database) {}

  // Insert or refresh an offer — Epic sometimes fills in end dates and images
  // after the offer first appears.
  async upsert(game: FreeGame): Promise<void> {
    await this.db.execute(
      `INSERT INTO free_games (provider, external_id, store, title, url, original_price, image_url, description, ends_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (provider, external_id)
       DO UPDATE SET title = EXCLUDED.title,
                     url = EXCLUDED.url,
                     original_price = EXCLUDED.original_price,
                     image_url = EXCLUDED.image_url,
                     description = EXCLUDED.description,
                     ends_at = EXCLUDED.ends_at`,
      [
        game.provider,
        game.externalId,
        game.store,
        game.title,
        game.url,
        game.originalPrice ?? null,
        game.imageUrl ?? null,
        game.description ?? null,
        game.endsAt ?? null,
      ],
    );
  }

  // Still-active offers in the given stores that this guild hasn't been
  // notified about yet, oldest first.
  async unpostedActive(guildId: string, stores: FreeGameStore[]): Promise<StoredFreeGame[]> {
    const rows = await this.db.query<FreeGameRow>(
      `SELECT ${COLUMNS}
         FROM free_games
        WHERE (ends_at IS NULL OR ends_at > now())
          AND store = ANY($2)
          AND NOT EXISTS (
            SELECT 1 FROM free_game_posts p
             WHERE p.guild_id = $1 AND p.free_game_id = free_games.id
          )
        ORDER BY first_seen ASC`,
      [guildId, stores],
    );
    return rows.map(toFreeGame);
  }

  async markPosted(guildId: string, freeGameId: string): Promise<void> {
    await this.db.execute(
      `INSERT INTO free_game_posts (guild_id, free_game_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [guildId, freeGameId],
    );
  }

  // Data aging — post rows go with the catalog rows (ON DELETE CASCADE).
  // Returns how many offers were removed (for logging).
  async deleteStale(): Promise<number> {
    const rows = await this.db.query<{ count: number }>(
      `WITH deleted AS (
         DELETE FROM free_games
          WHERE (ends_at IS NOT NULL AND ends_at < now() - interval '${EXPIRED_RETENTION}')
             OR (ends_at IS NULL AND first_seen < now() - interval '${ENDLESS_RETENTION}')
          RETURNING 1
       )
       SELECT count(*)::int AS count FROM deleted`,
    );
    return rows[0]?.count ?? 0;
  }
}
