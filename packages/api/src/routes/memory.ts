import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { Id } from "@jamot/contracts";
import type { Provenance } from "@jamot/contracts";
import type { MemoryProvider } from "@jamot/core/memory";
import { requireAuth } from "../rbac.js";
import { fail, parse } from "../util.js";

export interface MemoryRoutesOptions {
  memoryProvider: MemoryProvider;
}

const Scope = z.enum(["person", "agent", "relationship", "organization"]);

const ProvenanceInput = z.object({
  source: z
    .enum([
      "self_declared",
      "assessment",
      "observed",
      "manager_feedback",
      "inferred",
      "system",
    ])
    .optional(),
  confidence: z.number().min(0).max(1).optional(),
});

const CreateMemoryBody = z.object({
  scope: Scope,
  ownerId: Id,
  content: z.record(z.string(), z.unknown()),
  provenance: ProvenanceInput.optional(),
});

function buildProvenance(
  input: z.infer<typeof ProvenanceInput> | undefined,
): Provenance {
  const ts = new Date().toISOString();
  return {
    source: input?.source ?? "self_declared",
    confidence: input?.confidence ?? 0.5,
    createdAt: ts,
    updatedAt: ts,
  };
}

export default async function memoryRoutes(
  app: FastifyInstance,
  opts: MemoryRoutesOptions,
): Promise<void> {
  const { memoryProvider } = opts;

  app.post("/memory", { preHandler: requireAuth }, async (request, reply) => {
    const body = parse(CreateMemoryBody, request.body, reply);
    if (!body) return;

    const entry = await memoryProvider.store({
      scope: body.scope,
      ownerId: body.ownerId,
      content: body.content,
      provenance: buildProvenance(body.provenance),
    });

    reply.code(201);
    return entry;
  });

  app.get("/memory", { preHandler: requireAuth }, async (request, reply) => {
    const query = request.query as { scope?: string; ownerId?: string };
    const scope = parse(Scope, query.scope, reply);
    if (!scope) return;
    const ownerId = parse(Id, query.ownerId, reply);
    if (!ownerId) return;
    return { items: await memoryProvider.list({ scope, ownerId }) };
  });

  app.get("/memory/:id", { preHandler: requireAuth }, async (request, reply) => {
    const params = request.params as { id?: string };
    const id = parse(Id, params.id, reply);
    if (!id) return;
    const entry = await memoryProvider.get(id);
    if (!entry) return fail(reply, 404, "memory not found");
    return entry;
  });

  const UpdateMemoryBody = z.object({
    content: z.record(z.string(), z.unknown()).optional(),
    provenance: ProvenanceInput.optional(),
  });

  app.patch("/memory/:id", { preHandler: requireAuth }, async (request, reply) => {
    const params = request.params as { id?: string };
    const id = parse(Id, params.id, reply);
    if (!id) return;
    const body = parse(UpdateMemoryBody, request.body, reply);
    if (!body) return;

    const existing = await memoryProvider.get(id);
    if (!existing) return fail(reply, 404, "memory not found");

    const patch: Partial<Pick<typeof existing, "content" | "provenance">> = {};
    if (body.content) patch.content = body.content;
    patch.provenance = {
      ...existing.provenance,
      ...(body.provenance?.source ? { source: body.provenance.source } : {}),
      ...(body.provenance?.confidence !== undefined
        ? { confidence: body.provenance.confidence }
        : {}),
      updatedAt: new Date().toISOString(),
    };

    const updated = await memoryProvider.update(id, patch);
    if (!updated) return fail(reply, 404, "memory not found");
    return updated;
  });

  app.delete(
    "/memory/:id",
    { preHandler: requireAuth },
    async (request, reply) => {
      const params = request.params as { id?: string };
      const id = parse(Id, params.id, reply);
      if (!id) return;
      await memoryProvider.forget(id);
      reply.code(204).send();
    },
  );
}
