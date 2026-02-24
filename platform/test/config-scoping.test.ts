import { describe, it, expect } from "vitest";
import { buildScopedConfigPatch, validateConfigPatch } from "../src/ws/config-scoping.js";

const AGENT_ID = "user-alice123";

const SAMPLE_CONFIG = {
  agents: {
    list: [
      { id: "main", model: { primary: "anthropic/claude-sonnet-4-20250514" } },
      { id: AGENT_ID, model: { primary: "anthropic/claude-haiku-3-5-20241022" } },
      { id: "user-bob", model: { primary: "openai/gpt-4o" } },
    ],
    defaults: { maxTurns: 10 },
  },
  gateway: { mode: "local" },
};

describe("buildScopedConfigPatch", () => {
  it("updates the model for the tenant's agent only", () => {
    const patch = buildScopedConfigPatch(SAMPLE_CONFIG, AGENT_ID, {
      model: "anthropic/claude-sonnet-4-20250514",
    });

    expect(patch).not.toBeNull();
    const agents = (patch as any).agents.list;
    expect(agents).toHaveLength(3);

    // Only Alice's agent should be updated
    const alice = agents.find((a: any) => a.id === AGENT_ID);
    expect(alice.model.primary).toBe("anthropic/claude-sonnet-4-20250514");

    // Others unchanged
    const main = agents.find((a: any) => a.id === "main");
    expect(main.model.primary).toBe("anthropic/claude-sonnet-4-20250514");
    const bob = agents.find((a: any) => a.id === "user-bob");
    expect(bob.model.primary).toBe("openai/gpt-4o");
  });

  it("returns null if agent not found in config", () => {
    const patch = buildScopedConfigPatch(SAMPLE_CONFIG, "user-nonexistent", {
      model: "openai/gpt-4",
    });
    expect(patch).toBeNull();
  });

  it("preserves existing agent properties", () => {
    const config = {
      agents: {
        list: [{ id: AGENT_ID, model: { primary: "old" }, custom: "data" }],
      },
    };
    const patch = buildScopedConfigPatch(config, AGENT_ID, { model: "new" });
    const agent = (patch as any).agents.list[0];
    expect(agent.model.primary).toBe("new");
    expect(agent.custom).toBe("data");
  });

  it("handles empty input (no changes)", () => {
    const patch = buildScopedConfigPatch(SAMPLE_CONFIG, AGENT_ID, {});
    expect(patch).not.toBeNull();
    // Should still produce a patch (with unchanged values)
    const agents = (patch as any).agents.list;
    const alice = agents.find((a: any) => a.id === AGENT_ID);
    expect(alice.model.primary).toBe("anthropic/claude-haiku-3-5-20241022");
  });
});

describe("validateConfigPatch", () => {
  it("allows patches that only touch the tenant's agent", () => {
    const patch = {
      agents: {
        list: [{ id: AGENT_ID, model: { primary: "new-model" } }],
      },
    };
    expect(validateConfigPatch(patch, AGENT_ID)).toBe(true);
  });

  it("rejects patches that touch gateway config", () => {
    const patch = { gateway: { mode: "remote" } };
    expect(validateConfigPatch(patch, AGENT_ID)).toBe(false);
  });

  it("rejects patches that touch channels config", () => {
    const patch = { channels: { telegram: { token: "stolen" } } };
    expect(validateConfigPatch(patch, AGENT_ID)).toBe(false);
  });

  it("rejects patches that touch auth config", () => {
    const patch = { auth: { anthropic: { apiKey: "stolen" } } };
    expect(validateConfigPatch(patch, AGENT_ID)).toBe(false);
  });

  it("rejects patches that touch another tenant's agent", () => {
    const patch = {
      agents: {
        list: [
          { id: AGENT_ID, model: { primary: "ok" } },
          { id: "user-bob", model: { primary: "hijacked" } },
        ],
      },
    };
    expect(validateConfigPatch(patch, AGENT_ID)).toBe(false);
  });

  it("allows patches with models (providers)", () => {
    const patch = {
      models: {
        providers: {
          [`${AGENT_ID}-anthropic`]: { apiKey: "key" },
        },
      },
    };
    expect(validateConfigPatch(patch, AGENT_ID)).toBe(true);
  });

  it("rejects exec config", () => {
    expect(validateConfigPatch({ exec: { enabled: true } }, AGENT_ID)).toBe(false);
  });

  it("rejects node config", () => {
    expect(validateConfigPatch({ node: {} }, AGENT_ID)).toBe(false);
  });
});
