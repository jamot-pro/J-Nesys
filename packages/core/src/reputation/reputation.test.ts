import { describe, expect, it } from "vitest";
import type { Provenance } from "@jamot/contracts";
import { createInMemoryReputationService } from "./memory.js";
import type { ReputationEvidence } from "./reputation.js";

const ACTOR = "00000000-0000-4000-8000-000000000001";

function provenance(confidence = 0.8): Provenance {
  const ts = new Date().toISOString();
  return { source: "assessment", confidence, createdAt: ts, updatedAt: ts };
}

function evidence(
  overrides: Partial<ReputationEvidence> = {},
): ReputationEvidence {
  return {
    outcome: {},
    verified: false,
    provenance: provenance(),
    ...overrides,
  };
}

describe("reputation service", () => {
  it("records a score and aggregates per capability", async () => {
    const svc = createInMemoryReputationService();
    await svc.record(ACTOR, "coding", evidence({ feedback: 0.8, verified: true }));
    await svc.record(ACTOR, "coding", evidence({ feedback: 0.6, verified: true }));
    await svc.record(ACTOR, "design", evidence({ feedback: 0.4, verified: true }));

    const scores = await svc.scores(ACTOR);
    expect(scores["coding"]).toBe(0.7);
    expect(scores["design"]).toBe(0.4);
  });

  it("weights verified entries higher than unverified", async () => {
    const svc = createInMemoryReputationService();
    await svc.record(ACTOR, "coding", evidence({ feedback: 0.8, verified: true }));
    await svc.record(ACTOR, "coding", evidence({ feedback: 0.8, verified: false }));

    const scores = await svc.scores(ACTOR);
    expect(scores["coding"]).toBe(0.6);
  });

  it("defaults feedback to 0.5", async () => {
    const svc = createInMemoryReputationService();
    const score = await svc.record(ACTOR, "coding", evidence({ verified: true }));
    expect(score).toBe(0.5);
  });
});
