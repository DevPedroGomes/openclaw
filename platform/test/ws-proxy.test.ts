import { describe, it, expect } from "vitest";
import {
  interceptClientFrame,
  interceptGatewayFrame,
  buildBlockResponse,
  clearPendingMethods,
  type Frame,
} from "../src/ws/frame-interceptor.js";

// Integration-style tests for the full proxy interceptor pipeline

const AGENT_ID = "user-test-tenant";

describe("ws-proxy interceptor pipeline", () => {
  beforeEach(() => {
    clearPendingMethods();
  });

  it("full request-response cycle: health check", () => {
    // Client sends health request
    const req: Frame = { type: "req", id: "100", method: "health" };
    const clientResult = interceptClientFrame(req, AGENT_ID);
    expect(clientResult.action).toBe("forward");

    // Gateway responds
    const res: Frame = { type: "res", id: "100", ok: true, payload: { ok: true } };
    const gwResult = interceptGatewayFrame(res, AGENT_ID);
    expect(gwResult.action).toBe("forward");
    expect((gwResult.frame?.payload as any).ok).toBe(true);
  });

  it("full request-response cycle: agents.list filtered", () => {
    // Client sends agents.list
    const req: Frame = { type: "req", id: "101", method: "agents.list" };
    const clientResult = interceptClientFrame(req, AGENT_ID);
    expect(clientResult.action).toBe("forward");

    // Gateway responds with multiple agents
    const res: Frame = {
      type: "res",
      id: "101",
      ok: true,
      payload: {
        agents: [{ id: AGENT_ID }, { id: "user-other" }, { id: "main" }],
      },
    };
    const gwResult = interceptGatewayFrame(res, AGENT_ID);
    expect(gwResult.action).toBe("rewrite");
    const agents = (gwResult.frame?.payload as any).agents;
    expect(agents).toHaveLength(1);
    expect(agents[0].id).toBe(AGENT_ID);
  });

  it("full request-response cycle: agents.files.set rewritten", () => {
    const req: Frame = {
      type: "req",
      id: "102",
      method: "agents.files.set",
      params: { agentId: "wrong-agent", name: "SOUL.md", content: "test" },
    };
    const clientResult = interceptClientFrame(req, AGENT_ID);
    expect(clientResult.action).toBe("rewrite");
    expect((clientResult.frame?.params as any).agentId).toBe(AGENT_ID);

    // Gateway responds
    const res: Frame = {
      type: "res",
      id: "102",
      ok: true,
      payload: { ok: true },
    };
    const gwResult = interceptGatewayFrame(res, AGENT_ID);
    expect(gwResult.action).toBe("forward");
  });

  it("blocked request returns synthetic error", () => {
    const req: Frame = { type: "req", id: "103", method: "exec.run", params: {} };
    const result = interceptClientFrame(req, AGENT_ID);
    expect(result.action).toBe("block");

    // Build synthetic response
    const response = buildBlockResponse("103", result.error!);
    const parsed = JSON.parse(response);
    expect(parsed.ok).toBe(false);
    expect(parsed.id).toBe("103");
    expect(parsed.error.code).toBe("PLATFORM_BLOCKED");
  });

  it("events pass through except admin events", () => {
    // Normal event
    const event1: Frame = { type: "event", event: "presence.update", payload: {} };
    expect(interceptGatewayFrame(event1, AGENT_ID).action).toBe("forward");

    // Blocked events
    const event2: Frame = { type: "event", event: "node.joined", payload: {} };
    expect(interceptGatewayFrame(event2, AGENT_ID).action).toBe("block");

    const event3: Frame = { type: "event", event: "device.paired", payload: {} };
    expect(interceptGatewayFrame(event3, AGENT_ID).action).toBe("block");
  });

  it("sessions.list gets session key prefixed", () => {
    const req: Frame = {
      type: "req",
      id: "104",
      method: "sessions.list",
      params: { key: "my-chat" },
    };
    const result = interceptClientFrame(req, AGENT_ID);
    expect(result.action).toBe("rewrite");
    expect((result.frame?.params as any).key).toBe(`${AGENT_ID}/my-chat`);
  });

  it("multiple concurrent requests tracked independently", () => {
    // Send two requests
    interceptClientFrame({ type: "req", id: "200", method: "health" }, AGENT_ID);
    interceptClientFrame({ type: "req", id: "201", method: "agents.list" }, AGENT_ID);

    // Responses arrive out of order
    const res1: Frame = {
      type: "res",
      id: "201",
      ok: true,
      payload: { agents: [{ id: AGENT_ID }, { id: "other" }] },
    };
    const gwResult1 = interceptGatewayFrame(res1, AGENT_ID);
    expect(gwResult1.action).toBe("rewrite"); // filtered

    const res2: Frame = {
      type: "res",
      id: "200",
      ok: true,
      payload: { ok: true },
    };
    const gwResult2 = interceptGatewayFrame(res2, AGENT_ID);
    expect(gwResult2.action).toBe("forward"); // not filtered
  });
});
