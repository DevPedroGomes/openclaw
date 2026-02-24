import { html, type TemplateResult } from "lit";
import type { WizardData } from "../types/studio-types.ts";
import { PERSONALITY_TEMPLATES } from "../data/personality-templates.ts";

const EMOJI_OPTIONS = ["🤖", "🧠", "💬", "🌟", "🎯", "🦊", "🐙", "⚡"];

export type StudioIdentityProps = {
  data: WizardData;
  onDataChange: (patch: Partial<WizardData>) => void;
};

export function renderStudioIdentity(props: StudioIdentityProps): TemplateResult {
  const { data, onDataChange } = props;
  const identity = data.identity;
  const selectedTemplate = PERSONALITY_TEMPLATES.find((t) => t.id === identity.templateId);

  const updateIdentity = (patch: Partial<WizardData["identity"]>) => {
    onDataChange({ identity: { ...identity, ...patch } });
  };

  return html`
    <div class="wizard-content">
      <div class="field">
        <label class="field-label">What should your assistant be called?</label>
        <input
          type="text"
          class="input"
          placeholder="e.g. Atlas, Luna, Max..."
          .value=${identity.name}
          @input=${(e: Event) => updateIdentity({ name: (e.target as HTMLInputElement).value })}
          autofocus
        />
      </div>

      <div class="field">
        <label class="field-label">Pick an emoji</label>
        <div class="emoji-picker">
          ${EMOJI_OPTIONS.map(
            (emoji) => html`
              <button
                class="emoji-option ${identity.emoji === emoji ? "emoji-option--selected" : ""}"
                @click=${() => updateIdentity({ emoji })}
              >
                ${emoji}
              </button>
            `,
          )}
        </div>
      </div>

      <div class="field">
        <label class="field-label">Choose a personality</label>
        <div class="template-grid">
          ${PERSONALITY_TEMPLATES.map(
            (template) => html`
              <button
                class="template-card ${identity.templateId === template.id ? "template-card--selected" : ""}"
                @click=${() => {
                  updateIdentity({
                    templateId: template.id,
                    customDescription:
                      template.id === "custom" ? identity.customDescription : template.soulMd,
                  });
                }}
              >
                <div class="template-card__emoji">${template.emoji}</div>
                <div class="template-card__label">${template.label}</div>
                <div class="template-card__desc">${template.description}</div>
              </button>
            `,
          )}
        </div>
      </div>

      <div class="field">
        <label class="field-label">Personality description</label>
        <textarea
          class="input textarea"
          rows="8"
          placeholder="Describe how your assistant should behave..."
          .value=${identity.customDescription || selectedTemplate?.soulMd || ""}
          @input=${(e: Event) =>
            updateIdentity({ customDescription: (e.target as HTMLTextAreaElement).value })}
        ></textarea>
        <div class="field-hint">This becomes your assistant's SOUL.md — its core identity.</div>
      </div>
    </div>
  `;
}
