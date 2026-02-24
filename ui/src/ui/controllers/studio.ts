import type { GatewayBrowserClient } from "../gateway.ts";
import type { WizardStep, WizardData, DashboardData } from "../types/studio-types.ts";
import { PERSONALITY_TEMPLATES } from "../data/personality-templates.ts";

export type StudioState = {
  client: GatewayBrowserClient | null;
  connected: boolean;
  wizardStep: WizardStep;
  wizardData: WizardData;
  wizardSaving: boolean;
  wizardError: string | null;
  wizardComplete: boolean;
  dashboardLoading: boolean;
  dashboardData: DashboardData | null;
  tab: string;
};

export type ValidationResult = {
  valid: boolean;
  errors: string[];
};

export function validateWizardStep(step: WizardStep, data: WizardData): ValidationResult {
  const errors: string[] = [];

  switch (step) {
    case "identity":
      if (!data.identity.name.trim()) {
        errors.push("Agent name is required.");
      }
      break;
    case "brain":
      if (!data.brain.provider) {
        errors.push("Please select a provider.");
      }
      if (data.brain.provider !== "ollama" && !data.brain.apiKey.trim()) {
        errors.push("API key is required for this provider.");
      }
      break;
    case "channels": {
      // Channels are optional — user can skip
      const hasChannel =
        data.channels.whatsapp.enabled ||
        data.channels.telegram.enabled ||
        data.channels.discord.enabled;
      if (data.channels.telegram.enabled && !data.channels.telegram.token.trim()) {
        errors.push("Telegram bot token is required when enabled.");
      }
      if (data.channels.discord.enabled && !data.channels.discord.token.trim()) {
        errors.push("Discord bot token is required when enabled.");
      }
      if (!hasChannel) {
        // Not an error — channels are optional
      }
      break;
    }
    case "security":
      // Always valid
      break;
    case "capabilities":
      // Always valid
      break;
  }

  return { valid: errors.length === 0, errors };
}

function buildSoulMd(data: WizardData): string {
  const template = PERSONALITY_TEMPLATES.find((t) => t.id === data.identity.templateId);
  if (data.identity.customDescription.trim()) {
    return data.identity.customDescription;
  }
  return template?.soulMd ?? "";
}

export async function applyWizard(state: StudioState) {
  if (!state.client || !state.connected) {
    state.wizardError = "Not connected to gateway.";
    return;
  }
  state.wizardSaving = true;
  state.wizardError = null;

  try {
    const data = state.wizardData;

    // Build SOUL.md content
    const soulMd = buildSoulMd(data);
    if (soulMd) {
      await state.client.request("agents.files.set", {
        name: "SOUL.md",
        content: soulMd,
      });
    }

    // Build config patch
    const patch: Record<string, unknown> = {};

    // Model config
    if (data.brain.provider && data.brain.modelId) {
      patch["agents.defaults.model"] = { primary: data.brain.modelId };
    }

    // Provider auth
    if (data.brain.provider && data.brain.apiKey) {
      const providerKeyMap: Record<string, string> = {
        anthropic: "auth.anthropic.apiKey",
        openai: "auth.openai.apiKey",
        google: "auth.google.apiKey",
        openrouter: "auth.openrouter.apiKey",
      };
      const keyPath = providerKeyMap[data.brain.provider];
      if (keyPath) {
        patch[keyPath] = data.brain.apiKey;
      }
    }

    // Channel tokens
    if (data.channels.telegram.enabled && data.channels.telegram.token) {
      patch["channels.telegram.token"] = data.channels.telegram.token;
    }
    if (data.channels.discord.enabled && data.channels.discord.token) {
      patch["channels.discord.token"] = data.channels.discord.token;
    }

    // Security
    if (data.security.mode === "open") {
      patch["channels.defaults.dmPolicy"] = "open";
    } else if (data.security.mode === "allowlist") {
      patch["channels.defaults.dmPolicy"] = "allowlist";
      if (data.security.allowedContacts.length > 0) {
        patch["channels.defaults.allowFrom"] = data.security.allowedContacts;
      }
    } else {
      patch["channels.defaults.dmPolicy"] = "pairing";
    }

    // Capabilities
    if (data.capabilities.webSearch) {
      patch["tools.webSearch.enabled"] = true;
    }

    // Apply config
    if (Object.keys(patch).length > 0) {
      await state.client.request("config.patch", { values: patch });
    }

    state.wizardComplete = true;
    state.tab = "dashboard";
  } catch (err) {
    state.wizardError = `Failed to apply configuration: ${String(err)}`;
  } finally {
    state.wizardSaving = false;
  }
}

export async function loadDashboard(state: StudioState) {
  if (!state.client || !state.connected) {
    return;
  }
  state.dashboardLoading = true;

  try {
    const [health, channels, agents, sessions] = await Promise.all([
      state.client.request<{ ok?: boolean }>("health", {}).catch(() => ({ ok: false })),
      state.client
        .request<{
          channelOrder?: string[];
          channelLabels?: Record<string, string>;
          accounts?: Record<string, unknown>;
        }>("channels.status", { probe: false })
        .catch(() => null),
      state.client.request<{ agents?: Array<{ id: string }> }>("agents.list", {}).catch(() => null),
      state.client
        .request<{
          sessions?: Array<{ key: string; lastMessageAt?: number; preview?: string }>;
        }>("sessions.list", { limit: 5, activeMinutes: 0 })
        .catch(() => null),
    ]);

    // Build agent info
    let agentName = "Assistant";
    let agentEmoji = "🤖";
    const mainAgentId = (agents as { defaultId?: string })?.defaultId ?? "main";
    try {
      const soulRes = await state.client.request<{ content?: string }>("agents.files.get", {
        agentId: mainAgentId,
        name: "SOUL.md",
      });
      if (soulRes?.content) {
        const nameMatch = soulRes.content.match(/^#\s+(.+)/m);
        if (nameMatch) {
          agentName = nameMatch[1].trim();
        }
      }
    } catch {
      // SOUL.md may not exist
    }

    // Build channels list
    const channelOrder = channels?.channelOrder ?? [];
    const channelLabels = channels?.channelLabels ?? {};
    const accounts = (channels?.accounts ?? {}) as Record<
      string,
      { status?: string; lastActivity?: number }
    >;

    const channelList = channelOrder.map((id) => {
      const account = accounts[id];
      return {
        id,
        label: channelLabels[id] ?? id,
        status: account?.status ?? "unknown",
        lastActivity: account?.lastActivity,
      };
    });

    // Build recent sessions
    const sessionList = (sessions?.sessions ?? []).map((s) => ({
      key: s.key,
      preview: s.preview ?? s.key,
      timestamp: s.lastMessageAt ?? 0,
    }));

    state.dashboardData = {
      agentName,
      agentEmoji,
      online: health?.ok ?? false,
      channels: channelList,
      recentSessions: sessionList,
    };
  } catch {
    // Dashboard load is best-effort
  } finally {
    state.dashboardLoading = false;
  }
}
