import type { Task } from "@jamot/contracts";
import type { JamotRepository } from "../repository/repository.js";

type TaskRef = Pick<Task, "id" | "spaceId" | "title">;

/** Notifies a human assignee that a task landed on them. Agent assignees
 * don't get a bell notification — there's no UI for them to see it in. */
export async function notifyTaskAssigned(
  repo: JamotRepository,
  task: TaskRef,
  assigneeActorId: string,
): Promise<void> {
  const actor = await repo.getActor(assigneeActorId);
  if (!actor || actor.type !== "human") return;
  await repo.createNotification({
    spaceId: task.spaceId,
    actorId: assigneeActorId,
    type: "message",
    title: `You were assigned: ${task.title}`,
    summary: "Open the task to get started.",
    targetSection: "tasks",
    targetId: task.id,
  });
}

async function spaceAdminActorIds(repo: JamotRepository, spaceId: string): Promise<string[]> {
  const [space, roles] = await Promise.all([repo.getSpace(spaceId), repo.listRolesForSpace(spaceId)]);
  const ids = new Set<string>();
  if (space?.ownerActorId) ids.add(space.ownerActorId);
  for (const role of roles) {
    if (role.kind === "owner" || role.kind === "admin") ids.add(role.actorId);
  }
  return [...ids];
}

/** Fires when the routing pipeline can't auto-assign a task under current
 * policy (require_human / require_admin) — the space's owner and admins are
 * the ones who can actually route it, so they're the recipients. */
export async function notifyApprovalRequired(repo: JamotRepository, task: TaskRef): Promise<void> {
  const adminIds = await spaceAdminActorIds(repo, task.spaceId);
  await Promise.all(
    adminIds.map((actorId) =>
      repo.createNotification({
        spaceId: task.spaceId,
        actorId,
        type: "approval",
        title: `Approval needed: ${task.title}`,
        summary: "No candidate could be auto-assigned under current policy.",
        targetSection: "tasks",
        targetId: task.id,
      }),
    ),
  );
}

export async function notifyTaskCompleted(repo: JamotRepository, task: TaskRef): Promise<void> {
  const adminIds = await spaceAdminActorIds(repo, task.spaceId);
  await Promise.all(
    adminIds.map((actorId) =>
      repo.createNotification({
        spaceId: task.spaceId,
        actorId,
        type: "completed",
        title: `Completed: ${task.title}`,
        summary: "",
        targetSection: "tasks",
        targetId: task.id,
      }),
    ),
  );
}
