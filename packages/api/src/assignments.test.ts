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

describe("task assignment", () => {
  // Regression test for the bug where evaluate([]) === "deny" and nothing
  // ever created a Policy row, so /tasks/:id/assign 409'd for every org.
  // createSpace() now seeds a default allow policy - this exercises that
  // end-to-end through the real route stack, not just the policy engine
  // in isolation.
  it("assigns a task to the space owner on a freshly created org, with no manual policy setup", async () => {
    const app = await makeApp();
    const cookie = await registerAndLogin(app, "owner@example.com", "password123", "Owner");

    const org = await app.inject({
      method: "POST",
      url: "/api/organizations",
      headers: { cookie },
      payload: { name: "Acme" },
    });
    expect(org.statusCode).toBe(201);
    const spaceId = org.json().organization.spaceId;

    const task = await app.inject({
      method: "POST",
      url: "/api/tasks",
      headers: { cookie },
      payload: { spaceId, title: "Follow up with the new lead" },
    });
    expect(task.statusCode).toBe(201);

    const assigned = await app.inject({
      method: "POST",
      url: `/api/tasks/${task.json().id}/assign`,
      headers: { cookie },
    });
    expect(assigned.statusCode).toBe(200);
    expect(assigned.json().assigneeActorIds.length).toBeGreaterThan(0);

    // The assign response body reflects assignTask()'s pre-status-update
    // snapshot (a separate, pre-existing quirk in assignments.ts, not this
    // fix) - re-fetch to confirm the persisted status actually changed.
    const refetched = await app.inject({
      method: "GET",
      url: `/api/tasks/${task.json().id}`,
      headers: { cookie },
    });
    expect(refetched.json().status).toBe("assigned");
  });

  it("lists the default policy seeded for a new space and lets an admin add another", async () => {
    const app = await makeApp();
    const cookie = await registerAndLogin(app, "owner2@example.com", "password123", "Owner2");

    const org = await app.inject({
      method: "POST",
      url: "/api/organizations",
      headers: { cookie },
      payload: { name: "Acme 2" },
    });
    const spaceId = org.json().organization.spaceId;

    const listed = await app.inject({
      method: "GET",
      url: `/api/policies?spaceId=${spaceId}`,
      headers: { cookie },
    });
    expect(listed.statusCode).toBe(200);
    expect(listed.json().items).toHaveLength(1);
    expect(listed.json().items[0].decision).toBe("allow");

    const created = await app.inject({
      method: "POST",
      url: "/api/policies",
      headers: { cookie },
      payload: {
        spaceId,
        name: "Deny external payments",
        capability: "treasury.payment",
        minRole: "admin",
        decision: "deny",
      },
    });
    expect(created.statusCode).toBe(201);
  });
});
