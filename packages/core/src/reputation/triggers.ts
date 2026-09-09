import type { Task } from "@jamot/contracts";
import type { ReputationService } from "./reputation.js";

// Same capability name routing/pipeline.ts and execution/task-execution.ts
// use for the generic "did this task get done" check - reputation isn't
// wired to the separate id-based Capability/requiredCapabilityIds system
// any more than policy is (see the comment in task-execution.ts). A
// per-capability reputation breakdown is a real improvement over this, just
// not what closes the "never auto-triggers" gap.
const TASK_COMPLETION_CAPABILITY = "task.execution";

/**
 * Records reputation evidence for every actor a just-completed task was
 * assigned to. Call this once a task's status actually becomes "completed" -
 * this function doesn't check that itself, callers own that decision.
 *
 * Deliberately scoped to tasks only. Payment/order settlement is a
 * plausible second trigger (the audit flagged both), but treasury records
 * are keyed by buyer/sellerOrganizationId, not actorId - ReputationService
 * is actor-scoped (ActorType is "human" | "agent", no "organization").
 * Organizations already carry their own separate `reputation` field
 * (repository.ts NewOrganization) and Suppliers their own, neither of which
 * goes through this engine. Forcing payment settlement through
 * ReputationService would mean inventing an org-to-actor mapping with no
 * clear right answer - left as a real follow-up, not guessed at here.
 */
export async function recordTaskCompletion(
  reputation: ReputationService,
  task: Pick<Task, "id" | "assigneeActorIds" | "outcome">,
): Promise<void> {
  const outcome = task.outcome ?? {};
  const failed = "lastError" in outcome;
  const now = new Date().toISOString();

  for (const actorId of task.assigneeActorIds) {
    await reputation.record(actorId, TASK_COMPLETION_CAPABILITY, {
      taskId: task.id,
      outcome,
      verified: !failed,
      provenance: { source: "system", confidence: 0.6, createdAt: now, updatedAt: now },
    });
  }
}
