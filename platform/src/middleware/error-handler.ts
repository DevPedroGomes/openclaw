import type { ErrorHandler } from "hono";

export const errorHandler: ErrorHandler = (err, c) => {
  console.error("[platform] Unhandled error:", err);
  const status = "status" in err && typeof err.status === "number" ? err.status : 500;
  return c.json({ error: status === 500 ? "Internal server error" : err.message }, status as 500);
};
