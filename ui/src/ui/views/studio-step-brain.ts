import { html, nothing, type TemplateResult } from "lit";
import type { WizardData } from "../types/studio-types.ts";

type Provider = {
  id: string;
  label: string;
  icon: string;
  models: Array<{ id: string; label: string }>;
  helpUrl: string;
  helpSteps: string[];
};

const PROVIDERS: Provider[] = [
  {
    id: "anthropic",
    label: "Anthropic",
    icon: "🟠",
    models: [
      { id: "claude-sonnet-4-5-20250929", label: "Claude Sonnet 4.5" },
      { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5" },
      { id: "claude-opus-4-6", label: "Claude Opus 4.6" },
    ],
    helpUrl: "https://console.anthropic.com/account/keys",
    helpSteps: [
      "Go to console.anthropic.com",
      "Sign in or create an account",
      'Navigate to "API Keys"',
      'Click "Create Key" and copy it',
    ],
  },
  {
    id: "openai",
    label: "OpenAI",
    icon: "🟢",
    models: [
      { id: "gpt-4o", label: "GPT-4o" },
      { id: "gpt-4o-mini", label: "GPT-4o Mini" },
      { id: "o3-mini", label: "o3-mini" },
    ],
    helpUrl: "https://platform.openai.com/api-keys",
    helpSteps: [
      "Go to platform.openai.com",
      "Sign in or create an account",
      'Navigate to "API Keys"',
      'Click "Create new secret key" and copy it',
    ],
  },
  {
    id: "google",
    label: "Google",
    icon: "🔵",
    models: [
      { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
      { id: "gemini-2.0-pro", label: "Gemini 2.0 Pro" },
    ],
    helpUrl: "https://aistudio.google.com/apikey",
    helpSteps: [
      "Go to aistudio.google.com",
      "Sign in with your Google account",
      'Click "Get API key"',
      "Create a key for a new or existing project",
    ],
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    icon: "🟣",
    models: [
      { id: "anthropic/claude-sonnet-4-5", label: "Claude Sonnet 4.5" },
      { id: "openai/gpt-4o", label: "GPT-4o" },
      { id: "google/gemini-2.0-flash", label: "Gemini 2.0 Flash" },
    ],
    helpUrl: "https://openrouter.ai/keys",
    helpSteps: [
      "Go to openrouter.ai",
      "Sign in or create an account",
      'Navigate to "API Keys"',
      "Create a key and copy it",
    ],
  },
];

export type StudioBrainProps = {
  data: WizardData;
  onDataChange: (patch: Partial<WizardData>) => void;
};

export function renderStudioBrain(props: StudioBrainProps): TemplateResult {
  const { data, onDataChange } = props;
  const brain = data.brain;
  const selectedProvider = PROVIDERS.find((p) => p.id === brain.provider);

  const updateBrain = (patch: Partial<WizardData["brain"]>) => {
    onDataChange({ brain: { ...brain, ...patch } });
  };

  return html`
    <div class="wizard-content">
      <div class="field">
        <label class="field-label">Choose an AI provider</label>
        <div class="provider-grid">
          ${PROVIDERS.map(
            (provider) => html`
              <button
                class="provider-card ${brain.provider === provider.id ? "provider-card--selected" : ""}"
                @click=${() => {
                  const defaultModel = provider.models[0]?.id ?? "";
                  updateBrain({
                    provider: provider.id,
                    modelId: defaultModel,
                    apiKey: brain.provider === provider.id ? brain.apiKey : "",
                  });
                }}
              >
                <span class="provider-card__icon">${provider.icon}</span>
                <span class="provider-card__label">${provider.label}</span>
              </button>
            `,
          )}
        </div>
      </div>

      ${
        selectedProvider
          ? html`
            <div class="field">
              <label class="field-label">API Key</label>
              <input
                type="password"
                class="input"
                placeholder="sk-..."
                .value=${brain.apiKey}
                @input=${(e: Event) =>
                  updateBrain({ apiKey: (e.target as HTMLInputElement).value })}
              />
              <details class="help-expand">
                <summary>How do I get this key?</summary>
                <div class="help-expand__content">
                  <ol>
                    ${selectedProvider.helpSteps.map((step) => html`<li>${step}</li>`)}
                  </ol>
                  <a href="${selectedProvider.helpUrl}" target="_blank" rel="noreferrer">
                    Open ${selectedProvider.label} dashboard
                  </a>
                </div>
              </details>
            </div>

            <div class="field">
              <label class="field-label">Model</label>
              <select
                class="input select"
                .value=${brain.modelId}
                @change=${(e: Event) =>
                  updateBrain({ modelId: (e.target as HTMLSelectElement).value })}
              >
                ${selectedProvider.models.map(
                  (model) =>
                    html`<option value=${model.id} ?selected=${brain.modelId === model.id}>
                      ${model.label}
                    </option>`,
                )}
              </select>
            </div>
          `
          : nothing
      }

      <details class="help-expand">
        <summary>Advanced: Use Ollama or a custom provider</summary>
        <div class="help-expand__content">
          <p>
            For local models (Ollama) or custom OpenAI-compatible endpoints, use the
            <strong>Config</strong> tab after completing this wizard.
          </p>
        </div>
      </details>
    </div>
  `;
}
