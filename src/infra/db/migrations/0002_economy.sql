-- economy: shared per-guild points ledger. Foundation for the leaderboard
-- (ranks by balance) and poll betting (stakes/payouts hit this same ledger).

-- Current balance per (guild, user). The leaderboard reads this directly; the
-- ledger below is the append-only audit trail that produces these numbers.
CREATE TABLE economy_balances (
  guild_id   TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  balance    BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (guild_id, user_id)
);
-- Leaderboard scan: top balances within a guild.
CREATE INDEX idx_economy_leaderboard ON economy_balances (guild_id, balance DESC);

-- Append-only ledger. Every balance change writes one signed row here, in the
-- same transaction, so the trail always reconciles with economy_balances.
-- `reason` is the source ('grant', 'poll_bet', 'poll_payout', …); `ref` is an
-- optional dedup/correlation key (e.g. a poll id) so settlement can be made
-- idempotent (won't double-pay on a retry).
CREATE TABLE economy_ledger (
  id         BIGSERIAL PRIMARY KEY,
  guild_id   TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  amount     BIGINT NOT NULL,
  reason     TEXT NOT NULL,
  ref        TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_economy_ledger_user ON economy_ledger (guild_id, user_id, created_at DESC);
