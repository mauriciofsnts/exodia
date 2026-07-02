-- Advance heads-up for scheduled events: a second announcement fired a fixed
-- lead time before start, separate from the existing "starting now" ping.
-- `reminded` tracks whether that heads-up has already gone out (mirrors the
-- `announced` flag used for the start ping) so it fires at most once.
ALTER TABLE guild_events ADD COLUMN IF NOT EXISTS reminded BOOLEAN NOT NULL DEFAULT FALSE;

-- The scheduler scans for un-reminded upcoming events every minute — partial
-- index keeps that scan tiny, like idx_guild_events_unannounced.
CREATE INDEX IF NOT EXISTS idx_guild_events_unreminded
  ON guild_events (start_at) WHERE reminded = FALSE;
