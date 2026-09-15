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
  return { app, cookie, spaceId: me.json().person.membershipSpaceIds[0] as string };
}

describe("deals", () => {
  it("creates, lists, updates stage (stamping closedAt), and deletes", async () => {
    const { app, cookie, spaceId } = await setup();

    const created = await app.inject({
      method: "POST",
      url: "/api/deals",
      headers: { cookie },
      payload: { spaceId, title: "Acme renewal", valueAmount: 5000, currency: "USD" },
    });
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({ stage: "open", valueAmount: 5000, closedAt: null });
    const dealId = created.json().id as string;

    const won = await app.inject({
      method: "PATCH",
      url: `/api/deals/${dealId}`,
      headers: { cookie },
      payload: { stage: "won" },
    });
    expect(won.statusCode).toBe(200);
    expect(won.json().stage).toBe("won");
    expect(won.json().closedAt).not.toBeNull();

    const reopened = await app.inject({
      method: "PATCH",
      url: `/api/deals/${dealId}`,
      headers: { cookie },
      payload: { stage: "open" },
    });
    expect(reopened.json().closedAt).toBeNull();

    const listed = await app.inject({
      method: "GET",
      url: `/api/deals?spaceId=${spaceId}`,
      headers: { cookie },
    });
    expect(listed.json().items).toHaveLength(1);

    const deleted = await app.inject({
      method: "DELETE",
      url: `/api/deals/${dealId}`,
      headers: { cookie },
    });
    expect(deleted.statusCode).toBe(204);
  });

  it("refuses access to a deal outside the caller's space", async () => {
    const { app, cookie: ownerCookie, spaceId } = await setup();

    const created = await app.inject({
      method: "POST",
      url: "/api/deals",
      headers: { cookie: ownerCookie },
      payload: { spaceId, title: "Private deal" },
    });
    const dealId = created.json().id as string;

    // A second person, registered on the same app, has their own personal
    // space and no membership in the first person's.
    await app.inject({
      method: "POST",
      url: "/api/people",
      payload: { email: "stranger@example.com", password: "password123", displayName: "Stranger" },
    });
    const strangerLogin = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "stranger@example.com", password: "password123" },
    });
    const strangerCookie = sessionCookie(strangerLogin);

    const res = await app.inject({
      method: "GET",
      url: `/api/deals/${dealId}`,
      headers: { cookie: strangerCookie },
    });
    expect(res.statusCode).toBe(403);
  });
});

describe("dashboard summary", () => {
  it("computes real counts across leads, deals, agents, and outreach", async () => {
    const { app, cookie, spaceId } = await setup();

    // Two won deals in different currencies, one open, one lost.
    for (const [title, stage, amount, currency] of [
      ["Won A", "won", 1000, "USD"],
      ["Won B", "won", 500, "EUR"],
      ["Open C", "open", 2000, "USD"],
      ["Lost D", "lost", 300, "USD"],
    ] as const) {
      await app.inject({
        method: "POST",
        url: "/api/deals",
        headers: { cookie },
        payload: { spaceId, title, stage, valueAmount: amount, currency },
      });
    }

    const agent = await app.inject({
      method: "POST",
      url: "/api/agents",
      headers: { cookie },
      payload: { name: "SDR", harness: { kind: "generic_http", endpoint: null, config: {} } },
    });
    expect(agent.statusCode).toBe(201);

    const summary = await app.inject({
      method: "GET",
      url: `/api/dashboard/summary?spaceId=${spaceId}`,
      headers: { cookie },
    });
    expect(summary.statusCode).toBe(200);
    const body = summary.json();
    expect(body.dealsOpen).toBe(1);
    expect(body.dealsWon).toBe(2);
    expect(body.dealsLost).toBe(1);
    expect(body.revenueByCurrency).toEqual(
      expect.arrayContaining([
        { currency: "USD", amount: 1000 },
        { currency: "EUR", amount: 500 },
      ]),
    );
    expect(body.leadsGenerated).toBe(0);
    expect(body.recentDeals.length).toBeGreaterThan(0);
  });

  it("refuses a caller with no access to the space", async () => {
    const a = await setup();
    const b = await setup();

    const res = await b.app.inject({
      method: "GET",
      url: `/api/dashboard/summary?spaceId=${a.spaceId}`,
      headers: { cookie: b.cookie },
    });
    expect(res.statusCode).toBe(403);
  });
});
