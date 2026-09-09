import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { ConnectorProvider, ConnectorType, Id, SecretRef } from "@jamot/contracts";
import { requireAuth } from "../rbac.js";
import { fail, parse } from "../util.js";
import type { RoutesOptions } from "./types.js";

const ConnectBody = z.object({
  provider: ConnectorProvider,
  type: ConnectorType.optional(),
  ownerActorId: Id.nullable().optional(),
  ownerOrganizationId: Id.nullable().optional(),
  capabilities: z.array(z.string()).optional(),
  credentialRef: SecretRef,
  scopes: z.array(z.string()).optional(),
  configuration: z.record(z.string(), z.unknown()).optional(),
  secretPlaintext: z.string().min(1),
});

export default async function connectorsRoutes(
  app: FastifyInstance,
  opts: RoutesOptions,
): Promise<void> {
  const { repository, secretStore } = opts;

  app.post("/connectors", { preHandler: requireAuth }, async (request, reply) => {
    const body = parse(ConnectBody, request.body, reply);
    if (!body) return;

    const { secretPlaintext, ...connectorInput } = body;
    const { ref, scope } = connectorInput.credentialRef;
    await repository.putSecret({
      ref,
      scope,
      ownerActorId: connectorInput.ownerActorId ?? null,
      ownerOrganizationId: connectorInput.ownerOrganizationId ?? null,
      ciphertext: secretStore.encrypt(secretPlaintext),
    });

    const connector = await repository.createConnector({
      ...connectorInput,
      status: "connected",
    });

    reply.code(201);
    return connector;
  });

  app.get("/connectors", { preHandler: requireAuth }, async (request, reply) => {
    const query = request.query as { ownerOrganizationId?: string };
    if (query.ownerOrganizationId) {
      const ownerOrganizationId = parse(Id, query.ownerOrganizationId, reply);
      if (!ownerOrganizationId) return;
      return { items: await repository.listConnectors({ ownerOrganizationId }) };
    }
    return { items: await repository.listConnectors() };
  });

  app.get("/connectors/:id", { preHandler: requireAuth }, async (request, reply) => {
    const params = request.params as { id?: string };
    const id = parse(Id, params.id, reply);
    if (!id) return;
    const connector = await repository.getConnector(id);
    if (!connector) return fail(reply, 404, "connector not found");
    return connector;
  });

  const ConnectorPatch = z.object({
    status: z.enum(["connected", "disconnected", "error"]).optional(),
    configuration: z.record(z.string(), z.unknown()).optional(),
  });

  app.patch("/connectors/:id", { preHandler: requireAuth }, async (request, reply) => {
    const params = request.params as { id?: string };
    const id = parse(Id, params.id, reply);
    if (!id) return;
    const patch = parse(ConnectorPatch, request.body, reply);
    if (!patch) return;
    const updated = await repository.updateConnector(id, patch);
    if (!updated) return fail(reply, 404, "connector not found");
    return updated;
  });

  app.delete("/connectors/:id", { preHandler: requireAuth }, async (request, reply) => {
    const params = request.params as { id?: string };
    const id = parse(Id, params.id, reply);
    if (!id) return;
    const connector = await repository.getConnector(id);
    if (!connector) return fail(reply, 404, "connector not found");
    await repository.deleteSecret(connector.credentialRef.ref);
    await repository.deleteConnector(id);
    reply.code(204).send();
  });
}
