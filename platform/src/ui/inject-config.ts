import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

let cachedHtml: string | null = null;

// Inject platform mode globals into the UI's index.html
export async function injectPlatformConfig(): Promise<string | null> {
  if (cachedHtml) return cachedHtml;

  const indexPath = resolve(import.meta.dirname ?? ".", "../../..", "dist/control-ui/index.html");

  let html: string;
  try {
    html = await readFile(indexPath, "utf8");
  } catch {
    return null;
  }

  // Inject config script before </head>
  const configScript = `
<script>
  window.__OPENCLAW_PLATFORM_MODE__ = true;
  window.__OPENCLAW_PLATFORM_WS_URL__ = (location.protocol === "https:" ? "wss:" : "ws:") + "//" + location.host + "/ws";
  window.__OPENCLAW_PLATFORM_API_URL__ = location.origin + "/api";
</script>`;

  html = html.replace("</head>", `${configScript}\n</head>`);
  cachedHtml = html;
  return html;
}

// Clear cache (for dev/testing)
export function clearHtmlCache() {
  cachedHtml = null;
}
