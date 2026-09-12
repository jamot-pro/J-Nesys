import type { FastifyInstance } from "fastify";

import { DreamListingPatch, Id } from "@jamot/contracts";
import type { JamotRepository } from "../repository.js";
import { createRbac, requireAuth } from "../rbac.js";
import { fail, parse } from "../util.js";

/**
 * The public dream directory behind Discover.
 *
 * A dream is listed as soon as its organization has written one: the statement
 * on `organizations.dream` is the entry, and `dream_listings` only adds the
 * presentation around it. Believers and agent counts are counted, never stored,
 * so the numbers on the cards cannot drift from the rows behind them.
 */
export function discoverRoutes(repo: JamotRepository) {
  const rbac = createRbac(repo);

  return async function (app: FastifyInstance): Promise<void> {
    /* Readable without a session: this is a public directory. A signed-in
       caller additionally learns which dreams they have already joined. */
    app.get("/dreams", async (request) => {
      const [organizations, listings] = await Promise.all([
        repo.listOrganizations(),
        repo.listDreamListings(),
      ]);
      const byOrg = new Map(listings.map((l) => [l.organizationId, l]));

      const actorId = request.session?.actorId ?? null;
      const joined = new Set(actorId ? await repo.listDreamsBelievedIn(actorId) : []);

      const published = organizations.filter((org) => org.dream.trim().length > 0);
      const items = await Promise.all(
        published.map(async (org) => {
          const listing = byOrg.get(org.id);
          /* An organization carries no name of its own — its space does. */
          const [believers, agents, space] = await Promise.all([
            repo.countDreamBelievers(org.id),
            repo.listAgents({ organizationId: org.id }),
            repo.getSpace(org.spaceId),
          ]);
          return {
            organizationId: org.id,
            slug: org.slug ?? null,
            name: space?.name ?? org.slug ?? "Untitled dream",
            logoUrl: org.logoUrl ?? null,
            statement: org.dream,
            holderName: listing?.holderName ?? "",
            place: listing?.place ?? "",
            category: listing?.category ?? "",
            needs: listing?.needs ?? [],
            payBand: listing?.payBand ?? "",
            fundedPct: listing?.fundedPct ?? 0,
            believers,
            agents: agents.length,
            joined: joined.has(org.id),
          };
        }),
      );

      return { items };
    });

    /** Join a dream — become one of its believers. */
    app.post("/dreams/:orgId/believers", { preHandler: requireAuth }, async (request, reply) => {
      const orgId = parse(Id, (request.params as { orgId?: string }).orgId, reply);
      if (!orgId) return;

      const org = await repo.getOrganization(orgId);
      if (!org || org.dream.trim().length === 0) return fail(reply, 404, "dream not found");

      await repo.addDreamBeliever(orgId, request.session.actorId!);
      reply.code(201);
      return { believers: await repo.countDreamBelievers(orgId) };
    });

    /** Leave a dream. */
    app.delete("/dreams/:orgId/believers", { preHandler: requireAuth }, async (request, reply) => {
      const orgId = parse(Id, (request.params as { orgId?: string }).orgId, reply);
      if (!orgId) return;

      await repo.removeDreamBeliever(orgId, request.session.actorId!);
      reply.code(204);
    });

    /** The presentation fields, editable by the organization's own admins. */
    app.patch(
      "/dreams/:orgId/listing",
      { preHandler: rbac.requireOrgAdmin("orgId") },
      async (request, reply) => {
        const orgId = parse(Id, (request.params as { orgId?: string }).orgId, reply);
        if (!orgId) return;
        const patch = parse(DreamListingPatch, request.body, reply);
        if (!patch) return;

        return await repo.upsertDreamListing(orgId, patch);
      },
    );

    /** How many believers one dream has, without loading the directory. */
    app.get("/dreams/:orgId/believers", async (request, reply) => {
      const orgId = parse(Id, (request.params as { orgId?: string }).orgId, reply);
      if (!orgId) return;
      return { believers: await repo.countDreamBelievers(orgId) };
    });

  };
}
