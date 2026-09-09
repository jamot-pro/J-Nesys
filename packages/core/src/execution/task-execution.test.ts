import { describe, expect, it } from "vitest";
import { createMemoryRepository } from "../repository/memory.js";
import type { HarnessClient, HarnessRequest, HarnessResponse } from "../harness/harness.js";
import type { HarnessRegistry } from "../harness/registry.js";
import { createInMemoryReputationService } from "../reputation/memory.js";
import { createTaskExecutionProcessor } from "./task-execution.js";

function fakeHarnessRegistry(run: (req: HarnessRequest) => Promise<HarnessResponse>): HarnessRegistry {
  const client: HarnessClient = { kind: "fake", run };
  return {
    register() {
      // unused in tests
    },
    resolve() {
      return client;
    },
  };
}

async function setup() {
  const repo = createMemoryRepository();
  const owner = await repo.createActor({ type: "human", displayName: "Owner" });
  const space = await repo.createSpace({ kind: "organization", ownerActorId: owner.id, name: "Acme" });
  const agentActor = await repo.createActor({ type: "agent", displayName: "Sales Agent" });
  const agent = await repo.createAgent({
    actorId: agentActor.id,
    ownerId: owner.id,
    harness: { kind: "generic_http", endpoint: "https://harness.example/run", config: {} },
  });
  await repo.createRole({ actorId: agentActor.id, spaceId: space.id, kind: "member" });
  const task = await repo.createTask({
    spaceId: space.id,
    title: "Follow up with lead",
    description: "Send a friendly check-in.",
    targetType: "agent",
    assigneeActorIds: [agentActor.id],
  });
  await repo.assignTask(task.id, [agentActor.id]);
  await repo.updateTaskStatus(task.id, "assigned");
  return { repo, space, agent, agentActor, task };
}

describe("createTaskExecutionProcessor", () => {
  it("blocks execution when a policy explicitly denies the capability", async () => {
    // createSpace() now seeds a permissive default "allow *" policy
    // (fix/policy-engine-reachability), so an empty policy list is no
    // longer reachable through the normal path - the blocked case is an
    // admin narrowing access with an explicit deny, which evaluate()'s
    // deny-short-circuit still honors over the seeded allow.
    const { repo, space, task } = await setup();
    await repo.createPolicy({
      spaceId: space.id,
      name: "Deny execution",
      capability: "task.execution",
      decision: "deny",
    });
    const harness = fakeHarnessRegistry(async () => {
      throw new Error("should not be called");
    });
    const reputation = createInMemoryReputationService();
    const processor = createTaskExecutionProcessor(repo, harness, reputation);

    const result = await processor.processDue();

    expect(result).toEqual({ executed: 0, blocked: 1, failed: 0 });
    const reloaded = await repo.getTask(task.id);
    expect(reloaded?.status).toBe("assigned");
    expect(reloaded?.outcome).toBeNull();
  });

  it("executes the task, records the outcome, and records reputation when policy allows it", async () => {
    const { repo, space, agentActor, task } = await setup();
    await repo.createPolicy({
      spaceId: space.id,
      name: "Allow execution",
      capability: "task.execution",
      decision: "allow",
    });
    const harness = fakeHarnessRegistry(async (req) => ({
      output: `handled: ${req.prompt.split("\n")[0]}`,
    }));
    const reputation = createInMemoryReputationService();
    const processor = createTaskExecutionProcessor(repo, harness, reputation);

    const result = await processor.processDue();

    expect(result).toEqual({ executed: 1, blocked: 0, failed: 0 });
    const reloaded = await repo.getTask(task.id);
    expect(reloaded?.status).toBe("completed");
    expect(reloaded?.outcome?.output).toBe("handled: Follow up with lead");
    const scores = await reputation.scores(agentActor.id);
    expect(scores["task.execution"]).toBe(0.5);
  });

  it("reverts to assigned, records the error, and does NOT record reputation when the harness fails", async () => {
    const { repo, space, agentActor, task } = await setup();
    await repo.createPolicy({
      spaceId: space.id,
      name: "Allow execution",
      capability: "task.execution",
      decision: "allow",
    });
    const harness = fakeHarnessRegistry(async () => {
      throw new Error("harness endpoint returned 503");
    });
    const reputation = createInMemoryReputationService();
    const processor = createTaskExecutionProcessor(repo, harness, reputation);

    const result = await processor.processDue();

    expect(result).toEqual({ executed: 0, blocked: 0, failed: 1 });
    const reloaded = await repo.getTask(task.id);
    expect(reloaded?.status).toBe("assigned");
    expect(reloaded?.outcome?.lastError).toBe("harness endpoint returned 503");
    // A retry-eligible transient failure isn't a terminal outcome (matches
    // routes/tasks.ts's trigger, which only fires on an actual "completed"
    // transition) - dinging reputation here would penalize a blip that
    // might succeed on the very next poll.
    const scores = await reputation.scores(agentActor.id);
    expect(scores).toEqual({});
  });

  it("leaves human-targeted and unassigned tasks alone", async () => {
    // Standalone repo, not the shared setup() - that helper's own
    // agent-targeted assigned task would otherwise be picked up too and
    // muddy what this test is actually checking.
    const repo = createMemoryRepository();
    const owner = await repo.createActor({ type: "human", displayName: "Owner" });
    const space = await repo.createSpace({ kind: "organization", ownerActorId: owner.id, name: "Acme" });
    await repo.createPolicy({
      spaceId: space.id,
      name: "Allow execution",
      capability: "task.execution",
      decision: "allow",
    });
    const humanTask = await repo.createTask({
      spaceId: space.id,
      title: "Call the client",
      targetType: "human",
    });
    await repo.updateTaskStatus(humanTask.id, "assigned");
    await repo.createTask({ spaceId: space.id, title: "Not yet assigned", targetType: "agent" });
    const harness = fakeHarnessRegistry(async () => {
      throw new Error("should not be called");
    });
    const reputation = createInMemoryReputationService();
    const processor = createTaskExecutionProcessor(repo, harness, reputation);

    const result = await processor.processDue();

    expect(result).toEqual({ executed: 0, blocked: 0, failed: 0 });
  });
});
