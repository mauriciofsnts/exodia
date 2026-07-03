import type { Redis } from "ioredis";
import { cached } from "@/infra/cache/cached";
import type { Logger } from "@/lib/logger";
import { EpicProvider } from "./epicProvider";
import { GamerPowerProvider } from "./gamerPowerProvider";
import type { FreeGame, FreeGameProvider, FreeGameStore } from "./types";

export const freeGameProviders: FreeGameProvider[] = [new EpicProvider(), new GamerPowerProvider()];

export const FREE_GAME_STORES: FreeGameStore[] = ["epic", "steam", "gog", "other"];

const CACHE_TTL = 900; // 15 minutes — restarts and command spam don't re-hit the APIs

// Every currently-free game across all providers, Redis-cached per provider.
// A provider failing is logged and skipped so one flaky API never blanks the
// others. Used by both the /freegames listing and the scheduler tick.
export async function fetchAllFreeGames(cache: Redis, logger: Logger): Promise<FreeGame[]> {
  const results = await Promise.all(
    freeGameProviders.map(async (provider) => {
      try {
        const games = await cached(cache, `cache:freegames:${provider.name}`, CACHE_TTL, () =>
          provider.fetchFreeGames(),
        );
        // Dates round-trip through JSON as strings — re-hydrate.
        return games.map((game) => ({
          ...game,
          endsAt: game.endsAt ? new Date(game.endsAt) : undefined,
        }));
      } catch (err) {
        logger.error({ err, provider: provider.name }, "Free games provider fetch failed");
        return [];
      }
    }),
  );
  return results.flat();
}
