import type { MiddlewareHandler } from "hono";
import { eq } from "drizzle-orm";
import type { AppContext } from "../server.js";
import { tenant } from "../db/schema.js";

// Extend Hono context to carry user + tenant
declare module "hono" {
  interface ContextVariableMap {
    userId: string;
    userEmail: string;
    tenantId: string;
    agentId: string;
  }
}

export function requireSession(ctx: AppContext): MiddlewareHandler {
  return async (c, next) => {
    const session = await ctx.auth.api.getSession({
      headers: c.req.raw.headers,
    });

    if (!session?.user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    c.set("userId", session.user.id);
    c.set("userEmail", session.user.email);

    // Lookup tenant
    const [row] = await ctx.db
      .select()
      .from(tenant)
      .where(eq(tenant.userId, session.user.id))
      .limit(1);

    if (row) {
      c.set("tenantId", row.id);
      c.set("agentId", row.agentId);
    }

    await next();
  };
}

// Stricter middleware: requires tenant to exist
export function requireTenant(ctx: AppContext): MiddlewareHandler {
  return async (c, next) => {
    const session = await ctx.auth.api.getSession({
      headers: c.req.raw.headers,
    });

    if (!session?.user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    c.set("userId", session.user.id);
    c.set("userEmail", session.user.email);

    const [row] = await ctx.db
      .select()
      .from(tenant)
      .where(eq(tenant.userId, session.user.id))
      .limit(1);

    if (!row) {
      return c.json({ error: "Tenant not found. Complete onboarding first." }, 403);
    }

    c.set("tenantId", row.id);
    c.set("agentId", row.agentId);

    await next();
  };
}
