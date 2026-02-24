import type { PlatformEnv } from "../env.js";

type AgentEntry = {
  id: string;
  model?: { primary?: string };
  [key: string]: unknown;
};

type GatewayConfig = {
  agents?: {
    list?: AgentEntry[];
    defaults?: Record<string, unknown>;
  };
  models?: {
    providers?: Record<string, unknown>;
  };
  [key: string]: unknown;
};

// Build a merge-patch that appends a new agent to the gateway config.
// merge-patch replaces arrays entirely, so we must include the full agents.list.
export function buildAgentConfigPatch(
  currentConfig: Record<string, unknown>,
  agentId: string,
  displayName: string,
  env: PlatformEnv,
): Record<string, unknown> {
  const config = currentConfig as GatewayConfig;
  const existingList = config.agents?.list ?? [];

  // Check agent isn't already provisioned
  if (existingList.some((a) => a.id === agentId)) {
    return {}; // no-op
  }

  const newAgent: AgentEntry = { id: agentId };

  // If a shared key is available, set it as default model provider
  if (env.PLATFORM_SHARED_ANTHROPIC_KEY) {
    newAgent.model = { primary: "anthropic/claude-sonnet-4-20250514" };
  }

  const patch: Record<string, unknown> = {
    agents: {
      ...config.agents,
      list: [...existingList, newAgent],
    },
  };

  return patch;
}

// Build a scoped config patch for a tenant's BYOK provider
export function buildByokProviderPatch(
  currentConfig: Record<string, unknown>,
  agentId: string,
  provider: string,
  apiKey: string,
  modelId: string,
): Record<string, unknown> {
  const config = currentConfig as GatewayConfig;
  const providerName = `${agentId}-${provider}`;

  const providerEntry: Record<string, unknown> = { apiKey };
  switch (provider) {
    case "anthropic":
      providerEntry.baseUrl = "https://api.anthropic.com";
      providerEntry.api = "anthropic-messages";
      break;
    case "openai":
      providerEntry.baseUrl = "https://api.openai.com/v1";
      providerEntry.api = "openai-chat";
      break;
    case "google":
      providerEntry.baseUrl = "https://generativelanguage.googleapis.com/v1beta";
      providerEntry.api = "google-genai";
      break;
    case "openrouter":
      providerEntry.baseUrl = "https://openrouter.ai/api/v1";
      providerEntry.api = "openai-chat";
      break;
  }

  // Update agent model reference
  const agentsList = [...(config.agents?.list ?? [])];
  const agentIdx = agentsList.findIndex((a) => a.id === agentId);
  if (agentIdx >= 0) {
    agentsList[agentIdx] = {
      ...agentsList[agentIdx],
      model: { primary: `${providerName}/${modelId}` },
    };
  }

  return {
    models: {
      ...config.models,
      providers: {
        ...config.models?.providers,
        [providerName]: providerEntry,
      },
    },
    agents: {
      ...config.agents,
      list: agentsList,
    },
  };
}
