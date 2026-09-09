import { describe, expect, it } from "vitest";
import type { Agent } from "@jamot/contracts";
import { cronMatches, cronIsValid } from "./cron.js";
import { isHeartbeatDue } from "./heartbeat.js";
import { createScheduler } from "./scheduler.js";

function heartbeat(
  partial: Partial<Agent["heartbeat"]> = {},
): Agent["heartbeat"] {
  return {
    enabled: false,
    cron: null,
    quietHours: null,
    check: [],
    onAction: "ask",
    ...partial,
  };
}

describe("cronMatches", () => {
  it("matches * * * * * at any time", () => {
    expect(cronMatches("* * * * *", new Date(2024, 0, 1, 0, 0, 0))).toBe(true);
    expect(cronMatches("* * * * *", new Date(2024, 5, 15, 23, 59, 59))).toBe(
      true,
    );
  });

  it("matches */5 minute steps", () => {
    expect(cronMatches("*/5 * * * *", new Date(2024, 0, 1, 0, 0, 0))).toBe(
      true,
    );
    expect(cronMatches("*/5 * * * *", new Date(2024, 0, 1, 0, 5, 0))).toBe(
      true,
    );
    expect(cronMatches("*/5 * * * *", new Date(2024, 0, 1, 0, 1, 0))).toBe(
      false,
    );
  });

  it("matches a specific weekday and hour", () => {
    const monday0900 = new Date(2024, 0, 1, 9, 0, 0);
    expect(monday0900.getDay()).toBe(1);
    expect(cronMatches("0 9 * * 1", monday0900)).toBe(true);
    expect(cronMatches("0 9 * * 1", new Date(2024, 0, 2, 9, 0, 0))).toBe(
      false,
    );
  });

  it("returns false for malformed cron", () => {
    expect(cronMatches("not a cron", new Date())).toBe(false);
    expect(cronMatches("", new Date())).toBe(false);
  });
});

describe("cronIsValid", () => {
  it("accepts valid expressions", () => {
    expect(cronIsValid("* * * * *")).toBe(true);
    expect(cronIsValid("*/5 0 * * 1")).toBe(true);
    expect(cronIsValid("0 9 1,15 * 1-5")).toBe(true);
  });

  it("rejects malformed expressions", () => {
    expect(cronIsValid("* * * *")).toBe(false);
    expect(cronIsValid("* * * * * *")).toBe(false);
    expect(cronIsValid("60 * * * *")).toBe(false);
    expect(cronIsValid("*/0 * * * *")).toBe(false);
  });
});

describe("isHeartbeatDue", () => {
  it("returns false when disabled", () => {
    expect(
      isHeartbeatDue(heartbeat({ enabled: false }), new Date()),
    ).toBe(false);
  });

  it("blocks quiet hours but allows outside them", () => {
    const hb = heartbeat({ enabled: true, quietHours: "22:00-07:00" });
    expect(isHeartbeatDue(hb, new Date(2024, 0, 1, 23, 0, 0))).toBe(false);
    expect(isHeartbeatDue(hb, new Date(2024, 0, 1, 12, 0, 0))).toBe(true);
  });
});

describe("scheduler", () => {
  it("runs a job at most once per minute", async () => {
    const scheduler = createScheduler();
    let runs = 0;
    scheduler.register({
      id: "job",
      cron: "* * * * *",
      async run() {
        runs += 1;
      },
    });

    const now = new Date(2024, 0, 1, 12, 30, 0);
    const first = await scheduler.runDue(now);
    const second = await scheduler.runDue(now);

    expect(runs).toBe(1);
    expect(first.find((r) => r.jobId === "job")?.ran).toBe(true);
    expect(second.find((r) => r.jobId === "job")?.ran).toBe(false);
  });
});
