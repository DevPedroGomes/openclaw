import { Hono } from "hono";

export function createHealthRoutes() {
  const app = new Hono();

  app.get("/health", (c) => {
    return c.json({ ok: true, ts: Date.now() });
  });

  return app;
}
