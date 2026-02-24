import { eq, and } from "drizzle-orm";
import { Hono } from "hono";
import type { AppContext } from "../server.js";
import { requireTenant } from "../auth/middleware.js";
import { tenantApiKey } from "../db/schema.js";
import { encrypt, decrypt } from "../provisioning/api-key-crypto.js";

const VALID_PROVIDERS = ["anthropic", "openai", "google", "openrouter"];

export function createApiKeyRoutes(ctx: AppContext) {
  const app = new Hono();

  // List API keys (masked)
  app.get("/keys", requireTenant(ctx), async (c) => {
    const rows = await ctx.db
      .select()
      .from(tenantApiKey)
      .where(eq(tenantApiKey.tenantId, c.get("tenantId")));

    const keys = rows.map((row) => {
      const plain = decrypt(
        { encrypted: row.encryptedKey, iv: row.iv, tag: row.tag },
        ctx.env.PLATFORM_ENCRYPTION_KEY,
      );
      const masked = plain.slice(0, 4) + "..." + plain.slice(-4);
      return {
        provider: row.provider,
        masked,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      };
    });

    return c.json({ keys });
  });

  // Set API key for a provider
  app.post("/keys", requireTenant(ctx), async (c) => {
    const body = await c.req.json<{ provider: string; apiKey: string }>();

    if (!VALID_PROVIDERS.includes(body.provider)) {
      return c.json(
        { error: `Invalid provider. Must be one of: ${VALID_PROVIDERS.join(", ")}` },
        400,
      );
    }
    if (!body.apiKey?.trim()) {
      return c.json({ error: "apiKey is required" }, 400);
    }

    const { encrypted, iv, tag } = encrypt(body.apiKey.trim(), ctx.env.PLATFORM_ENCRYPTION_KEY);
    const tenantId = c.get("tenantId");

    // Upsert: delete existing, insert new
    await ctx.db
      .delete(tenantApiKey)
      .where(and(eq(tenantApiKey.tenantId, tenantId), eq(tenantApiKey.provider, body.provider)));

    await ctx.db.insert(tenantApiKey).values({
      tenantId,
      provider: body.provider,
      encryptedKey: encrypted,
      iv,
      tag,
    });

    return c.json({ ok: true }, 201);
  });

  // Delete API key for a provider
  app.delete("/keys/:provider", requireTenant(ctx), async (c) => {
    const provider = c.req.param("provider");
    if (!VALID_PROVIDERS.includes(provider)) {
      return c.json({ error: "Invalid provider" }, 400);
    }

    const tenantId = c.get("tenantId");
    await ctx.db
      .delete(tenantApiKey)
      .where(and(eq(tenantApiKey.tenantId, tenantId), eq(tenantApiKey.provider, provider)));

    return c.json({ ok: true });
  });

  return app;
}
