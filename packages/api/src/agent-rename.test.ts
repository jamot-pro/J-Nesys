import { describe, expect, it } from "vitest";
import type { LightMyRequestResponse } from "fastify";
import { buildApp } from "./app.js";
import { createMemoryRepository } from "./repository.js";

function sessionCookie(res: LightMyRequestResponse): string {
  const raw = res.headers["set-cookie"];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value ? (value.split(";")[0] ?? "") : "";
}

async function setup(email: string) {
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
  return { app, cookie: sessionCookie(login) };
}

describe("renaming an agent", () => {
  it("changes the name shown for it, which lives on its actor", async () => {
    const { app, cookie } = await setup("owner@example.com");
    const created = await app.inject({
      method: "POST",
      url: "/api/agents",
      headers: { cookie },
      payload: { name: "First name", harness: { kind: "generic_http", endpoint: null, config: {} } },
    });
    expect(created.statusCode).toBe(201);
    const agentId = created.json().id as string;
    const actorId = created.json().actorId as string;

    const renamed = await app.inject({
      method: "PATCH",
      url: `/api/agents/${agentId}`,
      headers: { cookie },
      payload: { name: "Second name" },
    });
    expect(renamed.statusCode).toBe(200);

    const actors = await app.inject({ method: "GET", url: "/api/actors", headers: { cookie } });
    const actor = actors.json().items.find((a: { id: string }) => a.id === actorId);
    expect(actor.displayName).toBe("Second name");
  });

  it("renames and changes another field in the same patch", async () => {
    const { app, cookie } = await setup("both@example.com");
    const created = await app.inject({
      method: "POST",
      url: "/api/agents",
      headers: { cookie },
      payload: { name: "Before", harness: { kind: "generic_http", endpoint: null, config: {} } },
    });
    const agentId = created.json().id as string;

    const patched = await app.inject({
      method: "PATCH",
      url: `/api/agents/${agentId}`,
      headers: { cookie },
      payload: { name: "After", purpose: "Book meetings" },
    });
    expect(patched.statusCode).toBe(200);
    // The name is not an agent column, so it must not leak into the agent row.
    expect(patched.json().purpose).toBe("Book meetings");
    expect(patched.json()).not.toHaveProperty("name");
  });

  it("refuses a rename from someone who cannot manage the agent", async () => {
    const owner = await setup("a@example.com");
    const created = await owner.app.inject({
      method: "POST",
      url: "/api/agents",
      headers: { cookie: owner.cookie },
      payload: { name: "Theirs", harness: { kind: "generic_http", endpoint: null, config: {} } },
    });
    const agentId = created.json().id as string;

    const stranger = await setup("b@example.com");
    const res = await stranger.app.inject({
      method: "PATCH",
      url: `/api/agents/${agentId}`,
      headers: { cookie: stranger.cookie },
      payload: { name: "Mine now" },
    });
    expect([403, 404]).toContain(res.statusCode);
  });
});
