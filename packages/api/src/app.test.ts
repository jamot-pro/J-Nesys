import { describe, expect, it } from "vitest";
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

async function registerAndLogin(
  app: Awaited<ReturnType<typeof buildApp>>,
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

describe("health", () => {
  it("returns ok without auth", async () => {
    const app = await makeApp();
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ok" });
  });
});

describe("auth", () => {
  it("rejects unauthenticated access to protected routes", async () => {
    const app = await makeApp();
    const res = await app.inject({ method: "GET", url: "/api/actors" });
    expect(res.statusCode).toBe(401);
  });

  it("registers, logs in, and exposes the current actor", async () => {
    const app = await makeApp();
    const cookie = await registerAndLogin(app, "alice@example.com", "password123", "Alice");

    const me = await app.inject({ method: "GET", url: "/api/auth/me", headers: { cookie } });
    expect(me.statusCode).toBe(200);
    const body = me.json();
    expect(body.actor.displayName).toBe("Alice");
    expect(body.person.email).toBe("alice@example.com");

    const logout = await app.inject({ method: "POST", url: "/api/auth/logout", headers: { cookie } });
    expect(logout.statusCode).toBe(200);

    const after = await app.inject({ method: "GET", url: "/api/auth/me", headers: { cookie } });
    expect(after.statusCode).toBe(401);
  });

  it("rejects login with a bad password", async () => {
    const app = await makeApp();
    await registerAndLogin(app, "bob@example.com", "password123", "Bob");
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "bob@example.com", password: "wrong-password" },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe("rbac", () => {
  it("lets owner grant roles and blocks members", async () => {
    const app = await makeApp();
    const ownerCookie = await registerAndLogin(app, "owner@example.com", "password123", "Owner");
    const memberCookie = await registerAndLogin(app, "member@example.com", "password123", "Member");

    const org = await app.inject({
      method: "POST",
      url: "/api/organizations",
      headers: { cookie: ownerCookie },
      payload: { name: "Acme" },
    });
    expect(org.statusCode).toBe(201);
    const spaceId = org.json().space.id;

    const memberMe = await app.inject({ method: "GET", url: "/api/auth/me", headers: { cookie: memberCookie } });
    const memberActorId = memberMe.json().actor.id;

    const grant = await app.inject({
      method: "POST",
      url: "/api/roles",
      headers: { cookie: ownerCookie },
      payload: { actorId: memberActorId, spaceId, kind: "member" },
    });
    expect(grant.statusCode).toBe(201);

    const blocked = await app.inject({
      method: "POST",
      url: "/api/roles",
      headers: { cookie: memberCookie },
      payload: { actorId: memberActorId, spaceId, kind: "admin" },
    });
    expect(blocked.statusCode).toBe(403);

    const allowed = await app.inject({
      method: "POST",
      url: "/api/roles",
      headers: { cookie: ownerCookie },
      payload: { actorId: memberActorId, spaceId, kind: "admin" },
    });
    expect(allowed.statusCode).toBe(201);
  });
});

describe("ownership", () => {
  it("prevents person A from patching person B", async () => {
    const app = await makeApp();
    await registerAndLogin(app, "a@example.com", "password123", "A");
    const bCookie = await registerAndLogin(app, "b@example.com", "password123", "B");

    const bMe = await app.inject({ method: "GET", url: "/api/auth/me", headers: { cookie: bCookie } });
    const bPersonId = bMe.json().person.id;

    const patch = await app.inject({
      method: "PATCH",
      url: `/api/people/${bPersonId}`,
      headers: { cookie: await registerAndLogin(app, "a2@example.com", "password123", "A2") },
      payload: { email: "hacked@example.com" },
    });
    expect(patch.statusCode).toBe(403);
  });
});

describe("tasks", () => {
  it("creates, lists, and patches task status", async () => {
    const app = await makeApp();
    const cookie = await registerAndLogin(app, "tasker@example.com", "password123", "Tasker");

    const me = await app.inject({ method: "GET", url: "/api/auth/me", headers: { cookie } });
    const spaceId = me.json().person.membershipSpaceIds[0];

    const created = await app.inject({
      method: "POST",
      url: "/api/tasks",
      headers: { cookie },
      payload: { spaceId, title: "Do the thing" },
    });
    expect(created.statusCode).toBe(201);
    const taskId = created.json().id;

    const list = await app.inject({
      method: "GET",
      url: `/api/tasks?spaceId=${spaceId}`,
      headers: { cookie },
    });
    expect(list.statusCode).toBe(200);
    expect(list.json().items).toHaveLength(1);

    const patched = await app.inject({
      method: "PATCH",
      url: `/api/tasks/${taskId}/status`,
      headers: { cookie },
      payload: { status: "completed" },
    });
    expect(patched.statusCode).toBe(200);
    expect(patched.json().status).toBe("completed");
  });
});

describe("personal space id alias", () => {
  it("resolves the literal 'personal' spaceId to the actor's personal space instead of 500ing", async () => {
    const app = await makeApp();
    const cookie = await registerAndLogin(app, "personal@example.com", "password123", "Personal");

    // The app shell sends spaceId="personal" for the personal space. This used
    // to hit getSpace("personal") -> invalid uuid cast -> 500.
    const res = await app.inject({
      method: "GET",
      url: "/api/wa/accounts?spaceId=personal",
      headers: { cookie },
    });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json().items)).toBe(true);
  });
});

describe("composio key", () => {
  it("lets any authenticated user set and read the global composio key", async () => {
    const app = await makeApp();
    const cookie = await registerAndLogin(app, "alice@example.com", "password123", "Alice");

    const before = await app.inject({
      method: "GET",
      url: "/api/composio/key",
      headers: { cookie },
    });
    expect(before.statusCode).toBe(200);
    expect(before.json().configured).toBe(false);

    const put = await app.inject({
      method: "PUT",
      url: "/api/composio/key",
      headers: { cookie },
      payload: { apiKey: "composio_test_key" },
    });
    expect(put.statusCode).toBe(200);
    expect(put.json().configured).toBe(true);

    const after = await app.inject({
      method: "GET",
      url: "/api/composio/key",
      headers: { cookie },
    });
    expect(after.statusCode).toBe(200);
    expect(after.json().configured).toBe(true);
  });

  it("rejects an empty key", async () => {
    const app = await makeApp();
    const cookie = await registerAndLogin(app, "bob@example.com", "password123", "Bob");
    const put = await app.inject({
      method: "PUT",
      url: "/api/composio/key",
      headers: { cookie },
      payload: { apiKey: "" },
    });
    expect(put.statusCode).toBe(400);
  });
});
