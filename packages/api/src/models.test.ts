import { describe, expect, it, afterEach } from "vitest";
import type { LightMyRequestResponse } from "fastify";
import { buildApp } from "./app.js";
import { createMemoryRepository } from "./repository.js";

function sessionCookie(res: LightMyRequestResponse): string {
  const raw = res.headers["set-cookie"];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value ? (value.split(";")[0] ?? "") : "";
}

async function registerAndLogin(
  app: Awaited<ReturnType<typeof buildApp>>,
  email: string,
): Promise<string> {
  await app.inject({
    method: "POST",
    url: "/api/people",
    payload: { email, password: "password123", displayName: "Tester" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: "password123" },
  });
  return sessionCookie(login);
}

// Unroutable address: the live test must fail fast without hanging.
const DEAD_BASE_URL = "http://127.0.0.1:9/v1";

describe("model providers", () => {
  it("adds a provider, records a failed test, then manages models manually", async () => {
    const app = await buildApp({ repository: createMemoryRepository(), secret: "test" });
    const cookie = await registerAndLogin(app, "alice@example.com");

    const created = await app.inject({
      method: "POST",
      url: "/api/models/providers",
      headers: { cookie },
      payload: { name: "Local gateway", baseUrl: DEAD_BASE_URL, apiKey: "sk-test" },
    });
    expect(created.statusCode).toBe(201);
    const body = created.json();
    expect(body.provider.name).toBe("Local gateway");
    expect(body.provider.hasKey).toBe(true);
    expect(body.provider.credentialRef).toBeUndefined();
    expect(body.test.ok).toBe(false);

    const providerId = body.provider.id as string;

    // Manual model entry when discovery is unavailable.
    const added = await app.inject({
      method: "POST",
      url: `/api/models/providers/${providerId}/models`,
      headers: { cookie },
      payload: { modelId: "my-custom-model" },
    });
    expect(added.statusCode).toBe(201);
    const modelRowId = added.json().id as string;

    // The enabled model is visible to selectors.
    const enabled = await app.inject({
      method: "GET",
      url: "/api/models/enabled",
      headers: { cookie },
    });
    expect(enabled.statusCode).toBe(200);
    expect(enabled.json().items).toHaveLength(1);
    expect(enabled.json().items[0].modelId).toBe("my-custom-model");

    // Disable it — selectors no longer see it.
    const toggled = await app.inject({
      method: "PATCH",
      url: `/api/models/providers/${providerId}/models/${modelRowId}`,
      headers: { cookie },
      payload: { enabled: false },
    });
    expect(toggled.statusCode).toBe(200);
    expect(toggled.json().enabled).toBe(false);

    const afterDisable = await app.inject({
      method: "GET",
      url: "/api/models/enabled",
      headers: { cookie },
    });
    expect(afterDisable.json().items).toHaveLength(0);

    // Delete removes the provider and its models.
    const deleted = await app.inject({
      method: "DELETE",
      url: `/api/models/providers/${providerId}`,
      headers: { cookie },
    });
    expect(deleted.statusCode).toBe(204);

    const listed = await app.inject({
      method: "GET",
      url: "/api/models/providers",
      headers: { cookie },
    });
    expect(listed.json().items).toHaveLength(0);
  });

  it("keeps providers private between users", async () => {
    const app = await buildApp({ repository: createMemoryRepository(), secret: "test" });
    const alice = await registerAndLogin(app, "alice@example.com");
    const bob = await registerAndLogin(app, "bob@example.com");

    await app.inject({
      method: "POST",
      url: "/api/models/providers",
      headers: { cookie: alice },
      payload: { name: "Alice provider", baseUrl: DEAD_BASE_URL, apiKey: "sk-test" },
    });

    const bobList = await app.inject({
      method: "GET",
      url: "/api/models/providers",
      headers: { cookie: bob },
    });
    expect(bobList.json().items).toHaveLength(0);
  });
});

