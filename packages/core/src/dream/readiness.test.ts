import { describe, expect, it } from "vitest";
import type { OrgGraph, OrgNode } from "@jamot/contracts";
import { computeReadiness, responsibilityCoverage } from "./readiness.js";

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

function graph(nodes: OrgNode[], edges: OrgGraph["edges"]): OrgGraph {
  return { nodes, edges };
}

describe("computeReadiness", () => {
  it("is not JAMOT when the DREAM has no objective", () => {
    const g = graph([node("dream", "dream", "Dream")], []);
    const r = computeReadiness(g);
    expect(r.jamot).toBe(false);
    expect(r.dimensions.find((d) => d.key === "dream")?.score).toBe(0);
    expect(r.dimensions.find((d) => d.key === "dream")?.missing).toContain(
      "Set a DREAM objective",
    );
  });

  it("flags uncovered responsibilities", () => {
    const g = graph(
      [
        node("dream", "dream", "Dream", { objective: "Grow" }),
        node("resp", "responsibility", "Finance"),
      ],
      [],
    );
    const r = computeReadiness(g);
    const dim = r.dimensions.find((d) => d.key === "responsibilities");
    expect(dim?.score).toBe(0);
    expect(dim?.missing).toContain("Finance");
  });

  it("counts an owned responsibility as covered", () => {
    const g = graph(
      [
        node("dream", "dream", "Dream", { objective: "Grow" }),
        node("resp", "responsibility", "Finance"),
        node("agent", "agent", "Finance Agent"),
      ],
      [edge("agent", "resp", "responsible_for")],
    );
    const r = computeReadiness(g);
    expect(
      r.dimensions.find((d) => d.key === "responsibilities")?.score,
    ).toBe(1);
    expect(responsibilityCoverage(g)[0]?.owners).toEqual(["agent"]);
  });

  it("requires a heartbeat to monitor each team", () => {
    const g = graph(
      [
        node("dream", "dream", "Dream", { objective: "Grow" }),
        node("team", "team", "Core"),
        node("hb", "heartbeat", "Pulse", { schedule: "0 9 * * 1", enabled: true }),
      ],
      [],
    );
    const r = computeReadiness(g);
    const dim = r.dimensions.find((d) => d.key === "heartbeats");
    expect(dim?.score).toBeLessThan(1);
    expect(dim?.missing).toContain("Core");
  });

  it("requires escalation configured", () => {
    const g = graph(
      [
        node("hb", "heartbeat", "Pulse", {
          schedule: "0 9 * * 1",
          actions: ["reflect"],
        }),
      ],
      [],
    );
    expect(
      computeReadiness(g).dimensions.find((d) => d.key === "escalation")?.score,
    ).toBe(0);
  });

  it("reaches JAMOT only when every dimension is fully covered", () => {
    const g = graph(
      [
        node("dream", "dream", "Dream", { objective: "Grow" }),
        node("team", "team", "Core", { mission: "Do things" }),
        node("resp", "responsibility", "Delivery"),
        node("agent", "agent", "Ops Agent"),
        node("tool", "tool", "CRM"),
        node("hb", "heartbeat", "Pulse", {
          schedule: "0 9 * * 1",
          actions: ["escalate"],
        }),
      ],
      [
        edge("agent", "team", "member_of"),
        edge("team", "dream", "member_of"),
        edge("agent", "resp", "responsible_for"),
        edge("hb", "team", "monitors"),
        edge("hb", "dream", "monitors"),
      ],
    );
    const r = computeReadiness(g);
    expect(r.jamot).toBe(true);
    expect(r.overall).toBe(1);
  });
});