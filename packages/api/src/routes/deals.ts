import { z } from "zod";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { CreateDeal, DealStage, Id, UpdateDeal } from "@jamot/contracts";
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

/**
 * Deals: the pipeline a sales dashboard needs. A deal is created
 * deliberately, usually against a lead worth pursuing, so open/won/lost and
 * revenue reflect what the team decided to work rather than a status guess.
 */
export default async function dealsRoutes(
  app: FastifyInstance,
  opts: { repository: JamotRepository },
): Promise<void> {
  const { repository: repo } = opts;
  const { requireSpaceAccess } = createRbac(repo);
  const canAccessSpace = requireSpaceMember(repo);

  app.post("/deals", { preHandler: requireSpaceAccess("spaceId") }, async (request, reply) => {
    const body = parse(CreateDeal, request.body, reply);
    if (!body) return;
    const spaceId = request.resolvedSpaceId ?? body.spaceId;

    const deal = await repo.createDeal({
      spaceId,
      organizationId: body.organizationId ?? null,
      personId: body.personId ?? null,
      agentId: body.agentId ?? null,
      createdBy: request.session.actorId ?? null,
      leadListId: body.leadListId ?? null,
      title: body.title,
      valueAmount: body.valueAmount,
      currency: body.currency,
      stage: body.stage,
      source: body.source ?? null,
      notes: body.notes,
    });

    await repo.recordEvent({
      type: "deal.created",
      spaceId,
      actorId: request.session.actorId ?? null,
      payload: { dealId: deal.id, title: deal.title, stage: deal.stage },
    });

    reply.code(201);
    return deal;
  });

  app.get("/deals", { preHandler: requireAuth }, async (request, reply) => {
    const query = request.query as { spaceId?: string; stage?: string };
    const spaceId = parse(Id, request.resolvedSpaceId ?? query.spaceId, reply);
    if (!spaceId) return;
    if (!(await canAccessSpace(request, reply, spaceId))) return;
    const stage = query.stage ? DealStage.safeParse(query.stage) : undefined;
    if (stage && !stage.success) return fail(reply, 400, "invalid stage");
    const items = await repo.listDeals({ spaceId, stage: stage?.data });
    return { items };
  });

  app.get("/deals/:id", { preHandler: requireAuth }, async (request, reply) => {
    const id = parse(Id, (request.params as { id?: string }).id, reply);
    if (!id) return;
    const deal = await repo.getDeal(id);
    if (!deal) return fail(reply, 404, "deal not found");
    if (!(await canAccessSpace(request, reply, deal.spaceId))) return;
    return deal;
  });

  app.patch("/deals/:id", { preHandler: requireAuth }, async (request, reply) => {
    const id = parse(Id, (request.params as { id?: string }).id, reply);
    if (!id) return;
    const body = parse(UpdateDeal, request.body, reply);
    if (!body) return;
    const deal = await repo.getDeal(id);
    if (!deal) return fail(reply, 404, "deal not found");
    if (!(await canAccessSpace(request, reply, deal.spaceId))) return;

    /* Closing a deal (won or lost) stamps closedAt; reopening it clears that
       stamp rather than leaving a stale close date on an open deal. */
    const closedAt =
      body.stage && body.stage !== "open"
        ? (deal.closedAt ?? new Date().toISOString())
        : body.stage === "open"
          ? null
          : undefined;

    const updated = await repo.updateDeal(id, {
      ...body,
      ...(closedAt !== undefined ? { closedAt } : {}),
    });
    if (!updated) return fail(reply, 404, "deal not found");

    if (body.stage && body.stage !== deal.stage) {
      await repo.recordEvent({
        type: "deal.stage_changed",
        spaceId: deal.spaceId,
        actorId: request.session.actorId ?? null,
        payload: { dealId: id, from: deal.stage, to: body.stage },
      });
    }

    return updated;
  });

  app.delete("/deals/:id", { preHandler: requireAuth }, async (request, reply) => {
    const id = parse(Id, (request.params as { id?: string }).id, reply);
    if (!id) return;
    const deal = await repo.getDeal(id);
    if (!deal) return fail(reply, 404, "deal not found");
    if (!(await canAccessSpace(request, reply, deal.spaceId))) return;
    await repo.deleteDeal(id);
    reply.code(204).send();
  });
}
