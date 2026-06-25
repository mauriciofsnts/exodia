import type { Database } from "@/core/database";
import type { EconomyRepository } from "@/services/economy/economyRepository";

export type PollStatus = "open" | "resolved";

export interface Poll {
  id: number;
  guildId: string;
  channelId: string | null;
  messageId: string | null;
  question: string;
  options: string[];
  stake: number;
  closesAt: Date | null;
  status: PollStatus;
  winningOption: number | null;
  createdBy: string;
}

export interface PollTally {
  counts: number[]; // votes per option index
  pot: number; // total coins staked across all votes
  voters: number;
}

export interface NewPoll {
  guildId: string;
  channelId: string;
  question: string;
  options: string[];
  stake: number;
  closesAt: Date | null;
  createdBy: string;
}

// Result of a vote attempt — the handler turns each into the right user-facing message.
export type CastVoteResult = "ok" | "already_voted" | "insufficient" | "closed";

export interface ResolveOutcome {
  status: "ok" | "not_found" | "already_resolved" | "invalid_option";
  poll?: Poll;
  pot?: number;
  winnerCount?: number;
  refunded?: boolean; // pot returned to all bettors because nobody picked the winner
}

interface PollRow {
  id: string;
  guild_id: string;
  channel_id: string | null;
  message_id: string | null;
  question: string;
  options: string[];
  stake: string;
  closes_at: Date | null;
  status: PollStatus;
  winning_option: number | null;
  created_by: string;
}

function toPoll(row: PollRow): Poll {
  return {
    id: Number(row.id),
    guildId: row.guild_id,
    channelId: row.channel_id,
    messageId: row.message_id,
    question: row.question,
    options: row.options,
    stake: Number(row.stake),
    closesAt: row.closes_at,
    status: row.status,
    winningOption: row.winning_option,
    createdBy: row.created_by,
  };
}

// Thrown to unwind a vote transaction when the bettor can't afford the stake —
// rolls back the just-inserted vote row. Caught and mapped to "insufficient".
class InsufficientFunds extends Error {}

const POLL_COLUMNS = `id, guild_id, channel_id, message_id, question, options, stake,
                      closes_at, status, winning_option, created_by`;

// Persists polls and their votes, and settles betting polls against the shared
// economy ledger. Staking and payouts go through EconomyRepository's tx-scoped
// methods so coins and vote rows commit (or roll back) together.
export class PollRepository {
  constructor(
    private readonly db: Database,
    private readonly economy: EconomyRepository,
  ) {}

  async create(poll: NewPoll): Promise<number> {
    const rows = await this.db.query<{ id: string }>(
      `INSERT INTO polls (guild_id, channel_id, question, options, stake, closes_at, created_by)
            VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7)
       RETURNING id`,
      [
        poll.guildId,
        poll.channelId,
        poll.question,
        JSON.stringify(poll.options),
        poll.stake,
        poll.closesAt,
        poll.createdBy,
      ],
    );
    return Number(rows[0].id);
  }

  // Links the poll to the message that renders it, so resolve can edit it later.
  async attachMessage(id: number, channelId: string, messageId: string): Promise<void> {
    await this.db.execute(`UPDATE polls SET channel_id = $2, message_id = $3 WHERE id = $1`, [
      id,
      channelId,
      messageId,
    ]);
  }

  async get(id: number): Promise<Poll | null> {
    const rows = await this.db.query<PollRow>(`SELECT ${POLL_COLUMNS} FROM polls WHERE id = $1`, [
      id,
    ]);
    return rows[0] ? toPoll(rows[0]) : null;
  }

  async tally(id: number): Promise<PollTally> {
    const poll = await this.get(id);
    const optionCount = poll?.options.length ?? 0;
    const rows = await this.db.query<{ choice: number; stake: string }>(
      `SELECT choice, stake FROM poll_votes WHERE poll_id = $1`,
      [id],
    );
    const counts = new Array<number>(optionCount).fill(0);
    let pot = 0;
    for (const row of rows) {
      if (row.choice >= 0 && row.choice < optionCount) counts[row.choice]++;
      pot += Number(row.stake);
    }
    return { counts, pot, voters: rows.length };
  }

