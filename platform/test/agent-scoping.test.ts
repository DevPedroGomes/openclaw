import { describe, it, expect } from "vitest";
import {
  scopeAgentRequest,
  filterAgentsListResponse,
  validateSessionKey,
  type RequestFrame,
} from "../src/ws/agent-scoping.js";

const AGENT_ID = "user-alice123";

describe("scopeAgentRequest", () => {
  it("forces agentId on agents.files.get", () => {
    const frame: RequestFrame = {
      type: "req",
      id: "1",
      method: "agents.files.get",
      params: { agentId: "hacker", name: "SOUL.md" },
    };
    const result = scopeAgentRequest(frame, AGENT_ID);
    expect(result.params?.agentId).toBe(AGENT_ID);
    expect(result.params?.name).toBe("SOUL.md");
  });

  it("forces agentId on agents.files.set", () => {
    const frame: RequestFrame = {
      type: "req",
      id: "2",
      method: "agents.files.set",
      params: { agentId: "other", name: "SOUL.md", content: "test" },
    };
    const result = scopeAgentRequest(frame, AGENT_ID);
    expect(result.params?.agentId).toBe(AGENT_ID);
    expect(result.params?.content).toBe("test");
  });

  it("forces agentId on agents.files.list", () => {
    const frame: RequestFrame = {
      type: "req",
      id: "3",
      method: "agents.files.list",
      params: { agentId: "other" },
    };
    const result = scopeAgentRequest(frame, AGENT_ID);
    expect(result.params?.agentId).toBe(AGENT_ID);
  });

  it("prefixes session key on sessions.list", () => {
    const frame: RequestFrame = {
      type: "req",
      id: "4",
      method: "sessions.list",
      params: { key: "my-session" },
    };
    const result = scopeAgentRequest(frame, AGENT_ID);
    expect(result.params?.key).toBe(`${AGENT_ID}/my-session`);
  });

  it("does not double-prefix already-scoped session key", () => {
    const frame: RequestFrame = {
      type: "req",
      id: "5",
      method: "sessions.get",
      params: { key: `${AGENT_ID}/existing-session` },
    };
    const result = scopeAgentRequest(frame, AGENT_ID);
    expect(result.params?.key).toBe(`${AGENT_ID}/existing-session`);
  });

  it("forces agentId on sessions with agentId param", () => {
    const frame: RequestFrame = {
      type: "req",
      id: "6",
      method: "sessions.create",
      params: { agentId: "other-agent", key: "new" },
    };
    const result = scopeAgentRequest(frame, AGENT_ID);
    expect(result.params?.agentId).toBe(AGENT_ID);
  });

  it("returns frame unchanged for non-scoped methods", () => {
    const frame: RequestFrame = {
      type: "req",
      id: "7",
      method: "health",
      params: {},
    };
    const result = scopeAgentRequest(frame, AGENT_ID);
    expect(result).toEqual(frame);
  });
});

describe("filterAgentsListResponse", () => {
  it("filters to only the tenant's agent", () => {
    const payload = {
      agents: [
        { id: AGENT_ID, name: "Alice" },
        { id: "user-bob", name: "Bob" },
        { id: "main", name: "Main" },
      ],
    };
    const result = filterAgentsListResponse(payload, AGENT_ID) as any;
    expect(result.agents).toHaveLength(1);
    expect(result.agents[0].id).toBe(AGENT_ID);
  });

  it("returns empty array if agent not found", () => {
    const payload = {
      agents: [{ id: "user-bob", name: "Bob" }],
    };
    const result = filterAgentsListResponse(payload, AGENT_ID) as any;
    expect(result.agents).toHaveLength(0);
  });

  it("handles null/undefined payload", () => {
    expect(filterAgentsListResponse(null, AGENT_ID)).toBeNull();
    expect(filterAgentsListResponse(undefined, AGENT_ID)).toBeUndefined();
  });

  it("handles payload without agents array", () => {
    const payload = { defaultId: "main" };
    const result = filterAgentsListResponse(payload, AGENT_ID);
    expect(result).toEqual(payload);
  });
});

describe("validateSessionKey", () => {
  it("accepts keys with correct agent prefix", () => {
    expect(validateSessionKey(`${AGENT_ID}/session-1`, AGENT_ID)).toBe(true);
    expect(validateSessionKey(`${AGENT_ID}/deep/nested/key`, AGENT_ID)).toBe(true);
  });

  it("rejects keys with wrong prefix", () => {
    expect(validateSessionKey("user-bob/session-1", AGENT_ID)).toBe(false);
    expect(validateSessionKey("main/session-1", AGENT_ID)).toBe(false);
  });

  it("rejects keys without any prefix", () => {
    expect(validateSessionKey("session-1", AGENT_ID)).toBe(false);
  });
});
