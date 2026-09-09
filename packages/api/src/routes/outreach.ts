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

  app.post(
    "/outreach/lists",
    { preHandler: requireSpaceAccess("spaceId") },
    async (request, reply) => {
      const body = parse(CreateOutreachList, request.body, reply);
      if (!body) return;
      const list = await repo.createOutreachList({
        spaceId: body.spaceId,
        name: body.name,
        description: body.description,
        memberPersonIds: body.memberPersonIds,
      });

      await repo.recordEvent({
        type: "outreach.list.created",
        spaceId: body.spaceId,
        actorId: request.session.actorId ?? null,
        payload: { listId: list.id, name: list.name },
      });

      reply.code(201);
      return list;
    },
  );

  app.get("/outreach/lists", { preHandler: requireAuth }, async (request, reply) => {
    const query = request.query as { spaceId?: string };
    const spaceId = parse(Id, query.spaceId, reply);
    if (!spaceId) return;
    if (!(await canAccessSpace(request, reply, spaceId))) return;
    return { items: await repo.listOutreachLists(spaceId) };
  });

  app.get("/outreach/lists/:id", { preHandler: requireAuth }, async (request, reply) => {
    const params = request.params as { id?: string };
    const id = parse(Id, params.id, reply);
    if (!id) return;
    const list = await repo.getOutreachList(id);
    if (!list) return fail(reply, 404, "list not found");
    if (!(await canAccessSpace(request, reply, list.spaceId))) return;
    return list;
  });

  app.patch("/outreach/lists/:id", { preHandler: requireAuth }, async (request, reply) => {
    const params = request.params as { id?: string };
    const id = parse(Id, params.id, reply);
    if (!id) return;
    const body = parse(UpdateOutreachList, request.body, reply);
    if (!body) return;
    const list = await repo.getOutreachList(id);
    if (!list) return fail(reply, 404, "list not found");
    if (!(await canAccessSpace(request, reply, list.spaceId))) return;
    const updated = await repo.updateOutreachList(id, body);
    if (!updated) return fail(reply, 404, "list not found");
    return updated;
  });

  app.delete("/outreach/lists/:id", { preHandler: requireAuth }, async (request, reply) => {
    const params = request.params as { id?: string };
    const id = parse(Id, params.id, reply);
    if (!id) return;
    const list = await repo.getOutreachList(id);
    if (!list) return fail(reply, 404, "list not found");
    if (!(await canAccessSpace(request, reply, list.spaceId))) return;

    const inUse = await repo.listOutreachCampaigns({ spaceId: list.spaceId });
    if (inUse.some((c) => c.listId === id)) {
      return fail(reply, 409, "list is used by an outreach campaign");
    }

    await repo.deleteOutreachList(id);
    await repo.recordEvent({
      type: "outreach.list.deleted",
      spaceId: list.spaceId,
      actorId: request.session.actorId ?? null,
      payload: { listId: id, name: list.name },
    });
    reply.code(204).send();
  });

  // --- List members --------------------------------------------------------

  app.get(
    "/outreach/lists/:id/members",
    { preHandler: requireAuth },
    async (request, reply) => {
      const params = request.params as { id?: string };
      const id = parse(Id, params.id, reply);
      if (!id) return;
      const list = await repo.getOutreachList(id);
      if (!list) return fail(reply, 404, "list not found");
      if (!(await canAccessSpace(request, reply, list.spaceId))) return;

      const members = [];
      for (const personId of list.memberPersonIds) {
        const person = await repo.getPerson(personId);
        if (!person) continue;
        const actor = await repo.getActor(person.actorId);
        members.push({
          personId: person.id,
          actorId: person.actorId,
          email: person.email,
          displayName: actor?.displayName ?? "Unknown",
          addedAt: list.updatedAt,
        });
      }
      return { items: members };
    },
  );

  app.post(
    "/outreach/lists/:id/members",
    { preHandler: requireAuth },
    async (request, reply) => {
      const params = request.params as { id?: string };
      const id = parse(Id, params.id, reply);
      if (!id) return;
      const body = parse(AddListMembers, request.body, reply);
      if (!body) return;
      const list = await repo.getOutreachList(id);
      if (!list) return fail(reply, 404, "list not found");
      if (!(await canAccessSpace(request, reply, list.spaceId))) return;

      const memberPersonIds = [
        ...new Set([...list.memberPersonIds, ...body.personIds]),
      ];
      const updated = await repo.updateOutreachList(id, { memberPersonIds });
      if (!updated) return fail(reply, 404, "list not found");
      return { items: updated.memberPersonIds };
    },
  );

  app.delete(
    "/outreach/lists/:id/members",
    { preHandler: requireAuth },
    async (request, reply) => {
      const params = request.params as { id?: string };
      const id = parse(Id, params.id, reply);
      if (!id) return;
      const body = parse(RemoveListMembers, request.body, reply);
      if (!body) return;
      const list = await repo.getOutreachList(id);
      if (!list) return fail(reply, 404, "list not found");
      if (!(await canAccessSpace(request, reply, list.spaceId))) return;

      const removed = new Set(body.personIds);
      const memberPersonIds = list.memberPersonIds.filter((p) => !removed.has(p));
      const updated = await repo.updateOutreachList(id, { memberPersonIds });
      if (!updated) return fail(reply, 404, "list not found");
      return { items: updated.memberPersonIds };
    },
  );

  // --- Campaigns -----------------------------------------------------------

  app.post(
    "/outreach/campaigns",
    { preHandler: requireSpaceAccess("spaceId") },
    async (request, reply) => {
      const body = parse(CreateOutreachCampaign, request.body, reply);
      if (!body) return;

      const list = await repo.getOutreachList(body.listId);
      if (!list || list.spaceId !== body.spaceId) {
        return fail(reply, 400, "source list does not exist in this space");
      }
      const agent = await repo.getAgent(body.agentId);
      if (!agent) {
        return fail(reply, 400, "assigned agent does not exist");
      }

      const campaign = await repo.createOutreachCampaign({
        spaceId: body.spaceId,
        name: body.name,
        description: body.description,
        listId: body.listId,
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
        spaceId: body.spaceId,
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
      const spaceId = parse(Id, query.spaceId, reply);
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
        repo.getOutreachList(campaign.listId),
        repo.getAgent(campaign.agentId),
      ]);
      const agentActor = agent
        ? await repo.getActor(agent.actorId)
        : null;

      return {
        campaign,
        steps,
        sends,
        list: list
          ? { id: list.id, name: list.name, memberCount: list.memberPersonIds.length }
          : null,
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