# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev          # run bot in watch mode (tsx)
pnpm start        # run bot in production (tsx)
pnpm deploy       # register slash commands with Discord API
pnpm check        # format + lint + organize imports (Biome, auto-fix)
pnpm format       # format only
pnpm lint         # lint only
pnpm exec tsc --noEmit  # type-check without emitting
```

No test suite yet. No build step — `tsx` runs TypeScript directly.

## Formatting

Biome (`biome.json`) handles formatting, linting, and import organization. Run `pnpm check` before committing. Config: 2-space indent, 100-char line width, `node:` protocol enforced for Node built-ins. The `noExplicitAny` rule is set to `warn` (not error) — `any` is used intentionally in `commandBuilder.ts` for type erasure in the middleware/handler pipeline.

## File naming

All files use **camelCase with a lowercase first letter** (e.g. `commandBuilder.ts`, `playerManager.ts`). This applies to every file under `src/` and `scripts/`. Directories use lowercase kebab-case.

## Architecture

The bot is built around four layers: **core framework** (`src/core/`), **commands** (`src/commands/`), **domain services** (`src/services/`), and **infrastructure** (`src/infra/`). `src/infra/` holds the pure technical adapters — the Redis cache (`src/infra/cache/`) and the Postgres database + migrations (`src/infra/db/`); `src/services/` holds only domain features (music, sports, news, events, …). Keep this split: nothing under `src/infra/` should know about a specific feature.

### Command lifecycle

1. `src/index.ts` builds `BotContext` and passes it (with optional global middlewares) to `Bot`
2. `Bot` creates the Discord `Client` and delegates command loading to `CommandLoader`
3. `CommandLoader.load()` auto-discovers all files under `src/commands/` — every file with a default export matching `CommandDefinition` is registered automatically
4. On each invocation: `CommandLoader` builds typed args → runs `global middlewares → per-command middlewares → execute handler`

### CommandBuilder (`src/core/commandBuilder.ts`)

The core abstraction. Generic over `TOptions extends OptionDef[]` — each `.addOption()` call appends to the type tuple, so `args` in `.execute()` is statically typed without casts.

Key types:
- `TypedArgs<TOptions>` — maps each option name to its TS type (`string`, `number`, `boolean`, or `T | null` when `required` is absent)
- `CommandExecutionContext<TOptions>` — passed to every handler; contains `bot` (full `BotContext`), `args`, `raw` (prefix tokens), `reply`, `interaction`, `message`
- `Middleware` — `(ctx, next) => Promise<void>`, compose pattern (global-first, then per-command)

`const O extends OptionDef` in `addOption` forces literal type inference so `required: true` is preserved as `true`, not widened to `boolean`.

### BotContext (`src/core/context.ts`)

Passed to every command handler via `ctx.bot`. Contains:
- `client` — discord.js `Client`
- `config` — validated env vars (zod schema in `src/config/index.ts`)
- `logger` — pino instance
- `db` — `Database | null` (pluggable interface in `src/core/database.ts`)
- `cache` — ioredis client
- `player` — `PlayerManager` (one queue per guild)

### Configuration & environment variables (`src/config/index.ts`)

All runtime configuration comes from environment variables, validated **once at startup** by a single zod schema in `src/config/index.ts`. The parsed result is exported as `config` (and its inferred type `Config`); `BotContext.config` is this object, so every command/service reads typed, validated values — never `process.env` directly. Invalid env (missing required vars, bad types) fails fast: the schema logs the formatted error and calls `process.exit(1)`. `dotenv/config` is imported here, so a local `.env` is loaded automatically.

To add a new env var:

1. Add a field to the zod schema in `src/config/index.ts` with a comment. Use `.optional()` for optional values, `.default(...)` for defaults, and `z.coerce.number()` / a `preprocess` for non-string types (note: `z.coerce.boolean()` is a footgun — `Boolean("false") === true` — parse the literal string instead, as `LAVALINK_SECURE` does).
2. Document it in **`.env.example`** (the source of truth for available vars, with an inline comment).
3. If it must ship to production, also add it to the k8s Deployment env in `.infra/manifests/exodia/deployment.yaml` (note: optional vars aren't all mirrored there).
4. Read it via `ctx.bot.config.MY_VAR` — never `process.env`.

### Database interface (`src/core/database.ts`)

Intentionally thin: `query`, `execute`, `transaction`, `close`. The Postgres implementation lives in `src/infra/db/postgres.ts`; `src/index.ts` constructs it only when `DATABASE_URL` is set (otherwise `db` is `null` and the bot runs without persistence). Schema is managed by versioned SQL files under `src/infra/db/migrations/`, applied once at startup by `runMigrations` (`src/infra/db/migrate.ts`) — add a new `NNNN_description.sql` file to evolve it; repositories no longer create their own tables.

### PlayerManager (`src/services/player/playerManager.ts`)

Manages one `GuildPlayer` per guild (Shoukaku voice player + `Queue`). Audio resolution and streaming are delegated to a **Lavalink** server (via [Shoukaku](https://github.com/shipgirlproject/Shoukaku)) with the youtube-source plugin — this avoids the datacenter-IP "Sign in to confirm you're not a bot" block that direct yt-dlp extraction hits. `PlayerManager.connect(client)` (called from `Bot.start()` before login) builds the Shoukaku client from the `LAVALINK_*` env vars. Search (`search`/`searchMany`) goes through Lavalink's REST `loadtracks`; only `youtubeSuggest` (autocomplete) still uses a plain HTTP call. The queue advances on the Shoukaku player's `end`/`stuck` events. Lavalink deployment manifests for k3s live in `deploy/lavalink/`.

### Adding a command

Create a file anywhere under `src/commands/` — it will be auto-discovered:

```typescript
export default createCommand()
  .setName('name')
  .setDescription('...')
  .setPrefix('name')          // optional: also respond to !name
  .addOption({ name: 'x', description: '...', type: ApplicationCommandOptionType.String, required: true })
  .use(myPerCommandMiddleware) // optional
  .execute(async ({ bot, args, reply }) => {
    args.x // string — no cast needed
  })
  .build();
```

After adding slash commands, run `pnpm deploy` to register them with Discord.

### Keep `/help` in sync

The `/help` command (`src/commands/general/help.ts`) is generated from the loaded command definitions — name, description, prefix, and options. So renaming a command, changing its description, or adding/removing/renaming options changes the help output automatically; no manual edit is needed there. **But** when a command changes, check whether anything `/help` (or other commands) relies on still lines up — in particular:

- If a command's behavior changes, update its `.setDescription(...)` so the help listing stays accurate.
- If you add/remove options, confirm the usage line and option list `/help <command>` renders still make sense.
- If the change touches user-facing copy, update **both** locale files (`src/i18n/locales/en-US.ts` and `pt-BR.ts`) — they must stay structurally identical (en-US is the type source of truth; a missing key is a type error).

### Adding a global middleware

Create a function matching `Middleware` and add it to the array in `src/index.ts`:

```typescript
new Bot({ ...ctx }, [commandCounter, myNewMiddleware])
```

Middlewares in `src/middlewares/` have access to the full `CommandExecutionContext` including `ctx.bot.cache`, `ctx.bot.db`, etc.
