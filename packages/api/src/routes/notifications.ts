import type { FastifyInstance } from "fastify";
import type { Id } from "@jamot/contracts";
import type { JamotRepository } from "../repository.js";
import { requireAuth, resolveSpaceIdForActor } from "../rbac.js";
import { fail } from "../util.js";

export default async function notificationsRoutes(
  app: FastifyInstance,
  opts: { repository: JamotRepository },
): Promise<void> {
  const { repository } = opts;

  // GET /api/notifications?spaceId=... — the authenticated actor's own notifications
  app.get("/notifications", { preHandler: requireAuth }, async (request) => {
    const query = request.query as { spaceId?: string };
    const actorId = request.session.actorId!;
    // This route guards with requireAuth only, so nothing has resolved the
    // "personal" alias for it — passing it straight through made Postgres
    // reject the query with `invalid input syntax for type uuid: "personal"`.
    const spaceId = query.spaceId
      ? ((await resolveSpaceIdForActor(repository, actorId as Id, query.spaceId as Id)) ?? undefined)
      : undefined;
    const items = await repository.listNotifications({
      actorId,
      spaceId,
    });
    return { items };
  });

  // PUT /api/notifications/:id/read — mark a single notification as read
  app.put("/notifications/:id/read", { preHandler: requireAuth }, async (request, reply) => {
    const params = request.params as { id?: string };
    if (!params.id) return fail(reply, 400, "missing id");
    const actorId = request.session.actorId!;
    const updated = await repository.markNotificationRead(params.id, actorId);
    if (!updated) return fail(reply, 404, "notification not found");
    return { status: "ok" };
  });

  // PUT /api/notifications/read-all — mark all of the actor's notifications as read
  app.put("/notifications/read-all", { preHandler: requireAuth }, async (request) => {
    const query = request.query as { spaceId?: string };
    const actorId = request.session.actorId!;
    // Same "personal" alias as the listing route: without resolving it here,
    // Postgres rejects the query on a spaceId that is not a uuid.
    const spaceId = query.spaceId
      ? ((await resolveSpaceIdForActor(repository, actorId as Id, query.spaceId as Id)) ?? undefined)
      : undefined;
    await repository.markAllNotificationsRead({ actorId, spaceId });
    return { status: "ok" };
  });
}
