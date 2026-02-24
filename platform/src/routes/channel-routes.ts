import { Hono } from "hono";
import type { AppContext } from "../server.js";
import { requireTenant } from "../auth/middleware.js";
import {
  buildWhatsAppChannelPatch,
  buildTelegramChannelPatch,
  tenantAccountId,
} from "../provisioning/config-builder.js";
import { createGatewayRpc } from "../ws/proxy.js";

const SUPPORTED_CHANNELS = new Set(["whatsapp", "telegram"]);

// Serialize config mutations with PostgreSQL advisory lock (same lock as provision-agent)
const CONFIG_LOCK_ID = 827_401;
async function withConfigLock<T>(db: AppContext["db"], fn: () => Promise<T>): Promise<T> {
  await db.execute(`SELECT pg_advisory_lock(${CONFIG_LOCK_ID})`);
  try {
    return await fn();
  } finally {
    await db.execute(`SELECT pg_advisory_unlock(${CONFIG_LOCK_ID})`);
  }
}

export function createChannelRoutes(ctx: AppContext) {
  const app = new Hono();

  // POST /channels/:channel — provision a channel account + binding for the tenant
  app.post("/channels/:channel", requireTenant(ctx), async (c) => {
    const channel = c.req.param("channel");
    if (!SUPPORTED_CHANNELS.has(channel)) {
      return c.json({ error: `Unsupported channel: ${channel}` }, 400);
    }

    const agentId = c.get("agentId") as string;
    const body = await c.req.json<{ botToken?: string }>().catch(() => ({}));

    // Telegram requires a botToken
    if (channel === "telegram" && !body.botToken?.trim()) {
      return c.json({ error: "botToken is required for Telegram" }, 400);
    }

    const gatewayRpc = createGatewayRpc(ctx.env);
    try {
      // Advisory lock prevents concurrent provisioning from overwriting bindings
      return await withConfigLock(ctx.db, async () => {
        // Get current config (inside lock to guarantee freshness)
        const configRes = (await gatewayRpc("config.get")) as {
          parsed?: Record<string, unknown>;
          hash?: string;
        };
        const currentConfig = configRes.parsed ?? {};
        const baseHash = configRes.hash;

        // Build channel patch
        let patch: Record<string, unknown>;
        if (channel === "whatsapp") {
          patch = buildWhatsAppChannelPatch(currentConfig, agentId);
        } else {
          patch = buildTelegramChannelPatch(currentConfig, agentId, body.botToken!.trim());
        }

        // Skip if no changes needed
        if (Object.keys(patch).length === 0) {
          return c.json({
            ok: true,
            accountId: tenantAccountId(agentId, channel),
            message: "Channel already provisioned",
          });
        }

        // Apply patch
        await gatewayRpc("config.patch", {
          raw: JSON.stringify(patch),
          baseHash,
          note: `Provision ${channel} for ${agentId}`,
          restartDelayMs: 2000,
        });

        return c.json(
          {
            ok: true,
            accountId: tenantAccountId(agentId, channel),
            message: `${channel} channel provisioned`,
          },
          201,
        );
      });
    } finally {
      gatewayRpc.close();
    }
  });

  return app;
}
