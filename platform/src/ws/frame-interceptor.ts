// Parse, filter, and rewrite gateway RPC frames for tenant isolation

import { scopeAgentRequest, filterAgentsListResponse } from "./agent-scoping.js";
import { getMethodStrategy, type MethodStrategy } from "./allowed-methods.js";

export type Frame = {
  type: string;
  id?: string;
  method?: string;
  params?: Record<string, unknown>;
  event?: string;
  payload?: unknown;
  ok?: boolean;
  error?: unknown;
  [key: string]: unknown;
};

export type InterceptResult = {
  action: "forward" | "block" | "rewrite" | "synthetic";
  frame?: Frame;
  error?: string;
};

// Track pending request methods for response interception
const pendingMethods = new Map<string, string>();

// Intercept client→gateway request frames
export function interceptClientFrame(frame: Frame, agentId: string): InterceptResult {
  if (frame.type !== "req" || !frame.method) {
    return { action: "forward", frame };
  }

  const strategy = getMethodStrategy(frame.method);

  switch (strategy) {
    case "block":
      return {
        action: "block",
        error: `Method "${frame.method}" is not available in platform mode`,
      };

    case "allow":
      // Track for response interception
      if (frame.id) pendingMethods.set(frame.id, frame.method);
      return { action: "forward", frame };

    case "rewrite": {
      const rewritten = scopeAgentRequest(
        frame as { type: "req"; id: string; method: string; params?: Record<string, unknown> },
        agentId,
      );
      if (frame.id) pendingMethods.set(frame.id, frame.method);
      return { action: "rewrite", frame: rewritten };
    }

    case "filter":
      // Forward but remember to filter response
      if (frame.id) pendingMethods.set(frame.id, frame.method);
      return { action: "forward", frame };

    case "transform":
      // config.patch — block raw patches, they must go through REST API
      return {
        action: "block",
        error: "Direct config.patch is not allowed. Use the tenant config API instead.",
      };

    default:
      return { action: "block", error: `Unknown method: ${frame.method}` };
  }
}

// Intercept gateway→client response frames
export function interceptGatewayFrame(frame: Frame, agentId: string): InterceptResult {
  // Events pass through (except sensitive ones)
  if (frame.type === "event") {
    const event = frame.event ?? "";
    // Block admin events
    if (event.startsWith("node.") || event.startsWith("device.")) {
      return { action: "block" };
    }
    return { action: "forward", frame };
  }

  // Response frames — check if we need to filter
  if (frame.type === "res" && frame.id) {
    const method = pendingMethods.get(frame.id);
    pendingMethods.delete(frame.id);

    if (method === "agents.list" && frame.ok) {
      const filtered = filterAgentsListResponse(frame.payload, agentId);
      return { action: "rewrite", frame: { ...frame, payload: filtered } };
    }

    return { action: "forward", frame };
  }

  return { action: "forward", frame };
}

// Build a synthetic error response for blocked requests
export function buildBlockResponse(requestId: string, error: string): string {
  return JSON.stringify({
    type: "res",
    id: requestId,
    ok: false,
    error: { code: "PLATFORM_BLOCKED", message: error },
  });
}

// Clean up tracked methods (call on connection close)
export function clearPendingMethods() {
  pendingMethods.clear();
}
