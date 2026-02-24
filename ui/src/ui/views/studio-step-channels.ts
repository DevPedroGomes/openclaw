import { html, nothing, type TemplateResult } from "lit";
import type { WizardData } from "../types/studio-types.ts";

export type StudioChannelsProps = {
  data: WizardData;
  onDataChange: (patch: Partial<WizardData>) => void;
  // WhatsApp QR passthrough from existing state
  whatsappQrDataUrl: string | null;
  whatsappMessage: string | null;
  whatsappConnected: boolean | null;
  whatsappBusy: boolean;
  onWhatsAppStart: (force: boolean) => Promise<void>;
  onWhatsAppWait: () => Promise<void>;
};

export function renderStudioChannels(props: StudioChannelsProps): TemplateResult {
  const { data, onDataChange } = props;
  const channels = data.channels;

  const updateChannels = (patch: Partial<WizardData["channels"]>) => {
    onDataChange({ channels: { ...channels, ...patch } });
  };

  const statusDot = (status: string) => {
    const cls =
      status === "connected"
        ? "status-dot--ok"
        : status === "scanning" || status === "validating"
          ? "status-dot--warn"
          : status === "error"
            ? "status-dot--error"
            : "";
    return html`<span class="status-dot ${cls}"></span>`;
  };

  return html`
    <div class="wizard-content">
      <p class="field-hint" style="margin-bottom: 16px;">
        Connect at least one messaging channel so people can talk to your assistant.
        You can always add more later.
      </p>

      <div class="channel-setup">
        <!-- WhatsApp -->
        <div class="channel-setup-card">
          <div class="channel-setup-card__header">
            <div class="channel-setup-card__title">
              ${statusDot(channels.whatsapp.status)} WhatsApp
            </div>
            <label class="toggle">
              <input
                type="checkbox"
                .checked=${channels.whatsapp.enabled}
                @change=${(e: Event) =>
                  updateChannels({
                    whatsapp: {
                      ...channels.whatsapp,
                      enabled: (e.target as HTMLInputElement).checked,
                    },
                  })}
              />
              <span class="toggle__slider"></span>
            </label>
          </div>
          ${
            channels.whatsapp.enabled
              ? html`
                <div class="channel-setup-card__body">
                  ${
                    props.whatsappQrDataUrl
                      ? html`
                        <div class="qr-container">
                          <img src="${props.whatsappQrDataUrl}" alt="WhatsApp QR Code" class="qr-image" />
                          <p class="field-hint">Scan this QR code with WhatsApp on your phone.</p>
                        </div>
                      `
                      : props.whatsappConnected
                        ? html`
                            <div class="callout callout--ok">WhatsApp connected.</div>
                          `
                        : html`
                          <button
                            class="button button--sm"
                            ?disabled=${props.whatsappBusy}
                            @click=${() => {
                              void props.onWhatsAppStart(false);
                              void props.onWhatsAppWait();
                            }}
                          >
                            ${props.whatsappBusy ? "Generating..." : "Generate QR Code"}
                          </button>
                        `
                  }
                  ${
                    props.whatsappMessage
                      ? html`<div class="field-hint">${props.whatsappMessage}</div>`
                      : nothing
                  }
                </div>
              `
              : nothing
          }
        </div>

        <!-- Telegram -->
        <div class="channel-setup-card">
          <div class="channel-setup-card__header">
            <div class="channel-setup-card__title">
              ${statusDot(channels.telegram.status)} Telegram
            </div>
            <label class="toggle">
              <input
                type="checkbox"
                .checked=${channels.telegram.enabled}
                @change=${(e: Event) =>
                  updateChannels({
                    telegram: {
                      ...channels.telegram,
                      enabled: (e.target as HTMLInputElement).checked,
                    },
                  })}
              />
              <span class="toggle__slider"></span>
            </label>
          </div>
          ${
            channels.telegram.enabled
              ? html`
                <div class="channel-setup-card__body">
                  <input
                    type="password"
                    class="input"
                    placeholder="Bot token from @BotFather"
                    .value=${channels.telegram.token}
                    @input=${(e: Event) =>
                      updateChannels({
                        telegram: {
                          ...channels.telegram,
                          token: (e.target as HTMLInputElement).value,
                        },
                      })}
                  />
                  <details class="help-expand">
                    <summary>How do I get a Telegram bot token?</summary>
                    <div class="help-expand__content">
                      <ol>
                        <li>Open Telegram and search for <strong>@BotFather</strong></li>
                        <li>Send <code>/newbot</code> and follow the prompts</li>
                        <li>Copy the bot token and paste it above</li>
                      </ol>
                    </div>
                  </details>
                </div>
              `
              : nothing
          }
        </div>

        <!-- Discord -->
        <div class="channel-setup-card">
          <div class="channel-setup-card__header">
            <div class="channel-setup-card__title">
              ${statusDot(channels.discord.status)} Discord
            </div>
            <label class="toggle">
              <input
                type="checkbox"
                .checked=${channels.discord.enabled}
                @change=${(e: Event) =>
                  updateChannels({
                    discord: {
                      ...channels.discord,
                      enabled: (e.target as HTMLInputElement).checked,
                    },
                  })}
              />
              <span class="toggle__slider"></span>
            </label>
          </div>
          ${
            channels.discord.enabled
              ? html`
                <div class="channel-setup-card__body">
                  <input
                    type="password"
                    class="input"
                    placeholder="Bot token from Discord Developer Portal"
                    .value=${channels.discord.token}
                    @input=${(e: Event) =>
                      updateChannels({
                        discord: {
                          ...channels.discord,
                          token: (e.target as HTMLInputElement).value,
                        },
                      })}
                  />
                  <details class="help-expand">
                    <summary>How do I get a Discord bot token?</summary>
                    <div class="help-expand__content">
                      <ol>
                        <li>Go to <strong>discord.com/developers</strong></li>
                        <li>Create a new application</li>
                        <li>Navigate to the Bot section and create a bot</li>
                        <li>Copy the token and paste it above</li>
                      </ol>
                    </div>
                  </details>
                </div>
              `
              : nothing
          }
        </div>
      </div>

      <div style="margin-top: 16px;">
        <button
          class="button button--ghost button--sm"
          @click=${() => {
            updateChannels({
              whatsapp: { ...channels.whatsapp, enabled: false },
              telegram: { ...channels.telegram, enabled: false },
              discord: { ...channels.discord, enabled: false },
            });
          }}
        >
          Skip channels for now
        </button>
      </div>
    </div>
  `;
}
