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

describe("space settings > default reply agent", () => {
  it("sets and clears the fallback agent for senders on no list", async () => {
    const { app, cookie, spaceId } = await signUp("owner@example.com");

    const initial = await app.inject({
      method: "GET",
      url: `/api/spaces/${spaceId}/settings`,
      headers: { cookie },
    });
    expect(initial.json().defaultReplyAgentId).toBeNull();

    const agent = await app.inject({
      method: "POST",
      url: "/api/agents",
      headers: { cookie },
      payload: { name: "Front Desk", harness: { kind: "generic_http", endpoint: null, config: {} } },
    });
    const agentId = agent.json().id as string;

    const set = await app.inject({
      method: "PATCH",
      url: `/api/spaces/${spaceId}/settings`,
      headers: { cookie },
      payload: { defaultReplyAgentId: agentId },
    });
    expect(set.json().defaultReplyAgentId).toBe(agentId);

    const reloaded = await app.inject({
      method: "GET",
      url: `/api/spaces/${spaceId}/settings`,
      headers: { cookie },
    });
    expect(reloaded.json().defaultReplyAgentId).toBe(agentId);

    const cleared = await app.inject({
      method: "PATCH",
      url: `/api/spaces/${spaceId}/settings`,
      headers: { cookie },
      payload: { defaultReplyAgentId: null },
    });
    expect(cleared.json().defaultReplyAgentId).toBeNull();
  });
});
