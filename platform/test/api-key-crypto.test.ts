import { randomBytes } from "node:crypto";
import { describe, it, expect } from "vitest";
import { encrypt, decrypt } from "../src/provisioning/api-key-crypto.js";

const MASTER_KEY = randomBytes(32).toString("hex");

describe("api-key-crypto", () => {
  it("encrypts and decrypts a round-trip", () => {
    const plaintext = "sk-ant-api03-my-secret-key-1234567890";
    const payload = encrypt(plaintext, MASTER_KEY);
    const result = decrypt(payload, MASTER_KEY);
    expect(result).toBe(plaintext);
  });

  it("produces different ciphertexts for same plaintext (random IV)", () => {
    const plaintext = "same-key";
    const a = encrypt(plaintext, MASTER_KEY);
    const b = encrypt(plaintext, MASTER_KEY);
    expect(a.encrypted).not.toBe(b.encrypted);
    expect(a.iv).not.toBe(b.iv);
    // Both decrypt to the same value
    expect(decrypt(a, MASTER_KEY)).toBe(plaintext);
    expect(decrypt(b, MASTER_KEY)).toBe(plaintext);
  });

  it("fails with wrong master key", () => {
    const plaintext = "secret";
    const payload = encrypt(plaintext, MASTER_KEY);
    const wrongKey = randomBytes(32).toString("hex");
    expect(() => decrypt(payload, wrongKey)).toThrow();
  });

  it("fails with tampered ciphertext", () => {
    const plaintext = "secret";
    const payload = encrypt(plaintext, MASTER_KEY);
    // Flip a byte in the encrypted data
    const tampered = payload.encrypted.slice(0, -2) + "00";
    expect(() => decrypt({ ...payload, encrypted: tampered }, MASTER_KEY)).toThrow();
  });

  it("fails with tampered auth tag", () => {
    const plaintext = "secret";
    const payload = encrypt(plaintext, MASTER_KEY);
    const tampered = "00".repeat(16);
    expect(() => decrypt({ ...payload, tag: tampered }, MASTER_KEY)).toThrow();
  });

  it("handles empty string", () => {
    const payload = encrypt("", MASTER_KEY);
    expect(decrypt(payload, MASTER_KEY)).toBe("");
  });

  it("handles unicode content", () => {
    const plaintext = "chave-secreta-com-acentos-é-ão-ü-日本語";
    const payload = encrypt(plaintext, MASTER_KEY);
    expect(decrypt(payload, MASTER_KEY)).toBe(plaintext);
  });

  it("output fields are hex strings", () => {
    const payload = encrypt("test", MASTER_KEY);
    expect(payload.encrypted).toMatch(/^[0-9a-f]+$/);
    expect(payload.iv).toMatch(/^[0-9a-f]+$/);
    expect(payload.tag).toMatch(/^[0-9a-f]+$/);
    // IV should be 12 bytes = 24 hex chars
    expect(payload.iv).toHaveLength(24);
    // Tag should be 16 bytes = 32 hex chars
    expect(payload.tag).toHaveLength(32);
  });
});
