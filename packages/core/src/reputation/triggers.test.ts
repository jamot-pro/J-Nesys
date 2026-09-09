import { describe, expect, it } from "vitest";
import { createInMemoryReputationService } from "./memory.js";
import { recordTaskCompletion } from "./triggers.js";

describe("recordTaskCompletion", () => {
  it("records verified evidence for every assignee on a successful task", async () => {
    const reputation = createInMemoryReputationService();
    await recordTaskCompletion(reputation, {
      id: "task-1",
      assigneeActorIds: ["actor-a", "actor-b"],
      outcome: { output: "done" },
    });

    const scoresA = await reputation.scores("actor-a");
    const scoresB = await reputation.scores("actor-b");
    // computeScore(undefined, verified=true) -> base 0.5 * weight 1 = 0.5
    expect(scoresA["task.execution"]).toBe(0.5);
    expect(scoresB["task.execution"]).toBe(0.5);
  });

  it("records unverified (lower-weight) evidence when the outcome carries a lastError", async () => {
    const reputation = createInMemoryReputationService();
    await recordTaskCompletion(reputation, {
      id: "task-2",
      assigneeActorIds: ["actor-a"],
      outcome: { lastError: "harness endpoint returned 503" },
    });

    const scores = await reputation.scores("actor-a");
    // computeScore(undefined, verified=false) -> base 0.5 * weight 0.5 = 0.25
    expect(scores["task.execution"]).toBe(0.25);
  });

  it("does nothing for a task with no assignees", async () => {
    const reputation = createInMemoryReputationService();
    await recordTaskCompletion(reputation, { id: "task-3", assigneeActorIds: [], outcome: null });

    // No throw, and nothing recorded under any actor - nothing to assert
    // against except that the call resolves cleanly.
    await expect(reputation.scores("nobody")).resolves.toEqual({});
  });
});
