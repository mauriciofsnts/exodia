export interface Database {
  query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]>;
  execute(sql: string, params?: unknown[]): Promise<void>;
  transaction<T>(fn: (db: Database) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