describe("model runtime diagnostics", () => {
  it("returns reason=no_providers when nothing is configured", async () => {
    const app = await buildApp({ repository: createMemoryRepository(), secret: "test" });
    const cookie = await registerAndLogin(app, "alice@example.com");

    const runtime = await app.inject({
      method: "GET",
      url: "/api/models/runtime",
      headers: { cookie },
    });
    expect(runtime.statusCode).toBe(200);
    expect(runtime.json()).toMatchObject({ configured: false, reason: "no_providers" });
  });

  it("returns reason=no_enabled_models when a provider has no enabled model", async () => {
    const app = await buildApp({ repository: createMemoryRepository(), secret: "test" });
    const cookie = await registerAndLogin(app, "alice@example.com");

    const created = await app.inject({
      method: "POST",
      url: "/api/models/providers",
      headers: { cookie },
      payload: { name: "gw", baseUrl: DEAD_BASE_URL, apiKey: "sk-test" },
    });
    const providerId = created.json().provider.id as string;
    const added = await app.inject({
      method: "POST",
      url: `/api/models/providers/${providerId}/models`,
      headers: { cookie },
      payload: { modelId: "some-model" },
    });
    const modelRowId = added.json().id as string;
    // Leave it disabled.
    await app.inject({
      method: "PATCH",
      url: `/api/models/providers/${providerId}/models/${modelRowId}`,
      headers: { cookie },
      payload: { enabled: false },
    });

    const runtime = await app.inject({
      method: "GET",
      url: "/api/models/runtime",
      headers: { cookie },
    });
    expect(runtime.json()).toMatchObject({ configured: false, reason: "no_enabled_models" });
  });

  it("debug endpoint reports scopes and never leaks keys", async () => {
    const app = await buildApp({ repository: createMemoryRepository(), secret: "test" });
    const cookie = await registerAndLogin(app, "alice@example.com");

    const created = await app.inject({
      method: "POST",
      url: "/api/models/providers",
      headers: { cookie },
      payload: { name: "gw", baseUrl: DEAD_BASE_URL, apiKey: "sk-super-secret" },
    });
    const providerId = created.json().provider.id as string;
    const added = await app.inject({
      method: "POST",
      url: `/api/models/providers/${providerId}/models`,
      headers: { cookie },
      payload: { modelId: "some-model" },
    });
    const modelRowId = added.json().id as string;
    await app.inject({
      method: "PATCH",
      url: `/api/models/providers/${providerId}/models/${modelRowId}`,
      headers: { cookie },
      payload: { enabled: true },
    });

    const debug = await app.inject({
      method: "GET",
      url: "/api/models/runtime/debug",
      headers: { cookie },
    });
    expect(debug.statusCode).toBe(200);
    const body = debug.json();
    expect(body.resolved).not.toBeNull();
    expect(body.resolved.model).toBe("some-model");
    expect(body.reason).toBeNull();
    // The personal scope should list the provider with decryptOk.
    const personal = body.scopes.find((s: { scope: string }) => s.scope === "personal");
    expect(personal).toBeTruthy();
    expect(personal.providers[0].decryptOk).toBe(true);
    // No key material anywhere in the report.
    expect(JSON.stringify(body)).not.toContain("sk-super-secret");
    expect(JSON.stringify(body)).not.toContain("apiKey");
  });
});

describe("session cookie domain", () => {
  afterEach(() => {
    delete process.env.COOKIE_DOMAIN;
  });

  it("sets the cookie Domain when COOKIE_DOMAIN is configured", async () => {
    process.env.COOKIE_DOMAIN = ".jamot.pro";
    const app = await buildApp({ repository: createMemoryRepository(), secret: "test" });
    await app.inject({
      method: "POST",
      url: "/api/people",
      payload: { email: "carol@example.com", password: "password123", displayName: "Carol" },
    });
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "carol@example.com", password: "password123" },
    });
    const raw = login.headers["set-cookie"];
    const cookies = Array.isArray(raw) ? raw : [raw];
    // Skip the stale host-only clearing cookie (empty value) — find the real one.
    const session = cookies.find((c) => {
      if (!c?.startsWith("jamot_session=")) return false;
      const value = c.slice("jamot_session=".length).split(";")[0] ?? "";
      return value.length > 0;
    });
    expect(session).toBeTruthy();
    expect(session?.toLowerCase()).toContain("domain=.jamot.pro");
  });

  it("omits the cookie Domain when COOKIE_DOMAIN is unset", async () => {
    const app = await buildApp({ repository: createMemoryRepository(), secret: "test" });
    await app.inject({
      method: "POST",
      url: "/api/people",
      payload: { email: "dave@example.com", password: "password123", displayName: "Dave" },
    });
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "dave@example.com", password: "password123" },
    });
    const raw = login.headers["set-cookie"];
    const cookies = Array.isArray(raw) ? raw : [raw];
    const session = cookies.find((c) => c?.startsWith("jamot_session="));
    expect(session).toBeTruthy();
    expect(session?.toLowerCase()).not.toContain("domain=");
  });
});
