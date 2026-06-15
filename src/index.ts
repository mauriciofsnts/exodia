import { config } from "./config/index.js";
import { Bot } from "./core/bot.js";
import { I18n } from "./i18n/index.js";
import { logger } from "./lib/logger.js";
import { adminErrorNotifier } from "./middlewares/adminErrorNotifier.js";
import { commandCounter } from "./middlewares/commandCounter.js";
import { createCache } from "./services/cache/index.js";
import { PlayerManager } from "./services/player/playerManager.js";

async function main() {
  const cache = createCache(config, logger);
  await cache.connect();

  const player = new PlayerManager(logger, config.PLAYER_IDLE_TIMEOUT_MS);
  const i18n = new I18n();

  const bot = new Bot(
    {
      config,
      logger,
      db: null, // plug in a Database implementation here when needed
      cache,
      player,
      i18n,
    },
    [adminErrorNotifier, commandCounter],
  );

  await bot.start();
}

main().catch((err) => {
  logger.error({ err }, "Fatal error during startup");
  process.exit(1);
});
