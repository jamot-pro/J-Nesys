import { describe, expect, it, beforeAll } from "vitest";
import type { LightMyRequestResponse } from "fastify";
import { buildApp } from "./app.js";
import { createMemoryRepository } from "./repository.js";

function sessionCookie(res: LightMyRequestResponse): string {
  const raw = res.headers["set-cookie"];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value ? (value.split(";")[0] ?? "") : "";
}

/**
 * The app shell sends the literal "personal" as a space id. Only the RBAC
 * check resolved it; handlers then queried with the alias, so Postgres
 * rejected it — `invalid input syntax for type uuid: "personal"` — and both
 * /api/wa/accounts and /api/notifications returned 500 whenever the personal
 * space was active. The in-memory repository accepts any string, which is why
 * this never failed in tests before; these assert the status instead.
 */
describe("the personal space alias", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let cookie: string;

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
    cookie = sessionCookie(login);
  });

  it("is accepted by /api/wa/accounts", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/wa/accounts?spaceId=personal",
      headers: { cookie },
    });
    expect(res.statusCode).toBe(200);
  });

  it("is accepted by /api/wa/channels", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/wa/channels?spaceId=personal",
      headers: { cookie },
    });
    expect(res.statusCode).toBe(200);
  });

  it("is accepted by /api/notifications", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/notifications?spaceId=personal",
      headers: { cookie },
    });
    expect(res.statusCode).toBe(200);
  });

  it("still refuses a space the actor has no role in", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/wa/accounts?spaceId=11111111-1111-1111-1111-111111111111",
      headers: { cookie },
    });
    expect(res.statusCode).toBe(403);
  });
});
