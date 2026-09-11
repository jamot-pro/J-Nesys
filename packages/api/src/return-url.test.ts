import { describe, expect, it } from "vitest";
import { safeReturnUrl } from "./return-url.js";

const FRONTEND = "https://mvp.jamot.pro";

describe("safeReturnUrl", () => {
  it("allows the frontend itself and any sibling org console", () => {
    expect(safeReturnUrl("https://mvp.jamot.pro/", FRONTEND)).toBe("https://mvp.jamot.pro/");
    expect(safeReturnUrl("https://sales.jamot.pro/leads", FRONTEND)).toBe(
      "https://sales.jamot.pro/leads",
    );
    expect(safeReturnUrl("https://jamot.pro/", FRONTEND)).toBe("https://jamot.pro/");
  });

  it("rejects other sites, including lookalikes", () => {
    // The classic open-redirect bypass: endsWith("jamot.pro") would pass this.
    expect(safeReturnUrl("https://jamot.pro.evil.com/", FRONTEND)).toBeNull();
    expect(safeReturnUrl("https://evil.com/", FRONTEND)).toBeNull();
    expect(safeReturnUrl("https://notjamot.pro/", FRONTEND)).toBeNull();
  });

  it("rejects non-https, credentials and junk", () => {
    expect(safeReturnUrl("http://sales.jamot.pro/", FRONTEND)).toBeNull();
    expect(safeReturnUrl("javascript:alert(1)", FRONTEND)).toBeNull();
    expect(safeReturnUrl("//evil.com", FRONTEND)).toBeNull();
    expect(safeReturnUrl("https://user:pw@sales.jamot.pro/", FRONTEND)).toBeNull();
    expect(safeReturnUrl("not a url", FRONTEND)).toBeNull();
    expect(safeReturnUrl(undefined, FRONTEND)).toBeNull();
  });

  it("allows http on localhost for local development", () => {
    expect(safeReturnUrl("http://localhost:3002/leads", "http://localhost:3000")).toBe(
      "http://localhost:3002/leads",
    );
    // ...but never localhost when the deployment is a real site.
    expect(safeReturnUrl("http://localhost:3002/", FRONTEND)).toBeNull();
  });
});
