import { describe, expect, it } from "vitest";
import type { MemoryProvider, MemoryEntry } from "@jamot/core/memory";
import type { OrgGraph, OrgNode } from "@jamot/contracts";
import {
  evaluateOrgHeartbeat,
  isOrgHeartbeatDue,
  runOrgHeartbeats,
} from "./heartbeat.js";

function node(
  id: string,
  kind: OrgNode["kind"],
  name: string,
  config: Record<string, unknown> = {},
): OrgNode {
  return {
    id: id as OrgNode["id"],
    organizationId: "org" as OrgNode["organizationId"],
    kind,
    name,
    refId: null,
    config,
    position: { x: 0, y: 0 },
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  };
}

function edge(from: string, to: string, relation: string) {
  return {
    id: `${from}-${to}` as OrgNode["id"],
    organizationId: "org" as OrgNode["organizationId"],
    fromNodeId: from as OrgNode["id"],
    toNodeId: to as OrgNode["id"],
    relation: relation as never,
    metadata: {},
    validFrom: "2024-01-01T00:00:00.000Z",
    validTo: null,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  };
}

const memory: MemoryEntry[] = [];
const memoryProvider: MemoryProvider = {
  async store(entry) {
    memory.push(entry as unknown as MemoryEntry);
    return entry as unknown as MemoryEntry;
  },
  async get() {
    return null;
  },
  async list() {
    return [];
  },
  async update() {
    return null;
  },
  async forget() {},
};

function memoryTypes(): string[] {
  return memory.map((m) => (m.content as { type?: string }).type as string);
}

describe("isOrgHeartbeatDue", () => {
  it("is due only when enabled with a matching cron schedule", () => {
    const due = node("hb", "heartbeat", "Pulse", {
      schedule: "0 9 * * 1",
      enabled: true,
    });
    const now = new Date(2024, 0, 1, 9, 0, 0); // Monday 09:00
    expect(now.getDay()).toBe(1);
    expect(isOrgHeartbeatDue(due, now)).toBe(true);
    expect(isOrgHeartbeatDue(due, new Date(2024, 0, 2, 9, 0, 0))).toBe(false);
    expect(
      isOrgHeartbeatDue({ ...due, config: { ...due.config, enabled: false } }, now),
    ).toBe(false);
  });
});

describe("evaluateOrgHeartbeat", () => {
  it("detects a team with no human/agent members", () => {
    const g: OrgGraph = {
      nodes: [
        node("hb", "heartbeat", "Pulse"),
        node("team", "team", "Core"),
        node("dream", "dream", "Dream"),
      ],
      edges: [edge("hb", "team", "monitors"), edge("hb", "dream", "monitors")],
    };
    const res = evaluateOrgHeartbeat(g, g.nodes[0]!);
    expect(res.monitors).toEqual(["Core", "Dream"]);
    expect(res.gaps.length).toBe(2);
    expect(res.gaps[0]).toContain("no human/agent members");
  });

  it("does not flag a team that has a human or agent member", () => {
    const g: OrgGraph = {
      nodes: [
        node("hb", "heartbeat", "Pulse"),
        node("team", "team", "Core"),
        node("human", "human", "Andrea"),
      ],
      edges: [
        edge("hb", "team", "monitors"),
        edge("human", "team", "member_of"),
      ],
    };
    expect(evaluateOrgHeartbeat(g, g.nodes[0]!).gaps).toEqual([]);
  });
});

describe("runOrgHeartbeats", () => {
  it("emits heartbeat.fired and heartbeat.detected memory events", async () => {
    memory.length = 0;
    const g: OrgGraph = {
      nodes: [
        node("hb", "heartbeat", "Pulse", { schedule: "* * * * *", enabled: true }),
        node("team", "team", "Core"),
      ],
      edges: [edge("hb", "team", "monitors")],
    };
    const runs = await runOrgHeartbeats("org", g, memoryProvider, new Date(2024, 0, 1, 9, 0, 0));
    expect(runs.length).toBe(1);
    expect(memoryTypes()).toContain("heartbeat.fired");
    expect(memoryTypes()).toContain("heartbeat.detected");
  });

  it("skips heartbeats that are not due", async () => {
    memory.length = 0;
    const g: OrgGraph = {
      nodes: [
        node("hb", "heartbeat", "Pulse", {
          schedule: "0 9 * * 1",
          enabled: true,
        }),
      ],
      edges: [],
    };
    const runs = await runOrgHeartbeats(
      "org",
      g,
      memoryProvider,
      new Date(2024, 0, 2, 9, 0, 0), // Tuesday, not due
    );
    expect(runs.length).toBe(0);
    expect(memoryTypes()).not.toContain("heartbeat.fired");
  });
});