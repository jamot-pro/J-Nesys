import type { FastifyReply, FastifyRequest } from "fastify";
import type { Id } from "@jamot/contracts";
import type { JamotRepository, RoleKind, StoredUser } from "./repository.js";

export const ROLE_WEIGHT: Record<RoleKind, number> = {
  owner: 5,
  admin: 4,
  member: 3,
  agent: 2,
  external: 1,
};

export function deny(
  reply: FastifyReply,
  message = "Forbidden",
  code: number = 403,
): FastifyReply {
  return reply.code(code).send({ error: message });
}

export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<FastifyReply | void> {
  if (!request.session.actorId) {
    return reply.code(401).send({ error: "Unauthenticated" });
  }
}

export async function actorRoleInSpace(
  repo: JamotRepository,
  actorId: Id,
  spaceId: Id,
): Promise<RoleKind | null> {
  // The app shell uses the literal "personal" id for the personal space; it is
  // not a UUID, so resolve it to the actor's real personal space before
  // querying the DB (otherwise getSpace("personal") throws a uuid cast error).
  const resolved = await resolveSpaceIdForActor(repo, actorId, spaceId);
  if (!resolved) return null;
  const space = await repo.getSpace(resolved);
  if (space && space.ownerActorId === actorId) return "owner";
  const roles = await repo.listRolesForActor(actorId);
  const inSpace = roles.filter((r) => r.spaceId === resolved);
  if (inSpace.length === 0) return null;
  return inSpace.reduce<RoleKind>(
    (max, r) => (ROLE_WEIGHT[r.kind] > ROLE_WEIGHT[max] ? r.kind : max),
    inSpace[0]!.kind,
  );
}

/** Map the literal "personal" space id to the actor's actual personal space id. */
async function resolveSpaceIdForActor(
  repo: JamotRepository,
  actorId: Id,
  spaceId: Id,
): Promise<Id | null> {
  if (spaceId !== ("personal" as Id)) return spaceId;
  const spaces = await repo.listSpaces();
  const personal = spaces.find((s) => s.kind === "personal" && s.ownerActorId === actorId);
  return (personal?.id ?? null) as Id | null;
}

export async function loadUser(
  repo: JamotRepository,
  actorId: string,
): Promise<StoredUser | null> {
  return repo.findUserByActor(actorId);
}

export function isSuperAdminUser(user: StoredUser | null): boolean {
  return user?.isSuperAdmin === true;
}

function resolveSpaceId(request: FastifyRequest, source: string): string | undefined {
  const params = request.params as Record<string, unknown> | undefined;
  const query = request.query as Record<string, unknown> | undefined;
  const body = request.body as Record<string, unknown> | null | undefined;
  if (params && typeof params[source] === "string") return params[source];
  if (query && typeof query[source] === "string") return query[source];
  if (body && typeof body[source] === "string") return body[source];
  return undefined;
}

export function createRbac(repo: JamotRepository) {
  const requireRole = (minRole: RoleKind, spaceSource = "spaceId") =>
    async (request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply | void> => {
      const actorId = request.session.actorId;
      if (!actorId) return deny(reply, "Unauthenticated", 401);
      const spaceId = resolveSpaceId(request, spaceSource);
      if (!spaceId) return deny(reply, "spaceId is required", 400);
      const role = await actorRoleInSpace(repo, actorId, spaceId as Id);
      if (!role || ROLE_WEIGHT[role] < ROLE_WEIGHT[minRole]) {
        return deny(reply, `Requires role ${minRole} or higher`, 403);
      }
    };

  const requireSpaceAccess = (spaceSource = "spaceId") =>
    async (request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply | void> => {
      const actorId = request.session.actorId;
      if (!actorId) return deny(reply, "Unauthenticated", 401);
      const spaceId = resolveSpaceId(request, spaceSource);
      if (!spaceId) return deny(reply, "spaceId is required", 400);
      const role = await actorRoleInSpace(repo, actorId, spaceId as Id);
      if (!role) return deny(reply, "No access to this space", 403);
    };

  const requireOrgAccess = (orgSource = "organizationId") =>
    async (request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply | void> => {
      const actorId = request.session.actorId;
      if (!actorId) return deny(reply, "Unauthenticated", 401);
      const orgId = resolveSpaceId(request, orgSource);
      if (!orgId) return deny(reply, "organizationId is required", 400);
      const org = await repo.getOrganization(orgId as Id);
      if (!org) return deny(reply, "organization not found", 404);
      const user = await loadUser(repo, actorId);
      if (isSuperAdminUser(user)) return;
      const space = await repo.getSpace(org.spaceId);
      if (!space) return deny(reply, "organization space not found", 404);
      const role = await actorRoleInSpace(repo, actorId, org.spaceId);
      if (!role) return deny(reply, "No access to this organization", 403);
    };

  const requireOrgAdmin = (orgSource = "organizationId") =>
    async (request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply | void> => {
      const actorId = request.session.actorId;
      if (!actorId) return deny(reply, "Unauthenticated", 401);
      const orgId = resolveSpaceId(request, orgSource);
      if (!orgId) return deny(reply, "organizationId is required", 400);
      const org = await repo.getOrganization(orgId as Id);
      if (!org) return deny(reply, "organization not found", 404);
      const user = await loadUser(repo, actorId);
      if (isSuperAdminUser(user)) return;
      const space = await repo.getSpace(org.spaceId);
      if (!space) return deny(reply, "organization space not found", 404);
      const role = await actorRoleInSpace(repo, actorId, org.spaceId);
      if (!role || ROLE_WEIGHT[role] < ROLE_WEIGHT.admin) {
        return deny(reply, "Requires organization admin role or higher", 403);
      }
    };

  const requireSuperAdmin = () =>
    async (request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply | void> => {
      const actorId = request.session.actorId;
      if (!actorId) return deny(reply, "Unauthenticated", 401);
      const user = await loadUser(repo, actorId);
      if (!isSuperAdminUser(user)) return deny(reply, "Requires super admin", 403);
    };

  return { requireRole, requireSpaceAccess, requireOrgAccess, requireOrgAdmin, requireSuperAdmin };
}
