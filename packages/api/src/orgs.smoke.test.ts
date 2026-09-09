import { describe, expect, it, beforeAll, afterAll } from "vitest";
import type { LightMyRequestResponse } from "fastify";
import { buildApp } from "./app.js";
import { createMemoryRepository } from "./repository.js";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.SUPER_ADMIN_EMAILS = "root@example.com";

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

describe("org smoke", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let owner: string;
  let orgId: string;

  beforeAll(async () => {
    app = await makeApp();
    owner = await registerAndLogin(app, "owner@example.com", "password123", "Owner");
  });

  it("super admin flag is applied on register", async () => {
    const root = await registerAndLogin(app, "root@example.com", "password123", "Root");
    const me = await app.inject({ method: "GET", url: "/api/auth/me", headers: { cookie: root } });
    expect(me.json().isSuperAdmin).toBe(true);

    const ownerMe = await app.inject({ method: "GET", url: "/api/auth/me", headers: { cookie: owner } });
    expect(ownerMe.json().isSuperAdmin).toBe(false);
  });

  it("creates an org and makes the creator owner", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/organizations",
      headers: { cookie: owner },
      payload: { name: "Acme", dream: "sell widgets" },
    });
    expect(res.statusCode).toBe(201);
    orgId = res.json().organization.id;

    const members = await app.inject({
      method: "GET",
      url: `/api/organizations/${orgId}/members`,
      headers: { cookie: owner },
    });
    expect(members.statusCode).toBe(200);
    expect(members.json().items).toHaveLength(1);
    expect(members.json().items[0].kind).toBe("owner");
  });

  it("adds a member by unknown email as a placeholder (no password login yet)", async () => {
    const added = await app.inject({
      method: "POST",
      url: `/api/organizations/${orgId}/members`,
      headers: { cookie: owner },
      payload: { email: "bob@example.com", role: "member" },
    });
    expect(added.statusCode).toBe(201);
    expect(added.json().personId).toBeTruthy();
    expect(added.json().kind).toBe("member");

    const bobLogin = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "bob@example.com", password: "anything123" },
    });
    expect(bobLogin.statusCode).toBe(401);
  });

  it("duplicate membership is rejected", async () => {
    const dup = await app.inject({
      method: "POST",
      url: `/api/organizations/${orgId}/members`,
      headers: { cookie: owner },
      payload: { email: "bob@example.com", role: "admin" },
    });
    expect(dup.statusCode).toBe(409);
  });

  it("scoping: only members see the org; strangers get 403", async () => {
    const eve = await registerAndLogin(app, "eve@example.com", "password123", "Eve");
    const eveOrgs = await app.inject({ method: "GET", url: "/api/organizations", headers: { cookie: eve } });
    expect(eveOrgs.json().items.map((i: any) => i.organization.id)).not.toContain(orgId);

    const blocked = await app.inject({
      method: "GET",
      url: `/api/organizations/${orgId}/members`,
      headers: { cookie: eve },
    });
    expect(blocked.statusCode).toBe(403);
  });

  it("member with an existing account is added, can log in, and sees the org", async () => {
    const dave = await registerAndLogin(app, "dave@example.com", "password123", "Dave");
    const added = await app.inject({
      method: "POST",
      url: `/api/organizations/${orgId}/members`,
      headers: { cookie: owner },
      payload: { email: "dave@example.com", role: "member" },
    });
    expect(added.statusCode).toBe(201);

    const daveOrgs = await app.inject({ method: "GET", url: "/api/organizations", headers: { cookie: dave } });
    expect(daveOrgs.json().items.map((i: any) => i.organization.id)).toContain(orgId);
  });

  it("promotes and demotes a member; cannot touch the owner", async () => {
    const members = await app.inject({
      method: "GET",
      url: `/api/organizations/${orgId}/members`,
      headers: { cookie: owner },
    });
    const dave = members.json().items.find((m: any) => m.email === "dave@example.com");

    const promote = await app.inject({
      method: "PATCH",
      url: `/api/organizations/${orgId}/members/${dave.personId}`,
      headers: { cookie: owner },
      payload: { role: "admin" },
    });
    expect(promote.statusCode).toBe(200);
    expect(promote.json().kind).toBe("admin");

    const ownerMember = members.json().items.find((m: any) => m.kind === "owner");
    const demoteOwner = await app.inject({
      method: "PATCH",
      url: `/api/organizations/${orgId}/members/${ownerMember.personId}`,
      headers: { cookie: owner },
      payload: { role: "member" },
    });
    expect(demoteOwner.statusCode).toBe(403);
  });

  it("plain member can read members but not manage them", async () => {
    const members = await app.inject({
      method: "GET",
      url: `/api/organizations/${orgId}/members`,
      headers: { cookie: owner },
    });
    const dave = members.json().items.find((m: any) => m.email === "dave@example.com");
    expect(dave.kind).toBe("admin");

    const demote = await app.inject({
      method: "PATCH",
      url: `/api/organizations/${orgId}/members/${dave.personId}`,
      headers: { cookie: owner },
      payload: { role: "member" },
    });
    expect(demote.statusCode).toBe(200);

    const daveCookie = await registerAndLogin(app, "dave@example.com", "password123", "Dave");
    const readOk = await app.inject({
      method: "GET",
      url: `/api/organizations/${orgId}/members`,
      headers: { cookie: daveCookie },
    });
    expect(readOk.statusCode).toBe(200);

    const tryAdd = await app.inject({
      method: "POST",
      url: `/api/organizations/${orgId}/members`,
      headers: { cookie: daveCookie },
      payload: { email: "carol@example.com", role: "member" },
    });
    expect(tryAdd.statusCode).toBe(403);
  });

  it("apps get/put: toggles and validates app ids", async () => {
    const initial = await app.inject({
      method: "GET",
      url: `/api/organizations/${orgId}/apps`,
      headers: { cookie: owner },
    });
    expect(initial.statusCode).toBe(200);
    expect(initial.json().apps.map((a: any) => a.id)).toContain("crm");

    const put = await app.inject({
      method: "PUT",
      url: `/api/organizations/${orgId}/apps`,
      headers: { cookie: owner },
      payload: { enabledAppIds: ["crm", "event-management"] },
    });
    expect(put.statusCode).toBe(200);
    expect(put.json().enabledAppIds).toEqual(["crm", "event-management"]);

    const bad = await app.inject({
      method: "PUT",
      url: `/api/organizations/${orgId}/apps`,
      headers: { cookie: owner },
      payload: { enabledAppIds: ["crm", "nope"] },
    });
    expect(bad.statusCode).toBe(400);
  });

  it("removes a member; cannot remove the owner", async () => {
    const members = await app.inject({
      method: "GET",
      url: `/api/organizations/${orgId}/members`,
      headers: { cookie: owner },
    });
    const dave = members.json().items.find((m: any) => m.email === "dave@example.com");
    const removed = await app.inject({
      method: "DELETE",
      url: `/api/organizations/${orgId}/members/${dave.personId}`,
      headers: { cookie: owner },
    });
    expect(removed.statusCode).toBe(204);

    const ownerMember = members.json().items.find((m: any) => m.kind === "owner");
    const removeOwner = await app.inject({
      method: "DELETE",
      url: `/api/organizations/${orgId}/members/${ownerMember.personId}`,
      headers: { cookie: owner },
    });
    expect(removeOwner.statusCode).toBe(403);
  });

  it("super admin sees every org regardless of membership", async () => {
    const root = await registerAndLogin(app, "root@example.com", "password123", "Root");
    const orgs = await app.inject({ method: "GET", url: "/api/organizations", headers: { cookie: root } });
    expect(orgs.json().items.map((i: any) => i.organization.id)).toContain(orgId);

    const members = await app.inject({
      method: "GET",
      url: `/api/organizations/${orgId}/members`,
      headers: { cookie: root },
    });
    expect(members.statusCode).toBe(200);
  });
});

