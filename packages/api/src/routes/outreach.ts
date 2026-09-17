import { z } from "zod";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  AddListMembers,
  CreateOutreachCampaign,
  CreateOutreachList,
  CreateOutreachStep,
  Id,
  RemoveListMembers,
  UpdateOutreachCampaign,
  UpdateOutreachList,
  UpdateOutreachStep,
  type OutreachCampaignStatus,
} from "@jamot/contracts";
import type { JamotRepository } from "../repository.js";
import { actorRoleInSpace, createRbac, requireAuth } from "../rbac.js";
import { fail, parse } from "../util.js";

/** Verifies the acting actor is a member of `spaceId` (org or personal). */
function requireSpaceMember(repo: JamotRepository) {
  return async (
    request: FastifyRequest,
    reply: FastifyReply,
    spaceId: string,
  ): Promise<boolean> => {
    const actorId = request.session.actorId;
    if (!actorId) {
      fail(reply, 401, "Unauthenticated");
      return false;
    }
    const role = await actorRoleInSpace(repo, actorId, spaceId as Id);
    if (!role) {
      fail(reply, 403, "No access to this space");
      return false;
    }
    return true;
  };
}

export default async function outreachRoutes(
  app: FastifyInstance,
  opts: { repository: JamotRepository },
): Promise<void> {
  const { repository: repo } = opts;
  const { requireSpaceAccess } = createRbac(repo);
  const canAccessSpace = requireSpaceMember(repo);

  // --- Lists ---------------------------------------------------------------

  /* ---- Lists -------------------------------------------------------------
   *
   * There is one list concept now: People lists. These routes keep their old
   * paths and shapes so the cockpit's People screen goes on working, but every
   * one of them reads and writes people_lists. Curate a list anywhere and it is
   * the same list everywhere.
   */

  /** A people list in the shape the outreach clients already expect. */
  async function asOutreachList(list: {
    id: string;
    spaceId: string;
    name: string;
    replyAgentId?: string | null;
    createdAt: string;
    updatedAt: string;
  }) {
    const members = await repo.listPeopleListMembers(list.id);
    return {
      id: list.id,
      spaceId: list.spaceId,
      name: list.name,
      description: "",
      memberPersonIds: members.map((m) => m.personId),
      sourcePeopleListId: list.id,
      /** Agent that answers inbound messages from anyone on this list. */
      replyAgentId: list.replyAgentId ?? null,
      createdAt: list.createdAt,
      updatedAt: list.updatedAt,
    };
  }

  app.post(
    "/outreach/lists",
    { preHandler: requireSpaceAccess("spaceId") },
    async (request, reply) => {
      const body = parse(CreateOutreachList, request.body, reply);
      if (!body) return;
      const spaceId = request.resolvedSpaceId ?? body.spaceId;

      const list = await repo.createPeopleList({
        spaceId,
        organizationId: null,
        createdBy: request.session.actorId ?? null,
        name: body.name,
      });
      for (const personId of body.memberPersonIds ?? []) {
        await repo.addPeopleListMember(list.id, personId);
      }

      await repo.recordEvent({
        type: "outreach.list.created",
        spaceId,
        actorId: request.session.actorId ?? null,
        payload: { listId: list.id, name: list.name },
      });

      reply.code(201);
      return await asOutreachList(list);
    },
  );

  app.get("/outreach/lists", { preHandler: requireAuth }, async (request, reply) => {
    const query = request.query as { spaceId?: string };
    const spaceId = parse(Id, request.resolvedSpaceId ?? query.spaceId, reply);
    if (!spaceId) return;
    if (!(await canAccessSpace(request, reply, spaceId))) return;
    const lists = await repo.listPeopleLists({ spaceId });
    return { items: await Promise.all(lists.map(asOutreachList)) };
  });

  app.get("/outreach/lists/:id", { preHandler: requireAuth }, async (request, reply) => {
    const id = parse(Id, (request.params as { id?: string }).id, reply);
    if (!id) return;
    const list = await repo.getPeopleList(id);
    if (!list) return fail(reply, 404, "list not found");
    if (!(await canAccessSpace(request, reply, list.spaceId))) return;
    return await asOutreachList(list);
  });

  app.patch("/outreach/lists/:id", { preHandler: requireAuth }, async (request, reply) => {
    const id = parse(Id, (request.params as { id?: string }).id, reply);
    if (!id) return;
    const body = parse(UpdateOutreachList, request.body, reply);
    if (!body) return;
    const list = await repo.getPeopleList(id);
    if (!list) return fail(reply, 404, "list not found");
    if (!(await canAccessSpace(request, reply, list.spaceId))) return;
    /* Only the name is shared between the two shapes; a people list carries no
       description, so one sent here is accepted and ignored rather than 400. */
    const updated = body.name ? await repo.renamePeopleList(id, body.name) : list;
    if (!updated) return fail(reply, 404, "list not found");
    return await asOutreachList(updated);
  });

  /**
   * A list a campaign is working cannot be deleted out from under it.
   *
   * This used to live only on the outreach delete route. Now that People and
   * Outreach share one list, the People route can orphan a campaign just as
   * easily, so the check belongs to the list rather than to one screen.
   */
  const campaignsUsingList = async (spaceId: string, listId: string) => {
    const campaigns = await repo.listOutreachCampaigns({ spaceId });
    return campaigns.filter((campaign) => campaign.peopleListId === listId);
  };

  app.delete("/outreach/lists/:id", { preHandler: requireAuth }, async (request, reply) => {
    const id = parse(Id, (request.params as { id?: string }).id, reply);
    if (!id) return;
    const list = await repo.getPeopleList(id);
    if (!list) return fail(reply, 404, "list not found");
    if (!(await canAccessSpace(request, reply, list.spaceId))) return;

    const inUse = await campaignsUsingList(list.spaceId, id);
    if (inUse.length > 0) {
      return fail(reply, 409, `${inUse.length} campaign(s) still work this list`);
    }

    await repo.deletePeopleList(id);
    await repo.recordEvent({
      type: "outreach.list.deleted",
      spaceId: list.spaceId,
      actorId: request.session.actorId ?? null,
      payload: { listId: id, name: list.name },
    });
    reply.code(204).send();
  });

  // --- List members --------------------------------------------------------

  app.get("/outreach/lists/:id/members", { preHandler: requireAuth }, async (request, reply) => {
    const id = parse(Id, (request.params as { id?: string }).id, reply);
    if (!id) return;
    const list = await repo.getPeopleList(id);
    if (!list) return fail(reply, 404, "list not found");
    if (!(await canAccessSpace(request, reply, list.spaceId))) return;

    const members = [];
    for (const member of await repo.listPeopleListMembers(id)) {
      const person = await repo.getPerson(member.personId);
      if (!person) continue;
      const actor = await repo.getActor(person.actorId);
      members.push({
        personId: person.id,
        actorId: person.actorId,
        email: person.email,
        displayName: actor?.displayName ?? "Unknown",
        addedAt: member.createdAt,
      });
    }
    return { items: members };
  });

  app.post("/outreach/lists/:id/members", { preHandler: requireAuth }, async (request, reply) => {
    const id = parse(Id, (request.params as { id?: string }).id, reply);
    if (!id) return;
    const body = parse(z.object({ personIds: z.array(Id).min(1) }), request.body, reply);
    if (!body) return;
    const list = await repo.getPeopleList(id);
    if (!list) return fail(reply, 404, "list not found");
    if (!(await canAccessSpace(request, reply, list.spaceId))) return;

    for (const personId of body.personIds) await repo.addPeopleListMember(id, personId);
    return { items: (await repo.listPeopleListMembers(id)).map((m) => m.personId) };
  });

  app.delete("/outreach/lists/:id/members", { preHandler: requireAuth }, async (request, reply) => {
    const id = parse(Id, (request.params as { id?: string }).id, reply);
    if (!id) return;
    const body = parse(z.object({ personIds: z.array(Id).min(1) }), request.body, reply);
    if (!body) return;
    const list = await repo.getPeopleList(id);
    if (!list) return fail(reply, 404, "list not found");
    if (!(await canAccessSpace(request, reply, list.spaceId))) return;

    for (const personId of body.personIds) await repo.removePeopleListMember(id, personId);
    return { items: (await repo.listPeopleListMembers(id)).map((m) => m.personId) };
  });

  // --- Campaigns -----------------------------------------------------------

  app.post(
    "/outreach/campaigns",
    { preHandler: requireSpaceAccess("spaceId") },
    async (request, reply) => {
      const body = parse(CreateOutreachCampaign, request.body, reply);
      if (!body) return;

      const list = await repo.getPeopleList(body.peopleListId);
      if (!list || list.spaceId !== (request.resolvedSpaceId ?? body.spaceId)) {
        return fail(reply, 400, "source list does not exist in this space");
      }
      const agent = await repo.getAgent(body.agentId);
      if (!agent) {
        return fail(reply, 400, "assigned agent does not exist");
      }

      const campaign = await repo.createOutreachCampaign({
        spaceId: request.resolvedSpaceId ?? body.spaceId,
        name: body.name,
        description: body.description,
        peopleListId: body.peopleListId,
        agentId: body.agentId,
        goal: body.goal,
      });

      for (const [index, step] of (body.steps ?? []).entries()) {
        await repo.createOutreachStep({
          campaignId: campaign.id,
          position: step.position ?? index,
          sendAfterDays: step.sendAfterDays ?? 0,
          channel: step.channel ?? "whatsapp",
          subject: step.subject,
          template: step.template,
          instructions: step.instructions,
        });
      }

      await repo.recordEvent({
        type: "outreach.campaign.created",
        spaceId: request.resolvedSpaceId ?? body.spaceId,
        actorId: request.session.actorId ?? null,
        payload: { campaignId: campaign.id, name: campaign.name },
      });

      reply.code(201);
      return campaign;
    },
  );

  app.get(
    "/outreach/campaigns",
    { preHandler: requireAuth },
    async (request, reply) => {
      const query = request.query as { spaceId?: string };
      const spaceId = parse(Id, request.resolvedSpaceId ?? query.spaceId, reply);
      if (!spaceId) return;
      if (!(await canAccessSpace(request, reply, spaceId))) return;
      return { items: await repo.listOutreachCampaigns({ spaceId }) };
    },
  );

  app.get(
    "/outreach/campaigns/:id",
    { preHandler: requireAuth },
    async (request, reply) => {
      const params = request.params as { id?: string };
      const id = parse(Id, params.id, reply);
      if (!id) return;
      const campaign = await repo.getOutreachCampaign(id);
      if (!campaign) return fail(reply, 404, "campaign not found");
      if (!(await canAccessSpace(request, reply, campaign.spaceId))) return;

      const [steps, sends, list, agent] = await Promise.all([
        repo.listOutreachSteps(id),
        repo.listOutreachSends({ campaignId: id }),
        repo.getPeopleList(campaign.peopleListId),
        repo.getAgent(campaign.agentId),
      ]);
      const agentActor = agent
        ? await repo.getActor(agent.actorId)
        : null;

      const memberCount = list ? (await repo.listPeopleListMembers(list.id)).length : 0;

      return {
        campaign,
        steps,
        sends,
        list: list ? { id: list.id, name: list.name, memberCount } : null,
        agent: agent
          ? {
              id: agent.id,
              actorId: agent.actorId,
              displayName: agentActor?.displayName ?? agent.role ?? "Agent",
              role: agent.role,
            }
          : null,
      };
    },
  );

  app.patch(
    "/outreach/campaigns/:id",
    { preHandler: requireAuth },
    async (request, reply) => {
      const params = request.params as { id?: string };
      const id = parse(Id, params.id, reply);
      if (!id) return;
      const body = parse(UpdateOutreachCampaign, request.body, reply);
      if (!body) return;
      const campaign = await repo.getOutreachCampaign(id);
      if (!campaign) return fail(reply, 404, "campaign not found");
      if (!(await canAccessSpace(request, reply, campaign.spaceId))) return;
      const updated = await repo.updateOutreachCampaign(id, body);
      if (!updated) return fail(reply, 404, "campaign not found");
      return updated;
    },
  );

  app.delete(
    "/outreach/campaigns/:id",
    { preHandler: requireAuth },
    async (request, reply) => {
      const params = request.params as { id?: string };
      const id = parse(Id, params.id, reply);
      if (!id) return;
      const campaign = await repo.getOutreachCampaign(id);
      if (!campaign) return fail(reply, 404, "campaign not found");
      if (!(await canAccessSpace(request, reply, campaign.spaceId))) return;
      await repo.deleteOutreachCampaign(id);
      await repo.recordEvent({
        type: "outreach.campaign.deleted",
        spaceId: campaign.spaceId,
        actorId: request.session.actorId ?? null,
        payload: { campaignId: id, name: campaign.name },
      });
      reply.code(204).send();
    },
  );

  const setStatus = (status: OutreachCampaignStatus, startedAt?: string | null) =>
    async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as { id?: string };
      const id = parse(Id, params.id, reply);
      if (!id) return;
      const campaign = await repo.getOutreachCampaign(id);
      if (!campaign) return fail(reply, 404, "campaign not found");
      if (!(await canAccessSpace(request, reply, campaign.spaceId))) return;
      const patch: Record<string, unknown> = { status };
      if (startedAt !== undefined) patch.startedAt = startedAt;
      const updated = await repo.updateOutreachCampaign(id, patch);
      if (!updated) return fail(reply, 404, "campaign not found");

      await repo.recordEvent({
        type: `outreach.campaign.${status}`,
        spaceId: campaign.spaceId,
        actorId: request.session.actorId ?? null,
        payload: { campaignId: id },
      });
      return updated;
    };

  app.post(
    "/outreach/campaigns/:id/activate",
    { preHandler: requireAuth },
    setStatus("active", new Date().toISOString()),
  );
  app.post(
    "/outreach/campaigns/:id/pause",
    { preHandler: requireAuth },
    setStatus("paused"),
  );
  app.post(
    "/outreach/campaigns/:id/complete",
    { preHandler: requireAuth },
    setStatus("completed"),
  );
  app.post(
    "/outreach/campaigns/:id/archive",
    { preHandler: requireAuth },
    setStatus("archived"),
  );

  // --- Steps ---------------------------------------------------------------

  app.post(
    "/outreach/campaigns/:id/steps",
    { preHandler: requireAuth },
    async (request, reply) => {
      const params = request.params as { id?: string };
      const id = parse(Id, params.id, reply);
      if (!id) return;
      const body = parse(CreateOutreachStep, request.body, reply);
      if (!body) return;
      const campaign = await repo.getOutreachCampaign(id);
      if (!campaign) return fail(reply, 404, "campaign not found");
      if (!(await canAccessSpace(request, reply, campaign.spaceId))) return;

      const existing = await repo.listOutreachSteps(id);
      const step = await repo.createOutreachStep({
        campaignId: id,
        position: body.position ?? existing.length,
        sendAfterDays: body.sendAfterDays ?? 0,
        channel: body.channel ?? "whatsapp",
        subject: body.subject,
        template: body.template,
        instructions: body.instructions,
      });
      reply.code(201);
      return step;
    },
  );

  app.patch(
    "/outreach/campaigns/:id/steps/:stepId",
    { preHandler: requireAuth },
    async (request, reply) => {
      const params = request.params as { id?: string; stepId?: string };
      const id = parse(Id, params.id, reply);
      if (!id) return;
      const stepId = parse(Id, params.stepId, reply);
      if (!stepId) return;
      const body = parse(UpdateOutreachStep, request.body, reply);
      if (!body) return;
      const campaign = await repo.getOutreachCampaign(id);
      if (!campaign) return fail(reply, 404, "campaign not found");
      if (!(await canAccessSpace(request, reply, campaign.spaceId))) return;
      const step = await repo.updateOutreachStep(stepId, body);
      if (!step) return fail(reply, 404, "step not found");
      return step;
    },
  );

  app.delete(
    "/outreach/campaigns/:id/steps/:stepId",
    { preHandler: requireAuth },
    async (request, reply) => {
      const params = request.params as { id?: string; stepId?: string };
      const id = parse(Id, params.id, reply);
      if (!id) return;
      const stepId = parse(Id, params.stepId, reply);
      if (!stepId) return;
      const campaign = await repo.getOutreachCampaign(id);
      if (!campaign) return fail(reply, 404, "campaign not found");
      if (!(await canAccessSpace(request, reply, campaign.spaceId))) return;
      await repo.deleteOutreachStep(stepId);
      reply.code(204).send();
    },
  );
}