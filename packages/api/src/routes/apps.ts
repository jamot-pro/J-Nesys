import type { FastifyInstance } from "fastify";
import type { AppRegistry } from "@jamot/core/apps";
import { requireAuth } from "../rbac.js";

export default async function appsRoutes(
  app: FastifyInstance,
  opts: { apps: AppRegistry },
): Promise<void> {
  const { apps } = opts;

  app.get("/apps", { preHandler: requireAuth }, async () => {
    return { items: apps.list() };
  });

  app.get("/apps/:id", { preHandler: requireAuth }, async (request, reply) => {
    const params = request.params as { id?: string };
    const manifest = params.id ? apps.get(params.id) : null;
    if (!manifest) return reply.code(404).send({ error: "app not found" });
    return manifest;
  });
}
