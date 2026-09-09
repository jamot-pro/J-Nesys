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

describe("agents", () => {
  it("creates an agent owned by the session actor and persists config via PATCH", async () => {
    const app = await makeApp();
    const cookie = await registerAndLogin(app, "alice@example.com", "password123", "Alice");

    const created = await app.inject({
      method: "POST",
      url: "/api/agents",
      headers: { cookie },
      payload: {
        name: "Maria",
        harness: { kind: "mcp", endpoint: null },
        role: "Sales Assistant",
        purpose: "Help the sales team convert conversations into opportunities.",
      },
    });
    expect(created.statusCode).toBe(201);
    const agent = created.json();
    expect(agent.purpose).toContain("sales");
    expect(agent.autonomy).toBe("approve");

    const patched = await app.inject({
      method: "PATCH",
      url: `/api/agents/${agent.id}`,
      headers: { cookie },
      payload: {
        autonomy: "autonomous",
        purpose: "Own the full sales follow-up loop.",
        heartbeat: {
          enabled: true,
          cron: "*/15 * * * *",
          quietHours: "22:00-07:00",
          check: ["assigned_tasks", "new_messages"],
          onAction: "ask",
        },
        memoryScopes: ["organization", "department"],
        subscribedEvents: ["task.assigned", "message.received"],
        actionPermissions: { send_message: "approval", delete_records: "never" },
      },
    });
    expect(patched.statusCode).toBe(200);
    const updated = patched.json();
    expect(updated.autonomy).toBe("autonomous");
    expect(updated.heartbeat.enabled).toBe(true);
    expect(updated.heartbeat.check).toEqual(["assigned_tasks", "new_messages"]);
    expect(updated.memoryScopes).toContain("department");
    expect(updated.actionPermissions.delete_records).toBe("never");

    const fetched = await app.inject({
      method: "GET",
      url: `/api/agents/${agent.id}`,
      headers: { cookie },
    });
    expect(fetched.statusCode).toBe(200);
    expect(fetched.json().heartbeat.cron).toBe("*/15 * * * *");
  });

  it("rejects PATCH by a non-owner, non-admin user", async () => {
    const app = await makeApp();
    const ownerCookie = await registerAndLogin(app, "owner@example.com", "password123", "Owner");
    const strangerCookie = await registerAndLogin(app, "stranger@example.com", "password123", "Stranger");

    const created = await app.inject({
      method: "POST",
      url: "/api/agents",
      headers: { cookie: ownerCookie },
      payload: { name: "Maria", harness: { kind: "mcp", endpoint: null } },
    });
    expect(created.statusCode).toBe(201);

    const denied = await app.inject({
      method: "PATCH",
      url: `/api/agents/${created.json().id}`,
      headers: { cookie: strangerCookie },
      payload: { role: "Hacker" },
    });
    expect(denied.statusCode).toBe(403);

    const deniedDelete = await app.inject({
      method: "DELETE",
      url: `/api/agents/${created.json().id}`,
      headers: { cookie: strangerCookie },
    });
    expect(deniedDelete.statusCode).toBe(403);
  });

  it("rejects invalid configuration (unknown action permission)", async () => {
    const app = await makeApp();
    const cookie = await registerAndLogin(app, "bob@example.com", "password123", "Bob");

    const created = await app.inject({
      method: "POST",
      url: "/api/agents",
      headers: { cookie },
      payload: { name: "Maria", harness: { kind: "mcp", endpoint: null } },
    });
    expect(created.statusCode).toBe(201);

    const invalid = await app.inject({
      method: "PATCH",
      url: `/api/agents/${created.json().id}`,
      headers: { cookie },
      payload: { actionPermissions: { spend_money: "sometimes" } },
    });
    expect(invalid.statusCode).toBe(400);
  });

  it("deletes an agent and records activity", async () => {
    const app = await makeApp();
    const cookie = await registerAndLogin(app, "carol@example.com", "password123", "Carol");

    const created = await app.inject({
      method: "POST",
      url: "/api/agents",
      headers: { cookie },
      payload: { name: "Temp", harness: { kind: "mcp", endpoint: null } },
    });
    expect(created.statusCode).toBe(201);
    const agentId = created.json().id;

    await app.inject({
      method: "PATCH",
      url: `/api/agents/${agentId}`,
      headers: { cookie },
      payload: { role: "Intern" },
    });

    const activity = await app.inject({
      method: "GET",
      url: `/api/agents/${agentId}/activity`,
      headers: { cookie },
    });
    expect(activity.statusCode).toBe(200);
    const events = activity.json().items;
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events.map((e: { type: string }) => e.type)).toContain("agent.updated");

    const deleted = await app.inject({
      method: "DELETE",
      url: `/api/agents/${agentId}`,
      headers: { cookie },
    });
    expect(deleted.statusCode).toBe(204);

    const gone = await app.inject({
      method: "GET",
      url: `/api/agents/${agentId}`,
      headers: { cookie },
    });
    expect(gone.statusCode).toBe(404);
  });

  it("manages agent relationships", async () => {
    const app = await makeApp();
    const cookie = await registerAndLogin(app, "dave@example.com", "password123", "Dave");

    const me = await app.inject({ method: "GET", url: "/api/auth/me", headers: { cookie } });
    const humanActorId = me.json().actor.id;

    const created = await app.inject({
      method: "POST",
      url: "/api/agents",
      headers: { cookie },
      payload: { name: "Maria", harness: { kind: "mcp", endpoint: null } },
    });
    const agent = created.json();

    const added = await app.inject({
      method: "POST",
      url: `/api/agents/${agent.id}/relationships`,
      headers: { cookie },
      payload: { fromActorId: agent.actorId, toActorId: humanActorId, kind: "reports_to" },
    });
    expect(added.statusCode).toBe(201);

    const listed = await app.inject({
      method: "GET",
      url: `/api/agents/${agent.id}/relationships`,
      headers: { cookie },
    });
    expect(listed.statusCode).toBe(200);
    expect(listed.json().items).toHaveLength(1);
    expect(listed.json().items[0].to.displayName).toBe("Dave");
    expect(listed.json().items[0].to.type).toBe("human");

    const removed = await app.inject({
      method: "DELETE",
      url: `/api/agents/${agent.id}/relationships/${added.json().id}`,
      headers: { cookie },
    });
    expect(removed.statusCode).toBe(204);

    const listedAgain = await app.inject({
      method: "GET",
      url: `/api/agents/${agent.id}/relationships`,
      headers: { cookie },
    });
    expect(listedAgain.json().items).toHaveLength(0);
  });
});