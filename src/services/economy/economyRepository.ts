import type { Database } from "@/core/database";

export interface LeaderboardEntry {
  userId: string;
  balance: number;
}

// Shared per-guild points economy. Every balance change writes the new balance
// and an append-only economy_ledger row in the same transaction, so the ledger
// always reconciles with the balances table. The leaderboard reads balances
// directly; poll betting spends/awards through the `*In` methods below so the
// coin movement and the vote row commit (or roll back) together.
export class EconomyRepository {
  constructor(private readonly db: Database) {}

  async getBalance(guildId: string, userId: string): Promise<number> {
    const rows = await this.db.query<{ balance: string }>(
      `SELECT balance FROM economy_balances WHERE guild_id = $1 AND user_id = $2`,
      [guildId, userId],
    );
    // BIGINT comes back as a string from node-postgres; balances stay well within
    // JS safe-integer range, so Number() is fine here.
    return rows[0] ? Number(rows[0].balance) : 0;
  }

  // Unconditional signed delta + ledger row, in its own transaction. Returns the
  // resulting balance. Used by admin grants (the only standalone writer).
  async adjust(
    guildId: string,
    userId: string,
    amount: number,
    reason: string,
    ref: string | null = null,
  ): Promise<number> {
    return this.db.transaction((tx) => this.applyDelta(tx, guildId, userId, amount, reason, ref));
  }

  // Credit within a caller-supplied transaction (poll payouts/refunds). amount > 0.
  creditIn(
    tx: Database,
    guildId: string,
    userId: string,
    amount: number,
    reason: string,
    ref: string | null,
  ): Promise<number> {
    return this.applyDelta(tx, guildId, userId, amount, reason, ref);
  }

  // Debit within a caller-supplied transaction, only if the balance covers it.
  // Returns true when charged, false when the user can't afford `amount` (so the
  // caller can roll the surrounding work back). The conditional UPDATE makes the
  // check-and-spend atomic — no balance can go negative, even under concurrent bets.
  async spendIn(
    tx: Database,
    guildId: string,
    userId: string,
    amount: number,
    reason: string,
    ref: string | null,
  ): Promise<boolean> {
    const rows = await tx.query<{ balance: string }>(
      `UPDATE economy_balances SET balance = balance - $3, updated_at = now()
        WHERE guild_id = $1 AND user_id = $2 AND balance >= $3
        RETURNING balance`,
      [guildId, userId, amount],
    );
    if (rows.length === 0) return false;
    await tx.execute(
      `INSERT INTO economy_ledger (guild_id, user_id, amount, reason, ref)
            VALUES ($1, $2, $3, $4, $5)`,
      [guildId, userId, -amount, reason, ref],
    );
    return true;
  }

  async leaderboard(guildId: string, limit: number): Promise<LeaderboardEntry[]> {
    const rows = await this.db.query<{ user_id: string; balance: string }>(
      `SELECT user_id, balance
         FROM economy_balances
        WHERE guild_id = $1 AND balance <> 0
        ORDER BY balance DESC
        LIMIT $2`,
      [guildId, limit],
    );
    return rows.map((row) => ({ userId: row.user_id, balance: Number(row.balance) }));
  }

  // Shared writer: upsert the balance and append the ledger row. Runs against
  // whatever Database it's given — the bot's pool (via adjust) or an open tx.
  private async applyDelta(
    db: Database,
    guildId: string,
    userId: string,
    amount: number,
    reason: string,
    ref: string | null,
  ): Promise<number> {
    const rows = await db.query<{ balance: string }>(
      `INSERT INTO economy_balances (guild_id, user_id, balance, updated_at)
            VALUES ($1, $2, $3, now())
       ON CONFLICT (guild_id, user_id)
         DO UPDATE SET balance = economy_balances.balance + $3, updated_at = now()
       RETURNING balance`,
      [guildId, userId, amount],
    );
    await db.execute(
      `INSERT INTO economy_ledger (guild_id, user_id, amount, reason, ref)
            VALUES ($1, $2, $3, $4, $5)`,
      [guildId, userId, amount, reason, ref],
    );
    return Number(rows[0].balance);
  }
}
