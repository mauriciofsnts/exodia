import { Pool, type PoolClient } from "pg";
import type { Database } from "@/core/database";
import type { Logger } from "@/lib/logger";

// Both Pool and a checked-out PoolClient expose `.query`, so the same logic
// serves pooled calls and transaction-scoped calls.
type Queryable = Pool | PoolClient;

class PostgresDatabase implements Database {
  constructor(
    private readonly pool: Pool,
    private readonly executor: Queryable,
  ) {}

  async query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]> {
    const { rows } = await this.executor.query(sql, params as unknown[]);
    return rows as T[];
  }

  async execute(sql: string, params?: unknown[]): Promise<void> {
    await this.executor.query(sql, params as unknown[]);
  }

  async transaction<T>(fn: (db: Database) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      // Hand the callback a Database bound to this client so every query runs
      // inside the same transaction.
      const result = await fn(new PostgresDatabase(this.pool, client));
      await client.query("COMMIT");
      return result;
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

// Creates a connected Postgres-backed Database. Verifies connectivity eagerly so
// a bad DATABASE_URL fails at startup rather than on the first query.
export async function createDatabase(connectionString: string, logger: Logger): Promise<Database> {
  const pool = new Pool({ connectionString });
  // Idle-client errors are emitted on the pool, not the await path — log them
  // so a dropped backend connection doesn't crash the process.
  pool.on("error", (err) => logger.error({ err }, "Postgres pool error"));

  const client = await pool.connect();
  client.release();
  logger.info("Postgres connected");

  return new PostgresDatabase(pool, pool);
}
