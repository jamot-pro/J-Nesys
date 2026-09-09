import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { Id } from "@jamot/contracts";
import type { JamotRepository } from "../repository.js";
import { RoleKindSchema } from "../repository.js";
import { createRbac, requireAuth } from "../rbac.js";
import { fail, parse } from "../util.js";

const GrantRoleBody = z.object({
  actorId: Id,
  spaceId: Id,
  kind: RoleKindSchema,
  title: z.string().nullable().optional(),
});

export function rolesRoutes(repo: JamotRepository) {
  const { requireRole } = createRbac(repo);

  return async function (app: FastifyInstance): Promise<void> {
    app.post("/roles", { preHandler: requireAuth }, async (request, reply) => {
      const body = parse(GrantRoleBody, request.body, reply);
      if (!body) return;

      const minRole = body.kind === "owner" ? "owner" : "admin";
      const roleCheck = requireRole(minRole, "spaceId");
      await roleCheck(request, reply);
      if (reply.sent) return;

      const role = await repo.createRole({
        actorId: body.actorId,
        spaceId: body.spaceId,
        kind: body.kind,
        title: body.title ?? null,
      });

      reply.code(201);
      return role;
    });

    app.get("/roles", { preHandler: requireAuth }, async (request, reply) => {
      const query = request.query as { spaceId?: string; actorId?: string };

      if (query.spaceId && query.actorId) {
        const spaceId = parse(Id, query.spaceId, reply);
        if (!spaceId) return;
        const actorId = parse(Id, query.actorId, reply);
        if (!actorId) return;
        const roles = await repo.listRolesForActor(actorId);
        return { items: roles.filter((r) => r.spaceId === spaceId) };
      }
      if (query.spaceId) {
        const spaceId = parse(Id, query.spaceId, reply);
        if (!spaceId) return;
        return { items: await repo.listRolesForSpace(spaceId) };
      }
      if (query.actorId) {
        const actorId = parse(Id, query.actorId, reply);
        if (!actorId) return;
        return { items: await repo.listRolesForActor(actorId) };
      }

      return fail(reply, 400, "spaceId or actorId is required");
    });
  };
}
