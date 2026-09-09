import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { Id } from "@jamot/contracts";
import type { Provenance, Skill } from "@jamot/contracts";
import { requireAuth, ROLE_WEIGHT } from "../rbac.js";
import { fail, parse } from "../util.js";
import type { RoleKind } from "../repository.js";
import type { RoutesOptions, VaultRepository } from "./types.js";

/** Owner of a personal skill, super admin, or admin of the owning org. */
async function canManageSkill(
  repo: VaultRepository,
  actorId: string,
  skill: Skill,
): Promise<boolean> {
  if (skill.ownerActorId && skill.ownerActorId === actorId) return true;
  const user = await repo.findUserByActor(actorId);
  if (user?.isSuperAdmin) return true;
  if (skill.ownerOrganizationId) {
    const org = await repo.getOrganization(skill.ownerOrganizationId);
    if (org?.spaceId) {
      const roles = await repo.listRolesForActor(actorId);
      const inSpace = roles.filter((r) => r.spaceId === org.spaceId);
      const weight = inSpace.reduce(
        (max, r) => Math.max(max, ROLE_WEIGHT[r.kind as RoleKind] ?? 0),
        0,
      );
      if (weight >= ROLE_WEIGHT.admin) return true;
    }
  }
  return false;
}

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

const CreateSkillBody = z.object({
  ownerActorId: Id.nullable().optional(),
  ownerOrganizationId: Id.nullable().optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  body: z.string().optional(),
  version: z.string().optional(),
  inputs: z.record(z.string(), z.unknown()).optional(),
  outputs: z.record(z.string(), z.unknown()).optional(),
  prerequisites: z.array(Id).optional(),
  allowedCapabilityIds: z.array(Id).optional(),
  evaluationCriteria: z.array(z.string()).optional(),
  provenance: ProvenanceInput.optional(),
  status: z.enum(["draft", "validated", "deprecated"]).optional(),
});

const UpdateSkillBody = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  body: z.string().optional(),
  version: z.string().optional(),
  inputs: z.record(z.string(), z.unknown()).optional(),
  outputs: z.record(z.string(), z.unknown()).optional(),
  prerequisites: z.array(Id).optional(),
  allowedCapabilityIds: z.array(Id).optional(),
  evaluationCriteria: z.array(z.string()).optional(),
  status: z.enum(["draft", "validated", "deprecated"]).optional(),
});

function buildProvenance(input: z.infer<typeof ProvenanceInput> | undefined): Provenance {
  const ts = new Date().toISOString();
  return {
    source: input?.source ?? "self_declared",
    confidence: input?.confidence ?? 0.5,
    createdAt: ts,
    updatedAt: ts,
  };
}

export default async function skillsRoutes(
  app: FastifyInstance,
  opts: RoutesOptions,
): Promise<void> {
  const { repository } = opts;

  app.post("/skills", { preHandler: requireAuth }, async (request, reply) => {
    const body = parse(CreateSkillBody, request.body, reply);
    if (!body) return;

    const actorId = request.session.actorId!;
    const skill = await repository.createSkill({
      ownerActorId: body.ownerActorId ?? (body.ownerOrganizationId ? null : actorId),
      ownerOrganizationId: body.ownerOrganizationId ?? null,
      name: body.name,
      description: body.description,
      body: body.body,
      version: body.version,
      inputs: body.inputs,
      outputs: body.outputs,
      prerequisites: body.prerequisites,
      allowedCapabilityIds: body.allowedCapabilityIds,
      evaluationCriteria: body.evaluationCriteria,
      provenance: buildProvenance(body.provenance),
      status: body.status,
    });

    await repository.recordEvent({
      type: "skill.created",
      actorId: actorId,
      payload: { skillId: skill.id, name: skill.name },
    });

    reply.code(201);
    return skill;
  });

  app.get("/skills", { preHandler: requireAuth }, async (request, reply) => {
    const query = request.query as { ownerOrganizationId?: string };
    if (query.ownerOrganizationId) {
      const ownerOrganizationId = parse(Id, query.ownerOrganizationId, reply);
      if (!ownerOrganizationId) return;
      return { items: await repository.listSkills({ ownerOrganizationId }) };
    }
    return { items: await repository.listSkills() };
  });

  app.get("/skills/:id", { preHandler: requireAuth }, async (request, reply) => {
    const params = request.params as { id?: string };
    const id = parse(Id, params.id, reply);
    if (!id) return;
    const skill = await repository.getSkill(id);
    if (!skill) return fail(reply, 404, "skill not found");
    return skill;
  });

  app.patch("/skills/:id", { preHandler: requireAuth }, async (request, reply) => {
    const params = request.params as { id?: string };
    const id = parse(Id, params.id, reply);
    if (!id) return;
    const body = parse(UpdateSkillBody, request.body, reply);
    if (!body) return;

    const skill = await repository.getSkill(id);
    if (!skill) return fail(reply, 404, "skill not found");

    const actorId = request.session.actorId!;
    if (!(await canManageSkill(repository, actorId, skill))) {
      return fail(reply, 403, "no permission to edit this skill");
    }

    const updated = await repository.updateSkill(id, body);
    if (!updated) return fail(reply, 404, "skill not found");

    await repository.recordEvent({
      type: "skill.updated",
      actorId,
      payload: { skillId: id, name: updated.name },
    });

    return updated;
  });

  app.delete("/skills/:id", { preHandler: requireAuth }, async (request, reply) => {
    const params = request.params as { id?: string };
    const id = parse(Id, params.id, reply);
    if (!id) return;

    const skill = await repository.getSkill(id);
    if (!skill) return fail(reply, 404, "skill not found");

    const actorId = request.session.actorId!;
    if (!(await canManageSkill(repository, actorId, skill))) {
      return fail(reply, 403, "no permission to delete this skill");
    }

    await repository.deleteSkill(id);
    reply.code(204).send();
  });
}
