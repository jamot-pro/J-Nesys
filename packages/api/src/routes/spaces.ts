import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { Id } from "@jamot/contracts";
import type { JamotRepository } from "../repository.js";
import { createRbac, requireAuth } from "../rbac.js";
import { fail, parse } from "../util.js";

const CreateSpaceBody = z.object({
  name: z.string().min(1),
  kind: z.enum(["personal", "organization"]).optional(),
});

export function spacesRoutes(repo: JamotRepository) {
  return async function (app: FastifyInstance): Promise<void> {
    const rbac = createRbac(repo);
    app.post("/spaces", { preHandler: requireAuth }, async (request, reply) => {
      const body = parse(CreateSpaceBody, request.body, reply);
      if (!body) return;

      const actorId = request.session.actorId!;
      const space = await repo.createSpace({
        kind: body.kind ?? "organization",
        ownerActorId: actorId,
        name: body.name,
      });
      await repo.createRole({ actorId, spaceId: space.id, kind: "owner" });

      reply.code(201);
      return space;
    });

    app.get("/spaces", { preHandler: requireAuth }, async (request) => {
      const actorId = request.session.actorId!;
      const roles = await repo.listRolesForActor(actorId);
      const unique = new Map<string, Awaited<ReturnType<JamotRepository["getSpace"]>>>();
      for (const role of roles) {
        const space = await repo.getSpace(role.spaceId);
        if (space) unique.set(space.id, space);
      }
      return { items: [...unique.values()] };
    });

    app.get(
      "/spaces/:id",
      { preHandler: rbac.requireSpaceAccess("id") },
      async (request, reply) => {
        const params = request.params as { id?: string };
        const id = parse(Id, params.id, reply);
        if (!id) return;
        const space = await repo.getSpace(id);
        if (!space) return fail(reply, 404, "space not found");
        return space;
      },
    );
  };
}
