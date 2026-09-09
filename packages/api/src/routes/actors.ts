import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { Id } from "@jamot/contracts";
import type { JamotRepository } from "../repository.js";
import { requireAuth } from "../rbac.js";
import { fail, parse } from "../util.js";

const ActorPatch = z.object({
  displayName: z.string().min(1).max(120).optional(),
});

export function actorsRoutes(repo: JamotRepository) {
  return async function (app: FastifyInstance): Promise<void> {
    app.get("/actors", { preHandler: requireAuth }, async () => {
      return { items: await repo.listActors() };
    });

    app.get("/actors/:id", { preHandler: requireAuth }, async (request, reply) => {
      const params = request.params as { id?: string };
      const id = parse(Id, params.id, reply);
      if (!id) return;
      const actor = await repo.getActor(id);
      if (!actor) return fail(reply, 404, "actor not found");
      return actor;
    });

    app.patch("/actors/:id", { preHandler: requireAuth }, async (request, reply) => {
      const params = request.params as { id?: string };
      const id = parse(Id, params.id, reply);
      if (!id) return;
      const patch = parse(ActorPatch, request.body, reply);
      if (!patch) return;

      if (request.session.actorId !== id) {
        return fail(reply, 403, "you can only update your own actor");
      }

      const updated = await repo.updateActor(id, patch);
      if (!updated) return fail(reply, 404, "actor not found");
      return updated;
    });
  };
}
