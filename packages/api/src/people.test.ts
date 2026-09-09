import { describe, expect, it } from "vitest";
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

async function makeAppWithRepo() {
  const repository = createMemoryRepository();
  const app = await buildApp({ repository, secret: "test" });
  return { app, repository };
}

describe("people API", () => {
  it("creates a manual contact and finds it via server-side search", async () => {
    const { app } = await makeAppWithRepo();
    const cookie = await registerAndLogin(app, "alice@example.com", "password123", "Alice");
    const me = await app.inject({ method: "GET", url: "/api/auth/me", headers: { cookie } });
    const spaceId = me.json().actor.personalSpaceId;

    const created = await app.inject({
      method: "POST",
      url: "/api/people/contacts",
      headers: { cookie },
      payload: {
        spaceId,
        firstName: "Andrea",
        lastName: "Rossi",
        phone: "393331234567",
      },
    });
    expect(created.statusCode).toBe(201);

    const found = await app.inject({
      method: "GET",
      url: `/api/people?spaceId=${spaceId}&q=andrea`,
      headers: { cookie },
    });
    expect(found.statusCode).toBe(200);
    const page = found.json();
    expect(page.total).toBe(1);
    expect(page.items[0].displayName).toBe("Andrea Rossi");
    expect(page.items[0].phone).toBe("393331234567");

    const missed = await app.inject({
      method: "GET",
      url: `/api/people?spaceId=${spaceId}&q=zzz`,
      headers: { cookie },
    });
    expect(missed.json().total).toBe(0);
  });

  it("autosaves profile fields and rejects non-members", async () => {
    const { app } = await makeAppWithRepo();
    const cookie = await registerAndLogin(app, "alice@example.com", "password123", "Alice");
    const strangerCookie = await registerAndLogin(
      app,
      "stranger@example.com",
      "password123",
      "Stranger",
    );
    const me = await app.inject({ method: "GET", url: "/api/auth/me", headers: { cookie } });
    const spaceId = me.json().actor.personalSpaceId;

    const created = await app.inject({
      method: "POST",
      url: "/api/people/contacts",
      headers: { cookie },
      payload: { spaceId, firstName: "Marco" },
    });
    const personId = created.json().person.id;

    const patched = await app.inject({
      method: "PATCH",
      url: `/api/people/${personId}`,
      headers: { cookie },
      payload: { lastName: "Bianchi", email: "marco@example.com" },
    });
    expect(patched.statusCode).toBe(200);
    expect(patched.json().lastName).toBe("Bianchi");
    expect(patched.json().email).toBe("marco@example.com");

    const denied = await app.inject({
      method: "PATCH",
      url: `/api/people/${personId}`,
      headers: { cookie: strangerCookie },
      payload: { firstName: "Hacked" },
    });
    expect(denied.statusCode).toBe(403);
  });

  it("attaches and removes channel identities", async () => {
    const { app } = await makeAppWithRepo();
    const cookie = await registerAndLogin(app, "alice@example.com", "password123", "Alice");
    const me = await app.inject({ method: "GET", url: "/api/auth/me", headers: { cookie } });
    const spaceId = me.json().actor.personalSpaceId;

    const created = await app.inject({
      method: "POST",
      url: "/api/people/contacts",
      headers: { cookie },
      payload: { spaceId, firstName: "Andrea" },
    });
    const personId = created.json().person.id;

    const attached = await app.inject({
      method: "POST",
      url: `/api/people/${personId}/identities`,
      headers: { cookie },
      payload: { provider: "telegram", value: "424242" },
    });
    expect(attached.statusCode).toBe(201);

    const detail = await app.inject({
      method: "GET",
      url: `/api/people/${personId}`,
      headers: { cookie },
    });
    expect(detail.statusCode).toBe(200);
    expect(detail.json().identities).toHaveLength(1);
    expect(detail.json().identities[0].provider).toBe("telegram");

    const identityId = attached.json().id;
    const removed = await app.inject({
      method: "DELETE",
      url: `/api/people/${personId}/identities/${identityId}`,
      headers: { cookie },
    });
    expect(removed.statusCode).toBe(204);

    const after = await app.inject({
      method: "GET",
      url: `/api/people/${personId}`,
      headers: { cookie },
    });
    expect(after.json().identities).toHaveLength(0);
  });

  it("resolves a merge candidate into the keeper and removes the duplicate", async () => {
    const { app, repository } = await makeAppWithRepo();
    const cookie = await registerAndLogin(app, "alice@example.com", "password123", "Alice");
    const me = await app.inject({ method: "GET", url: "/api/auth/me", headers: { cookie } });
    const spaceId = me.json().actor.personalSpaceId;

    const keeper = await app.inject({
      method: "POST",
      url: "/api/people/contacts",
      headers: { cookie },
      payload: { spaceId, firstName: "Andrea", lastName: "Rossi", phone: "393331234567" },
    });
    const duplicate = await app.inject({
      method: "POST",
      url: "/api/people/contacts",
      headers: { cookie },
      payload: { spaceId, email: "andrea@example.com" },
    });
    const keeperPerson = keeper.json().person;
    const duplicatePerson = duplicate.json().person;

    await repository.addIdentity({
      actorId: duplicatePerson.actorId,
      personId: duplicatePerson.id,
      provider: "whatsapp",
      value: "393331234567",
    });
    const candidate = await repository.createMergeCandidate({
      spaceId,
      personAId: keeperPerson.id,
      personBId: duplicatePerson.id,
      reason: "phone 393331234567 matches another person",
    });

    const listed = await app.inject({
      method: "GET",
      url: `/api/people/merge-candidates?spaceId=${spaceId}`,
      headers: { cookie },
    });
    expect(listed.statusCode).toBe(200);
    expect(listed.json().items).toHaveLength(1);

    const resolved = await app.inject({
      method: "POST",
      url: `/api/people/merge-candidates/${candidate.id}/resolve`,
      headers: { cookie },
    });
    expect(resolved.statusCode).toBe(200);
    expect(resolved.json().status).toBe("merged");

    const merged = await app.inject({
      method: "GET",
      url: `/api/people/${keeperPerson.id}`,
      headers: { cookie },
    });
    expect(merged.statusCode).toBe(200);
    expect(merged.json().email).toBe("andrea@example.com");
    expect(merged.json().identities).toHaveLength(1);

    const gone = await app.inject({
      method: "GET",
      url: `/api/people/${duplicatePerson.id}`,
      headers: { cookie },
    });
    expect(gone.statusCode).toBe(404);
  });
});
