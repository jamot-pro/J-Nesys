import { describe, expect, it } from "vitest";
import { buildCorsOrigin } from "./cors.js";

describe("buildCorsOrigin", () => {
  it("is permissive when CORS_ORIGIN is unset (local dev)", () => {
    expect(buildCorsOrigin(undefined)).toBe(true);
    expect(buildCorsOrigin("")).toBe(true);
  });

  function matches(result: true | Array<string | RegExp>, origin: string): boolean {
    if (result === true) return true;
    return result.some((pattern) =>
      typeof pattern === "string" ? pattern === origin : pattern.test(origin),
    );
  }

  it("allows the exact configured origin", () => {
    const result = buildCorsOrigin("https://mvp.jamot.pro");
    expect(matches(result, "https://mvp.jamot.pro")).toBe(true);
  });

  it("allows any subdomain of the configured origin's root domain", () => {
    const result = buildCorsOrigin("https://mvp.jamot.pro");
    expect(matches(result, "https://acme.jamot.pro")).toBe(true);
    expect(matches(result, "https://another-org.jamot.pro")).toBe(true);
    expect(matches(result, "https://jamot.pro")).toBe(true);
  });

  it("rejects unrelated origins", () => {
    const result = buildCorsOrigin("https://mvp.jamot.pro");
    expect(matches(result, "https://evil.com")).toBe(false);
    expect(matches(result, "https://jamot.pro.evil.com")).toBe(false);
    expect(matches(result, "http://mvp.jamot.pro")).toBe(false);
  });

  it("supports multiple comma-separated origins", () => {
    const result = buildCorsOrigin("https://mvp.jamot.pro, https://staging.example.com");
    expect(matches(result, "https://acme.jamot.pro")).toBe(true);
    expect(matches(result, "https://foo.staging.example.com")).toBe(true);
    expect(matches(result, "https://evil.com")).toBe(false);
  });
});
