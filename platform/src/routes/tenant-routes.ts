import { eq } from "drizzle-orm";
import { Hono } from "hono";
import type { AppContext } from "../server.js";
import { requireSession, requireTenant } from "../auth/middleware.js";
import { tenant } from "../db/schema.js";
import { provisionAgent } from "../provisioning/provision-agent.js";
import { createGatewayRpc } from "../ws/proxy.js";

export function createTenantRoutes(ctx: AppContext) {
  const app = new Hono();

  // Get current tenant info
  app.get("/tenant", requireTenant(ctx), async (c) => {
    const [row] = await ctx.db
      .select()
      .from(tenant)
      .where(eq(tenant.userId, c.get("userId")))
      .limit(1);

    if (!row) return c.json({ error: "Tenant not found" }, 404);

    return c.json({
      id: row.id,
      agentId: row.agentId,
      displayName: row.displayName,
      agentProvisioned: row.agentProvisioned,
      createdAt: row.createdAt,
    });
  });

  // Update tenant display name
  app.patch("/tenant", requireTenant(ctx), async (c) => {
    const body = await c.req.json<{ displayName?: string }>();
    if (!body.displayName?.trim()) {
      return c.json({ error: "displayName is required" }, 400);
    }

    await ctx.db
      .update(tenant)
      .set({ displayName: body.displayName.trim(), updatedAt: new Date() })
      .where(eq(tenant.userId, c.get("userId")));

    return c.json({ ok: true });
  });

  // Manual provision trigger
  app.post("/tenant/provision", requireSession(ctx), async (c) => {
    const body = await c.req.json<{ displayName?: string }>();
    const displayName = body.displayName?.trim() || c.get("userEmail");

    const gatewayRpc = createGatewayRpc(ctx.env);
    try {
      const result = await provisionAgent(
        ctx.db,
        ctx.env,
        {
          userId: c.get("userId"),
          displayName,
        },
        gatewayRpc,
      );

      return c.json(result, 201);
    } finally {
      gatewayRpc.close();
    }
  });

  return app;
}
