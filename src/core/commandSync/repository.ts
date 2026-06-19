import type { Database } from "@/core/database.js";

// Scope key for the bot's own command count — what every guild's count is
// compared against. Per-guild rows use the guild id as the scope.
export const GLOBAL_SCOPE = "global";

interface CommandSyncRow {
  command_count: number;
}

// Tracks how many slash commands were last registered, globally and per guild,
// so we can detect a guild whose registered commands fell behind what the bot
// currently defines (e.g. a command was added after that guild ran setup).
export class CommandSyncRepository {
  constructor(private readonly db: Database) {}

  async init(): Promise<void> {
    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS command_sync (
        scope         TEXT PRIMARY KEY,
        command_count INTEGER NOT NULL,
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
  }

  async getCount(scope: string): Promise<number | null> {
    const rows = await this.db.query<CommandSyncRow>(
      `SELECT command_count FROM command_sync WHERE scope = $1`,
      [scope],
    );
    return rows[0]?.command_count ?? null;
  }

  async setCount(scope: string, count: number): Promise<void> {
    await this.db.execute(
      `INSERT INTO command_sync (scope, command_count, updated_at)
       VALUES ($1, $2, now())
       ON CONFLICT (scope) DO UPDATE SET command_count = $2, updated_at = now()`,
      [scope, count],
    );
  }
}
