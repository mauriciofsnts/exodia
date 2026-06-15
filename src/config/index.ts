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
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:\n", parsed.error.format());
  process.exit(1);
}

export const config = parsed.data;
export type Config = typeof config;
