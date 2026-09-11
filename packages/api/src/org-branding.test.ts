import { describe, expect, it, beforeAll } from "vitest";
import type { LightMyRequestResponse } from "fastify";
import { buildApp } from "./app.js";
import { createMemoryRepository } from "./repository.js";

function sessionCookie(res: LightMyRequestResponse): string {
  const raw = res.headers["set-cookie"];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value ? (value.split(";")[0] ?? "") : "";
}

describe("public org branding", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp({ repository: createMemoryRepository(), secret: "test" });
    await app.inject({
      method: "POST",
      url: "/api/people",
      payload: { email: "owner@example.com", password: "password123", displayName: "Owner" },
    });
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "owner@example.com", password: "password123" },
    });
    await app.inject({
      method: "POST",
      url: "/api/organizations",
      headers: { cookie: sessionCookie(login) },
      payload: { name: "Acme", dream: "sell widgets", slug: "acme" },
    });
  });

  it("serves branding with no session — it renders the console's first paint", async () => {
    const res = await app.inject({ method: "GET", url: "/api/organizations/acme/branding" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.slug).toBe("acme");
    expect(body.displayName).toBe("Acme");
    expect(body.branding).toEqual({});
  });

  it("leaks nothing beyond the branded login screen", async () => {
    const res = await app.inject({ method: "GET", url: "/api/organizations/acme/branding" });
    const body = res.json();
    // The org has a dream set; an unauthenticated caller must not see it, nor
    // members, workspaces, enabled apps, reputation or internal ids.
    expect(Object.keys(body).sort()).toEqual(["branding", "displayName", "logoUrl", "slug"]);
    expect(JSON.stringify(body)).not.toContain("sell widgets");
  });

  it("404s an unknown org and 400s an unusable slug", async () => {
    const missing = await app.inject({ method: "GET", url: "/api/organizations/nope/branding" });
    expect(missing.statusCode).toBe(404);

    // "api" is reserved, so it can never name an org console.
    const reserved = await app.inject({ method: "GET", url: "/api/organizations/api/branding" });
    expect(reserved.statusCode).toBe(400);
  });
});
