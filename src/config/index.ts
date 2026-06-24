import { z } from "zod";
import "dotenv/config";

const schema = z.object({
  DISCORD_TOKEN: z.string().min(1),
  DISCORD_CLIENT_ID: z.string().min(1),
  DISCORD_GUILD_ID: z.string().optional(),
  PREFIX: z.string().default("!"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  REDIS_URL: z.string().url().default("redis://localhost:6379"),
  // Optional: when set, a Postgres-backed Database is wired into BotContext.
  // Leave unset (or empty) to run without persistence (db stays null).
  // Empty string is coerced to undefined so `DATABASE_URL=` in .env is treated as off.
  DATABASE_URL: z.preprocess((v) => (v === "" ? undefined : v), z.string().url().optional()),
  ADMIN_USER_ID: z.string().optional(),
  // How long the bot stays in an empty voice channel before disconnecting (ms).
  PLAYER_IDLE_TIMEOUT_MS: z.coerce.number().int().positive().default(300_000),
  // Optional URL shortener endpoint. Without SHORTENER_API_KEY it's treated as a
  // GET template with a `{url}` placeholder (defaults to TinyURL when unset). With
  // SHORTENER_API_KEY set, it's the Shurl POST endpoint instead.
  SHORTENER_ENDPOINT: z.string().optional(),
  // Optional: when set, the shortener uses the Shurl provider (JSON/POST, API key
  // auth) pointed at SHORTENER_ENDPOINT instead of the GET-based provider.
  SHORTENER_API_KEY: z.string().optional(),
  // TheSportsDB API key — the public test key "3" works for upcoming fixtures.
  SPORTSDB_API_KEY: z.string().default("3"),
  // Lavalink connection. Audio resolution + streaming is delegated to a Lavalink
  // server (with the youtube-source plugin), which sidesteps the datacenter-IP
  // "Sign in to confirm you're not a bot" block that yt-dlp hits from k8s.
  LAVALINK_HOST: z.string().default("localhost"),
  LAVALINK_PORT: z.coerce.number().int().positive().default(2333),
  LAVALINK_PASSWORD: z.string().default("youshallnotpass"),
  // NOTE: z.coerce.boolean() is a footgun — Boolean("false") === true. Parse the
  // literal string instead so only "true"/"1" enable TLS.
  LAVALINK_SECURE: z
    .preprocess((v) => (typeof v === "string" ? v === "true" || v === "1" : v), z.boolean())
    .default(false),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:\n", parsed.error.format());
  process.exit(1);
}

export const config = parsed.data;
export type Config = typeof config;
