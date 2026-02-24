import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema.js";

let pool: pg.Pool | null = null;

export function getPool(connectionString: string): pg.Pool {
  if (!pool) {
    pool = new pg.Pool({ connectionString, max: 20 });
  }
  return pool;
}

export function getDb(connectionString: string) {
  return drizzle(getPool(connectionString), { schema });
}

export type Db = ReturnType<typeof getDb>;

export async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
