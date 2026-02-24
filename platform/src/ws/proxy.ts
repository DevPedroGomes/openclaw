import type { Hono } from "hono";
import { createNodeWebSocket } from "@hono/node-ws";
import { eq } from "drizzle-orm";
import WebSocket from "ws";
import type { PlatformEnv } from "../env.js";
import type { AppContext } from "../server.js";
import { tenant } from "../db/schema.js";
import {
  interceptClientFrame,
  interceptGatewayFrame,
  buildBlockResponse,
  type Frame,
} from "./frame-interceptor.js";

// Create a short-lived gateway RPC client for provisioning/admin tasks
export function createGatewayRpc(env: PlatformEnv) {
  let ws: WebSocket | null = null;
  let connected = false;
  const pending = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  let idCounter = 0;
  let connectResolve: (() => void) | null = null;
  const connectPromise = new Promise<void>((r) => {
    connectResolve = r;
  });

  ws = new WebSocket(env.GATEWAY_URL);

  ws.on("message", (data) => {
    let frame: Frame;
    try {
      frame = JSON.parse(String(data)) as Frame;
    } catch {
      return;
    }

    // Handle connect challenge
    if (frame.type === "event" && frame.event === "connect.challenge") {
      const connectFrame = {
        type: "req",
        id: `rpc-connect`,
        method: "connect",
        params: {
          minProtocol: 3,
          maxProtocol: 3,
          client: {
            id: "openclaw-platform",
            version: "1.0.0",
            platform: "server",
            mode: "api",
          },
          role: "operator",
          scopes: ["operator.admin"],
          auth: { token: env.GATEWAY_TOKEN },
        },
      };
      ws!.send(JSON.stringify(connectFrame));
      return;
    }

    if (frame.type === "hello-ok") {
      connected = true;
      connectResolve?.();
      return;
    }

    if (frame.type === "res" && frame.id) {
      const p = pending.get(frame.id);
      if (p) {
        pending.delete(frame.id);
        if (frame.ok) {
          p.resolve(frame.payload);
        } else {
          p.reject(new Error((frame.error as { message?: string })?.message ?? "RPC failed"));
        }
      }
    }
  });

  ws.on("error", (err) => {
    console.error("[platform] Gateway RPC error:", err.message);
  });

  const rpc = async (method: string, params?: unknown): Promise<unknown> => {
    await connectPromise;
    const id = `rpc-${++idCounter}`;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      ws!.send(JSON.stringify({ type: "req", id, method, params }));
      // Timeout after 30s
      setTimeout(() => {
        if (pending.has(id)) {
          pending.delete(id);
          reject(new Error(`RPC timeout: ${method}`));
        }
      }, 30_000);
    });
  };

  rpc.close = () => {
    ws?.close();
    ws = null;
  };

  return rpc;
}

export function createWsProxy(app: Hono, ctx: AppContext) {
  const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app: app as any });

  app.get(
    "/ws",
    upgradeWebSocket(async (c) => {
      // Validate session from cookie
      const session = await ctx.auth.api.getSession({
        headers: c.req.raw.headers,
      });

      if (!session?.user) {
        return {
          onOpen: (_evt, ws) => {
            ws.close(4001, "Unauthorized");
          },
        };
      }

      // Lookup tenant
      const [row] = await ctx.db
        .select()
        .from(tenant)
        .where(eq(tenant.userId, session.user.id))
        .limit(1);

      if (!row?.agentProvisioned) {
        return {
          onOpen: (_evt, ws) => {
            ws.close(4003, "Tenant not provisioned");
          },
        };
      }

      const agentId = row.agentId;

      // Shared state across callbacks — the backend WS is opened in onOpen
      // and referenced in onMessage/onClose.
      let backendWs: WebSocket | null = null;
      let backendReady = false;

      return {
        onOpen(_evt, clientWs) {
          backendWs = new WebSocket(ctx.env.GATEWAY_URL);

          backendWs.on("message", (data) => {
            const raw = String(data);
            let frame: Frame;
            try {
              frame = JSON.parse(raw) as Frame;
            } catch {
              return;
            }

            // Handle gateway connect challenge — proxy authenticates itself
            if (frame.type === "event" && frame.event === "connect.challenge") {
              backendWs!.send(
                JSON.stringify({
                  type: "req",
                  id: "proxy-connect",
                  method: "connect",
                  params: {
                    minProtocol: 3,
                    maxProtocol: 3,
                    client: {
                      id: "openclaw-platform",
                      version: "1.0.0",
                      platform: "server",
                      mode: "api",
                    },
                    role: "operator",
                    scopes: ["operator.admin"],
                    auth: { token: ctx.env.GATEWAY_TOKEN },
                  },
                }),
              );
              return;
            }

            // Forward hello-ok to client
            if (frame.type === "hello-ok") {
              backendReady = true;
              clientWs.send(raw);
              return;
            }

            // Intercept gateway → client
            const result = interceptGatewayFrame(frame, agentId);
            switch (result.action) {
              case "forward":
                clientWs.send(raw);
                break;
              case "rewrite":
                clientWs.send(JSON.stringify(result.frame));
                break;
              case "block":
                break;
            }
          });

          backendWs.on("close", () => {
            clientWs.close(1011, "Gateway disconnected");
          });

          backendWs.on("error", (err) => {
            console.error(`[platform] Backend WS error for ${agentId}:`, err.message);
          });
        },

        onMessage(evt, clientWs) {
          if (!backendReady || !backendWs) return;
          const raw = typeof evt.data === "string" ? evt.data : String(evt.data);
          let frame: Frame;
          try {
            frame = JSON.parse(raw) as Frame;
          } catch {
            return;
          }

          const result = interceptClientFrame(frame, agentId);
          switch (result.action) {
            case "forward":
              backendWs.send(raw);
              break;
            case "rewrite":
              backendWs.send(JSON.stringify(result.frame));
              break;
            case "block":
              if (frame.id) {
                clientWs.send(buildBlockResponse(frame.id, result.error ?? "Blocked"));
              }
              break;
          }
        },

        onClose() {
          backendWs?.close();
          backendWs = null;
        },

        onError(_evt, ws) {
          ws.close(1011, "WebSocket error");
        },
      };
    }),
  );

  // Return injectWebSocket for the server to call
  return { injectWebSocket };
}
