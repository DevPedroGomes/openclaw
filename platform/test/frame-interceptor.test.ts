import { describe, it, expect, beforeEach } from "vitest";
import {
  interceptClientFrame,
  interceptGatewayFrame,
  buildBlockResponse,
  clearPendingMethods,
  type Frame,
} from "../src/ws/frame-interceptor.js";

const AGENT_ID = "user-alice123";

beforeEach(() => {
  clearPendingMethods();
});

describe("interceptClientFrame", () => {
  it("blocks connect method", () => {
    const frame: Frame = { type: "req", id: "1", method: "connect", params: {} };
    const result = interceptClientFrame(frame, AGENT_ID);
    expect(result.action).toBe("block");
    expect(result.error).toContain("connect");
  });

  it("blocks config.get", () => {
    const frame: Frame = { type: "req", id: "2", method: "config.get" };
    const result = interceptClientFrame(frame, AGENT_ID);
    expect(result.action).toBe("block");
  });

  it("blocks config.set", () => {
    const frame: Frame = { type: "req", id: "3", method: "config.set", params: {} };
    const result = interceptClientFrame(frame, AGENT_ID);
    expect(result.action).toBe("block");
  });

  it("blocks config.patch (must use REST API)", () => {
    const frame: Frame = { type: "req", id: "4", method: "config.patch", params: {} };
    const result = interceptClientFrame(frame, AGENT_ID);
    expect(result.action).toBe("block");
    expect(result.error).toContain("tenant config API");
  });

  it("allows health", () => {
    const frame: Frame = { type: "req", id: "5", method: "health" };
    const result = interceptClientFrame(frame, AGENT_ID);
    expect(result.action).toBe("forward");
  });

  it("allows models.list", () => {
    const frame: Frame = { type: "req", id: "6", method: "models.list" };
    const result = interceptClientFrame(frame, AGENT_ID);
    expect(result.action).toBe("forward");
  });

  it("allows config.schema", () => {
    const frame: Frame = { type: "req", id: "7", method: "config.schema" };
    const result = interceptClientFrame(frame, AGENT_ID);
    expect(result.action).toBe("forward");
  });

  it("rewrites agents.files.get with tenant agentId", () => {
    const frame: Frame = {
      type: "req",
      id: "8",
      method: "agents.files.get",
      params: { agentId: "hacker-agent", name: "SOUL.md" },
    };
    const result = interceptClientFrame(frame, AGENT_ID);
    expect(result.action).toBe("rewrite");
    expect((result.frame?.params as any).agentId).toBe(AGENT_ID);
  });

  it("rewrites agents.files.set with tenant agentId", () => {
    const frame: Frame = {
      type: "req",
      id: "9",
      method: "agents.files.set",
      params: { agentId: "other", name: "SOUL.md", content: "Hello" },
    };
    const result = interceptClientFrame(frame, AGENT_ID);
    expect(result.action).toBe("rewrite");
    expect((result.frame?.params as any).agentId).toBe(AGENT_ID);
    expect((result.frame?.params as any).content).toBe("Hello");
  });

  it("forwards agents.list for response filtering", () => {
    const frame: Frame = { type: "req", id: "10", method: "agents.list" };
    const result = interceptClientFrame(frame, AGENT_ID);
    expect(result.action).toBe("forward");
  });

  it("blocks exec.run", () => {
    const frame: Frame = { type: "req", id: "11", method: "exec.run", params: {} };
    const result = interceptClientFrame(frame, AGENT_ID);
    expect(result.action).toBe("block");
  });

  it("blocks node.list", () => {
    const frame: Frame = { type: "req", id: "12", method: "node.list" };
    const result = interceptClientFrame(frame, AGENT_ID);
    expect(result.action).toBe("block");
  });

  it("blocks device.approve", () => {
    const frame: Frame = { type: "req", id: "13", method: "device.approve", params: {} };
    const result = interceptClientFrame(frame, AGENT_ID);
    expect(result.action).toBe("block");
  });

  it("blocks unknown methods by default", () => {
    const frame: Frame = { type: "req", id: "14", method: "some.unknown.method" };
    const result = interceptClientFrame(frame, AGENT_ID);
    expect(result.action).toBe("block");
  });

  it("passes through non-request frames", () => {
    const frame: Frame = { type: "event", event: "ping" };
    const result = interceptClientFrame(frame, AGENT_ID);
    expect(result.action).toBe("forward");
  });

  it("blocks skills.install", () => {
    const frame: Frame = { type: "req", id: "15", method: "skills.install", params: {} };
    const result = interceptClientFrame(frame, AGENT_ID);
    expect(result.action).toBe("block");
  });

  it("allows skills.list", () => {
    const frame: Frame = { type: "req", id: "16", method: "skills.list" };
    const result = interceptClientFrame(frame, AGENT_ID);
    expect(result.action).toBe("forward");
  });

  it("rewrites web.login.start with tenant accountId", () => {
    const frame: Frame = {
      type: "req",
      id: "17",
      method: "web.login.start",
      params: { force: true },
    };
    const result = interceptClientFrame(frame, AGENT_ID);
    expect(result.action).toBe("rewrite");
    expect((result.frame?.params as any).accountId).toBe(`${AGENT_ID}-wa`);
    expect((result.frame?.params as any).force).toBe(true);
  });

  it("rewrites web.login.wait with tenant accountId", () => {
    const frame: Frame = {
      type: "req",
      id: "18",
      method: "web.login.wait",
      params: { timeoutMs: 120000 },
    };
    const result = interceptClientFrame(frame, AGENT_ID);
    expect(result.action).toBe("rewrite");
    expect((result.frame?.params as any).accountId).toBe(`${AGENT_ID}-wa`);
  });
});

