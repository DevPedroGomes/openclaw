import type { Hono } from "hono";
import { serveStatic } from "@hono/node-server/serve-static";
import { injectPlatformConfig } from "./inject-config.js";

// Serve the Studio UI build as a SPA.
// The UI build lives at ../dist/control-ui (built by the ui/ workspace).
export function serveSpa(app: Hono) {
  // Static assets (JS, CSS, images)
  app.use("/assets/*", serveStatic({ root: "../dist/control-ui" }));

  // Favicon and other static files
  app.use("/favicon.*", serveStatic({ root: "../dist/control-ui" }));

  // SPA fallback — inject platform config into index.html
  app.get("*", async (c) => {
    const html = await injectPlatformConfig();
    if (!html) {
      return c.text("UI not built. Run 'pnpm --dir ui build' first.", 503);
    }
    return c.html(html);
  });
}
