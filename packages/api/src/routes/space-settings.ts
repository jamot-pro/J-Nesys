import { z } from "zod";
import type { FastifyInstance } from "fastify";
import type { Id } from "@jamot/contracts";
import type { JamotRepository } from "../repository.js";
import {
  actorRoleInSpace,
  deny,
  requireAuth,
} from "../rbac.js";
import { fail, parse } from "../util.js";

export interface SpaceSettingsRoutesOptions {
  repository: JamotRepository;
}

const PatchBody = z.object({
  orchestratorModel: z.string().nullable().optional(),
});

/**
 * Per-space settings (orchestrator model, etc.).
 *
 * Read access: the personal-space owner, or any member of an org space.
 * Write access: the personal-space owner, or an owner/admin of an org space.
 */
export default async function spaceSettingsRoutes(
  app: FastifyInstance,
  opts: SpaceSettingsRoutesOptions,
): Promise<void> {
  const { repository } = opts;

  async function resolveAccess(spaceId: string, actorId: string) {
    const space = await repository.getSpace(spaceId);
    if (!space) return null;
    const isPersonalOwner = space.ownerActorId === actorId;
    const role = await actorRoleInSpace(repository, actorId as Id, space.id as Id);
    const org = await repository.getOrganizationBySpaceId(space.id);
    return { space, isPersonalOwner, role, org };
  }

  app.get("/spaces/:spaceId/settings", { preHandler: requireAuth }, async (request, reply) => {
    const params = request.params as { spaceId?: string };
    const spaceId = params.spaceId;
    if (!spaceId) return fail(reply, 400, "spaceId is required");
    const actorId = request.session.actorId;
    if (!actorId) return deny(reply, "Unauthenticated", 401);

    const access = await resolveAccess(spaceId, actorId);
    if (!access) return fail(reply, 404, "space not found");
    if (!access.isPersonalOwner && !access.role) {
      return deny(reply, "No access to this space", 403);
    }

    const config = await repository.getSpaceSettings(spaceId as Id);
    return { orchestratorModel: (config.orchestratorModel as string | null) ?? null };
  });

  app.patch(
    "/spaces/:spaceId/settings",
    { preHandler: requireAuth },
    async (request, reply) => {
      const params = request.params as { spaceId?: string };
      const spaceId = params.spaceId;
      if (!spaceId) return fail(reply, 400, "spaceId is required");
      const actorId = request.session.actorId;
      if (!actorId) return deny(reply, "Unauthenticated", 401);

      const access = await resolveAccess(spaceId, actorId);
      if (!access) return fail(reply, 404, "space not found");

      const canWrite = access.isPersonalOwner || access.role === "owner" || access.role === "admin";
      if (!canWrite) return deny(reply, "Requires owner or admin role", 403);

      const body = parse(PatchBody, request.body, reply);
      if (!body) return;

      const patch: Record<string, unknown> = {};
      if (body.orchestratorModel !== undefined) {
        patch.orchestratorModel = body.orchestratorModel;
      }
      const config = await repository.setSpaceSettings(spaceId as Id, patch);
      return { orchestratorModel: (config.orchestratorModel as string | null) ?? null };
    },
  );
}