  // Records a user's vote and, on a staked poll, debits the stake — atomically.
  // Re-checks the poll inside the transaction so a vote can't slip in after the
  // poll is resolved or its deadline passes.
  async castVote(poll: Poll, userId: string, choice: number): Promise<CastVoteResult> {
    if (choice < 0 || choice >= poll.options.length) return "closed";
    try {
      return await this.db.transaction(async (tx) => {
        const cur = await tx.query<{ status: PollStatus; closes_at: Date | null }>(
          `SELECT status, closes_at FROM polls WHERE id = $1 FOR UPDATE`,
          [poll.id],
        );
        const row = cur[0];
        if (!row) return "closed";
        if (row.status !== "open") return "closed";
        if (row.closes_at && row.closes_at.getTime() <= Date.now()) return "closed";

        const inserted = await tx.query<{ ok: number }>(
          `INSERT INTO poll_votes (poll_id, user_id, choice, stake)
                VALUES ($1, $2, $3, $4)
           ON CONFLICT (poll_id, user_id) DO NOTHING
           RETURNING 1 AS ok`,
          [poll.id, userId, choice, poll.stake],
        );
        if (inserted.length === 0) return "already_voted";

        if (poll.stake > 0) {
          const paid = await this.economy.spendIn(
            tx,
            poll.guildId,
            userId,
            poll.stake,
            "poll_bet",
            `poll:${poll.id}`,
          );
          if (!paid) throw new InsufficientFunds(); // rolls back the vote insert
        }
        return "ok";
      });
    } catch (err) {
      if (err instanceof InsufficientFunds) return "insufficient";
      throw err;
    }
  }

  // Settles a poll: marks the winning option and pays the pot out to the bettors
  // who picked it (pro-rata to their own stake). If nobody backed the winner,
  // every bettor is refunded. Idempotent via the status guard + ledger ref, so a
  // double resolve can't double-pay.
  async resolve(guildId: string, id: number, winningOption: number): Promise<ResolveOutcome> {
    return this.db.transaction(async (tx) => {
      const pollRows = await tx.query<PollRow>(
        `SELECT ${POLL_COLUMNS} FROM polls WHERE id = $1 AND guild_id = $2 FOR UPDATE`,
        [id, guildId],
      );
      if (pollRows.length === 0) return { status: "not_found" } as const;
      const poll = toPoll(pollRows[0]);
      if (poll.status === "resolved") return { status: "already_resolved" } as const;
      if (winningOption < 0 || winningOption >= poll.options.length)
        return { status: "invalid_option" } as const;

      const votes = await tx.query<{ user_id: string; choice: number; stake: string }>(
        `SELECT user_id, choice, stake FROM poll_votes WHERE poll_id = $1`,
        [id],
      );

      const pot = votes.reduce((sum, v) => sum + Number(v.stake), 0);
      const winners = votes
        .filter((v) => v.choice === winningOption)
        .map((v) => ({ userId: v.user_id, stake: Number(v.stake) }));
      const ref = `poll:${id}:payout`;
      let refunded = false;

      if (pot > 0) {
        const winnerStake = winners.reduce((sum, w) => sum + w.stake, 0);
        if (winnerStake === 0) {
          // Nobody picked the winning option — return each bettor's own stake.
          refunded = true;
          for (const v of votes) {
            const stake = Number(v.stake);
            if (stake > 0)
              await this.economy.creditIn(tx, guildId, v.user_id, stake, "poll_refund", ref);
          }
        } else {
          for (const [userId, payout] of splitPot(pot, winners)) {
            if (payout > 0)
              await this.economy.creditIn(tx, guildId, userId, payout, "poll_payout", ref);
          }
        }
      }

      await tx.execute(`UPDATE polls SET status = 'resolved', winning_option = $2 WHERE id = $1`, [
        id,
        winningOption,
      ]);

      return {
        status: "ok",
        poll: { ...poll, status: "resolved", winningOption },
        pot,
        winnerCount: winners.length,
        refunded,
      } as const;
    });
  }
}

// Splits an integer pot across winners proportionally to their stake. Floor each
// share, then hand the leftover coins (from rounding) to the largest stakes first
// so the whole pot is always distributed and nothing is lost to rounding.
function splitPot(pot: number, winners: { userId: string; stake: number }[]): Map<string, number> {
  const total = winners.reduce((sum, w) => sum + w.stake, 0);
  const payouts = new Map<string, number>();
  let distributed = 0;
  for (const w of winners) {
    const share = Math.floor((pot * w.stake) / total);
    payouts.set(w.userId, share);
    distributed += share;
  }
  let remainder = pot - distributed;
  for (const w of [...winners].sort((a, b) => b.stake - a.stake)) {
    if (remainder <= 0) break;
    payouts.set(w.userId, (payouts.get(w.userId) ?? 0) + 1);
    remainder--;
  }
  return payouts;
}
