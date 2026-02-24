import type { MiddlewareHandler } from "hono";

// Simple in-memory rate limiter per IP
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 120;

type Entry = { count: number; resetAt: number };
const store = new Map<string, Entry>();

// Periodic cleanup every 2 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key);
  }
}, 120_000).unref();

export function createRateLimiter(windowMs = WINDOW_MS, max = MAX_REQUESTS): MiddlewareHandler {
  return async (c, next) => {
    const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const now = Date.now();
    let entry = store.get(ip);

    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      store.set(ip, entry);
    }

    entry.count++;
    if (entry.count > max) {
      return c.json({ error: "Too many requests" }, 429);
    }

    await next();
  };
}
