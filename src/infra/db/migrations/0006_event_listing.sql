-- Follow-only subscriptions: newly imported fixtures are batched into a digest
-- post (list + follow select) instead of being announced individually. `listed`
-- tracks whether a fixture has been through that digest pass, so it fires at
-- most once per fixture. Added as TRUE so fixtures imported before this feature
-- don't all get digested at once, then future inserts default to FALSE.
ALTER TABLE guild_events ADD COLUMN listed BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE guild_events ALTER COLUMN listed SET DEFAULT FALSE;

-- The scheduler scans for unlisted fixtures every minute — partial index keeps
-- that scan tiny, like idx_guild_events_unannounced.
CREATE INDEX idx_guild_events_unlisted
  ON guild_events (start_at) WHERE listed = FALSE;
