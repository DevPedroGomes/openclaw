import { describe, expect, it } from "vitest";
import { createDefaultWizardData } from "../types/studio-types.ts";
import { validateWizardStep } from "./studio.ts";

describe("validateWizardStep", () => {
  it("identity: fails when name is empty", () => {
    const data = createDefaultWizardData();
    const result = validateWizardStep("identity", data);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("identity: passes when name is set", () => {
    const data = createDefaultWizardData();
    data.identity.name = "Atlas";
    const result = validateWizardStep("identity", data);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("brain: fails when provider is empty", () => {
    const data = createDefaultWizardData();
    const result = validateWizardStep("brain", data);
    expect(result.valid).toBe(false);
  });

  it("brain: fails when apiKey is empty for non-ollama provider", () => {
    const data = createDefaultWizardData();
    data.brain.provider = "anthropic";
    const result = validateWizardStep("brain", data);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("API key"))).toBe(true);
  });

  it("brain: passes for ollama without apiKey", () => {
    const data = createDefaultWizardData();
    data.brain.provider = "ollama";
    data.brain.modelId = "llama3";
    const result = validateWizardStep("brain", data);
    expect(result.valid).toBe(true);
  });

  it("brain: passes when provider and apiKey set", () => {
    const data = createDefaultWizardData();
    data.brain.provider = "openai";
    data.brain.apiKey = "sk-test";
    const result = validateWizardStep("brain", data);
    expect(result.valid).toBe(true);
  });

  it("channels: fails when telegram enabled without token", () => {
    const data = createDefaultWizardData();
    data.channels.telegram.enabled = true;
    const result = validateWizardStep("channels", data);
    expect(result.valid).toBe(false);
  });

  it("channels: passes when no channels enabled", () => {
    const data = createDefaultWizardData();
    const result = validateWizardStep("channels", data);
    expect(result.valid).toBe(true);
  });

  it("channels: passes when telegram enabled with token", () => {
    const data = createDefaultWizardData();
    data.channels.telegram.enabled = true;
    data.channels.telegram.token = "123:abc";
    const result = validateWizardStep("channels", data);
    expect(result.valid).toBe(true);
  });

  it("security: always valid", () => {
    const data = createDefaultWizardData();
    expect(validateWizardStep("security", data).valid).toBe(true);
  });

  it("capabilities: always valid", () => {
    const data = createDefaultWizardData();
    expect(validateWizardStep("capabilities", data).valid).toBe(true);
  });
});

describe("createDefaultWizardData", () => {
  it("returns expected default structure", () => {
    const data = createDefaultWizardData();
    expect(data.identity.name).toBe("");
    expect(data.identity.emoji).toBe("🤖");
    expect(data.identity.templateId).toBe("friendly");
    expect(data.brain.provider).toBe("");
    expect(data.channels.whatsapp.enabled).toBe(false);
    expect(data.channels.telegram.enabled).toBe(false);
    expect(data.channels.discord.enabled).toBe(false);
    expect(data.security.mode).toBe("pairing");
    expect(data.capabilities.webSearch).toBe(true);
    expect(data.capabilities.imageAnalysis).toBe(true);
    expect(data.capabilities.reminders).toBe(false);
    expect(data.capabilities.fileAccess).toBe(false);
  });
});
