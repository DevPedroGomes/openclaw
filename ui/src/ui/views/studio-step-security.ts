import { html, nothing, type TemplateResult } from "lit";
import type { WizardData } from "../types/studio-types.ts";

export type StudioSecurityProps = {
  data: WizardData;
  onDataChange: (patch: Partial<WizardData>) => void;
};

export function renderStudioSecurity(props: StudioSecurityProps): TemplateResult {
  const { data, onDataChange } = props;
  const security = data.security;

  const updateSecurity = (patch: Partial<WizardData["security"]>) => {
    onDataChange({ security: { ...security, ...patch } });
  };

  const modes: Array<{
    id: WizardData["security"]["mode"];
    label: string;
    description: string;
    recommended?: boolean;
  }> = [
    {
      id: "pairing",
      label: "Pairing code",
      description:
        "New contacts must confirm a pairing phrase before chatting. This is the safest default.",
      recommended: true,
    },
    {
      id: "allowlist",
      label: "Contact list",
      description: "Only the contacts you add below can talk to your assistant.",
    },
    {
      id: "open",
      label: "Open to everyone",
      description: "Anyone can start a conversation with your assistant.",
    },
  ];

  return html`
    <div class="wizard-content">
      <div class="field">
        <label class="field-label">Who can talk to your assistant?</label>
        <div class="security-options">
          ${modes.map(
            (mode) => html`
              <button
                class="radio-card ${security.mode === mode.id ? "radio-card--selected" : ""}"
                @click=${() => updateSecurity({ mode: mode.id })}
              >
                <div class="radio-card__header">
                  <span class="radio-card__radio ${security.mode === mode.id ? "radio-card__radio--checked" : ""}"></span>
                  <span class="radio-card__label">
                    ${mode.label}
                    ${
                      mode.recommended
                        ? html`
                            <span class="badge badge--accent">Recommended</span>
                          `
                        : nothing
                    }
                  </span>
                </div>
                <div class="radio-card__desc">${mode.description}</div>
              </button>
            `,
          )}
        </div>
      </div>

      ${
        security.mode === "allowlist"
          ? html`
            <div class="field">
              <label class="field-label">Allowed contacts</label>
              <div class="field-hint">
                Add phone numbers or usernames, one per line.
              </div>
              <textarea
                class="input textarea"
                rows="4"
                placeholder="+1234567890&#10;@username"
                .value=${security.allowedContacts.join("\n")}
                @input=${(e: Event) => {
                  const lines = (e.target as HTMLTextAreaElement).value
                    .split("\n")
                    .map((l) => l.trim())
                    .filter(Boolean);
                  updateSecurity({ allowedContacts: lines });
                }}
              ></textarea>
            </div>
          `
          : nothing
      }

      ${
        security.mode === "open"
          ? html`
              <div class="callout callout--warn">
                <strong>Heads up:</strong> Anyone who finds your assistant will be able to chat with it. This uses
                your AI provider credits for every conversation.
              </div>
            `
          : nothing
      }
    </div>
  `;
}
