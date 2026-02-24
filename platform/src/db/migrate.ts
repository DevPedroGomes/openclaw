import { migrate } from "drizzle-orm/node-postgres/migrator";
import type { Db } from "./connection.js";

export async function runMigrations(db: Db) {
  await migrate(db, { migrationsFolder: "./drizzle" });
}
