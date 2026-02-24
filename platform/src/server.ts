import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import type { Db } from "./db/connection.js";
import type { PlatformEnv } from "./env.js";
import { createAuth } from "./auth/auth.js";
import { errorHandler } from "./middleware/error-handler.js";
import { createRateLimiter } from "./middleware/rate-limit.js";
import { createApiKeyRoutes } from "./routes/api-key-routes.js";
import { createAuthRoutes } from "./routes/auth-routes.js";
import { createChannelRoutes } from "./routes/channel-routes.js";
import { createHealthRoutes } from "./routes/health-routes.js";
import { createTenantRoutes } from "./routes/tenant-routes.js";
import { serveSpa } from "./ui/serve-spa.js";
import { createWsProxy } from "./ws/proxy.js";

export type AppContext = {
  env: PlatformEnv;
  db: Db;
  auth: ReturnType<typeof createAuth>;
};

export function createApp(ctx: AppContext) {
  const app = new Hono();

  // Global middleware
  app.use("*", logger());
  app.use("*", cors({ origin: "*", credentials: true }));
  app.use("/api/*", createRateLimiter());
  app.onError(errorHandler);

  // Auth routes (Better Auth handles /api/auth/*)
  app.route("/api/auth", createAuthRoutes(ctx));

  // Health
  app.route("/api", createHealthRoutes());

  // Tenant management (protected)
  app.route("/api", createTenantRoutes(ctx));

  // API key management (protected)
  app.route("/api", createApiKeyRoutes(ctx));

  // Channel provisioning (protected)
  app.route("/api", createChannelRoutes(ctx));

  // WebSocket proxy
  createWsProxy(app, ctx);

  // SPA fallback — serve Studio UI
  serveSpa(app);

  return app;
}
