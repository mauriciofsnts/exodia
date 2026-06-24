import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Database } from "@/core/database";
import type { Logger } from "@/lib/logger";

const migrationsDir = fileURLToPath(new URL("./migrations", import.meta.url));

// Applies every pending SQL migration in `./migrations`, in filename order, each
// inside its own transaction. Applied versions are recorded in schema_migrations
// so a migration runs exactly once. Files are plain `.sql` (no params); add a new
// one as `NNNN_description.sql` — there's no need to make later migrations
// idempotent, only the 0001 baseline is (it must no-op on pre-migrations DBs).
export async function runMigrations(db: Database, logger: Logger): Promise<void> {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  const appliedRows = await db.query<{ version: string }>(`SELECT version FROM schema_migrations`);
  const applied = new Set(appliedRows.map((row) => row.version));

  const files = readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  let count = 0;
  for (const file of files) {
    const version = file.replace(/\.sql$/, "");
    if (applied.has(version)) continue;

    const sql = readFileSync(`${migrationsDir}/${file}`, "utf8");
    // One transaction per migration: the version row is written only if every
    // statement in the file succeeds, so a failed migration leaves no partial state.
    await db.transaction(async (tx) => {
      await tx.execute(sql);
      await tx.execute(`INSERT INTO schema_migrations (version) VALUES ($1)`, [version]);
    });
    logger.info({ version }, "Applied migration");
    count++;
  }

  if (count === 0) logger.info("Database schema up to date");
  else logger.info({ count }, "Database migrations applied");
}
