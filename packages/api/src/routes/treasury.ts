import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { Id } from "@jamot/contracts";
import type { TreasuryService } from "@jamot/core/treasury";
import { requireAuth } from "../rbac.js";
import { fail, parse } from "../util.js";

export interface TreasuryRoutesOptions {
  treasury: TreasuryService;
}

const CreateProposalBody = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  amount: z.number().positive(),
  proposedByActorId: Id,
});

export default async function treasuryRoutes(
  app: FastifyInstance,
  opts: TreasuryRoutesOptions,
): Promise<void> {
  const { treasury } = opts;

  app.get(
    "/treasury/:organizationId/ledger",
    { preHandler: requireAuth },
    async (request, reply) => {
      const params = request.params as { organizationId?: string };
      const organizationId = parse(Id, params.organizationId, reply);
      if (!organizationId) return;
      return { items: await treasury.ledger(organizationId) };
    },
  );

  app.post(
    "/treasury/:organizationId/proposals",
    { preHandler: requireAuth },
    async (request, reply) => {
      const params = request.params as { organizationId?: string };
      const organizationId = parse(Id, params.organizationId, reply);
      if (!organizationId) return;
      const body = parse(CreateProposalBody, request.body, reply);
      if (!body) return;
      const proposal = await treasury.propose(organizationId, {
        title: body.title,
        description: body.description,
        amount: body.amount,
        proposedByActorId: body.proposedByActorId,
      });
      reply.code(201);
      return proposal;
    },
  );

  app.post(
    "/treasury/proposals/:id/approve",
    { preHandler: requireAuth },
    async (request, reply) => {
      const params = request.params as { id?: string };
      const id = parse(Id, params.id, reply);
      if (!id) return;
      try {
        return await treasury.approve(id);
      } catch {
        return fail(reply, 404, "proposal not found");
      }
    },
  );
}
