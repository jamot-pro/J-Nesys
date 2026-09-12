import { describe, expect, it } from "vitest";
import type { LightMyRequestResponse } from "fastify";
import { buildApp } from "./app.js";
import { createMemoryRepository } from "./repository.js";

function sessionCookie(res: LightMyRequestResponse): string {
  const raw = res.headers["set-cookie"];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value ? (value.split(";")[0] ?? "") : "";
}

async function setup() {
  const app = await buildApp({ repository: createMemoryRepository(), secret: "test" });
  await app.inject({
    method: "POST",
    url: "/api/people",
    payload: { email: "o@example.com", password: "password123", displayName: "Owner" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "o@example.com", password: "password123" },
  });
  const cookie = sessionCookie(login);
  const me = await app.inject({ method: "GET", url: "/api/auth/me", headers: { cookie } });
  return { app, cookie, spaceId: me.json().actor.personalSpaceId as string };
}

async function peopleListWith(app: Awaited<ReturnType<typeof setup>>["app"], cookie: string, spaceId: string, names: string[]) {
  const list = await app.inject({
    method: "POST",
    url: "/api/people/lists",
    headers: { cookie },
    payload: { spaceId, name: "Operators" },
  });
  const listId = list.json().id as string;
  for (const firstName of names) {
    const contact = await app.inject({
      method: "POST",
      url: "/api/people/contacts",
      headers: { cookie },
      payload: { spaceId, firstName },
    });
    await app.inject({
      method: "POST",
      url: `/api/people/lists/${listId}/members`,
      headers: { cookie },
      payload: { personId: contact.json().person.id },
    });
  }
  return listId;
}

describe("outreach lists built from People", () => {
  it("copies the members and remembers the source", async () => {
    const { app, cookie, spaceId } = await setup();
    const peopleListId = await peopleListWith(app, cookie, spaceId, ["Mara", "Tomas"]);

    const res = await app.inject({
      method: "POST",
      url: "/api/outreach/lists/from-people",
      headers: { cookie },
      payload: { spaceId, peopleListId },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ name: "Operators", sourcePeopleListId: peopleListId });
    expect(res.json().memberPersonIds).toHaveLength(2);
  });

  it("refreshes from the source rather than drifting", async () => {
    const { app, cookie, spaceId } = await setup();
    const peopleListId = await peopleListWith(app, cookie, spaceId, ["Mara"]);
    const imported = await app.inject({
      method: "POST",
      url: "/api/outreach/lists/from-people",
      headers: { cookie },
      payload: { spaceId, peopleListId },
    });
    const outreachListId = imported.json().id as string;

    // Someone joins the People list after the import.
    const extra = await app.inject({
      method: "POST",
      url: "/api/people/contacts",
      headers: { cookie },
      payload: { spaceId, firstName: "Ines" },
    });
    await app.inject({
      method: "POST",
      url: `/api/people/lists/${peopleListId}/members`,
      headers: { cookie },
      payload: { personId: extra.json().person.id },
    });

    const synced = await app.inject({
      method: "POST",
      url: `/api/outreach/lists/${outreachListId}/sync`,
      headers: { cookie },
    });
    expect(synced.statusCode).toBe(200);
    expect(synced.json().memberPersonIds).toHaveLength(2);
  });

  it("refuses to sync a list that was never imported", async () => {
    const { app, cookie, spaceId } = await setup();
    const plain = await app.inject({
      method: "POST",
      url: "/api/outreach/lists",
      headers: { cookie },
      payload: { spaceId, name: "Typed by hand" },
    });
    const res = await app.inject({
      method: "POST",
      url: `/api/outreach/lists/${plain.json().id}/sync`,
      headers: { cookie },
    });
    expect(res.statusCode).toBe(400);
  });

  it("refuses a People list from another space", async () => {
    const a = await setup();
    const peopleListId = await peopleListWith(a.app, a.cookie, a.spaceId, ["Mara"]);

    const b = await setup();
    const res = await b.app.inject({
      method: "POST",
      url: "/api/outreach/lists/from-people",
      headers: { cookie: b.cookie },
      payload: { spaceId: b.spaceId, peopleListId },
    });
    expect([403, 404]).toContain(res.statusCode);
  });
});
