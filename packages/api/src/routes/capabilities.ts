import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { Id } from "@jamot/contracts";
import { requireAuth } from "../rbac.js";
import { fail, parse } from "../util.js";
import type { RoutesOptions } from "./types.js";

const CreateCapabilityBody = z.object({
  name: z.string().min(1),
  skillId: Id,
  connectorId: Id,
  policyIds: z.array(Id).optional(),
  context: z.record(z.string(), z.unknown()).optional(),
  spaceId: Id,
});

export default async function capabilitiesRoutes(
  app: FastifyInstance,
  opts: RoutesOptions,
): Promise<void> {
  const { repository } = opts;

  app.post("/capabilities", { preHandler: requireAuth }, async (request, reply) => {
    const body = parse(CreateCapabilityBody, request.body, reply);
    if (!body) return;

    const capability = await repository.createCapability({
      name: body.name,
      skillId: body.skillId,
      connectorId: body.connectorId,
      policyIds: body.policyIds ?? [],
      context: body.context ?? {},
      spaceId: body.spaceId,
    });

    reply.code(201);
    return capability;
  });

  app.get("/capabilities", { preHandler: requireAuth }, async (request, reply) => {
    const query = request.query as { spaceId?: string };
    if (query.spaceId) {
      const spaceId = parse(Id, query.spaceId, reply);
      if (!spaceId) return;
      return { items: await repository.listCapabilities({ spaceId }) };
    }
    return { items: await repository.listCapabilities() };
  });

  app.get("/capabilities/:id", { preHandler: requireAuth }, async (request, reply) => {
    const params = request.params as { id?: string };
    const id = parse(Id, params.id, reply);
    if (!id) return;
    const capability = await repository.getCapability(id);
    if (!capability) return fail(reply, 404, "capability not found");
    return capability;
  });
}
