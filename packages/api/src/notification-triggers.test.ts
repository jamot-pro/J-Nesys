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

describe("real domain events create notifications, end to end", () => {
  it("notifies space owner/admins when a policy escalates the assignment to require_human", async () => {
    const repo = createMemoryRepository();
    const app = await buildApp({ repository: repo, secret: "test" });
    const cookie = await registerAndLogin(app, "owner@example.com", "password123", "Owner");
    const me = await app.inject({ method: "GET", url: "/api/auth/me", headers: { cookie } });
    const ownerActorId = me.json().actor.id;

    const org = await app.inject({
      method: "POST",
      url: "/api/organizations",
      headers: { cookie },
      payload: { name: "Acme", dream: "sell widgets" },
    });
    const spaceId = org.json().organization.spaceId;

    // Mock LLM classifies any message containing "task" as intent "task",
    // which maps to the task.execution / workflow.run capabilities.
    await repo.createPolicy({
      spaceId,
      name: "Escalate all tasks to a human",
      capability: "*",
      decision: "require_human",
    });

    const task = await app.inject({
      method: "POST",
      url: "/api/tasks",
      headers: { cookie },
      payload: { spaceId, title: "task: follow up with lead" },
    });
    expect(task.statusCode).toBe(201);
    const taskId = task.json().id;

    const assign = await app.inject({
      method: "POST",
      url: `/api/tasks/${taskId}/assign`,
      headers: { cookie },
    });
    expect(assign.statusCode).toBe(409);

    const notifications = await repo.listNotifications({ actorId: ownerActorId });
    expect(notifications).toHaveLength(1);
    expect(notifications[0]?.type).toBe("approval");
    expect(notifications[0]?.targetId).toBe(taskId);
  });

  it("notifies the human assignee when routing successfully assigns the task to them", async () => {
    const repo = createMemoryRepository();
    const app = await buildApp({ repository: repo, secret: "test" });
    const cookie = await registerAndLogin(app, "owner2@example.com", "password123", "Owner2");
    const me = await app.inject({ method: "GET", url: "/api/auth/me", headers: { cookie } });
    const ownerActorId = me.json().actor.id;

    const org = await app.inject({
      method: "POST",
      url: "/api/organizations",
      headers: { cookie },
      payload: { name: "Acme2", dream: "sell widgets" },
    });
    const spaceId = org.json().organization.spaceId;

    await repo.createPolicy({
      spaceId,
      name: "Allow everything",
      capability: "*",
      decision: "allow",
    });

    const task = await app.inject({
      method: "POST",
      url: "/api/tasks",
      headers: { cookie },
      payload: { spaceId, title: "task: follow up with lead" },
    });
    const taskId = task.json().id;

    const assign = await app.inject({
      method: "POST",
      url: `/api/tasks/${taskId}/assign`,
      headers: { cookie },
    });
    expect(assign.statusCode).toBe(200);
    expect(assign.json().assigneeActorIds).toContain(ownerActorId);

    const notifications = await repo.listNotifications({ actorId: ownerActorId });
    expect(notifications).toHaveLength(1);
    expect(notifications[0]?.type).toBe("message");
    expect(notifications[0]?.targetId).toBe(taskId);
  });

  it("notifies the space owner when a task transitions to completed, once per transition", async () => {
    const repo = createMemoryRepository();
    const app = await buildApp({ repository: repo, secret: "test" });
    const cookie = await registerAndLogin(app, "owner3@example.com", "password123", "Owner3");
    const me = await app.inject({ method: "GET", url: "/api/auth/me", headers: { cookie } });
    const ownerActorId = me.json().actor.id;

    const org = await app.inject({
      method: "POST",
      url: "/api/organizations",
      headers: { cookie },
      payload: { name: "Acme3", dream: "sell widgets" },
    });
    const spaceId = org.json().organization.spaceId;

    const task = await app.inject({
      method: "POST",
      url: "/api/tasks",
      headers: { cookie },
      payload: { spaceId, title: "Ship the report" },
    });
    const taskId = task.json().id;

    const complete = await app.inject({
      method: "PATCH",
      url: `/api/tasks/${taskId}/status`,
      headers: { cookie },
      payload: { status: "completed" },
    });
    expect(complete.statusCode).toBe(200);

    // Re-applying "completed" (idempotent status update) must not re-notify.
    const completeAgain = await app.inject({
      method: "PATCH",
      url: `/api/tasks/${taskId}/status`,
      headers: { cookie },
      payload: { status: "completed" },
    });
    expect(completeAgain.statusCode).toBe(200);

    const notifications = await repo.listNotifications({ actorId: ownerActorId });
    expect(notifications).toHaveLength(1);
    expect(notifications[0]?.type).toBe("completed");
    expect(notifications[0]?.targetId).toBe(taskId);
  });
});
