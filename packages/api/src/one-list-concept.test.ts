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
  return {
    app,
    cookie,
    spaceId: me.json().person.membershipSpaceIds[0] as string,
    personId: me.json().person.id as string,
  };
}

describe("People and Outreach share one list", () => {
  it("a list made in People shows up in Outreach, with its members", async () => {
    const { app, cookie, spaceId, personId } = await setup();

    const made = await app.inject({
      method: "POST",
      url: "/api/people/lists",
      headers: { cookie },
      payload: { spaceId, name: "Operators" },
    });
    const listId = made.json().id as string;
    await app.inject({
      method: "POST",
      url: `/api/people/lists/${listId}/members`,
      headers: { cookie },
      payload: { personId },
    });

    const seen = await app.inject({
      method: "GET",
      url: `/api/outreach/lists?spaceId=${spaceId}`,
      headers: { cookie },
    });
    expect(seen.json().items).toHaveLength(1);
    expect(seen.json().items[0]).toMatchObject({ id: listId, name: "Operators" });
    expect(seen.json().items[0].memberPersonIds).toEqual([personId]);
  });

  it("a list made in Outreach shows up in People", async () => {
    const { app, cookie, spaceId } = await setup();

    await app.inject({
      method: "POST",
      url: "/api/outreach/lists",
      headers: { cookie },
      payload: { spaceId, name: "Pipeline" },
    });

    const seen = await app.inject({
      method: "GET",
      url: `/api/people/lists?spaceId=${spaceId}`,
      headers: { cookie },
    });
    expect(seen.json().items).toHaveLength(1);
    expect(seen.json().items[0].name).toBe("Pipeline");
  });

  it("renaming from either side is the same list", async () => {
    const { app, cookie, spaceId } = await setup();
    const made = await app.inject({
      method: "POST",
      url: "/api/people/lists",
      headers: { cookie },
      payload: { spaceId, name: "Before" },
    });
    const listId = made.json().id as string;

    await app.inject({
      method: "PATCH",
      url: `/api/outreach/lists/${listId}`,
      headers: { cookie },
      payload: { name: "After" },
    });

    const seen = await app.inject({
      method: "GET",
      url: `/api/people/lists?spaceId=${spaceId}`,
      headers: { cookie },
    });
    expect(seen.json().items[0].name).toBe("After");
  });

  it("GET /people?unlisted=true returns only people in none of the space's lists", async () => {
    const { app, cookie, spaceId, personId } = await setup();

    const listed = await app.inject({
      method: "POST",
      url: "/api/people/contacts",
      headers: { cookie },
      payload: { spaceId, firstName: "Listed", email: "listed@example.com" },
    });
    const listedId = listed.json().person.id as string;
    const unlisted = await app.inject({
      method: "POST",
      url: "/api/people/contacts",
      headers: { cookie },
      payload: { spaceId, firstName: "Unlisted", email: "unlisted@example.com" },
    });
    const unlistedId = unlisted.json().person.id as string;

    const made = await app.inject({
      method: "POST",
      url: "/api/people/lists",
      headers: { cookie },
      payload: { spaceId, name: "Some list" },
    });
    const listId = made.json().id as string;
    await app.inject({
      method: "POST",
      url: `/api/people/lists/${listId}/members`,
      headers: { cookie },
      payload: { personId: listedId },
    });

    const seen = await app.inject({
      method: "GET",
      url: `/api/people?spaceId=${spaceId}&unlisted=true&perPage=200`,
      headers: { cookie },
    });
    const ids = seen.json().items.map((p: { id: string }) => p.id);
    expect(ids).toContain(unlistedId);
    expect(ids).toContain(personId); // the space owner, never added to any list
    expect(ids).not.toContain(listedId);
  });

  it("People refuses to delete a list a campaign is working", async () => {
    const { app, cookie, spaceId } = await setup();
    const made = await app.inject({
      method: "POST",
      url: "/api/people/lists",
      headers: { cookie },
      payload: { spaceId, name: "In use" },
    });
    const listId = made.json().id as string;

    const agent = await app.inject({
      method: "POST",
      url: "/api/agents",
      headers: { cookie },
      payload: { name: "SDR", harness: { kind: "generic_http", endpoint: null, config: {} } },
    });

    const campaign = await app.inject({
      method: "POST",
      url: "/api/outreach/campaigns",
      headers: { cookie },
      payload: {
        spaceId,
        name: "Push",
        peopleListId: listId,
        agentId: agent.json().id,
        goal: "Book a call",
      },
    });
    expect(campaign.statusCode).toBe(201);

    const blocked = await app.inject({
      method: "DELETE",
      url: `/api/people/lists/${listId}`,
      headers: { cookie },
    });
    expect(blocked.statusCode).toBe(409);
  });
});
