-- Fixture enrichment: provider details (team badges, competition, venue,
-- thumbnail) captured at import time so announcements render a rich card
-- without another provider round trip. NULL for manually-added events.
ALTER TABLE guild_events ADD COLUMN details JSONB;

-- Event follows: users opt in per event (button/select) and get an @mention on
-- the advance reminder and the "starting now" announcement. Rows die with their
-- event (CASCADE), so the stale-event pruner cleans these up for free.
CREATE TABLE guild_event_followers (
  event_id   BIGINT NOT NULL REFERENCES guild_events(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, user_id)
);
