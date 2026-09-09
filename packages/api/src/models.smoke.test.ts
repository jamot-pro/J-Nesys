import { describe, expect, it, beforeAll } from "vitest";
import type { LightMyRequestResponse } from "fastify";
import { buildApp } from "./app.js";
import { createMemoryRepository } from "./repository.js";

function sessionCookie(res: LightMyRequestResponse): string {
  const raw = res.headers["set-cookie"];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value ? (value.split(";")[0] ?? "") : "";
}

async function makeApp() {
  return buildApp({ repository: createMemoryRepository(), secret: "test" });
}

type App = Awaited<ReturnType<typeof makeApp>>;

async function registerAndLogin(
  app: App,
  email: string,
  password: string,
  displayName: string,
): Promise<string> {
  await app.inject({
    method: "POST",
    url: "/api/people",
    payload: { email, password, displayName },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password },
  });
  return sessionCookie(login);
}

// Unroutable address: live tests fail fast without hanging.
const DEAD_BASE_URL = "http://127.0.0.1:9/v1";

async function addProvider(
  app: App,
  cookie: string,
  input: { name: string; organizationId?: string },
): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/api/models/providers",
    headers: { cookie },
    payload: {
      name: input.name,
      baseUrl: DEAD_BASE_URL,
      apiKey: "sk-test",
      organizationId: input.organizationId ?? null,
    },
  });
  expect(res.statusCode).toBe(201);
  return res.json().provider.id as string;
}

