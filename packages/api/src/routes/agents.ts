import { z } from "zod";
import type { FastifyInstance } from "fastify";
import {
  AutonomyLevel,
  CreateRelationshipBody,
  Harness,
  Heartbeat,
  Id,
  UpdateAgentBody,
  type Agent,
} from "@jamot/contracts";
import type { JamotRepository } from "../repository.js";
import {
  assertSafeMcpUrl,
  createMcpClient,
  importExternalAgent,
} from "@jamot/core/mcp";
import {
  actorRoleInSpace,
  deny,
  isSuperAdminUser,
  loadUser,
  requireAuth,
} from "../rbac.js";
import { fail, parse } from "../util.js";

export interface AgentsRoutesOptions {
  repository: JamotRepository;
}

const CreateAgentBody = z.object({
  name: z.string().min(1),
  ownerId: Id.optional(),
  harness: Harness,
  autonomy: AutonomyLevel.optional(),
  role: z.string().nullable().optional(),
  purpose: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  organizationIds: z.array(Id).optional(),
  skillIds: z.array(Id).optional(),
  capabilityIds: z.array(Id).optional(),
  connectorIds: z.array(Id).optional(),
  heartbeat: Heartbeat.optional(),
  memoryScopes: z.array(z.string()).optional(),
  subscribedEvents: z.array(z.string()).optional(),
  schedules: z
    .array(
      z.object({
        id: Id,
        enabled: z.boolean().default(true),
        cron: z.string().min(1),
        prompt: z.string().min(1),
      }),
    )
    .optional(),
  actionPermissions: z.record(z.string(), z.enum(["automatic", "approval", "never"])).optional(),
  availability: z.enum(["available", "busy", "offline"]).optional(),
  systemPrompt: z.string().nullable().optional(),
  model: z.string().nullable().optional(),
});

const ImportMcpBody = z.object({
  name: z.string().min(1),
  mcpUrl: z.string().url(),
});

/** Whether an authenticated actor may manage (edit/delete) an agent. */
async function canManageAgent(
  repo: JamotRepository,
  actorId: string,
  agent: Agent,
): Promise<boolean> {
  if (agent.ownerId === actorId) return true;
  const user = await loadUser(repo, actorId);
  if (isSuperAdminUser(user)) return true;
  for (const orgId of agent.organizationIds) {
    const org = await repo.getOrganization(orgId);
    if (!org?.spaceId) continue;
    const role = await actorRoleInSpace(repo, actorId as Id, org.spaceId);
    if (role === "admin" || role === "owner") return true;
  }
  return false;
}

/** Best-effort space id for an agent (first org space), used for event scoping. */
async function agentSpaceId(
  repo: JamotRepository,
  agent: Agent,
): Promise<string | null> {
  for (const orgId of agent.organizationIds) {
    const org = await repo.getOrganization(orgId);
    if (org?.spaceId) return org.spaceId;
  }
  return null;
}

