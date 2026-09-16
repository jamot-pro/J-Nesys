import { describe, expect, it } from "vitest";
import { normalizeDomain } from "../src/normalize/domain.js";
import { normalizePhone } from "../src/normalize/phone.js";

describe("normalizeDomain", () => {
  it("collapses scheme and www variants to the same domain", () => {
    expect(normalizeDomain("https://www.example.com/path")).toBe("example.com");
    expect(normalizeDomain("www.example.com")).toBe("example.com");
    expect(normalizeDomain("example.com")).toBe("example.com");
  });

  it("returns null for garbage input", () => {
    expect(normalizeDomain("")).toBeNull();
    expect(normalizeDomain(null)).toBeNull();
  });
});

describe("normalizePhone", () => {
  it("strips formatting but keeps digits and a leading +", () => {
    expect(normalizePhone("+1 (555) 123-4567")).toBe("+15551234567");
  });

  it("rejects strings too short to be a phone number", () => {
    expect(normalizePhone("12")).toBeNull();
  });
});
