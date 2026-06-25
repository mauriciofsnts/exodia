-- polls: per-guild polls with optional point staking. A poll with stake = 0 is a
-- plain opinion vote; with stake > 0 each voter bets that amount on their pick,
-- and an admin later resolves the winning option (winners split the pot via the
-- economy ledger). Voting closes at closes_at (if set) or when resolved.
CREATE TABLE polls (
  id             BIGSERIAL PRIMARY KEY,
  guild_id       TEXT NOT NULL,
  channel_id     TEXT,                          -- where the poll message lives (for editing on resolve)
  message_id     TEXT,                          -- set right after the message is sent
  question       TEXT NOT NULL,
  options        JSONB NOT NULL,                -- array of option labels
  stake          BIGINT NOT NULL DEFAULT 0,     -- coins each vote costs; 0 = plain poll
  closes_at      TIMESTAMPTZ,                   -- voting cutoff; NULL = open until resolved
  status         TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  winning_option INTEGER,                       -- 0-based index, set on resolve
  created_by     TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One vote per user per poll (PK). `stake` snapshots what the user paid, so the
-- pot/payout math is independent of later changes to the poll's stake.
CREATE TABLE poll_votes (
  poll_id    BIGINT NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL,
  choice     INTEGER NOT NULL,                  -- 0-based option index
  stake      BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (poll_id, user_id)
);
CREATE INDEX idx_poll_votes_poll ON poll_votes (poll_id);