describe("models smoke (provider-agnostic)", () => {
  let app: App;
  let owner: string;
  let admin: string;
  let member: string;
  let stranger: string;
  let orgId: string;

  beforeAll(async () => {
    app = await makeApp();
    owner = await registerAndLogin(app, "owner@example.com", "password123", "Owner");
    admin = await registerAndLogin(app, "admin@example.com", "password123", "Admin");
    member = await registerAndLogin(app, "member@example.com", "password123", "Member");
    stranger = await registerAndLogin(app, "stranger@example.com", "password123", "Stranger");

    const created = await app.inject({
      method: "POST",
      url: "/api/organizations",
      headers: { cookie: owner },
      payload: { name: "Acme", dream: "sell widgets" },
    });
    orgId = created.json().organization.id;

    await app.inject({
      method: "POST",
      url: `/api/organizations/${orgId}/members`,
      headers: { cookie: owner },
      payload: { email: "admin@example.com", role: "admin" },
    });
    await app.inject({
      method: "POST",
      url: `/api/organizations/${orgId}/members`,
      headers: { cookie: owner },
      payload: { email: "member@example.com", role: "member" },
    });
  });

  it("unauthenticated requests are rejected with 401", async () => {
    const get = await app.inject({ method: "GET", url: "/api/models/providers" });
    const post = await app.inject({
      method: "POST",
      url: "/api/models/providers",
      payload: { name: "x", baseUrl: DEAD_BASE_URL, apiKey: "sk-x" },
    });
    expect(get.statusCode).toBe(401);
    expect(post.statusCode).toBe(401);
  });

  it("personal scope: create masked, update, delete", async () => {
    const id = await addProvider(app, owner, { name: "Personal gateway" });

    const listed = await app.inject({
      method: "GET",
      url: "/api/models/providers",
      headers: { cookie: owner },
    });
    const provider = listed.json().items.find((p: { id: string }) => p.id === id);
    expect(provider).toBeTruthy();
    expect(provider.credentialRef).toBeUndefined();
    expect(provider.hasKey).toBe(true);

    const patched = await app.inject({
      method: "PATCH",
      url: `/api/models/providers/${id}`,
      headers: { cookie: owner },
      payload: { name: "Renamed gateway" },
    });
    expect(patched.statusCode).toBe(200);
    expect(patched.json().provider.name).toBe("Renamed gateway");

    const deleted = await app.inject({
      method: "DELETE",
      url: `/api/models/providers/${id}`,
      headers: { cookie: owner },
    });
    expect(deleted.statusCode).toBe(204);
  });

  it("isolation: personal providers stay private; org providers hidden from strangers", async () => {
    await addProvider(app, owner, { name: "Owner personal" });
    await addProvider(app, owner, { name: "Acme shared", organizationId: orgId });

    const memberView = await app.inject({
      method: "GET",
      url: `/api/models/providers?organizationId=${orgId}`,
      headers: { cookie: member },
    });
    const memberNames = memberView.json().items.map((p: { name: string }) => p.name);
    expect(memberNames).toContain("Acme shared");
    expect(memberNames).not.toContain("Owner personal");

    const strangerView = await app.inject({
      method: "GET",
      url: `/api/models/providers?organizationId=${orgId}`,
      headers: { cookie: stranger },
    });
    const strangerNames = strangerView.json().items.map((p: { name: string }) => p.name);
    expect(strangerNames).not.toContain("Acme shared");
    expect(strangerNames).not.toContain("Owner personal");
  });

  it("org scope: owner/admin may write; member/stranger get 403", async () => {
    const byMember = await app.inject({
      method: "POST",
      url: "/api/models/providers",
      headers: { cookie: member },
      payload: { name: "x", baseUrl: DEAD_BASE_URL, apiKey: "sk-x", organizationId: orgId },
    });
    expect(byMember.statusCode).toBe(403);

    const byStranger = await app.inject({
      method: "POST",
      url: "/api/models/providers",
      headers: { cookie: stranger },
      payload: { name: "x", baseUrl: DEAD_BASE_URL, apiKey: "sk-x", organizationId: orgId },
    });
    expect(byStranger.statusCode).toBe(403);

    const byAdmin = await app.inject({
      method: "POST",
      url: "/api/models/providers",
      headers: { cookie: admin },
      payload: { name: "Admin org provider", baseUrl: DEAD_BASE_URL, apiKey: "sk-x", organizationId: orgId },
    });
    expect(byAdmin.statusCode).toBe(201);
    expect(byAdmin.json().provider.ownerOrganizationId).toBe(orgId);
  });

  it("write to a nonexistent org returns 404", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/models/providers",
      headers: { cookie: owner },
      payload: {
        name: "x",
        baseUrl: DEAD_BASE_URL,
        apiKey: "sk-x",
        organizationId: "00000000-0000-4000-8000-00000000dead",
      },
    });
    expect(res.statusCode).toBe(404);
  });

  it("enabled models feed /models/enabled and /models/runtime", async () => {
    const id = await addProvider(app, member, { name: "Member personal runtime" });
    await app.inject({
      method: "POST",
      url: `/api/models/providers/${id}/models`,
      headers: { cookie: member },
      payload: { modelId: "member-model" },
    });

    const enabled = await app.inject({
      method: "GET",
      url: "/api/models/enabled",
      headers: { cookie: member },
    });
    expect(
      enabled.json().items.some((m: { modelId: string }) => m.modelId === "member-model"),
    ).toBe(true);

    const runtime = await app.inject({
      method: "GET",
      url: "/api/models/runtime",
      headers: { cookie: member },
    });
    expect(runtime.statusCode).toBe(200);
    expect(runtime.json().configured).toBe(true);
    expect(runtime.json().model).toBe("member-model");
    expect(typeof runtime.json().apiKey).toBe("string");
  });

  it("org providers take precedence over personal ones at runtime", async () => {
    const orgProviderId = await addProvider(app, owner, {
      name: "Acme runtime",
      organizationId: orgId,
    });
    await app.inject({
      method: "POST",
      url: `/api/models/providers/${orgProviderId}/models`,
      headers: { cookie: owner },
      payload: { modelId: "org-model" },
    });

    const personalId = await addProvider(app, member, { name: "Member runtime 2" });
    await app.inject({
      method: "POST",
      url: `/api/models/providers/${personalId}/models`,
      headers: { cookie: member },
      payload: { modelId: "member-model-2" },
    });

    const runtime = await app.inject({
      method: "GET",
      url: `/api/models/runtime?organizationId=${orgId}`,
      headers: { cookie: member },
    });
    expect(runtime.json().model).toBe("org-model");
    expect(runtime.json().providerName).toBe("Acme runtime");
  });
});
