import { z } from "zod";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { CreateLeadList, Id, UpdateLeadList } from "@jamot/contracts";
import type { JamotRepository } from "../repository.js";
import type { LeadGenerationService } from "@jamot/core/leads";
import { actorRoleInSpace, createRbac, requireAuth } from "../rbac.js";
import { fail, parse } from "../util.js";
import type { SecretStore } from "@jamot/core/secrets/secret-store";

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
  opts: {
    repository: JamotRepository;
    leads: LeadGenerationService;
    secretStore: SecretStore;
  },
): Promise<void> {
  const { repository: repo, leads, secretStore } = opts;
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
        spaceId: request.resolvedSpaceId ?? body.spaceId,
        actorId: request.session.actorId ?? null,
        payload: { listId: list.id, name: list.name, providerId: list.providerId },
      });
      reply.code(201);
      return list;
    },
  );

  app.get("/lead-lists", { preHandler: requireAuth }, async (request, reply) => {
    const query = request.query as { spaceId?: string; organizationId?: string };
    const spaceId = query.spaceId ? parse(Id, request.resolvedSpaceId ?? query.spaceId, reply) : undefined;
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
    const spaceId = query.spaceId ? parse(Id, request.resolvedSpaceId ?? query.spaceId, reply) : undefined;
    if (query.spaceId && !spaceId) return;
    if (spaceId && !(await canAccessSpace(request, reply, spaceId))) return;
    const views = await leads.listProviders({
      organizationId: query.organizationId ?? null,
      spaceId: spaceId ?? "",
      config: {},
    });
    return { items: views };
  });

  /**
   * Stores the API key a provider needs.
   *
   * Only the refs the providers actually read are writable, so this cannot be
   * used as a general secret-writing endpoint. Keys are write-only: there is
   * no route that reads one back, and the provider list reports configured or
   * not rather than the value.
   */
  const PROVIDER_KEY_REFS: Record<string, string> = {
    apollo: "leads/apollo",
    "google-maps": "leads/apify",
  };

  app.put("/lead-providers/:id/key", { preHandler: requireAuth }, async (request, reply) => {
    const providerId = (request.params as { id?: string }).id ?? "";
    const base = PROVIDER_KEY_REFS[providerId];
    if (!base) return fail(reply, 404, "that provider takes no API key");

    const body = parse(
      z.object({
        apiKey: z.string().trim().min(1).max(500),
        organizationId: Id.optional(),
      }),
      request.body,
      reply,
    );
    if (!body) return;

    /* Scoping a key to an organization requires belonging to it; the platform
       fallback key is deliberately not writable from here. */
    if (!body.organizationId) {
      return fail(reply, 400, "organizationId is required");
    }
    const organization = await repo.getOrganization(body.organizationId);
    if (!organization) return fail(reply, 404, "organization not found");
    const role = await actorRoleInSpace(
      repo,
      request.session.actorId as never,
      organization.spaceId,
    );
    if (!role) return fail(reply, 403, "no access to this organization");

    await repo.putSecret({
      ref: `${base}/${body.organizationId}`,
      scope: "organization",
      ownerActorId: null,
      ownerOrganizationId: body.organizationId,
      ciphertext: secretStore.encrypt(body.apiKey),
    });

    return { configured: true };
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

      // Not awaited: a Google Maps run can take minutes, and holding the
      // HTTP connection open that long is what made starting a second
      // search from the UI feel blocked on the first. runList() itself
      // updates the list's status/leadCount as it goes (including on
      // failure), so the caller finds out how it went by polling
      // GET /lead-lists rather than waiting on this response.
      void leads.runList(id).catch((err) => {
        request.log.error(err, "lead list run failed");
      });
      return { listId: id, status: "running", totalFound: 0, added: 0, skipped: 0, error: null };
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