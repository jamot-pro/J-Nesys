import { z } from "zod";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { CreateLeadList, Id, UpdateLeadList } from "@jamot/contracts";
import type { JamotRepository } from "../repository.js";
import type { LeadGenerationService } from "@jamot/core/leads";
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

const RunBody = z.object({
  limit: z.number().int().min(1).max(1000).optional(),
});

export default async function leadsRoutes(
  app: FastifyInstance,
  opts: { repository: JamotRepository; leads: LeadGenerationService },
): Promise<void> {
  const { repository: repo, leads } = opts;
  const { requireSpaceAccess } = createRbac(repo);
  const canAccessSpace = requireSpaceMember(repo);

  // --- Lists ----------------------------------------------------------------

  app.post(
    "/lead-lists",
    { preHandler: requireSpaceAccess("spaceId") },
    async (request, reply) => {
      const body = parse(CreateLeadList, request.body, reply);
      if (!body) return;
      const list = await leads.createList(body, request.session.actorId ?? null);
      await repo.recordEvent({
        type: "leads.list.created",
        spaceId: body.spaceId,
        actorId: request.session.actorId ?? null,
        payload: { listId: list.id, name: list.name, providerId: list.providerId },
      });
      reply.code(201);
      return list;
    },
  );

  app.get("/lead-lists", { preHandler: requireAuth }, async (request, reply) => {
    const query = request.query as { spaceId?: string; organizationId?: string };
    const spaceId = query.spaceId ? parse(Id, query.spaceId, reply) : undefined;
    if (query.spaceId && !spaceId) return;
    const organizationId = query.organizationId
      ? parse(Id, query.organizationId, reply)
      : undefined;
    if (query.organizationId && !organizationId) return;
    if (spaceId && !(await canAccessSpace(request, reply, String(spaceId)))) return;
    const items = await leads.listLists({
      spaceId: spaceId ? String(spaceId) : undefined,
      organizationId: organizationId ? String(organizationId) : undefined,
    });
    return { items };
  });

  app.get("/lead-lists/:id", { preHandler: requireAuth }, async (request, reply) => {
    const params = request.params as { id?: string };
    const id = parse(Id, params.id, reply);
    if (!id) return;
    const list = await leads.getList(id);
    if (!list) return fail(reply, 404, "lead list not found");
    if (!(await canAccessSpace(request, reply, list.spaceId))) return;
    return list;
  });

  app.patch("/lead-lists/:id", { preHandler: requireAuth }, async (request, reply) => {
    const params = request.params as { id?: string };
    const id = parse(Id, params.id, reply);
    if (!id) return;
    const body = parse(UpdateLeadList, request.body, reply);
    if (!body) return;
    const list = await leads.getList(id);
    if (!list) return fail(reply, 404, "lead list not found");
    if (!(await canAccessSpace(request, reply, list.spaceId))) return;
    const updated = await leads.updateList(id, body);
    if (!updated) return fail(reply, 404, "lead list not found");
    return updated;
  });

  app.delete("/lead-lists/:id", { preHandler: requireAuth }, async (request, reply) => {
    const params = request.params as { id?: string };
    const id = parse(Id, params.id, reply);
    if (!id) return;
    const list = await leads.getList(id);
    if (!list) return fail(reply, 404, "lead list not found");
    if (!(await canAccessSpace(request, reply, list.spaceId))) return;
    await leads.deleteList(id);
    await repo.recordEvent({
      type: "leads.list.deleted",
      spaceId: list.spaceId,
      actorId: request.session.actorId ?? null,
      payload: { listId: id, name: list.name },
    });
    reply.code(204).send();
  });

  // --- Providers -------------------------------------------------------------

  app.get("/lead-providers", { preHandler: requireAuth }, async (request, reply) => {
    const query = request.query as { spaceId?: string; organizationId?: string };
    const spaceId = query.spaceId ? parse(Id, query.spaceId, reply) : undefined;
    if (query.spaceId && !spaceId) return;
    if (spaceId && !(await canAccessSpace(request, reply, spaceId))) return;
    const views = await leads.listProviders({
      organizationId: query.organizationId ?? null,
      spaceId: spaceId ?? "",
      config: {},
    });
    return { items: views };
  });

  // --- Run + leads -----------------------------------------------------------

  app.post(
    "/lead-lists/:id/run",
    { preHandler: requireAuth },
    async (request, reply) => {
      const params = request.params as { id?: string };
      const id = parse(Id, params.id, reply);
      if (!id) return;
      const list = await leads.getList(id);
      if (!list) return fail(reply, 404, "lead list not found");
      if (!(await canAccessSpace(request, reply, list.spaceId))) return;

      const body = request.body as Record<string, unknown> | undefined;
      const parsed = body ? parse(RunBody, body, reply) : undefined;
      if (body && !parsed) return;
      if (parsed?.limit) {
        await leads.updateList(id, {
          providerConfig: { ...list.providerConfig, limit: parsed.limit },
        });
      }

      await repo.recordEvent({
        type: "leads.run.started",
        spaceId: list.spaceId,
        actorId: request.session.actorId ?? null,
        payload: { listId: id },
      });
      const result = await leads.runList(id);
      return result;
    },
  );

  app.get(
    "/lead-lists/:id/leads",
    { preHandler: requireAuth },
    async (request, reply) => {
      const params = request.params as { id?: string };
      const id = parse(Id, params.id, reply);
      if (!id) return;
      const list = await leads.getList(id);
      if (!list) return fail(reply, 404, "lead list not found");
      if (!(await canAccessSpace(request, reply, list.spaceId))) return;
      const members = await leads.listLeads(id);
      return { items: members };
    },
  );

  app.post(
    "/lead-lists/:id/leads/:personId/enrich",
    { preHandler: requireAuth },
    async (request, reply) => {
      const params = request.params as { id?: string; personId?: string };
      const id = parse(Id, params.id, reply);
      if (!id) return;
      const personId = parse(Id, params.personId, reply);
      if (!personId) return;
      const list = await leads.getList(id);
      if (!list) return fail(reply, 404, "lead list not found");
      if (!(await canAccessSpace(request, reply, list.spaceId))) return;
      const person = await leads.enrichLead(id, personId);
      return person;
    },
  );
}