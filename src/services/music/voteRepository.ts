import type { Database } from "@/core/database";

export type VoteType = "like" | "dislike" | "fav";

export interface VoteTarget {
  guildId: string;
  url: string;
}

// Maps emoji → vote, and the set of emojis the play card reacts with.
export const VOTE_EMOJIS: Record<string, VoteType> = {
  "👍": "like",
  "👎": "dislike",
  "⭐": "fav",
};

// Persists per-user reactions on play cards and the message→track mapping needed
// to resolve a reaction (which only carries a message id) back to a track.
export class VoteRepository {
  constructor(private readonly db: Database) {}

  // Marks a play-card message as votable, so reactions on it can be attributed.
  async registerMessage(messageId: string, guildId: string, url: string): Promise<void> {
    await this.db.execute(
      `INSERT INTO vote_messages (message_id, guild_id, url)
            VALUES ($1, $2, $3)
       ON CONFLICT (message_id) DO NOTHING`,
      [messageId, guildId, url],
    );
  }

  async lookupMessage(messageId: string): Promise<VoteTarget | null> {
    const rows = await this.db.query<{ guild_id: string; url: string }>(
      `SELECT guild_id, url FROM vote_messages WHERE message_id = $1`,
      [messageId],
    );
    const row = rows[0];
    return row ? { guildId: row.guild_id, url: row.url } : null;
  }

  async addVote(guildId: string, url: string, userId: string, vote: VoteType): Promise<void> {
    await this.db.execute(
      `INSERT INTO track_votes (guild_id, url, user_id, vote)
            VALUES ($1, $2, $3, $4)
       ON CONFLICT DO NOTHING`,
      [guildId, url, userId, vote],
    );
  }

  async removeVote(guildId: string, url: string, userId: string, vote: VoteType): Promise<void> {
    await this.db.execute(
      `DELETE FROM track_votes
        WHERE guild_id = $1 AND url = $2 AND user_id = $3 AND vote = $4`,
      [guildId, url, userId, vote],
    );
  }
}
