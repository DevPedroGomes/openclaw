import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import type { Db } from "../db/connection.js";
import type { PlatformEnv } from "../env.js";

export function createAuth(env: PlatformEnv, db: Db) {
  return betterAuth({
    database: drizzleAdapter(db, { provider: "pg" }),
    secret: env.BETTER_AUTH_SECRET,
    emailAndPassword: { enabled: true },
    session: {
      cookieCache: { enabled: true, maxAge: 300 },
    },
    trustedOrigins: ["*"],
  });
}

export type Auth = ReturnType<typeof createAuth>;
