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

describe("custom apps (per-org catalog beyond the built-in samples)", () => {
  it("registers a custom app, surfaces it in the org catalog, and lets it be enabled", async () => {
    const repo = createMemoryRepository();
    const app = await buildApp({ repository: repo, secret: "test" });
    const owner = await registerAndLogin(app, "owner@example.com", "password123", "Owner");

    const org = await app.inject({
      method: "POST",
      url: "/api/organizations",
      headers: { cookie: owner },
      payload: { name: "Acme", dream: "sell widgets" },
    });
    const orgId = org.json().organization.id;

    // Enabling it before it exists fails - it's not yet part of the catalog.
    const tooEarly = await app.inject({
      method: "PUT",
      url: `/api/organizations/${orgId}/apps`,
      headers: { cookie: owner },
      payload: { enabledAppIds: ["helpdesk"] },
    });
    expect(tooEarly.statusCode).toBe(400);

    const created = await app.inject({
      method: "POST",
      url: `/api/organizations/${orgId}/apps/custom`,
      headers: { cookie: owner },
      payload: { slug: "helpdesk", name: "Helpdesk", description: "Ticket triage." },
    });
    expect(created.statusCode).toBe(201);
    expect(created.json().slug).toBe("helpdesk");
    const customAppId = created.json().id;

    const catalog = await app.inject({
      method: "GET",
      url: `/api/organizations/${orgId}/apps`,
      headers: { cookie: owner },
    });
    const items = catalog.json().apps as Array<{ id: string; enabled: boolean }>;
    expect(items.some((a) => a.id === "helpdesk" && !a.enabled)).toBe(true);
    // Built-ins are still there too - custom apps are additive.
    expect(items.some((a) => a.id === "crm")).toBe(true);

    const enable = await app.inject({
      method: "PUT",
      url: `/api/organizations/${orgId}/apps`,
      headers: { cookie: owner },
      payload: { enabledAppIds: ["helpdesk"] },
    });
    expect(enable.statusCode).toBe(200);
    expect(enable.json().enabledAppIds).toEqual(["helpdesk"]);

    const deleted = await app.inject({
      method: "DELETE",
      url: `/api/organizations/${orgId}/apps/custom/${customAppId}`,
      headers: { cookie: owner },
    });
    expect(deleted.statusCode).toBe(204);

    // Deleting it also drops it from enabledAppIds.
    const after = await app.inject({
      method: "GET",
      url: `/api/organizations/${orgId}/apps`,
      headers: { cookie: owner },
    });
    expect(after.json().enabledAppIds).toEqual([]);
    expect((after.json().apps as Array<{ id: string }>).some((a) => a.id === "helpdesk")).toBe(false);
  });

  it("rejects a slug that collides with a built-in app id", async () => {
    const repo = createMemoryRepository();
    const app = await buildApp({ repository: repo, secret: "test" });
    const owner = await registerAndLogin(app, "owner2@example.com", "password123", "Owner2");

    const org = await app.inject({
      method: "POST",
      url: "/api/organizations",
      headers: { cookie: owner },
      payload: { name: "Acme2", dream: "sell widgets" },
    });
    const orgId = org.json().organization.id;

    const collide = await app.inject({
      method: "POST",
      url: `/api/organizations/${orgId}/apps/custom`,
      headers: { cookie: owner },
      payload: { slug: "crm", name: "My CRM" },
    });
    expect(collide.statusCode).toBe(409);
  });

  it("does not let a stranger register or see a custom app for someone else's org", async () => {
    const repo = createMemoryRepository();
    const app = await buildApp({ repository: repo, secret: "test" });
    const owner = await registerAndLogin(app, "owner3@example.com", "password123", "Owner3");
    const stranger = await registerAndLogin(app, "stranger@example.com", "password123", "Stranger");

    const org = await app.inject({
      method: "POST",
      url: "/api/organizations",
      headers: { cookie: owner },
      payload: { name: "Acme3", dream: "sell widgets" },
    });
    const orgId = org.json().organization.id;

    const blocked = await app.inject({
      method: "POST",
      url: `/api/organizations/${orgId}/apps/custom`,
      headers: { cookie: stranger },
      payload: { slug: "helpdesk", name: "Helpdesk" },
    });
    expect(blocked.statusCode).toBe(403);
  });
});
