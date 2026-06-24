import { config } from "./config/index";
import { Bot } from "./core/bot";
import { I18n } from "./i18n/index";
import { logger } from "./lib/logger";
import { adminErrorNotifier } from "./middlewares/adminErrorNotifier";
import { commandCounter } from "./middlewares/commandCounter";
import { createCache } from "./services/cache/index";
import { createDatabase } from "./services/db/postgres";
import { GuildConfigService } from "./services/guild/guildConfig";
import { createPersistence } from "./services/persistence";
import { PlayerManager } from "./services/player/playerManager";

async function main() {
  const cache = createCache(config, logger);
  await cache.connect();

  // Optional persistence: connect only when DATABASE_URL is configured,
  // otherwise the bot runs fine without it (db = null, services = null).
  const db = config.DATABASE_URL ? await createDatabase(config.DATABASE_URL, logger) : null;
  const { trackCache, votes, events, commandSync } = await createPersistence(db, logger);

  const player = new PlayerManager(logger, config);
  const i18n = new I18n();
  const guildConfig = new GuildConfigService(cache, config.PREFIX);

  const bot = new Bot(
    {
      config,
      logger,
      db,
      cache,
      player,
      i18n,
      guildConfig,
      trackCache,
      votes,
      events,
      commandSync,
    },
    [adminErrorNotifier, commandCounter],
  );

  await bot.start();
}

main().catch((err) => {
  logger.error({ err }, "Fatal error during startup");
  process.exit(1);
});
