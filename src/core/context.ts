import type { Client } from "discord.js";
import type { Redis } from "ioredis";
import type { Config } from "@/config/index.js";
import type { I18n } from "@/i18n/index.js";
import type { Logger } from "@/lib/logger.js";
import type { TrackSearchCache } from "@/services/music/searchCache.js";
import type { VoteRepository } from "@/services/music/voteRepository.js";
import type { PlayerManager } from "@/services/player/playerManager.js";
import type { Database } from "./database.js";

export interface BotContext {
  client: Client;
  config: Config;
  logger: Logger;
  db: Database | null;
  cache: Redis;
  player: PlayerManager;
  i18n: I18n;
  trackCache: TrackSearchCache | null; // query→track persistence; null when db is off
  votes: VoteRepository | null; // play-card reaction votes; null when db is off
}
