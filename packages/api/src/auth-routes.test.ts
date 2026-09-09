import { describe, expect, it, beforeAll } from "vitest";
import { buildApp } from "./app.js";
import { createMemoryRepository } from "./repository.js";

describe("auth routes", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp({ repository: createMemoryRepository(), secret: "test" });
    await app.inject({
      method: "POST",
      url: "/api/people",
      payload: { email: "ratelimit@example.com", password: "password123", displayName: "Rate Limit" },
    });
  });

  it("logs in with valid credentials", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "ratelimit@example.com", password: "password123" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().actor).toBeTruthy();
  });

  it("rejects invalid credentials without leaking which field was wrong", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "ratelimit@example.com", password: "wrong-password" },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe("invalid credentials");
  });

  it("throttles repeated login attempts from the same IP", async () => {
    // A dedicated app instance so this test's request count isn't polluted
    // by login attempts made in the tests above (rate-limit state is kept
    // per Fastify instance, keyed by IP — app.inject uses a fixed simulated
    // IP, so every request in this test hits the same bucket).
    const throttledApp = await buildApp({ repository: createMemoryRepository(), secret: "test" });
    await throttledApp.inject({
      method: "POST",
      url: "/api/people",
      payload: { email: "throttle@example.com", password: "password123", displayName: "Throttle" },
    });

    const attempt = () =>
      throttledApp.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { email: "throttle@example.com", password: "wrong-password" },
      });

    // The route's own limit is 10/minute — well under the app-wide 1000/minute
    // default, so this proves the per-route override is actually in effect
    // rather than just inheriting the global limit.
    const results = [];
    for (let i = 0; i < 12; i++) {
      results.push(await attempt());
    }

    const statusCodes = results.map((res) => res.statusCode);
    expect(statusCodes.slice(0, 10)).toEqual(new Array(10).fill(401));
    expect(statusCodes.slice(10)).toEqual([429, 429]);
  });
});