describe("interceptGatewayFrame", () => {
  it("filters agents.list response to only show tenant agent", () => {
    // First, send the request to register the pending method
    interceptClientFrame({ type: "req", id: "20", method: "agents.list" }, AGENT_ID);

    const frame: Frame = {
      type: "res",
      id: "20",
      ok: true,
      payload: {
        agents: [
          { id: AGENT_ID, name: "Alice Bot" },
          { id: "user-bob456", name: "Bob Bot" },
          { id: "main", name: "Main" },
        ],
      },
    };
    const result = interceptGatewayFrame(frame, AGENT_ID);
    expect(result.action).toBe("rewrite");
    const agents = (result.frame?.payload as any).agents;
    expect(agents).toHaveLength(1);
    expect(agents[0].id).toBe(AGENT_ID);
  });

  it("forwards events", () => {
    const frame: Frame = { type: "event", event: "presence.update", payload: {} };
    const result = interceptGatewayFrame(frame, AGENT_ID);
    expect(result.action).toBe("forward");
  });

  it("blocks node.* events", () => {
    const frame: Frame = { type: "event", event: "node.joined", payload: {} };
    const result = interceptGatewayFrame(frame, AGENT_ID);
    expect(result.action).toBe("block");
  });

  it("blocks device.* events", () => {
    const frame: Frame = { type: "event", event: "device.paired", payload: {} };
    const result = interceptGatewayFrame(frame, AGENT_ID);
    expect(result.action).toBe("block");
  });

  it("forwards normal response frames", () => {
    interceptClientFrame({ type: "req", id: "21", method: "health" }, AGENT_ID);
    const frame: Frame = { type: "res", id: "21", ok: true, payload: { ok: true } };
    const result = interceptGatewayFrame(frame, AGENT_ID);
    expect(result.action).toBe("forward");
  });
});

describe("buildBlockResponse", () => {
  it("builds a valid error response", () => {
    const raw = buildBlockResponse("req-1", "Method blocked");
    const parsed = JSON.parse(raw);
    expect(parsed.type).toBe("res");
    expect(parsed.id).toBe("req-1");
    expect(parsed.ok).toBe(false);
    expect(parsed.error.code).toBe("PLATFORM_BLOCKED");
    expect(parsed.error.message).toBe("Method blocked");
  });
});
