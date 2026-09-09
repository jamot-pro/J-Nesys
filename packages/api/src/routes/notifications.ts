import type { FastifyInstance } from "fastify";
import type { JamotRepository } from "../repository.js";
import { requireAuth } from "../rbac.js";

export default async function notificationsRoutes(
  app: FastifyInstance,
  opts: { repository: JamotRepository },
): Promise<void> {
  const { repository } = opts;

  // GET /api/notifications?spaceId=... — list all notifications for the user/space
  app.get("/notifications", { preHandler: requireAuth }, async (request) => {
    const query = request.query as { spaceId?: string };
    const actorId = request.session.actorId!;

    // Stub: return empty array for now. Real implementation would join
    // tasks, messages, approvals etc. into a unified feed.
    // When tasks exist, we can surface unassigned or recently-updated ones.
    if (query.spaceId) {
      try {
        const tasks = await repository.listTasks({
          spaceId: query.spaceId,
        });
        // Convert uncompleted recent tasks into notification-like items
        const items = tasks
          .filter((t) => t.status !== "completed" && t.status !== "cancelled")
          .slice(0, 20)
          .map((t) => ({
            id: `task-${t.id}`,
            type: "message" as const,
            title: t.title || "Untitled Task",
            summary: t.description || "",
            read: false,
            createdAt: t.createdAt,
          }));
        return { items };
      } catch {
        return { items: [] };
      }
    }

    return { items: [] };
  });

  // PUT /api/notifications/:id/read — mark a single notification as read
  app.put("/notifications/:id/read", { preHandler: requireAuth }, async (request, reply) => {
    return { status: "ok" };
  });

  // PUT /api/notifications/read-all — mark all notifications as read
  app.put("/notifications/read-all", { preHandler: requireAuth }, async (_request, reply) => {
    return { status: "ok" };
  });
}
