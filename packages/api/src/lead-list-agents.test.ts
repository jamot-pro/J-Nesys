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
  const agent = await app.inject({
    method: "POST",
    url: "/api/agents",
    headers: { cookie },
    payload: { name: "Scout", harness: { kind: "generic_http", endpoint: null, config: {} } },
  });
  return {
    app,
    cookie,
    spaceId: me.json().actor.personalSpaceId as string,
    agentId: agent.json().id as string,
  };
}

describe("a lead list remembers its agents", () => {
  it("keeps an agent assigned at creation", async () => {
    const { app, cookie, spaceId, agentId } = await setup();
    const created = await app.inject({
      method: "POST",
      url: "/api/lead-lists",
      headers: { cookie },
      payload: { spaceId, name: "Plumbers", providerId: "google-maps", agentId },
    });
    expect(created.statusCode).toBe(201);
    expect(created.json().agentId).toBe(agentId);
    expect(created.json().enrichmentAgentId).toBeNull();
  });

  it("assigns and unassigns through a patch, and it survives a reload", async () => {
    const { app, cookie, spaceId, agentId } = await setup();
    const created = await app.inject({
      method: "POST",
      url: "/api/lead-lists",
      headers: { cookie },
      payload: { spaceId, name: "Plumbers", providerId: "google-maps" },
    });
    const listId = created.json().id as string;

    await app.inject({
      method: "PATCH",
      url: `/api/lead-lists/${listId}`,
      headers: { cookie },
      payload: { agentId, enrichmentAgentId: agentId },
    });

    const reloaded = await app.inject({
      method: "GET",
      url: `/api/lead-lists/${listId}`,
      headers: { cookie },
    });
    expect(reloaded.json()).toMatchObject({ agentId, enrichmentAgentId: agentId });

    const cleared = await app.inject({
      method: "PATCH",
      url: `/api/lead-lists/${listId}`,
      headers: { cookie },
      payload: { agentId: null },
    });
    expect(cleared.json().agentId).toBeNull();
    // Clearing one must not clear the other.
    expect(cleared.json().enrichmentAgentId).toBe(agentId);
  });
});
