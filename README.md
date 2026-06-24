# exodia

A Discord bot (discord.js v14) with music playback (Lavalink/Shoukaku), URL
shortening, sports fixtures, scheduled events, and a small typed command
framework. TypeScript is run directly with `tsx` — there's no build step.

## Requirements

- Node.js 22+ and [pnpm](https://pnpm.io)
- Redis (guild config, stats, cooldowns, external-response cache)
- A [Lavalink](https://lavalink.dev) server for music playback
- Postgres (optional — enables persistence; the bot runs without it)

## Getting started

```bash
pnpm install
cp .env.example .env     # then fill in the required values
pnpm dev                 # run in watch mode
pnpm deploy              # register slash commands with Discord
```

| Script | Purpose |
| --- | --- |
| `pnpm dev` | run in watch mode (tsx) |
| `pnpm start` | run in production (tsx) |
| `pnpm deploy` | register slash commands with the Discord API |
| `pnpm check` | format + lint + organize imports (Biome, auto-fix) |
| `pnpm exec tsc --noEmit` | type-check |

## Configuration (environment variables)

All configuration comes from environment variables. They are validated **once at
startup** by a single [zod](https://zod.dev) schema in
[`src/config/index.ts`](src/config/index.ts); the parsed, typed result is exposed
as `config` and reaches every command/service through `BotContext.config` — code
never reads `process.env` directly. If a required variable is missing or has the
wrong type, the bot logs the validation error and exits immediately.

`.env.example` is the source of truth for the full list (with inline notes); a
local `.env` is loaded automatically via `dotenv`.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `DISCORD_TOKEN` | yes | — | Bot token |
| `DISCORD_CLIENT_ID` | yes | — | Application (client) ID |
| `DISCORD_GUILD_ID` | no | — | Deploy slash commands to a single guild in dev (instant) |
| `PREFIX` | no | `!` | Default global prefix (overridable per-guild) |
| `LOG_LEVEL` | no | `info` | `debug` \| `info` \| `warn` \| `error` |
| `REDIS_URL` | no | `redis://localhost:6379` | Redis connection |
| `DATABASE_URL` | no | — | Postgres URL; empty = run without persistence |
| `ADMIN_USER_ID` | no | — | Discord user ID that gets a DM on unexpected errors |
| `PLAYER_IDLE_TIMEOUT_MS` | no | `300000` | Ms before leaving an empty voice channel |
| `LAVALINK_HOST` | no | `localhost` | Lavalink host |
| `LAVALINK_PORT` | no | `2333` | Lavalink port |
| `LAVALINK_PASSWORD` | no | `youshallnotpass` | Must match Lavalink's `server.password` |
| `LAVALINK_SECURE` | no | `false` | `true` if Lavalink is behind TLS |
| `SHORTENER_ENDPOINT` | no | TinyURL | GET shortener with a `{url}` placeholder, or the Shurl POST endpoint when `SHORTENER_API_KEY` is set |
| `SHORTENER_API_KEY` | no | — | When set, use the [Shurl](https://github.com/pauloo27/shurl) provider (JSON/POST) against `SHORTENER_ENDPOINT` |
| `SPORTSDB_API_KEY` | no | `3` | TheSportsDB key; public test key `3` works |

### Adding a new variable

1. Add a field to the zod schema in `src/config/index.ts` (use `.optional()` /
   `.default(...)`, and `z.coerce`/`preprocess` for non-string types).
2. Document it in `.env.example`.
3. If it ships to production, add it to the k8s Deployment env in
   `.infra/manifests/exodia/deployment.yaml`.
4. Read it via `ctx.bot.config.MY_VAR`.

## Project layout

See [CLAUDE.md](CLAUDE.md) for an architecture overview (core framework,
commands, services, the command lifecycle, and how to add commands/middlewares).
