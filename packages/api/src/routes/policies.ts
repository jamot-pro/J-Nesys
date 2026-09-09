import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { Id, PolicyDecision } from "@jamot/contracts";
import type { JamotRepository } from "../repository.js";
import { createRbac } from "../rbac.js";
import { parse } from "../util.js";

const CreatePolicyBody = z.object({
  spaceId: Id,
  name: z.string().min(1),
  capability: z.string().min(1),
  resource: z.string().min(1).optional(),
  minRole: z.enum(["owner", "admin", "member", "agent", "external"]).nullable().optional(),
  riskThreshold: z.number().min(0).max(1).optional(),
  decision: PolicyDecision,
});

// Policies decide what every actor - human or agent - is allowed to do, so
// both endpoints require admin+ in the target space rather than plain auth.
export function policiesRoutes(repo: JamotRepository) {
  const { requireRole } = createRbac(repo);

  return async function (app: FastifyInstance): Promise<void> {
    app.get(
      "/policies",
      { preHandler: requireRole("admin", "spaceId") },
      async (request) => {
        const query = request.query as { spaceId?: string };
        return { items: await repo.listPolicies({ spaceId: query.spaceId }) };
      },
    );

    app.post(
      "/policies",
      { preHandler: requireRole("admin", "spaceId") },
      async (request, reply) => {
        const body = parse(CreatePolicyBody, request.body, reply);
        if (!body) return;

        const policy = await repo.createPolicy({
          spaceId: body.spaceId,
          name: body.name,
          capability: body.capability,
          resource: body.resource,
          minRole: body.minRole ?? null,
          riskThreshold: body.riskThreshold,
          decision: body.decision,
        });

        reply.code(201);
        return policy;
      },
    );
  };
}

export default policiesRoutes;
