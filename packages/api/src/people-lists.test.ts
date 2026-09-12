import { describe, expect, it } from "vitest";
import type { LightMyRequestResponse } from "fastify";
import { buildApp } from "./app.js";
import { createMemoryRepository } from "./repository.js";

function sessionCookie(res: LightMyRequestResponse): string {
  const raw = res.headers["set-cookie"];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value ? (value.split(";")[0] ?? "") : "";
}

async function signUp(email: string) {
  const app = await buildApp({ repository: createMemoryRepository(), secret: "test" });
  await app.inject({
    method: "POST",
    url: "/api/people",
    payload: { email, password: "password123", displayName: "Owner" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: "password123" },
  });
  const cookie = sessionCookie(login);
  const me = await app.inject({ method: "GET", url: "/api/auth/me", headers: { cookie } });
  return { app, cookie, spaceId: me.json().actor.personalSpaceId as string };
}

describe("people lists", () => {
  it("creates a list, adds a person, and lifts the CRM fields into the list view", async () => {
    const { app, cookie, spaceId } = await signUp("owner@example.com");

    const list = await app.inject({
      method: "POST",
      url: "/api/people/lists",
      headers: { cookie },
      payload: { spaceId, name: "Operators" },
    });
    expect(list.statusCode).toBe(201);
    const listId = list.json().id as string;

    const contact = await app.inject({
      method: "POST",
      url: "/api/people/contacts",
      headers: { cookie },
      payload: { spaceId, firstName: "Mara", lastName: "Jansen" },
    });
    const personId = contact.json().person.id as string;

    const added = await app.inject({
      method: "POST",
      url: `/api/people/lists/${listId}/members`,
      headers: { cookie },
      payload: { personId },
    });
    expect(added.statusCode).toBe(201);

    // The CRM-only fields go in through the ordinary person patch.
    await app.inject({
      method: "PATCH",
      url: `/api/people/${personId}`,
      headers: { cookie },
      payload: {
        profile: {
          selfDescribed: {
            website: { value: "jamot.pro" },
            context: { value: "Runs ops." },
            aura: { value: 78 },
            notes: { value: [{ when: "13/09", text: "Called." }] },
          },
        },
      },
    });

    const lists = await app.inject({
      method: "GET",
      url: `/api/people/lists?spaceId=${spaceId}`,
      headers: { cookie },
    });
    expect(lists.statusCode).toBe(200);
    const [only] = lists.json().items;
    expect(only.name).toBe("Operators");
    expect(only.people).toHaveLength(1);
    expect(only.people[0]).toMatchObject({
      id: personId,
      website: "jamot.pro",
      context: "Runs ops.",
      aura: 78,
      publicProfile: "",
    });
    expect(only.people[0].notes).toEqual([{ when: "13/09", text: "Called." }]);
  });

  it("adding the same person twice is a no-op, and removal leaves the person alive", async () => {
    const { app, cookie, spaceId } = await signUp("twice@example.com");
    const list = await app.inject({
      method: "POST",
      url: "/api/people/lists",
      headers: { cookie },
      payload: { spaceId, name: "Pilots" },
    });
    const listId = list.json().id as string;
    const contact = await app.inject({
      method: "POST",
      url: "/api/people/contacts",
      headers: { cookie },
      payload: { spaceId, firstName: "Ruben" },
    });
    const personId = contact.json().person.id as string;

    for (const _ of [0, 1]) {
      await app.inject({
        method: "POST",
        url: `/api/people/lists/${listId}/members`,
        headers: { cookie },
        payload: { personId },
      });
    }
    const after = await app.inject({
      method: "GET",
      url: `/api/people/lists?spaceId=${spaceId}`,
      headers: { cookie },
    });
    expect(after.json().items[0].people).toHaveLength(1);

    const removed = await app.inject({
      method: "DELETE",
      url: `/api/people/lists/${listId}/members/${personId}`,
      headers: { cookie },
    });
    expect(removed.statusCode).toBe(204);

    const empty = await app.inject({
      method: "GET",
      url: `/api/people/lists?spaceId=${spaceId}`,
      headers: { cookie },
    });
    expect(empty.json().items[0].people).toHaveLength(0);

    // Removing from a list must not delete the person.
    const person = await app.inject({
      method: "GET",
      url: `/api/people/${personId}`,
      headers: { cookie },
    });
    expect(person.statusCode).toBe(200);
  });

  it("refuses a space the caller has no role in", async () => {
    const owner = await signUp("a@example.com");
    const list = await owner.app.inject({
      method: "POST",
      url: "/api/people/lists",
      headers: { cookie: owner.cookie },
      payload: { spaceId: owner.spaceId, name: "Private" },
    });
    expect(list.statusCode).toBe(201);

    const stranger = await signUp("b@example.com");
    const denied = await stranger.app.inject({
      method: "GET",
      url: `/api/people/lists?spaceId=${owner.spaceId}`,
      headers: { cookie: stranger.cookie },
    });
    expect(denied.statusCode).toBe(403);
  });

  it("deleting a list drops its membership rows", async () => {
    const { app, cookie, spaceId } = await signUp("drop@example.com");
    const list = await app.inject({
      method: "POST",
      url: "/api/people/lists",
      headers: { cookie },
      payload: { spaceId, name: "Temporary" },
    });
    const listId = list.json().id as string;
    const contact = await app.inject({
      method: "POST",
      url: "/api/people/contacts",
      headers: { cookie },
      payload: { spaceId, firstName: "Ines" },
    });
    await app.inject({
      method: "POST",
      url: `/api/people/lists/${listId}/members`,
      headers: { cookie },
      payload: { personId: contact.json().person.id },
    });

    const gone = await app.inject({
      method: "DELETE",
      url: `/api/people/lists/${listId}`,
      headers: { cookie },
    });
    expect(gone.statusCode).toBe(204);

    const lists = await app.inject({
      method: "GET",
      url: `/api/people/lists?spaceId=${spaceId}`,
      headers: { cookie },
    });
    expect(lists.json().items).toHaveLength(0);
  });
});
