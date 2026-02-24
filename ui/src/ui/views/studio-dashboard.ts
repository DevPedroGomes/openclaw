import { html, nothing, type TemplateResult } from "lit";
import type { DashboardData, WizardStep } from "../types/studio-types.ts";

export type StudioDashboardProps = {
  loading: boolean;
  data: DashboardData | null;
  connected: boolean;
  onRefresh: () => Promise<void>;
  onOpenChat: () => void;
  onEditSetup: (step: WizardStep) => void;
  onOpenAdvanced: () => void;
};

function relativeTime(timestamp: number): string {
  if (!timestamp) {
    return "";
  }
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) {
    return "just now";
  }
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function statusLabel(status: string): string {
  switch (status) {
    case "connected":
    case "ok":
      return "Connected";
    case "disconnected":
    case "offline":
      return "Offline";
    case "error":
      return "Error";
    default:
      return status;
  }
}

export function renderStudioDashboard(props: StudioDashboardProps): TemplateResult {
  const { data, loading } = props;

  if (loading && !data) {
    return html`
      <div class="wizard-content"><div class="loading-text">Loading dashboard...</div></div>
    `;
  }

  if (!data) {
    return html`
      <div class="wizard-content">
        <div class="callout callout--info">
          <strong>No data yet.</strong>
          <p>Connect to the gateway to see your assistant's status.</p>
          <button class="button button--sm" @click=${() => void props.onRefresh()}>
            Refresh
          </button>
        </div>
      </div>
    `;
  }

  return html`
    <div class="studio-dashboard">
      <div class="dashboard-hero card">
        <div class="dashboard-hero__emoji">${data.agentEmoji}</div>
        <div class="dashboard-hero__name">${data.agentName}</div>
        <span class="pill ${data.online ? "pill--ok" : "pill--muted"}">
          <span class="statusDot ${data.online ? "ok" : ""}"></span>
          ${data.online ? "Online" : "Offline"}
        </span>
      </div>

      ${
        data.channels.length > 0
          ? html`
            <section>
              <h3 class="section-title">Connected Channels</h3>
              <div class="grid grid-cols-2">
                ${data.channels.map(
                  (ch) => html`
                    <div class="card channel-card">
                      <div class="channel-card__header">
                        <span class="channel-card__name">${ch.label}</span>
                        <span class="pill pill--sm ${ch.status === "connected" || ch.status === "ok" ? "pill--ok" : "pill--muted"}">
                          ${statusLabel(ch.status)}
                        </span>
                      </div>
                      ${
                        ch.lastActivity
                          ? html`<div class="channel-card__activity">${relativeTime(ch.lastActivity)}</div>`
                          : nothing
                      }
                    </div>
                  `,
                )}
              </div>
            </section>
          `
          : html`
            <section>
              <div class="callout callout--info">
                No channels connected yet.
                <button class="button button--sm button--ghost" @click=${() => props.onEditSetup("channels")}>
                  Add a channel
                </button>
              </div>
            </section>
          `
      }

      ${
        data.recentSessions.length > 0
          ? html`
            <section>
              <h3 class="section-title">Recent Conversations</h3>
              <div class="card">
                ${data.recentSessions.map(
                  (s) => html`
                    <div class="session-row">
                      <span class="session-row__preview">${s.preview}</span>
                      <span class="session-row__time">${relativeTime(s.timestamp)}</span>
                    </div>
                  `,
                )}
              </div>
            </section>
          `
          : nothing
      }

      <div class="dashboard-actions">
        <button class="button button--accent" @click=${() => props.onOpenChat()}>
          Chat
        </button>
        <button class="button button--ghost" @click=${() => props.onEditSetup("identity")}>
          Edit personality
        </button>
        <button class="button button--ghost" @click=${() => props.onEditSetup("channels")}>
          Add channel
        </button>
        <button class="button button--ghost" @click=${() => props.onOpenAdvanced()}>
          Advanced settings
        </button>
      </div>
    </div>
  `;
}
