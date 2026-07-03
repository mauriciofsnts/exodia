-- Free games notifications: a global catalog of currently-free offers (one row
-- per provider offer, shared by all guilds) plus per-guild posted tracking so
-- each guild is notified about an offer at most once.

CREATE TABLE free_games (
  id             BIGSERIAL PRIMARY KEY,
  provider       TEXT NOT NULL,
  external_id    TEXT NOT NULL,
  store          TEXT NOT NULL,
  title          TEXT NOT NULL,
  url            TEXT NOT NULL,
  original_price TEXT,
  image_url      TEXT,
  description    TEXT,
  ends_at        TIMESTAMPTZ,
  first_seen     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_free_games_dedup ON free_games (provider, external_id);

-- A row means this guild was (or is being) notified about the offer —
-- mark-after-send, like guild_events.announced. Rows die with the catalog row.
CREATE TABLE free_game_posts (
  guild_id     TEXT NOT NULL,
  free_game_id BIGINT NOT NULL REFERENCES free_games(id) ON DELETE CASCADE,
  posted_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (guild_id, free_game_id)
);
