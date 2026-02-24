import { serve } from "@hono/node-server";
import { createAuth } from "./auth/auth.js";
import { getDb } from "./db/connection.js";
import { loadEnv } from "./env.js";
import { createApp } from "./server.js";

async function main() {
  const env = loadEnv();
  const db = getDb(env.DATABASE_URL);
  const auth = createAuth(env, db);
  const app = createApp({ env, db, auth });

  console.log(`[platform] Starting on port ${env.PLATFORM_PORT}`);
  console.log(`[platform] Gateway: ${env.GATEWAY_URL}`);

  serve({ fetch: app.fetch, port: env.PLATFORM_PORT }, (info) => {
    console.log(`[platform] Listening on http://localhost:${info.port}`);
  });
}

main().catch((err) => {
  console.error("[platform] Fatal:", err);
  process.exit(1);
});
