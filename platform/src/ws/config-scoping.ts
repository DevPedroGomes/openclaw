// Transform config.patch requests to enforce tenant scope.
// Instead of letting tenants send raw config patches, we accept a simplified
// tenant config format and build proper scoped patches.

export type TenantConfigInput = {
  model?: string;
  identity?: { name?: string; emoji?: string };
  soul?: string;
};

type AgentEntry = {
  id: string;
  model?: { primary?: string };
  [key: string]: unknown;
};

type GatewayConfig = {
  agents?: { list?: AgentEntry[]; defaults?: Record<string, unknown> };
  [key: string]: unknown;
};

// Build a scoped config patch from simplified tenant input.
// Returns the gateway-level merge-patch targeting only the tenant's agent entry.
export function buildScopedConfigPatch(
  currentConfig: Record<string, unknown>,
  agentId: string,
  input: TenantConfigInput,
): Record<string, unknown> | null {
  const config = currentConfig as GatewayConfig;
  const agentsList = [...(config.agents?.list ?? [])];
  const agentIdx = agentsList.findIndex((a) => a.id === agentId);

  if (agentIdx < 0) return null;

  const agentEntry = { ...agentsList[agentIdx] };

  if (input.model) {
    agentEntry.model = { ...agentEntry.model, primary: input.model };
  }

  agentsList[agentIdx] = agentEntry;

  return {
    agents: {
      ...config.agents,
      list: agentsList,
    },
  };
}

// Validate that a raw config.patch from a tenant only touches allowed fields.
// Returns true if the patch is safe, false if it touches forbidden areas.
export function validateConfigPatch(patch: Record<string, unknown>, agentId: string): boolean {
  const forbiddenTopLevel = ["gateway", "channels", "auth", "node", "exec", "update"];

  for (const key of Object.keys(patch)) {
    if (forbiddenTopLevel.includes(key)) return false;
  }

  // If patching agents, ensure it only modifies this tenant's agent
  if (patch.agents && typeof patch.agents === "object") {
    const agents = patch.agents as { list?: unknown[] };
    if (Array.isArray(agents.list)) {
      for (const entry of agents.list) {
        if (entry && typeof entry === "object") {
          const e = entry as { id?: string };
          if (e.id && e.id !== agentId) return false;
        }
      }
    }
  }

  return true;
}
