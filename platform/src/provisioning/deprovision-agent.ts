import { eq } from "drizzle-orm";
import type { Db } from "../db/connection.js";
import { tenant, tenantApiKey } from "../db/schema.js";

type AgentEntry = { id: string; [key: string]: unknown };

type GatewayConfig = {
  agents?: { list?: AgentEntry[] };
  models?: { providers?: Record<string, unknown> };
  [key: string]: unknown;
};

export async function deprovisionAgent(
  db: Db,
  tenantId: string,
  agentId: string,
  gatewayRpc: (method: string, params?: unknown) => Promise<unknown>,
): Promise<void> {
  // Get current config
  const configRes = (await gatewayRpc("config.get")) as {
    raw?: string;
    hash?: string;
    parsed?: Record<string, unknown>;
  };

  const config = (configRes.parsed ?? {}) as GatewayConfig;
  const baseHash = configRes.hash;

  // Remove agent from agents.list
  const filteredList = (config.agents?.list ?? []).filter((a) => a.id !== agentId);

  // Remove tenant-scoped providers (e.g. "user-xxx-anthropic")
  const providers = { ...config.models?.providers };
  for (const key of Object.keys(providers)) {
    if (key.startsWith(`${agentId}-`)) {
      delete providers[key];
    }
  }

  const patch: Record<string, unknown> = {
    agents: { ...config.agents, list: filteredList },
    models: { ...config.models, providers },
  };

  await gatewayRpc("config.patch", {
    raw: JSON.stringify(patch),
    baseHash,
    note: `Deprovision agent ${agentId}`,
    restartDelayMs: 2000,
  });

  // Remove API keys + tenant from DB (cascade deletes api keys)
  await db.delete(tenantApiKey).where(eq(tenantApiKey.tenantId, tenantId));
  await db.delete(tenant).where(eq(tenant.id, tenantId));
}
