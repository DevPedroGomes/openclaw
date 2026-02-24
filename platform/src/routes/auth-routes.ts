import { Hono } from "hono";
import type { AppContext } from "../server.js";

export function createAuthRoutes(ctx: AppContext) {
  const app = new Hono();

  // Mount Better Auth handler — handles signup, signin, signout, session, etc.
  app.on(["POST", "GET"], "/*", (c) => {
    return ctx.auth.handler(c.req.raw);
  });

  return app;
}
