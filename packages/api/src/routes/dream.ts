import type { FastifyInstance } from "fastify";
import {
  CreateOrgEdge,
  CreateOrgNode,
  Id,
  OrgEdge,
  OrgGraph,
  OrgNode,
  UpdateDreamConfig,
} from "@jamot/contracts";
import type { OrgNode as OrgNodeType } from "@jamot/contracts";
import type { MemoryProvider } from "@jamot/core/memory";
import { computeReadiness } from "@jamot/core/dream";
import type { JamotRepository } from "../repository.js";
import { createRbac } from "../rbac.js";
import { fail, parse } from "../util.js";

export interface DreamRoutesOptions {
  memoryProvider: MemoryProvider;
}

const UpdateNodeBody = OrgNode.pick({ name: true }).partial().extend({
  config: OrgNode.shape.config.optional(),
  position: OrgNode.shape.position.optional(),
});

type OrgParams = { orgId?: string };
type NodeParams = { orgId?: string; nodeId?: string };
type EdgeParams = { orgId?: string; edgeId?: string };

export function dreamRoutes(
  repo: JamotRepository,
  opts: DreamRoutesOptions,
) {
  const writeOrgMemory = (
    organizationId: string,
    content: Record<string, unknown>,
  ): Promise<unknown> => {
    const ts = new Date().toISOString();
    return opts.memoryProvider.store({
      scope: "organization",
      ownerId: organizationId,
      content,
      provenance: {
        source: "system",
        confidence: 1,
        createdAt: ts,
        updatedAt: ts,
      },
    });
  };

  return async function (app: FastifyInstance): Promise<void> {
    const rbac = createRbac(repo);

    const loadGraph = async (organizationId: string): Promise<OrgGraph> =>
      OrgGraph.parse({
        nodes: await repo.listOrgNodes(organizationId),
        edges: await repo.listOrgEdges(organizationId),
      });

    const ensureDreamNode = async (
      organizationId: string,
    ): Promise<OrgNodeType> => {
      const nodes = await repo.listOrgNodes(organizationId);
      const existing = nodes.find((n) => n.kind === "dream");
      if (existing) return existing;
      const organization = await repo.getOrganization(organizationId);
      if (!organization) throw new Error("organization not found");
      const space = await repo.getSpace(organization.spaceId);
      const node = await repo.createOrgNode({
        organizationId,
        kind: "dream",
        name: `${space?.name ?? "Organization"} Dream`,
        config: { objective: organization.dream || "" },
      });
      await writeOrgMemory(organizationId, {
        type: "node.created",
        nodeId: node.id,
        kind: node.kind,
        name: node.name,
      });
      return node;
    };

    app.get(
      "/organizations/:orgId/graph",
      { preHandler: rbac.requireOrgAccess("orgId") },
      async (request, reply) => {
        const params = request.params as OrgParams;
        const orgId = parse(Id, params.orgId, reply);
        if (!orgId) return;
        await ensureDreamNode(orgId);
        return loadGraph(orgId);
      },
    );

    app.post(
      "/organizations/:orgId/graph/nodes",
      { preHandler: rbac.requireOrgAccess("orgId") },
      async (request, reply) => {
        const params = request.params as OrgParams;
        const orgId = parse(Id, params.orgId, reply);
        if (!orgId) return;
        const body = parse(CreateOrgNode, request.body, reply);
        if (!body) return;
        const node = await repo.createOrgNode({
          organizationId: orgId,
          kind: body.kind,
          name: body.name,
          refId: body.refId ?? null,
          config: body.config,
          position: body.position,
        });
        await writeOrgMemory(orgId, {
          type: "node.created",
          nodeId: node.id,
          kind: node.kind,
          name: node.name,
          byActorId: request.session.actorId,
        });
        reply.code(201);
        return node;
      },
    );

    app.patch(
      "/organizations/:orgId/graph/nodes/:nodeId",
      { preHandler: rbac.requireOrgAccess("orgId") },
      async (request, reply) => {
        const params = request.params as NodeParams;
        const orgId = parse(Id, params.orgId, reply);
        if (!orgId) return;
        const nodeId = parse(Id, params.nodeId, reply);
        if (!nodeId) return;
        const body = parse(UpdateNodeBody, request.body, reply);
        if (!body) return;
        const existing = await repo.getOrgNode(nodeId);
        if (!existing || existing.organizationId !== orgId) {
          return fail(reply, 404, "node not found");
        }
        const patch: {
          name?: string;
          config?: Record<string, unknown>;
          position?: { x: number; y: number };
        } = {};
        if (body.name !== undefined) patch.name = body.name;
        if (body.config !== undefined) patch.config = body.config;
        if (body.position !== undefined) patch.position = body.position;
        const node = await repo.updateOrgNode(nodeId, patch);
        if (!node) return fail(reply, 404, "node not found");
        await writeOrgMemory(orgId, {
          type: "node.updated",
          nodeId: node.id,
          kind: node.kind,
          byActorId: request.session.actorId,
        });
        return node;
      },
    );

    app.delete(
      "/organizations/:orgId/graph/nodes/:nodeId",
      { preHandler: rbac.requireOrgAdmin("orgId") },
      async (request, reply) => {
        const params = request.params as NodeParams;
        const orgId = parse(Id, params.orgId, reply);
        if (!orgId) return;
        const nodeId = parse(Id, params.nodeId, reply);
        if (!nodeId) return;
        const existing = await repo.getOrgNode(nodeId);
        if (!existing || existing.organizationId !== orgId) {
          return fail(reply, 404, "node not found");
        }
        await repo.deleteOrgNode(nodeId);
        await writeOrgMemory(orgId, {
          type: "node.deleted",
          nodeId,
          byActorId: request.session.actorId,
        });
        return { ok: true };
      },
    );

    app.post(
      "/organizations/:orgId/graph/edges",
      { preHandler: rbac.requireOrgAccess("orgId") },
      async (request, reply) => {
        const params = request.params as OrgParams;
        const orgId = parse(Id, params.orgId, reply);
        if (!orgId) return;
        const body = parse(CreateOrgEdge, request.body, reply);
        if (!body) return;
        const [from, to] = await Promise.all([
          repo.getOrgNode(body.fromNodeId),
          repo.getOrgNode(body.toNodeId),
        ]);
        if (!from || !to || from.organizationId !== orgId || to.organizationId !== orgId) {
          return fail(reply, 400, "both nodes must exist in this organization");
        }
        let edge: OrgEdge;
        try {
          edge = await repo.createOrgEdge({
            organizationId: orgId,
            fromNodeId: body.fromNodeId,
            toNodeId: body.toNodeId,
            relation: body.relation,
            metadata: body.metadata,
          });
        } catch {
          return fail(reply, 400, "both nodes must exist in this organization");
        }
        await writeOrgMemory(orgId, {
          type: "edge.created",
          edgeId: edge.id,
          fromNodeId: edge.fromNodeId,
          toNodeId: edge.toNodeId,
          relation: edge.relation,
          byActorId: request.session.actorId,
        });
        reply.code(201);
        return edge;
      },
    );

    app.delete(
      "/organizations/:orgId/graph/edges/:edgeId",
      { preHandler: rbac.requireOrgAdmin("orgId") },
      async (request, reply) => {
        const params = request.params as EdgeParams;
        const orgId = parse(Id, params.orgId, reply);
        if (!orgId) return;
        const edgeId = parse(Id, params.edgeId, reply);
        if (!edgeId) return;
        const edges = await repo.listOrgEdges(orgId);
        if (!edges.some((e) => e.id === edgeId)) {
          return fail(reply, 404, "edge not found");
        }
        await repo.deleteOrgEdge(edgeId);
        await writeOrgMemory(orgId, {
          type: "edge.deleted",
          edgeId,
          byActorId: request.session.actorId,
        });
        return { ok: true };
      },
    );

    app.put(
      "/organizations/:orgId/dream",
      { preHandler: rbac.requireOrgAdmin("orgId") },
      async (request, reply) => {
        const params = request.params as OrgParams;
        const orgId = parse(Id, params.orgId, reply);
        if (!orgId) return;
        const body = parse(UpdateDreamConfig, request.body, reply);
        if (!body) return;
        const node = await ensureDreamNode(orgId);
        const updated = await repo.updateOrgNode(node.id, {
          config: body as unknown as Record<string, unknown>,
        });
        if (!updated) return fail(reply, 404, "dream node not found");
        const dream = body;
        await writeOrgMemory(orgId, {
          type: "dream.configured",
          nodeId: updated.id,
          objective: dream.objective,
          byActorId: request.session.actorId,
        });
        const graph = await loadGraph(orgId);
        const readiness = computeReadiness(graph);
        await writeOrgMemory(orgId, {
          type: "readiness.changed",
          jamot: readiness.jamot,
          overall: readiness.overall,
        });
        return { node: updated, dream };
      },
    );

    app.get(
      "/organizations/:orgId/readiness",
      { preHandler: rbac.requireOrgAccess("orgId") },
      async (request, reply) => {
        const params = request.params as OrgParams;
        const orgId = parse(Id, params.orgId, reply);
        if (!orgId) return;
        await ensureDreamNode(orgId);
        return computeReadiness(await loadGraph(orgId));
      },
    );

    app.get(
      "/organizations/:orgId/jamot",
      { preHandler: rbac.requireOrgAccess("orgId") },
      async (request, reply) => {
        const params = request.params as OrgParams;
        const orgId = parse(Id, params.orgId, reply);
        if (!orgId) return;
        await ensureDreamNode(orgId);
        const readiness = computeReadiness(await loadGraph(orgId));
        return { jamot: readiness.jamot, overall: readiness.overall };
      },
    );
  };
}