import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { Id } from "@jamot/contracts";
import type { JamotRepository } from "../repository.js";
import { createRbac, requireAuth } from "../rbac.js";
import { fail, parse } from "../util.js";

const CreateListBody = z.object({
  spaceId: Id,
  name: z.string().min(1),
  position: z.number().int().min(0).optional(),
});

const UpdateListBody = z.object({
  name: z.string().min(1).optional(),
  position: z.number().int().min(0).optional(),
});

export default async function taskListsRoutes(
  app: FastifyInstance,
  opts: { repository: JamotRepository },
): Promise<void> {
  const { repository } = opts;
  const { requireSpaceAccess } = createRbac(repository);

  app.post(
    "/task-lists",
    { preHandler: requireSpaceAccess("spaceId") },
    async (request, reply) => {
      const body = parse(CreateListBody, request.body, reply);
      if (!body) return;
      const list = await repository.createTaskList({
        spaceId: body.spaceId,
        name: body.name,
        position: body.position,
      });
      reply.code(201);
      return list;
    },
  );

  app.get("/task-lists", { preHandler: requireAuth }, async (request, reply) => {
    const query = request.query as { spaceId?: string };
    const spaceId = parse(Id, query.spaceId, reply);
    if (!spaceId) return;
    return { items: await repository.listTaskLists(spaceId) };
  });

  app.patch(
    "/task-lists/:id",
    { preHandler: requireAuth },
    async (request, reply) => {
      const params = request.params as { id?: string };
      const id = parse(Id, params.id, reply);
      if (!id) return;
      const body = parse(UpdateListBody, request.body, reply);
      if (!body) return;
      const list = await repository.updateTaskList(id, body);
      if (!list) return fail(reply, 404, "list not found");
      return list;
    },
  );

  app.delete(
    "/task-lists/:id",
    { preHandler: requireAuth },
    async (request, reply) => {
      const params = request.params as { id?: string };
      const id = parse(Id, params.id, reply);
      if (!id) return;
      await repository.deleteTaskList(id);
      reply.code(204).send();
    },
  );
}
