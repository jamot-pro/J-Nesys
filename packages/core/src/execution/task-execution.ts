import type { Agent, Task } from "@jamot/contracts";
import type { JamotRepository } from "../repository/repository.js";
import type { HarnessRegistry } from "../harness/registry.js";
import { evaluate, type RoleKind } from "../policy/policy-engine.js";
import { recordTaskCompletion } from "../reputation/triggers.js";
import type { ReputationService } from "../reputation/reputation.js";

// Mirrors routing/pipeline.ts's INTENT_CAPABILITY_MAP["task"][0] — assignment
// already policy-checked a candidate against this same capability name. Task
// itself carries requiredCapabilityIds (references into the id-based
// Capability/connector system), which is a separate mechanism this processor
// does not attempt to reconcile with policy's string-keyed capabilities;
// that integration is its own piece of work, not part of getting execution
// running at all.
const EXECUTION_CAPABILITY = "task.execution";

export interface TaskExecutionResult {
  executed: number;
  blocked: number;
  failed: number;
}

export interface TaskExecutionProcessor {
  /** Runs every task currently assigned to an agent through its harness. */
  processDue(): Promise<TaskExecutionResult>;
}

export function createTaskExecutionProcessor(
  repo: JamotRepository,
  harness: HarnessRegistry,
  reputation: ReputationService,
): TaskExecutionProcessor {
  async function executeOne(task: Task, agent: Agent): Promise<"executed" | "blocked" | "failed"> {
    const roles = await repo.listRolesForSpace(task.spaceId);
    const roleKind =
      (roles.find((r) => r.actorId === agent.actorId)?.kind as RoleKind | undefined) ?? null;
    const policies = await repo.listPolicies({ spaceId: task.spaceId });
    const decision = evaluate(policies, {
      actorId: agent.actorId,
      roleKind,
      spaceId: task.spaceId,
      capability: EXECUTION_CAPABILITY,
      resource: "*",
      risk: 0,
    });
    if (decision !== "allow") {
      return "blocked";
    }

    await repo.updateTaskStatus(task.id, "started");
    const client = harness.resolve(agent.harness);
    try {
      const result = await client.run({
        prompt: `${task.title}\n\n${task.description}`.trim(),
        taskId: task.id,
        agentId: agent.id,
      });
      const outcome = { output: result.output, completedAt: new Date().toISOString() };
      await repo.updateTask(task.id, { outcome });
      await repo.updateTaskStatus(task.id, "completed");
      // Mirrors routes/tasks.ts's PATCH .../status handler - same trigger,
      // same "record on every completed transition" semantics, just from
      // the agent-execution path instead of a human clicking a button.
      await recordTaskCompletion(reputation, {
        id: task.id,
        assigneeActorIds: task.assigneeActorIds,
        outcome,
      });
      return "executed";
    } catch (err) {
      // No retry/backoff policy yet — reverting to "assigned" means the next
      // poll retries immediately, which is fine for transient failures but
      // will spin forever on a persistently broken harness. Worth a real
      // failure state and backoff as a follow-up, not solved here.
      const message = err instanceof Error ? err.message : String(err);
      await repo.updateTask(task.id, {
        outcome: { lastError: message, failedAt: new Date().toISOString() },
      });
      await repo.updateTaskStatus(task.id, "assigned");
      return "failed";
    }
  }

  return {
    async processDue() {
      const [tasks, agents] = await Promise.all([repo.listTasks(), repo.listAgents()]);
      const agentByActorId = new Map(agents.map((a) => [a.actorId, a] as const));

      const result: TaskExecutionResult = { executed: 0, blocked: 0, failed: 0 };
      for (const task of tasks) {
        if (task.status !== "assigned") continue;
        if (task.targetType !== "agent") continue; // human_agent stays manual for now
        const assigneeId = task.assigneeActorIds[0];
        if (!assigneeId) continue;
        const agent = agentByActorId.get(assigneeId);
        if (!agent) continue;

        const outcome = await executeOne(task, agent);
        result[outcome] += 1;
      }
      return result;
    },
  };
}
