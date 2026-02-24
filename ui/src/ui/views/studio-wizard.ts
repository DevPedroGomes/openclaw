import { html, nothing, type TemplateResult } from "lit";
import { validateWizardStep } from "../controllers/studio.ts";
import { WIZARD_STEPS, type WizardData, type WizardStep } from "../types/studio-types.ts";
import { renderStudioBrain } from "./studio-step-brain.ts";
import { renderStudioCapabilities } from "./studio-step-capabilities.ts";
import { renderStudioChannels } from "./studio-step-channels.ts";
import { renderStudioIdentity } from "./studio-step-identity.ts";
import { renderStudioSecurity } from "./studio-step-security.ts";

const STEP_LABELS: Record<WizardStep, string> = {
  identity: "Identity",
  brain: "Brain",
  channels: "Channels",
  security: "Security",
  capabilities: "Capabilities",
};

export type StudioWizardProps = {
  step: WizardStep;
  data: WizardData;
  saving: boolean;
  error: string | null;
  connected: boolean;
  // WhatsApp QR passthrough
  whatsappQrDataUrl: string | null;
  whatsappMessage: string | null;
  whatsappConnected: boolean | null;
  whatsappBusy: boolean;
  // Callbacks
  onStepChange: (step: WizardStep) => void;
  onDataChange: (patch: Partial<WizardData>) => void;
  onFinish: () => Promise<void>;
  onWhatsAppStart: (force: boolean) => Promise<void>;
  onWhatsAppWait: () => Promise<void>;
};

function renderStepContent(props: StudioWizardProps): TemplateResult {
  const common = { data: props.data, onDataChange: props.onDataChange };
  switch (props.step) {
    case "identity":
      return renderStudioIdentity(common);
    case "brain":
      return renderStudioBrain(common);
    case "channels":
      return renderStudioChannels({
        ...common,
        whatsappQrDataUrl: props.whatsappQrDataUrl,
        whatsappMessage: props.whatsappMessage,
        whatsappConnected: props.whatsappConnected,
        whatsappBusy: props.whatsappBusy,
        onWhatsAppStart: props.onWhatsAppStart,
        onWhatsAppWait: props.onWhatsAppWait,
      });
    case "security":
      return renderStudioSecurity(common);
    case "capabilities":
      return renderStudioCapabilities(common);
  }
}

export function renderStudioWizard(props: StudioWizardProps): TemplateResult {
  const currentIndex = WIZARD_STEPS.indexOf(props.step);
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === WIZARD_STEPS.length - 1;

  const goBack = () => {
    if (!isFirst) {
      props.onStepChange(WIZARD_STEPS[currentIndex - 1]);
    }
  };

  const goNext = () => {
    if (isLast) {
      void props.onFinish();
      return;
    }
    const result = validateWizardStep(props.step, props.data);
    if (result.valid) {
      props.onStepChange(WIZARD_STEPS[currentIndex + 1]);
    }
  };

  const validation = validateWizardStep(props.step, props.data);

  return html`
    <div class="wizard">
      <div class="wizard-stepper">
        ${WIZARD_STEPS.map((step, i) => {
          const isComplete = i < currentIndex;
          const isActive = i === currentIndex;
          const isFuture = i > currentIndex;
          return html`
            ${i > 0 ? html`<div class="wizard-connector ${isComplete ? "wizard-connector--done" : ""}"></div>` : nothing}
            <button
              class="wizard-step ${isActive ? "wizard-step--active" : ""} ${isComplete ? "wizard-step--complete" : ""} ${isFuture ? "wizard-step--disabled" : ""}"
              @click=${() => {
                if (isComplete) {
                  props.onStepChange(step);
                }
              }}
              ?disabled=${isFuture}
            >
              <span class="wizard-step__number">
                ${
                  isComplete
                    ? html`
                        <span class="wizard-step__check">&#10003;</span>
                      `
                    : `${i + 1}`
                }
              </span>
              <span class="wizard-step__label">${STEP_LABELS[step]}</span>
            </button>
          `;
        })}
      </div>

      <div class="wizard-body">
        ${renderStepContent(props)}
      </div>

      ${props.error ? html`<div class="callout callout--error">${props.error}</div>` : nothing}

      ${
        !validation.valid && validation.errors.length > 0
          ? html`
            <div class="wizard-validation">
              ${validation.errors.map((err) => html`<div class="field-error">${err}</div>`)}
            </div>
          `
          : nothing
      }

      <div class="wizard-nav">
        <button
          class="button button--ghost"
          ?disabled=${isFirst}
          @click=${goBack}
        >
          &larr; Back
        </button>
        <button
          class="button button--accent"
          ?disabled=${props.saving}
          @click=${goNext}
        >
          ${props.saving ? "Saving..." : isLast ? "Create my assistant!" : "Next &rarr;"}
        </button>
      </div>
    </div>
  `;
}
