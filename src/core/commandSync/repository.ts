import type { Database } from "@/core/database";

interface CommandSignatureRow {
  command_name: string;
  signature: string;
}

// Records the exact set of slash commands last registered for each guild — one
// row per command, holding a content hash of its registered shape. Comparing
// this against what the bot currently defines lets the sync service register
// only the commands that are missing or changed, and delete the ones that are
// no longer defined, instead of re-pushing the whole set.
export class CommandSyncRepository {
  constructor(private readonly db: Database) {}

  // The commands last registered for a scope, as a name→signature map.
  async getSignatures(scope: string): Promise<Map<string, string>> {
    const rows = await this.db.query<CommandSignatureRow>(
      `SELECT command_name, signature FROM command_signatures WHERE scope = $1`,
      [scope],
    );
    return new Map(rows.map((row) => [row.command_name, row.signature]));
  }

  // Replaces a scope's recorded signatures with exactly `signatures`: upserts the
  // given commands and deletes any previously-recorded command no longer present.
  // Done in one transaction so the record never reflects a half-applied sync.
  async saveSignatures(scope: string, signatures: Map<string, string>): Promise<void> {
    await this.db.transaction(async (tx) => {
      const names = [...signatures.keys()];

      // Drop rows for commands that are no longer defined (deleted/renamed).
      if (names.length > 0) {
        await tx.execute(
          `DELETE FROM command_signatures WHERE scope = $1 AND command_name <> ALL($2::text[])`,
          [scope, names],
        );
      } else {
        await tx.execute(`DELETE FROM command_signatures WHERE scope = $1`, [scope]);
      }

      for (const [name, signature] of signatures) {
        await tx.execute(
          `INSERT INTO command_signatures (scope, command_name, signature, updated_at)
           VALUES ($1, $2, $3, now())
           ON CONFLICT (scope, command_name)
           DO UPDATE SET signature = $3, updated_at = now()`,
          [scope, name, signature],
        );
      }
    });
  }
}
