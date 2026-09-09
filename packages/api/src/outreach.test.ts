import { describe, expect, it } from "vitest";
import type { LightMyRequestResponse } from "fastify";
import { buildApp } from "./app.js";
import { createMemoryRepository } from "./repository.js";
import { createOutreachProcessor } from "@jamot/core/scheduler";

function sessionCookie(res: LightMyRequestResponse): string {
  const raw = res.headers["set-cookie"];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value ? (value.split(";")[0] ?? "") : "";
}

async function makeApp() {
  const repository = createMemoryRepository();
  const app = await buildApp({ repository, secret: "test" });
  return { app, repository };
}

async function registerAndLogin(
  app: Awaited<ReturnType<typeof buildApp>>,
  email: string,
  password: string,
  displayName: string,
): Promise<string> {
  await app.inject({
    method: "POST",
    url: "/api/people",
    payload: { email, password, displayName },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password },
  });
  return sessionCookie(login);
}

describe("outreach", () => {
  it("manages lists, members, campaigns, steps and delegation", async () => {
    const { app, repository } = await makeApp();
    const cookie = await registerAndLogin(app, "outreach@example.com", "password123", "Outreacher");

    const me = await app.inject({ method: "GET", url: "/api/auth/me", headers: { cookie } });
    expect(me.statusCode).toBe(200);
    const personId = me.json().person.id as string;
    const spaceId = me.json().person.membershipSpaceIds[0] as string;

    // --- list CRUD ---
    const list = await app.inject({
      method: "POST",
      url: "/api/outreach/lists",
      headers: { cookie },
      payload: { spaceId, name: "Pipeline", memberPersonIds: [personId] },
    });
    expect(list.statusCode).toBe(201);
    const listId = list.json().id as string;
    expect(list.json().memberPersonIds).toEqual([personId]);

    const lists = await app.inject({
      method: "GET",
      url: `/api/outreach/lists?spaceId=${spaceId}`,
      headers: { cookie },
    });
    expect(lists.statusCode).toBe(200);
    expect(lists.json().items).toHaveLength(1);

    // --- members ---
    const members = await app.inject({
      method: "GET",
      url: `/api/outreach/lists/${listId}/members`,
      headers: { cookie },
    });
    expect(members.statusCode).toBe(200);
    expect(members.json().items).toHaveLength(1);
    expect(members.json().items[0].displayName).toBe("Outreacher");

    const addMember = await app.inject({
      method: "POST",
      url: `/api/outreach/lists/${listId}/members`,
      headers: { cookie },
      payload: { personIds: [personId] },
    });
    expect(addMember.statusCode).toBe(200);
    expect(addMember.json().items).toEqual([personId]);

    const removeMember = await app.inject({
      method: "DELETE",
      url: `/api/outreach/lists/${listId}/members`,
      headers: { cookie },
      payload: { personIds: [personId] },
    });
    expect(removeMember.statusCode).toBe(200);
    expect(removeMember.json().items).toEqual([]);

    const reAdd = await app.inject({
      method: "POST",
      url: `/api/outreach/lists/${listId}/members`,
      headers: { cookie },
      payload: { personIds: [personId] },
    });
    expect(reAdd.statusCode).toBe(200);

    // --- agent ---
    const agent = await app.inject({
      method: "POST",
      url: "/api/agents",
      headers: { cookie },
      payload: {
        name: "SDR Bot",
        harness: { kind: "generic_http", endpoint: null, config: {} },
      },
    });
    expect(agent.statusCode).toBe(201);
    const agentId = agent.json().id as string;
    const agentActorId = agent.json().actorId as string;

    // --- campaign with steps ---
    const campaign = await app.inject({
      method: "POST",
      url: "/api/outreach/campaigns",
      headers: { cookie },
      payload: {
        spaceId,
        name: "Demo push",
        listId,
        agentId,
        goal: "Book a demo call",
        steps: [
          { position: 0, sendAfterDays: 0, channel: "whatsapp", template: "Hi!" },
          { position: 1, sendAfterDays: 3, channel: "email", template: "Following up" },
        ],
      },
    });
    expect(campaign.statusCode).toBe(201);
    const campaignId = campaign.json().id as string;
    expect(campaign.json().status).toBe("draft");

    const detail = await app.inject({
      method: "GET",
      url: `/api/outreach/campaigns/${campaignId}`,
      headers: { cookie },
    });
    expect(detail.statusCode).toBe(200);
    expect(detail.json().steps).toHaveLength(2);
    expect(detail.json().steps[0].channel).toBe("whatsapp");
    expect(detail.json().list.memberCount).toBe(1);
    expect(detail.json().agent.displayName).toBe("SDR Bot");

    // --- activate ---
    const activate = await app.inject({
      method: "POST",
      url: `/api/outreach/campaigns/${campaignId}/activate`,
      headers: { cookie },
    });
    expect(activate.statusCode).toBe(200);
    expect(activate.json().status).toBe("active");
    expect(activate.json().startedAt).toBeTruthy();

    // --- scheduler delegates due sends as tasks for the assigned agent ---
    const processor = createOutreachProcessor(repository);
    const result = await processor.processDue(new Date());
    expect(result.created).toBe(1); // step 0 (day 0) for 1 member; step 1 not due
    expect(result.skipped).toBe(0);

    // idempotent on re-run
    const again = await processor.processDue(new Date());
    expect(again.created).toBe(0);
    expect(again.skipped).toBe(1);

    const tasks = await repository.listTasks({ assigneeActorId: agentActorId });
    expect(tasks).toHaveLength(1);
    expect(tasks[0]!.title).toContain("Demo push");
    expect(tasks[0]!.description).toContain("Book a demo call");
    expect(tasks[0]!.description).toContain("Hi!");

    const detailAfter = await app.inject({
      method: "GET",
      url: `/api/outreach/campaigns/${campaignId}`,
      headers: { cookie },
    });
    expect(detailAfter.json().sends).toHaveLength(1);
    expect(detailAfter.json().sends[0].status).toBe("delegated");
    expect(detailAfter.json().sends[0].taskId).toBe(tasks[0]!.id);

    // --- list deletion blocked while referenced by a campaign ---
    const blockedDelete = await app.inject({
      method: "DELETE",
      url: `/api/outreach/lists/${listId}`,
      headers: { cookie },
    });
    expect(blockedDelete.statusCode).toBe(409);

    // --- steps management ---
    const addStep = await app.inject({
      method: "POST",
      url: `/api/outreach/campaigns/${campaignId}/steps`,
      headers: { cookie },
      payload: { sendAfterDays: 7, channel: "matrix", template: "Last nudge" },
    });
    expect(addStep.statusCode).toBe(201);
    expect(addStep.json().position).toBe(2);

    const patchStep = await app.inject({
      method: "PATCH",
      url: `/api/outreach/campaigns/${campaignId}/steps/${addStep.json().id}`,
      headers: { cookie },
      payload: { sendAfterDays: 10 },
    });
    expect(patchStep.statusCode).toBe(200);
    expect(patchStep.json().sendAfterDays).toBe(10);

    const deleteStep = await app.inject({
      method: "DELETE",
      url: `/api/outreach/campaigns/${campaignId}/steps/${addStep.json().id}`,
      headers: { cookie },
    });
    expect(deleteStep.statusCode).toBe(204);

    // --- pause, complete, delete campaign, then list deletion succeeds ---
    const pause = await app.inject({
      method: "POST",
      url: `/api/outreach/campaigns/${campaignId}/pause`,
      headers: { cookie },
    });
    expect(pause.statusCode).toBe(200);
    expect(pause.json().status).toBe("paused");

    const complete = await app.inject({
      method: "POST",
      url: `/api/outreach/campaigns/${campaignId}/complete`,
      headers: { cookie },
    });
    expect(complete.statusCode).toBe(200);
    expect(complete.json().status).toBe("completed");

    const deleteCampaign = await app.inject({
      method: "DELETE",
      url: `/api/outreach/campaigns/${campaignId}`,
      headers: { cookie },
    });
    expect(deleteCampaign.statusCode).toBe(204);

    const deleteList = await app.inject({
      method: "DELETE",
      url: `/api/outreach/lists/${listId}`,
      headers: { cookie },
    });
    expect(deleteList.statusCode).toBe(204);
  });

  it("rejects unauthenticated and cross-space access", async () => {
    const { app } = await makeApp();

    const anon = await app.inject({ method: "GET", url: "/api/outreach/lists?spaceId=00000000-0000-4000-8000-000000000000" });
    expect(anon.statusCode).toBe(401);

    const cookie = await registerAndLogin(app, "owner2@example.com", "password123", "Owner2");
    const outsider = await registerAndLogin(app, "outsider@example.com", "password123", "Outsider");

    const me = await app.inject({ method: "GET", url: "/api/auth/me", headers: { cookie } });
    const spaceId = me.json().person.membershipSpaceIds[0] as string;

    const list = await app.inject({
      method: "POST",
      url: "/api/outreach/lists",
      headers: { cookie },
      payload: { spaceId, name: "Private" },
    });
    expect(list.statusCode).toBe(201);

    // outsider cannot see the owner's personal-space lists
    const foreign = await app.inject({
      method: "GET",
      url: `/api/outreach/lists?spaceId=${spaceId}`,
      headers: { cookie: outsider },
    });
    expect(foreign.statusCode).toBe(403);

    // outsider cannot create a list in someone else's space
    const foreignCreate = await app.inject({
      method: "POST",
      url: "/api/outreach/lists",
      headers: { cookie: outsider },
      payload: { spaceId, name: "Sneaky" },
    });
    expect(foreignCreate.statusCode).toBe(403);
  });
});