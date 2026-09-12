import { describe, expect, it } from "vitest";
import { safeReturnUrl } from "./return-url.js";

describe("OAuth round-trips return to the console they started on", () => {
  const frontend = "https://mvp.jamot.pro";

  it("accepts any jamot.pro console", () => {
    expect(safeReturnUrl("https://sales.jamot.pro/?x=1", frontend)).toBe(
      "https://sales.jamot.pro/?x=1",
    );
  });

  it("still refuses a lookalike host", () => {
    expect(safeReturnUrl("https://jamot.pro.evil.com/", frontend)).toBeNull();
  });

  it("falls back when nothing was stored", () => {
    expect(safeReturnUrl(undefined, frontend)).toBeNull();
  });
});
