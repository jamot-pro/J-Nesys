import { describe, expect, it } from "vitest";
import { createMemoryRepository } from "../repository/memory.js";
import { notifyApprovalRequired, notifyTaskAssigned, notifyTaskCompleted } from "./triggers.js";

async function setup() {
  const repo = createMemoryRepository();
  const owner = await repo.createActor({ type: "human", displayName: "Owner" });
  const space = await repo.createSpace({ kind: "organization", ownerActorId: owner.id, name: "Acme" });
  const member = await repo.createActor({ type: "human", displayName: "Member" });
  await repo.createRole({ actorId: member.id, spaceId: space.id, kind: "member" });
  const agentActor = await repo.createActor({ type: "agent", displayName: "Bot" });
  await repo.createRole({ actorId: agentActor.id, spaceId: space.id, kind: "agent" });
  const task = await repo.createTask({
    spaceId: space.id,
    title: "Follow up with lead",
    targetType: "human",
  });
  return { repo, owner, space, member, agentActor, task };
}

describe("notifyTaskAssigned", () => {
  it("notifies a human assignee", async () => {
    const { repo, member, task } = await setup();
    await notifyTaskAssigned(repo, task, member.id);

    const items = await repo.listNotifications({ actorId: member.id });
    expect(items).toHaveLength(1);
    expect(items[0]?.type).toBe("message");
    expect(items[0]?.targetId).toBe(task.id);
    expect(items[0]?.read).toBe(false);
  });

  it("does not notify an agent assignee (no UI for it)", async () => {
    const { repo, agentActor, task } = await setup();
    await notifyTaskAssigned(repo, task, agentActor.id);

    const items = await repo.listNotifications({ actorId: agentActor.id });
    expect(items).toHaveLength(0);
  });
});

describe("notifyApprovalRequired", () => {
  it("notifies the space owner and any admins, deduped, but not plain members", async () => {
    const { repo, owner, member, space, task } = await setup();
    await notifyApprovalRequired(repo, task);

    const ownerItems = await repo.listNotifications({ actorId: owner.id });
    expect(ownerItems).toHaveLength(1);
    expect(ownerItems[0]?.type).toBe("approval");

    const memberItems = await repo.listNotifications({ actorId: member.id });
    expect(memberItems).toHaveLength(0);
    void space;
  });
});

describe("notifyTaskCompleted", () => {
  it("notifies the space owner with a completed-type item", async () => {
    const { repo, owner, task } = await setup();
    await notifyTaskCompleted(repo, task);

    const items = await repo.listNotifications({ actorId: owner.id });
    expect(items).toHaveLength(1);
    expect(items[0]?.type).toBe("completed");
  });
});
