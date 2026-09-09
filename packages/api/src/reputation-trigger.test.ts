import { describe, expect, it } from "vitest";
import type { LightMyRequestResponse } from "fastify";
import { buildApp } from "./app.js";
import { createMemoryRepository } from "./repository.js";
import { createInMemoryReputationService } from "@jamot/core/reputation";
import type { ReputationService } from "@jamot/core/reputation";

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

describe("reputation auto-trigger", () => {
  it("records reputation for the assignee when a task's status is set to completed", async () => {
    const app = await makeApp();
    const cookie = await registerAndLogin(app, "owner@example.com", "password123", "Owner");

    const me = await app.inject({ method: "GET", url: "/api/auth/me", headers: { cookie } });
    const actorId = me.json().actor.id;

    const org = await app.inject({
      method: "POST",
      url: "/api/organizations",
      headers: { cookie },
      payload: { name: "Acme" },
    });
    const spaceId = org.json().organization.spaceId;

    const created = await app.inject({
      method: "POST",
      url: "/api/tasks",
      headers: { cookie },
      payload: { spaceId, title: "Write the report", assigneeActorIds: [actorId] },
    });
    const taskId = created.json().id;

    const before = await app.inject({
      method: "GET",
      url: `/api/reputation/${actorId}`,
      headers: { cookie },
    });
    expect(before.json()).toEqual({});

    const completed = await app.inject({
      method: "PATCH",
      url: `/api/tasks/${taskId}/status`,
      headers: { cookie },
      payload: { status: "completed" },
    });
    expect(completed.statusCode).toBe(200);

    const after = await app.inject({
      method: "GET",
      url: `/api/reputation/${actorId}`,
      headers: { cookie },
    });
    expect(after.json()["task.execution"]).toBe(0.5);
  });

  it("does not double-record when the task is already completed", async () => {
    // A real reputation service can't tell 1 recording from 2 by score value
    // alone (both average to the same number), so this wraps a spy around
    // the actual in-memory implementation rather than asserting on scores.
    const real = createInMemoryReputationService();
    let recordCalls = 0;
    const spy: ReputationService = {
      record: (...args) => {
        recordCalls += 1;
        return real.record(...args);
      },
      scores: (...args) => real.scores(...args),
    };
    const app = await buildApp({
      repository: createMemoryRepository(),
      secret: "test",
      reputation: spy,
    });
    const cookie = await registerAndLogin(app, "owner2@example.com", "password123", "Owner2");
    const me = await app.inject({ method: "GET", url: "/api/auth/me", headers: { cookie } });
    const actorId = me.json().actor.id;
    const org = await app.inject({
      method: "POST",
      url: "/api/organizations",
      headers: { cookie },
      payload: { name: "Acme 2" },
    });
    const spaceId = org.json().organization.spaceId;
    const created = await app.inject({
      method: "POST",
      url: "/api/tasks",
      headers: { cookie },
      payload: { spaceId, title: "Ship the release", assigneeActorIds: [actorId] },
    });
    const taskId = created.json().id;

    await app.inject({
      method: "PATCH",
      url: `/api/tasks/${taskId}/status`,
      headers: { cookie },
      payload: { status: "completed" },
    });
    // Redundant re-completion (e.g. a retried client call) should not add a
    // second reputation entry.
    await app.inject({
      method: "PATCH",
      url: `/api/tasks/${taskId}/status`,
      headers: { cookie },
      payload: { status: "completed" },
    });

    expect(recordCalls).toBe(1);
  });
});
