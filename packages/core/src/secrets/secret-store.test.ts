import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createSecretStore } from "./secret-store.js";

const KEY = randomBytes(32).toString("base64");

describe("secret store (AES-256-GCM)", () => {
  it("roundtrips a plaintext through encrypt/decrypt", () => {
    const store = createSecretStore({ encryptionKey: KEY });
    const ciphertext = store.encrypt("super-secret-value");
    expect(ciphertext).not.toContain("super-secret-value");
    expect(store.decrypt(ciphertext)).toBe("super-secret-value");
  });

  it("produces distinct ciphertexts for the same plaintext (fresh IV)", () => {
    const store = createSecretStore({ encryptionKey: KEY });
    expect(store.encrypt("same")).not.toBe(store.encrypt("same"));
  });

  it("detects tampering and throws on decrypt", () => {
    const store = createSecretStore({ encryptionKey: KEY });
    const ciphertext = store.encrypt("integrity-matters");
    const [iv, tag, data] = ciphertext.split(".");
    const flipped = data!.replace(/^./, (c) => (c === "A" ? "B" : "A"));
    const tampered = [iv, tag, flipped].join(".");
    expect(() => store.decrypt(tampered)).toThrow();
  });

  it("throws when a different key is used to decrypt", () => {
    const a = createSecretStore({ encryptionKey: KEY });
    const b = createSecretStore({ encryptionKey: randomBytes(32).toString("base64") });
    const ciphertext = a.encrypt("cross-key");
    expect(() => b.decrypt(ciphertext)).toThrow();
  });

  it("derives a key from SESSION_SECRET when no encryption key is set", () => {
    const prev = process.env.SECRET_ENCRYPTION_KEY;
    delete process.env.SECRET_ENCRYPTION_KEY;
    process.env.SESSION_SECRET = "a-long-session-secret-for-key-derivation";
    try {
      const store = createSecretStore();
      expect(store.decrypt(store.encrypt("derived"))).toBe("derived");
    } finally {
      process.env.SESSION_SECRET = undefined;
      if (prev) process.env.SECRET_ENCRYPTION_KEY = prev;
    }
  });

  it("throws a clear error when no key source is available", () => {
    const prevKey = process.env.SECRET_ENCRYPTION_KEY;
    const prevSession = process.env.SESSION_SECRET;
    delete process.env.SECRET_ENCRYPTION_KEY;
    delete process.env.SESSION_SECRET;
    try {
      expect(() => createSecretStore()).toThrow(/no secret encryption key/i);
    } finally {
      if (prevKey) process.env.SECRET_ENCRYPTION_KEY = prevKey;
      if (prevSession) process.env.SESSION_SECRET = prevSession;
    }
  });
});
