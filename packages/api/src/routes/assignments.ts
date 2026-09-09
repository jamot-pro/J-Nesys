import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { Id } from "@jamot/contracts";
import type { JamotRepository } from "../repository.js";
import { createRoutingPipeline } from "@jamot/core/routing";
import type { LLMProvider } from "@jamot/core/llm";
import { createLLMProvider, resolveEnabledModel } from "@jamot/core/llm";
import type { SecretStoreLike } from "../app.js";
import { requireAuth } from "../rbac.js";
import { fail, parse } from "../util.js";

export interface AssignmentsRoutesOptions {
  repository: JamotRepository;
  llm: LLMProvider;
  secretStore: SecretStoreLike;
}

const RoutingIntentBody = z.object({
  spaceId: Id,
  message: z.string().min(1),
});

export default async function assignmentsRoutes(
  app: FastifyInstance,
  opts: AssignmentsRoutesOptions,
): Promise<void> {
  const { repository, llm, secretStore } = opts;

  const resolveModel = async (spaceId: string): Promise<LLMProvider | null> => {
    const org = await repository.getOrganizationBySpaceId(spaceId);
    const cfg = await resolveEnabledModel({
      repo: repository,
      store: secretStore,
      organizationId: org?.id ?? null,
    });
    if (!cfg) return null;
    try {
      return createLLMProvider(cfg.kind, {
        apiKey: cfg.apiKey,
        baseUrl: cfg.baseUrl,
        model: cfg.model,
      });
    } catch {
      return null;
    }
  };

  const pipeline = createRoutingPipeline({ repo: repository, llm, resolveModelConfig: resolveModel });

  app.post(
    "/tasks/:id/assign",
    { preHandler: requireAuth },
    async (request, reply) => {
      const params = request.params as { id?: string };
      const id = parse(Id, params.id, reply);
      if (!id) return;

      const task = await repository.getTask(id);
      if (!task) return fail(reply, 404, "task not found");

      const message = `${task.title} ${task.description}`.trim();
      const result = await pipeline.route({
        spaceId: task.spaceId,
        message,
      });

      if (!result.assignment) {
        return fail(
          reply,
          409,
          `no candidate eligible for assignment (${result.decision})`,
        );
      }

      const assigned = await repository.assignTask(id, [
        result.assignment.actorId,
      ]);
      if (!assigned) return fail(reply, 404, "task not found");
      await repository.updateTaskStatus(id, "assigned");
      return assigned;
    },
  );

  app.post(
    "/routing/intent",
    { preHandler: requireAuth },
    async (request, reply) => {
      const body = parse(RoutingIntentBody, request.body, reply);
      if (!body) return;
      return pipeline.route({ spaceId: body.spaceId, message: body.message });
    },
  );
}