describe("org subdomain / settings / delete", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let root: string;
  let boss: string;
  let orgId: string;
  let uploadsDir: string;

  beforeAll(async () => {
    uploadsDir = mkdtempSync(join(tmpdir(), "jamot-uploads-"));
    process.env.UPLOADS_DIR = uploadsDir;
    app = await makeApp();
    root = await registerAndLogin(app, "root@example.com", "password123", "Root");
    boss = await registerAndLogin(app, "boss@example.com", "password123", "Boss");
    const created = await app.inject({
      method: "POST",
      url: "/api/organizations",
      headers: { cookie: root },
      payload: { name: "Widgets Co", slug: "widgets" },
    });
    expect(created.statusCode).toBe(201);
    orgId = created.json().organization.id;
  });

  afterAll(() => {
    if (uploadsDir) rmSync(uploadsDir, { recursive: true, force: true });
  });

  it("rejects duplicate or invalid subdomains", async () => {
    const dup = await app.inject({
      method: "POST",
      url: "/api/organizations",
      headers: { cookie: root },
      payload: { name: "Dup", slug: "widgets" },
    });
    expect(dup.statusCode).toBe(409);

    const reserved = await app.inject({
      method: "POST",
      url: "/api/organizations",
      headers: { cookie: root },
      payload: { name: "Api", slug: "api" },
    });
    expect(reserved.statusCode).toBe(400);
  });

  it("resolves an org by subdomain for members and super admins, 403 for strangers", async () => {
    await app.inject({
      method: "POST",
      url: `/api/organizations/${orgId}/members`,
      headers: { cookie: root },
      payload: { email: "boss@example.com", role: "admin" },
    });

    const byBoss = await app.inject({
      method: "GET",
      url: "/api/organizations/resolve?subdomain=widgets",
      headers: { cookie: boss },
    });
    expect(byBoss.statusCode).toBe(200);
    expect(byBoss.json().organization.slug).toBe("widgets");
    expect(byBoss.json().role).toBe("admin");

    const byRoot = await app.inject({
      method: "GET",
      url: "/api/organizations/resolve?subdomain=widgets",
      headers: { cookie: root },
    });
    expect(byRoot.statusCode).toBe(200);

    const eve = await registerAndLogin(app, "eve2@example.com", "password123", "Eve");
    const byEve = await app.inject({
      method: "GET",
      url: "/api/organizations/resolve?subdomain=widgets",
      headers: { cookie: eve },
    });
    expect(byEve.statusCode).toBe(403);
  });

  it("org settings patch is super-admin only", async () => {
    const byBoss = await app.inject({
      method: "PATCH",
      url: `/api/organizations/${orgId}`,
      headers: { cookie: boss },
      payload: { slug: "hijacked" },
    });
    expect(byBoss.statusCode).toBe(403);

    const byRoot = await app.inject({
      method: "PATCH",
      url: `/api/organizations/${orgId}`,
      headers: { cookie: root },
      payload: { slug: "widgets-pro", dream: "build widgets" },
    });
    expect(byRoot.statusCode).toBe(200);
    expect(byRoot.json().organization.slug).toBe("widgets-pro");
  });

  it("org admin can patch workspace settings (name + config), member cannot", async () => {
    const ws = await app.inject({
      method: "GET",
      url: `/api/organizations/${orgId}/workspaces`,
      headers: { cookie: root },
    });
    const workspace = ws.json().items[0];

    const patched = await app.inject({
      method: "PATCH",
      url: `/api/organizations/${orgId}/workspaces/${workspace.id}`,
      headers: { cookie: boss },
      payload: { name: "Renamed Workspace", config: { theme: "dark" } },
    });
    expect(patched.statusCode).toBe(200);
    expect(patched.json().name).toBe("Renamed Workspace");
    expect(patched.json().config).toEqual({ theme: "dark" });

    const eve = await registerAndLogin(app, "eve3@example.com", "password123", "Eve");
    await app.inject({
      method: "POST",
      url: `/api/organizations/${orgId}/members`,
      headers: { cookie: root },
      payload: { email: "eve3@example.com", role: "member" },
    });
    const byMember = await app.inject({
      method: "PATCH",
      url: `/api/organizations/${orgId}/workspaces/${workspace.id}`,
      headers: { cookie: eve },
      payload: { name: "nope" },
    });
    expect(byMember.statusCode).toBe(403);
  });

  it("uploads and serves an org logo", async () => {
    const pixel =
      "data:image/png;base64," +
      Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      ).toString("base64");
    const up = await app.inject({
      method: "PUT",
      url: `/api/organizations/${orgId}/logo`,
      headers: { cookie: root },
      payload: { dataUri: pixel },
    });
    expect(up.statusCode).toBe(200);
    expect(up.json().logoUrl).toMatch(/^\/uploads\/orgs\//);

    const byMember = await app.inject({
      method: "PUT",
      url: `/api/organizations/${orgId}/logo`,
      headers: { cookie: boss },
      payload: { dataUri: pixel },
    });
    expect(byMember.statusCode).toBe(403);
  });

  it("deletes the org only with matching confirmName and as super admin", async () => {
    const orgDetail = await app.inject({
      method: "GET",
      url: `/api/organizations/${orgId}`,
      headers: { cookie: root },
    });
    const space = await app.inject({
      method: "GET",
      url: `/api/spaces/${orgDetail.json().spaceId}`,
      headers: { cookie: root },
    });
    const currentName = space.json().name;

    const wrong = await app.inject({
      method: "DELETE",
      url: `/api/organizations/${orgId}`,
      headers: { cookie: root },
      payload: { confirmName: "nope" },
    });
    expect(wrong.statusCode).toBe(400);

    const byBoss = await app.inject({
      method: "DELETE",
      url: `/api/organizations/${orgId}`,
      headers: { cookie: boss },
      payload: { confirmName: currentName },
    });
    expect(byBoss.statusCode).toBe(403);

    const ok = await app.inject({
      method: "DELETE",
      url: `/api/organizations/${orgId}`,
      headers: { cookie: root },
      payload: { confirmName: currentName },
    });
    expect(ok.statusCode).toBe(204);

    const gone = await app.inject({
      method: "GET",
      url: `/api/organizations/${orgId}`,
      headers: { cookie: root },
    });
    expect(gone.statusCode).toBe(404);
  });
});

