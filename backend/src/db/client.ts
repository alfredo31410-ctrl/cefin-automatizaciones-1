import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema.js";

export type AppDatabaseClient = NodePgDatabase<typeof schema>;

export interface DatabaseConnection {
  db: AppDatabaseClient;
  healthCheck: () => Promise<void>;
  close: () => Promise<void>;
}

export function createDatabaseConnection(connectionString: string): DatabaseConnection {
  const pool = new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });

  return {
    db: drizzle(pool, { schema }),
    healthCheck: async () => {
      await pool.query("select 1");
    },
    close: async () => {
      await pool.end();
    },
  };
}
