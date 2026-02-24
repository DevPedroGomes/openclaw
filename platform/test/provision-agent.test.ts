import { describe, it, expect } from "vitest";
import type { PlatformEnv } from "../src/env.js";
import {
  buildAgentConfigPatch,
  buildByokProviderPatch,
} from "../src/provisioning/config-builder.js";

const BASE_ENV: PlatformEnv = {
  DATABASE_URL: "postgresql://test",
  GATEWAY_URL: "ws://localhost:18789",
  GATEWAY_TOKEN: "test-token",
  PLATFORM_ENCRYPTION_KEY: "a".repeat(64),
  BETTER_AUTH_SECRET: "test-secret",
  PLATFORM_PORT: 3000,
  PLATFORM_SHARED_ANTHROPIC_KEY: null,
  PLATFORM_SHARED_OPENAI_KEY: null,
};

describe("buildAgentConfigPatch", () => {
  it("appends a new agent to an existing list", () => {
    const currentConfig = {
      agents: {
        list: [{ id: "main" }],
      },
    };
    const patch = buildAgentConfigPatch(currentConfig, "user-alice", "Alice", BASE_ENV);
    const list = (patch as any).agents.list;
    expect(list).toHaveLength(2);
    expect(list[0].id).toBe("main");
    expect(list[1].id).toBe("user-alice");
  });

  it("creates agents.list when none exists", () => {
    const patch = buildAgentConfigPatch({}, "user-alice", "Alice", BASE_ENV);
    const list = (patch as any).agents.list;
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe("user-alice");
  });

  it("returns empty patch if agent already exists", () => {
    const currentConfig = {
      agents: {
        list: [{ id: "user-alice" }],
      },
    };
    const patch = buildAgentConfigPatch(currentConfig, "user-alice", "Alice", BASE_ENV);
    expect(Object.keys(patch)).toHaveLength(0);
  });

  it("sets default model when shared anthropic key is available", () => {
    const env = { ...BASE_ENV, PLATFORM_SHARED_ANTHROPIC_KEY: "sk-ant-xxx" };
    const patch = buildAgentConfigPatch({}, "user-alice", "Alice", env);
    const agent = (patch as any).agents.list[0];
    expect(agent.model.primary).toContain("anthropic/");
  });

  it("does not set model when no shared key", () => {
    const patch = buildAgentConfigPatch({}, "user-alice", "Alice", BASE_ENV);
    const agent = (patch as any).agents.list[0];
    expect(agent.model).toBeUndefined();
  });
});

describe("buildByokProviderPatch", () => {
  const BASE_CONFIG = {
    agents: { list: [{ id: "user-alice", model: { primary: "old" } }] },
    models: { providers: {} },
  };

  it("creates a named provider for anthropic", () => {
    const patch = buildByokProviderPatch(
      BASE_CONFIG,
      "user-alice",
      "anthropic",
      "sk-ant-xxx",
      "claude-sonnet-4-20250514",
    );
    const providers = (patch as any).models.providers;
    expect(providers["user-alice-anthropic"]).toBeDefined();
    expect(providers["user-alice-anthropic"].apiKey).toBe("sk-ant-xxx");
    expect(providers["user-alice-anthropic"].api).toBe("anthropic-messages");

    // Agent model reference updated
    const agent = (patch as any).agents.list[0];
    expect(agent.model.primary).toBe("user-alice-anthropic/claude-sonnet-4-20250514");
  });

  it("creates a named provider for openai", () => {
    const patch = buildByokProviderPatch(BASE_CONFIG, "user-alice", "openai", "sk-xxx", "gpt-4o");
    const providers = (patch as any).models.providers;
    expect(providers["user-alice-openai"].api).toBe("openai-chat");
  });

  it("creates a named provider for openrouter", () => {
    const patch = buildByokProviderPatch(
      BASE_CONFIG,
      "user-alice",
      "openrouter",
      "sk-or-xxx",
      "meta-llama/llama-3-70b",
    );
    const providers = (patch as any).models.providers;
    expect(providers["user-alice-openrouter"].api).toBe("openai-chat");
    expect(providers["user-alice-openrouter"].baseUrl).toContain("openrouter");
  });

  it("preserves existing providers", () => {
    const config = {
      ...BASE_CONFIG,
      models: { providers: { "existing-provider": { apiKey: "keep" } } },
    };
    const patch = buildByokProviderPatch(
      config,
      "user-alice",
      "anthropic",
      "sk-ant-xxx",
      "claude-sonnet-4-20250514",
    );
    const providers = (patch as any).models.providers;
    expect(providers["existing-provider"].apiKey).toBe("keep");
    expect(providers["user-alice-anthropic"]).toBeDefined();
  });
});
