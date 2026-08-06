import { config } from "./config/index";
import { Bot } from "./core/bot";
import { I18n } from "./i18n/index";
import { createCache } from "./infra/cache/index";
import { createDatabase } from "./infra/db/postgres";
import { logger } from "./lib/logger";
import { adminErrorNotifier } from "./middlewares/adminErrorNotifier";
import { commandCounter } from "./middlewares/commandCounter";
import { GuildConfigService } from "./services/guild/guildConfig";
import { createPersistence } from "./services/persistence";
import { PlayerManager } from "./services/player/playerManager";
import { createAudioProvider } from "./services/player/provider";
import { FootballDataProvider } from "./services/sports/provider/footballDataProvider";
import { TheSportsDbProvider } from "./services/sports/provider/theSportsDbProvider";
import { SportsImporter } from "./services/sports/sportsImporter";

async function main() {
  const cache = createCache(config, logger);
  await cache.connect();

  // Optional persistence: connect only when DATABASE_URL is configured,
  // otherwise the bot runs fine without it (db = null, services = null).
  const db = config.DATABASE_URL ? await createDatabase(config.DATABASE_URL, logger) : null;
  const { trackCache, votes, events, commandSync, economy, polls, freeGames } =
    await createPersistence(db, logger);

  const player = new PlayerManager(logger, config, createAudioProvider(config, logger));
  const i18n = new I18n();
  const guildConfig = new GuildConfigService(cache, config.PREFIX);

  // Preferred source for football leagues (see leagues/football.ts) — unset
  // FOOTBALL_DATA_API_KEY falls back to TheSportsDB for every sport, as before.
  const footballData = config.FOOTBALL_DATA_API_KEY
    ? new FootballDataProvider(config.FOOTBALL_DATA_API_KEY)
    : null;

  // Shared by the scheduled import job and the /sportsub wizard (immediate
  // import on subscribe). Needs persistence — null when the db is off.
  const sportsImporter = events
    ? new SportsImporter(
        guildConfig,
        events,
        new TheSportsDbProvider(config.SPORTSDB_API_KEY),
        footballData,
        cache,
        logger,
      )
    : null;

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
      sportsImporter,
      commandSync,
      economy,
      polls,
      freeGames,
    },
    [adminErrorNotifier, commandCounter],
  );

  await bot.start();
}

main().catch((err) => {
  logger.error({ err }, "Fatal error during startup");
  process.exit(1);
});
