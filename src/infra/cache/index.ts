import { Redis } from "ioredis";
import type { Config } from "@/config/index";
import type { Logger } from "@/lib/logger";

export function createCache(config: Config, logger: Logger): Redis {
  const client = new Redis(config.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 3,
  });

  client.on("connect", () => logger.info("Redis connected"));
  client.on("error", (err) => logger.error({ err }, "Redis error"));

  return client;
}
