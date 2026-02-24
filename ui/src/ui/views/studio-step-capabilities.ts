import { html, type TemplateResult } from "lit";
import type { WizardData } from "../types/studio-types.ts";

export type StudioCapabilitiesProps = {
  data: WizardData;
  onDataChange: (patch: Partial<WizardData>) => void;
};

type CapabilityItem = {
  key: keyof WizardData["capabilities"];
  icon: string;
  label: string;
  description: string;
  caution?: string;
};

const CAPABILITIES: CapabilityItem[] = [
  {
    key: "webSearch",
    icon: "🔍",
    label: "Web search",
    description: "Search the internet to answer questions with up-to-date information.",
  },
  {
    key: "imageAnalysis",
    icon: "📸",
    label: "Image analysis",
    description: "Analyze images and photos shared in conversations.",
  },
  {
    key: "reminders",
    icon: "🗓️",
    label: "Reminders and scheduling",
    description: "Set reminders and help with time-based tasks.",
  },
  {
    key: "fileAccess",
    icon: "📁",
    label: "File access",
    description: "Read and reference files from the agent workspace.",
    caution: "Grant with care — the assistant can access workspace files.",
  },
];

export function renderStudioCapabilities(props: StudioCapabilitiesProps): TemplateResult {
  const { data, onDataChange } = props;
  const caps = data.capabilities;

  const updateCaps = (patch: Partial<WizardData["capabilities"]>) => {
    onDataChange({ capabilities: { ...caps, ...patch } });
  };

  return html`
    <div class="wizard-content">
      <div class="field">
        <label class="field-label">What can your assistant do?</label>
        <div class="toggle-list">
          ${CAPABILITIES.map(
            (cap) => html`
              <div class="toggle-card">
                <div class="toggle-card__icon">${cap.icon}</div>
                <div class="toggle-card__body">
                  <div class="toggle-card__label">${cap.label}</div>
                  <div class="toggle-card__desc">${cap.description}</div>
                  ${cap.caution ? html`<div class="toggle-card__caution">${cap.caution}</div>` : ""}
                </div>
                <label class="toggle">
                  <input
                    type="checkbox"
                    .checked=${caps[cap.key]}
                    @change=${(e: Event) =>
                      updateCaps({ [cap.key]: (e.target as HTMLInputElement).checked })}
                  />
                  <span class="toggle__slider"></span>
                </label>
              </div>
            `,
          )}
        </div>
      </div>
    </div>
  `;
}
