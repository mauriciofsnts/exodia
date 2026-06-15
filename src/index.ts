import { config } from "./config/index.js";
import { Bot } from "./core/bot.js";
import { I18n } from "./i18n/index.js";
import { logger } from "./lib/logger.js";
import { adminErrorNotifier } from "./middlewares/adminErrorNotifier.js";
import { commandCounter } from "./middlewares/commandCounter.js";
import { createCache } from "./services/cache/index.js";
import { createDatabase } from "./services/db/postgres.js";
import { TrackSearchCache } from "./services/music/searchCache.js";
import { PlayerManager } from "./services/player/playerManager.js";

async function main() {
  const cache = createCache(config, logger);
  await cache.connect();

  // Optional persistence: connect only when DATABASE_URL is configured,
  // otherwise the bot runs fine with db = null.
  const db = config.DATABASE_URL ? await createDatabase(config.DATABASE_URL, logger) : null;

  // The query→track cache only exists when persistence is enabled.
  let trackCache: TrackSearchCache | null = null;
  if (db) {
    trackCache = new TrackSearchCache(db);
    await trackCache.init();
  }

  const player = new PlayerManager(logger, config.PLAYER_IDLE_TIMEOUT_MS);
  const i18n = new I18n();

  const bot = new Bot(
    {
      config,
      logger,
      db,
      cache,
      player,
      i18n,
      trackCache,
    },
    [adminErrorNotifier, commandCounter],
  );

  await bot.start();
}

main().catch((err) => {
  logger.error({ err }, "Fatal error during startup");
  process.exit(1);
});
