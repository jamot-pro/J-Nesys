import { describe, expect, it } from "vitest";
import { Timestamp } from "@jamot/contracts";
import { normalizePgTimestamp } from "./pg.js";

describe("normalizePgTimestamp", () => {
  it("converts Postgres's own rendering into something the contract accepts", () => {
    // What `timestamp(..., { mode: "string" })` actually returns: a space
    // separator and a two-digit offset. This is the value that made
    // /organizations/resolve return 500 for every Postgres organization.
    const fromPg = "2026-09-11 14:30:00+00";
    expect(Timestamp.safeParse(fromPg).success).toBe(false);
    expect(Timestamp.safeParse(normalizePgTimestamp(fromPg)).success).toBe(true);
  });

  it("leaves already-valid values meaning the same", () => {
    for (const v of ["2026-09-11T14:30:00.123Z", "2026-09-11T14:30:00+00:00"]) {
      const out = normalizePgTimestamp(v);
      expect(Timestamp.safeParse(out).success).toBe(true);
      expect(new Date(out).getTime()).toBe(new Date(v).getTime());
    }
  });

  it("accepts Date objects, for columns declared mode:'date'", () => {
    const d = new Date("2026-09-11T14:30:00.000Z");
    expect(normalizePgTimestamp(d)).toBe("2026-09-11T14:30:00.000Z");
  });

  it("preserves microsecond-precision instants to the millisecond", () => {
    const out = normalizePgTimestamp("2026-09-11 14:30:00.123456+02");
    expect(Timestamp.safeParse(out).success).toBe(true);
    expect(out).toBe("2026-09-11T12:30:00.123Z");
  });
});
