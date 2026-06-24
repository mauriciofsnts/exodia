-- Baseline schema, consolidated from the per-repository init() methods. Written
-- idempotently (IF NOT EXISTS / DROP ... IF EXISTS) so it is a safe no-op on
-- databases created by the old inline DDL, and creates everything from scratch
-- on a fresh database. Later migrations need not be idempotent.

-- music: query -> track cache (TrackSearchCache). Scoped per guild — the same
-- query can resolve to different tracks (and its own hit count) per server.
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
);

-- music: play-card votes (VoteRepository). One row per (guild, track, user, vote):
-- reactions are independent toggles, so a user may both like and fav one track.
CREATE TABLE IF NOT EXISTS track_votes (
  guild_id   TEXT NOT NULL,
  url        TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  vote       TEXT NOT NULL CHECK (vote IN ('like', 'dislike', 'fav')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (guild_id, url, user_id, vote)
);

-- music: maps a play-card message back to its track, so a reaction (which only
-- carries a message id) can be attributed to a vote target.
CREATE TABLE IF NOT EXISTS vote_messages (
  message_id TEXT PRIMARY KEY,
  guild_id   TEXT NOT NULL,
  url        TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- events: per-guild scheduled events (EventRepository). source/external_id
-- identify auto-imported sports fixtures so re-imports never duplicate.
CREATE TABLE IF NOT EXISTS guild_events (
  id               BIGSERIAL PRIMARY KEY,
  guild_id         TEXT NOT NULL,
  name             TEXT NOT NULL,
  start_at         TIMESTAMPTZ NOT NULL,
  discord_event_id TEXT,
  announced        BOOLEAN NOT NULL DEFAULT FALSE,
  source           TEXT,
  external_id      TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Pre-migrations DBs may carry an older dedup index — drop before recreating.
DROP INDEX IF EXISTS idx_guild_events_dedup;
-- Not partial: ON CONFLICT can only target an index whose predicate it repeats
-- verbatim, and Postgres treats NULLs as distinct, so manually-added events
-- (both columns NULL) never collide with each other.
CREATE UNIQUE INDEX IF NOT EXISTS idx_guild_events_dedup
  ON guild_events (guild_id, source, external_id);
CREATE INDEX IF NOT EXISTS idx_guild_events_guild_start
  ON guild_events (guild_id, start_at);
-- The scheduler scans these every minute — partial indexes keep them tiny by
-- covering only the rows still pending work.
CREATE INDEX IF NOT EXISTS idx_guild_events_pending_discord
  ON guild_events (start_at) WHERE discord_event_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_guild_events_unannounced
  ON guild_events (start_at) WHERE announced = FALSE;

-- command sync: per-scope registered slash-command signatures (CommandSyncRepository).
CREATE TABLE IF NOT EXISTS command_signatures (
  scope        TEXT NOT NULL,
  command_name TEXT NOT NULL,
  signature    TEXT NOT NULL,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (scope, command_name)
);
-- Legacy count-based table — superseded by per-command signatures above.
DROP TABLE IF EXISTS command_sync;
