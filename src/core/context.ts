import type { Client } from "discord.js";
import type { Redis } from "ioredis";
import type { Config } from "@/config/index.js";
import type { I18n } from "@/i18n/index.js";
import type { Logger } from "@/lib/logger.js";
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
}
