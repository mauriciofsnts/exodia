import { z } from "zod";
import "dotenv/config";

const schema = z.object({
  DISCORD_TOKEN: z.string().min(1),
  DISCORD_CLIENT_ID: z.string().min(1),
  DISCORD_GUILD_ID: z.string().optional(),
  PREFIX: z.string().default("!"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  REDIS_URL: z.string().url().default("redis://localhost:6379"),
  ADMIN_USER_ID: z.string().optional(),
  // How long the bot stays in an empty voice channel before disconnecting (ms).
  PLAYER_IDLE_TIMEOUT_MS: z.coerce.number().int().positive().default(300_000),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:\n", parsed.error.format());
  process.exit(1);
}

export const config = parsed.data;
export type Config = typeof config;
