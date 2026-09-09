import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createMemoryRepository } from "../repository/memory.js";
import { createSecretStore } from "./secret-store.js";
import { createCredentialResolver } from "./credential-resolution.js";

const KEY = randomBytes(32).toString("base64");
const UUID = "00000000-0000-4000-8000-00000000000a";

describe("credential resolution", () => {
  it("resolves an environment-scoped ref from process env", async () => {
    const repo = createMemoryRepository();
    await repo.putSecret({
      ref: "WHATSAPP_BOT_TOKEN",
      scope: "environment",
      ciphertext: "ignored",
    });
    const store = createSecretStore({ encryptionKey: KEY });
    const resolver = createCredentialResolver({
      repo,
      store,
      env: { WHATSAPP_BOT_TOKEN: "env-secret" },
    });

    await expect(resolver.resolveCredential("WHATSAPP_BOT_TOKEN")).resolves.toBe(
      "env-secret",
    );
  });

  it("decrypts a non-environment-scoped ref via the store", async () => {
    const repo = createMemoryRepository();
    const store = createSecretStore({ encryptionKey: KEY });
    const ciphertext = store.encrypt("stored-secret");
    await repo.putSecret({
      ref: "github-pat",
      scope: "system",
      ownerActorId: UUID,
      ciphertext,
    });
    const resolver = createCredentialResolver({ repo, store });

    await expect(resolver.resolveCredential("github-pat")).resolves.toBe(
      "stored-secret",
    );
  });

  it("returns null for an unknown ref", async () => {
    const repo = createMemoryRepository();
    const store = createSecretStore({ encryptionKey: KEY });
    const resolver = createCredentialResolver({ repo, store });

    await expect(resolver.resolveCredential("does-not-exist")).resolves.toBeNull();
  });

  it("returns null when an environment ref has no env value", async () => {
    const repo = createMemoryRepository();
    await repo.putSecret({
      ref: "MISSING_ENV",
      scope: "environment",
      ciphertext: "ignored",
    });
    const store = createSecretStore({ encryptionKey: KEY });
    const resolver = createCredentialResolver({ repo, store, env: {} });

    await expect(resolver.resolveCredential("MISSING_ENV")).resolves.toBeNull();
  });

  it("returns null when decryption fails", async () => {
    const repo = createMemoryRepository();
    const store = createSecretStore({ encryptionKey: KEY });
    await repo.putSecret({
      ref: "corrupt",
      scope: "organization",
      ciphertext: "not-valid-ciphertext",
    });
    const resolver = createCredentialResolver({ repo, store });

    await expect(resolver.resolveCredential("corrupt")).resolves.toBeNull();
  });
});