export default async function agentsRoutes(
  app: FastifyInstance,
  opts: AgentsRoutesOptions,
): Promise<void> {
  const { repository } = opts;

  app.post("/agents", { preHandler: requireAuth }, async (request, reply) => {
    const body = parse(CreateAgentBody, request.body, reply);
    if (!body) return;

    const ownerId = request.session.actorId;
    if (!ownerId) return fail(reply, 401, "Unauthenticated");

    const actor = await repository.createActor({
      type: "agent",
      source: "internal",
      displayName: body.name,
    });

    const agent = await repository.createAgent({
      actorId: actor.id,
      ownerId,
      role: body.role ?? null,
      purpose: body.purpose ?? null,
      description: body.description ?? null,
      organizationIds: body.organizationIds ?? [],
      harness: body.harness,
      skillIds: body.skillIds ?? [],
      capabilityIds: body.capabilityIds ?? [],
      connectorIds: body.connectorIds ?? [],
      autonomy: body.autonomy ?? "approve",
      heartbeat: body.heartbeat,
      availability: body.availability ?? "available",
      memoryScopes: body.memoryScopes ?? [],
      subscribedEvents: body.subscribedEvents ?? [],
      schedules: body.schedules ?? [],
      actionPermissions: body.actionPermissions ?? {},
      systemPrompt: body.systemPrompt ?? null,
      model: body.model ?? null,
    });

    await repository.recordEvent({
      type: "agent.created",
      actorId: actor.id,
      spaceId: await agentSpaceId(repository, agent),
      payload: { agentId: agent.id, name: body.name },
    });

    reply.code(201);
    return agent;
  });

  app.get("/agents", { preHandler: requireAuth }, async () => {
    return { items: await repository.listAgents() };
  });

  app.get("/agents/:id", { preHandler: requireAuth }, async (request, reply) => {
    const params = request.params as { id?: string };
    const id = parse(Id, params.id, reply);
    if (!id) return;
    const agent = await repository.getAgent(id);
    if (!agent) return fail(reply, 404, "agent not found");
    return agent;
  });

  app.patch("/agents/:id", { preHandler: requireAuth }, async (request, reply) => {
    const params = request.params as { id?: string };
    const id = parse(Id, params.id, reply);
    if (!id) return;
    const body = parse(UpdateAgentBody, request.body, reply);
    if (!body) return;

    const actorId = request.session.actorId;
    if (!actorId) return fail(reply, 401, "Unauthenticated");

    const agent = await repository.getAgent(id);
    if (!agent) return fail(reply, 404, "agent not found");
    if (!(await canManageAgent(repository, actorId, agent))) {
      return deny(reply, "You cannot modify this agent");
    }

    const updated = await repository.updateAgent(id, body);
    if (!updated) return fail(reply, 404, "agent not found");

    await repository.recordEvent({
      type: "agent.updated",
      actorId: agent.actorId,
      spaceId: await agentSpaceId(repository, agent),
      payload: { agentId: id, changed: Object.keys(body) },
    });

    return updated;
  });

  app.delete("/agents/:id", { preHandler: requireAuth }, async (request, reply) => {
    const params = request.params as { id?: string };
    const id = parse(Id, params.id, reply);
    if (!id) return;

    const actorId = request.session.actorId;
    if (!actorId) return fail(reply, 401, "Unauthenticated");

    const agent = await repository.getAgent(id);
    if (!agent) return fail(reply, 404, "agent not found");
    if (!(await canManageAgent(repository, actorId, agent))) {
      return deny(reply, "You cannot delete this agent");
    }

    await repository.deleteAgent(id);
    await repository.updateActor(agent.actorId, { status: "inactive" });

    await repository.recordEvent({
      type: "agent.deleted",
      actorId: agent.actorId,
      spaceId: await agentSpaceId(repository, agent),
      payload: { agentId: id },
    });

    reply.code(204).send();
  });

  app.get("/agents/:id/activity", { preHandler: requireAuth }, async (request, reply) => {
    const params = request.params as { id?: string };
    const id = parse(Id, params.id, reply);
    if (!id) return;
    const agent = await repository.getAgent(id);
    if (!agent) return fail(reply, 404, "agent not found");
    return { items: await repository.listEvents({ actorId: agent.actorId, limit: 50 }) };
  });

  app.get("/agents/:id/relationships", { preHandler: requireAuth }, async (request, reply) => {
    const params = request.params as { id?: string };
    const id = parse(Id, params.id, reply);
    if (!id) return;
    const agent = await repository.getAgent(id);
    if (!agent) return fail(reply, 404, "agent not found");

    const relationships = await repository.listRelationshipsForActor(agent.actorId);
    const actors = new Map(
      (await repository.listActors()).map((a) => [a.id, a]),
    );
    const items = relationships.map((rel) => ({
      ...rel,
      from: actors.get(rel.fromActorId)
        ? { id: rel.fromActorId, displayName: actors.get(rel.fromActorId)!.displayName, type: actors.get(rel.fromActorId)!.type }
        : null,
      to: actors.get(rel.toActorId)
        ? { id: rel.toActorId, displayName: actors.get(rel.toActorId)!.displayName, type: actors.get(rel.toActorId)!.type }
        : null,
    }));

    return { items };
  });

  app.post("/agents/:id/relationships", { preHandler: requireAuth }, async (request, reply) => {
    const params = request.params as { id?: string };
    const id = parse(Id, params.id, reply);
    if (!id) return;
    const body = parse(CreateRelationshipBody, request.body, reply);
    if (!body) return;

    const actorId = request.session.actorId;
    if (!actorId) return fail(reply, 401, "Unauthenticated");

    const agent = await repository.getAgent(id);
    if (!agent) return fail(reply, 404, "agent not found");
    if (!(await canManageAgent(repository, actorId, agent))) {
      return deny(reply, "You cannot modify this agent");
    }

    const relationship = await repository.createRelationship({
      fromActorId: body.fromActorId,
      toActorId: body.toActorId,
      kind: body.kind,
    });

    await repository.recordEvent({
      type: "relationship.created",
      actorId: agent.actorId,
      spaceId: await agentSpaceId(repository, agent),
      payload: { relationshipId: relationship.id, kind: body.kind, toActorId: body.toActorId },
    });

    reply.code(201);
    return relationship;
  });

  app.delete("/agents/:id/relationships/:relationshipId", { preHandler: requireAuth }, async (request, reply) => {
    const params = request.params as { id?: string; relationshipId?: string };
    const id = parse(Id, params.id, reply);
    if (!id) return;
    const relationshipId = parse(Id, params.relationshipId, reply);
    if (!relationshipId) return;

    const actorId = request.session.actorId;
    if (!actorId) return fail(reply, 401, "Unauthenticated");

    const agent = await repository.getAgent(id);
    if (!agent) return fail(reply, 404, "agent not found");
    if (!(await canManageAgent(repository, actorId, agent))) {
      return deny(reply, "You cannot modify this agent");
    }

    await repository.deleteRelationship(relationshipId);

    await repository.recordEvent({
      type: "relationship.deleted",
      actorId: agent.actorId,
      spaceId: await agentSpaceId(repository, agent),
      payload: { relationshipId },
    });

    reply.code(204).send();
  });

  app.post(
    "/agents/import-mcp",
    { preHandler: requireAuth },
    async (request, reply) => {
      const body = parse(ImportMcpBody, request.body, reply);
      if (!body) return;

      const ownerId = request.session.actorId;
      if (!ownerId) return fail(reply, 401, "Unauthenticated");

      try {
        assertSafeMcpUrl(body.mcpUrl);
      } catch (err) {
        return fail(reply, 400, err instanceof Error ? err.message : "invalid mcp url");
      }

      const client = createMcpClient(body.mcpUrl);
      const agent = await importExternalAgent({
        repo: repository,
        client,
        name: body.name,
        mcpUrl: body.mcpUrl,
        ownerId,
      });

      reply.code(201);
      return agent;
    },
  );
}