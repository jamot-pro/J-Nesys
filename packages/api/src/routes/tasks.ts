import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { Id } from "@jamot/contracts";
import type { JamotRepository } from "../repository.js";
import { createRbac, requireAuth } from "../rbac.js";
import { fail, parse } from "../util.js";

const CreateTaskBody = z.object({
  spaceId: Id,
  title: z.string().min(1),
  description: z.string().optional(),
  projectId: Id.nullable().optional(),
  listId: Id.nullable().optional(),
  assigneeActorIds: z.array(Id).optional(),
  targetType: z
    .enum(["human", "agent", "human_agent", "organization", "external"])
    .optional(),
  dueDate: z.string().datetime({ offset: true }).nullable().optional(),
  position: z.number().int().min(0).optional(),
});

const UpdateTaskStatusBody = z.object({
  status: z.enum(["created", "assigned", "started", "completed", "cancelled"]),
});

const UpdateTaskBody = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  dueDate: z.string().datetime({ offset: true }).nullable().optional(),
  listId: Id.nullable().optional(),
  position: z.number().int().min(0).optional(),
  assigneeActorIds: z.array(Id).optional(),
  targetType: z
    .enum(["human", "agent", "human_agent", "organization", "external"])
    .optional(),
});

const AddAttachmentBody = z.object({
  name: z.string().min(1),
  mimeType: z.string().optional(),
  size: z.number().int().min(0).optional(),
  data: z.string().min(1),
});

export function tasksRoutes(repo: JamotRepository) {
  const { requireSpaceAccess } = createRbac(repo);

  return async function (app: FastifyInstance): Promise<void> {
    app.post("/tasks", { preHandler: requireSpaceAccess("spaceId") }, async (request, reply) => {
      const body = parse(CreateTaskBody, request.body, reply);
      if (!body) return;

      const task = await repo.createTask({
        spaceId: body.spaceId,
        title: body.title,
        description: body.description,
        projectId: body.projectId ?? null,
        listId: body.listId ?? null,
        assigneeActorIds: body.assigneeActorIds ?? [],
        targetType: body.targetType,
        dueDate: body.dueDate ?? null,
        position: body.position ?? 0,
      });

      reply.code(201);
      return task;
    });

    app.get("/tasks", { preHandler: requireAuth }, async (request, reply) => {
      const query = request.query as {
        spaceId?: string;
        listId?: string;
        assigneeActorId?: string;
      };
      if (query.spaceId || query.listId || query.assigneeActorId) {
        const filter: {
          spaceId?: string;
          listId?: string;
          assigneeActorId?: string;
        } = {};
        if (query.spaceId) {
          const spaceId = parse(Id, query.spaceId, reply);
          if (!spaceId) return;
          filter.spaceId = spaceId;
        }
        if (query.listId) {
          const listId = parse(Id, query.listId, reply);
          if (!listId) return;
          filter.listId = listId;
        }
        if (query.assigneeActorId) {
          const assigneeActorId = parse(Id, query.assigneeActorId, reply);
          if (!assigneeActorId) return;
          filter.assigneeActorId = assigneeActorId;
        }
        return { items: await repo.listTasks(filter) };
      }
      return { items: await repo.listTasks() };
    });

    app.get("/tasks/:id", { preHandler: requireAuth }, async (request, reply) => {
      const params = request.params as { id?: string };
      const id = parse(Id, params.id, reply);
      if (!id) return;
      const task = await repo.getTask(id);
      if (!task) return fail(reply, 404, "task not found");
      return task;
    });

    app.patch("/tasks/:id", { preHandler: requireAuth }, async (request, reply) => {
      const params = request.params as { id?: string };
      const id = parse(Id, params.id, reply);
      if (!id) return;
      const body = parse(UpdateTaskBody, request.body, reply);
      if (!body) return;

      const updated = await repo.updateTask(id, body);
      if (!updated) return fail(reply, 404, "task not found");
      return updated;
    });

    app.patch("/tasks/:id/status", { preHandler: requireAuth }, async (request, reply) => {
      const params = request.params as { id?: string };
      const id = parse(Id, params.id, reply);
      if (!id) return;
      const body = parse(UpdateTaskStatusBody, request.body, reply);
      if (!body) return;

      const task = await repo.getTask(id);
      if (!task) return fail(reply, 404, "task not found");

      const actorId = request.session.actorId!;
      const roles = await repo.listRolesForActor(actorId);
      const space = await repo.getSpace(task.spaceId);
      const ownsSpace = space && space.ownerActorId === actorId;
      const hasRole = roles.some((r) => r.spaceId === task.spaceId);
      if (!ownsSpace && !hasRole) return fail(reply, 403, "no access to task space");

      const updated = await repo.updateTaskStatus(id, body.status);
      if (!updated) return fail(reply, 404, "task not found");
      return updated;
    });

    app.post("/tasks/:id/attachments", { preHandler: requireAuth }, async (request, reply) => {
      const params = request.params as { id?: string };
      const id = parse(Id, params.id, reply);
      if (!id) return;
      const body = parse(AddAttachmentBody, request.body, reply);
      if (!body) return;

      const attachment = await repo.addTaskAttachment({
        taskId: id,
        name: body.name,
        mimeType: body.mimeType,
        size: body.size,
        data: body.data,
      });
      reply.code(201);
      return attachment;
    });

    app.get("/tasks/:id/attachments", { preHandler: requireAuth }, async (request, reply) => {
      const params = request.params as { id?: string };
      const id = parse(Id, params.id, reply);
      if (!id) return;
      return { items: await repo.listTaskAttachments(id) };
    });

    app.delete("/tasks/:id/attachments/:attachmentId", { preHandler: requireAuth }, async (request, reply) => {
      const params = request.params as { attachmentId?: string };
      const attachmentId = parse(Id, params.attachmentId, reply);
      if (!attachmentId) return;
      await repo.deleteTaskAttachment(attachmentId);
      reply.code(204).send();
    });
  };
}
