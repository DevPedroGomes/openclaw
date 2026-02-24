export type WizardStep = "identity" | "brain" | "channels" | "security" | "capabilities";

export const WIZARD_STEPS: WizardStep[] = [
  "identity",
  "brain",
  "channels",
  "security",
  "capabilities",
];

export type PersonalityTemplate = {
  id: string;
  label: string;
  emoji: string;
  description: string;
  soulMd: string;
};

export type ChannelSetup = {
  enabled: boolean;
  token: string;
  status: "idle" | "validating" | "connected" | "error";
};

export type WizardData = {
  identity: {
    name: string;
    emoji: string;
    templateId: string;
    customDescription: string;
  };
  brain: {
    provider: string;
    apiKey: string;
    modelId: string;
  };
  channels: {
    whatsapp: { enabled: boolean; status: "idle" | "scanning" | "connected" | "error" };
    telegram: ChannelSetup;
    discord: ChannelSetup;
  };
  security: {
    mode: "pairing" | "allowlist" | "open";
    allowedContacts: string[];
  };
  capabilities: {
    webSearch: boolean;
    imageAnalysis: boolean;
    reminders: boolean;
    fileAccess: boolean;
  };
};

export type DashboardData = {
  agentName: string;
  agentEmoji: string;
  online: boolean;
  channels: Array<{ id: string; label: string; status: string; lastActivity?: number }>;
  recentSessions: Array<{ key: string; preview: string; timestamp: number }>;
};

export function createDefaultWizardData(): WizardData {
  return {
    identity: { name: "", emoji: "🤖", templateId: "friendly", customDescription: "" },
    brain: { provider: "", apiKey: "", modelId: "" },
    channels: {
      whatsapp: { enabled: false, status: "idle" },
      telegram: { enabled: false, token: "", status: "idle" },
      discord: { enabled: false, token: "", status: "idle" },
    },
    security: { mode: "pairing", allowedContacts: [] },
    capabilities: {
      webSearch: true,
      imageAnalysis: true,
      reminders: false,
      fileAccess: false,
    },
  };
}
