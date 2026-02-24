import { eq } from "drizzle-orm";
import type { Db } from "../db/connection.js";
import type { PlatformEnv } from "../env.js";
import { tenant } from "../db/schema.js";
import { buildAgentConfigPatch } from "./config-builder.js";

export type ProvisionInput = {
  userId: string;
  displayName: string;
};

export type ProvisionResult = {
  tenantId: string;
  agentId: string;
};

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 20);
}

// Use PostgreSQL advisory lock to serialize config mutations
async function withAdvisoryLock<T>(db: Db, fn: () => Promise<T>): Promise<T> {
  const LOCK_ID = 827_401; // arbitrary 32-bit integer for platform config lock
  await db.execute(`SELECT pg_advisory_lock(${LOCK_ID})`);
  try {
    return await fn();
  } finally {
    await db.execute(`SELECT pg_advisory_unlock(${LOCK_ID})`);
  }
}

export async function provisionAgent(
  db: Db,
  env: PlatformEnv,
  input: ProvisionInput,
  gatewayRpc: (method: string, params?: unknown) => Promise<unknown>,
): Promise<ProvisionResult> {
  // Check if tenant already exists
  const [existing] = await db.select().from(tenant).where(eq(tenant.userId, input.userId)).limit(1);

  if (existing?.agentProvisioned) {
    return { tenantId: existing.id, agentId: existing.agentId };
  }

  const agentId = `user-${slugify(input.userId)}`;

  return await withAdvisoryLock(db, async () => {
    // Get current gateway config
    const configRes = (await gatewayRpc("config.get")) as {
      raw?: string;
      hash?: string;
      parsed?: Record<string, unknown>;
    };

    const currentConfig = configRes.parsed ?? {};
    const baseHash = configRes.hash;

    // Build config patch that adds the new agent
    const patch = buildAgentConfigPatch(currentConfig, agentId, input.displayName, env);

    // Apply config patch to gateway
    await gatewayRpc("config.patch", {
      raw: JSON.stringify(patch),
      baseHash,
      note: `Provision agent for ${input.displayName}`,
      restartDelayMs: 2000,
    });

    // Upsert tenant row
    if (existing) {
      await db
        .update(tenant)
        .set({
          agentId,
          displayName: input.displayName,
          agentProvisioned: true,
          updatedAt: new Date(),
        })
        .where(eq(tenant.id, existing.id));
      return { tenantId: existing.id, agentId };
    }

    const [row] = await db
      .insert(tenant)
      .values({
        userId: input.userId,
        agentId,
        displayName: input.displayName,
        agentProvisioned: true,
      })
      .returning();

    return { tenantId: row!.id, agentId };
  });
}
