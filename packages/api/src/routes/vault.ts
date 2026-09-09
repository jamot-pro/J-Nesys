import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { ConnectorProvider, ConnectorType, Id } from "@jamot/contracts";
import type { JamotRepository } from "../repository.js";
import { requireAuth, actorRoleInSpace, ROLE_WEIGHT, loadUser, isSuperAdminUser } from "../rbac.js";
import { fail, parse } from "../util.js";
import type { RoutesOptions } from "./types.js";

const AddConnectionBody = z.object({
  provider: ConnectorProvider,
  type: ConnectorType.optional(),
  ref: z.string().min(1),
  scope: z.enum(["user", "organization", "system", "environment"]).optional(),
  ownerActorId: Id.nullable().optional(),
  ownerOrganizationId: Id.nullable().optional(),
  capabilities: z.array(z.string()).optional(),
  scopes: z.array(z.string()).optional(),
  configuration: z.record(z.string(), z.unknown()).optional(),
  secretPlaintext: z.string().min(1),
});

export default async function vaultRoutes(
  app: FastifyInstance,
  opts: RoutesOptions,
): Promise<void> {
  const { repository, secretStore } = opts;
  const repo = repository as unknown as JamotRepository;

  app.get("/vault", { preHandler: requireAuth }, async () => {
    const connectors = await repository.listConnectors();
    const secretRefs = [
      ...new Map(
        connectors.map((c) => [
          c.credentialRef.ref,
          { ref: c.credentialRef.ref, scope: c.credentialRef.scope },
        ]),
      ).values(),
    ];
    return { connectors, secretRefs };
  });

  app.post("/vault/connections", { preHandler: requireAuth }, async (request, reply) => {
    const body = parse(AddConnectionBody, request.body, reply);
    if (!body) return;

    const actorId = request.session.actorId!;
    const effectiveScope = body.scope ?? "system";

    let ownerActorId: string | null = body.ownerActorId ?? null;
    let ownerOrganizationId: string | null = body.ownerOrganizationId ?? null;

    if (effectiveScope === "user") {
      if (ownerActorId && ownerActorId !== actorId) {
        return fail(reply, 403, "Cannot store secrets for another user.");
      }
      ownerActorId = actorId;
      ownerOrganizationId = null;
    } else if (effectiveScope === "organization") {
      if (!ownerOrganizationId) {
        return fail(reply, 400, "ownerOrganizationId is required for organization scope.");
      }
      const org = await repo.getOrganization(ownerOrganizationId as Id);
      if (!org) return fail(reply, 404, "organization not found");
      const user = await loadUser(repo, actorId);
      if (!isSuperAdminUser(user)) {
        const role = await actorRoleInSpace(repo, actorId as Id, org.spaceId as Id);
        if (!role || ROLE_WEIGHT[role] < ROLE_WEIGHT.admin) {
          return fail(reply, 403, "Requires organization admin role or higher.");
        }
      }
      ownerActorId = null;
    } else {
      const user = await loadUser(repo, actorId);
      if (!isSuperAdminUser(user)) {
        return fail(reply, 403, "Requires super admin.");
      }
    }

    const scope = effectiveScope;
    await repository.putSecret({
      ref: body.ref,
      scope,
      ownerActorId,
      ownerOrganizationId,
      ciphertext: secretStore.encrypt(body.secretPlaintext),
    });

    const connector = await repository.createConnector({
      provider: body.provider,
      type: body.type ?? "channel",
      ownerActorId,
      ownerOrganizationId,
      capabilities: body.capabilities ?? [],
      credentialRef: { ref: body.ref, scope },
      scopes: body.scopes ?? [],
      configuration: body.configuration ?? {},
      status: "connected",
    });

    reply.code(201);
    return connector;
  });

  app.delete("/vault/connections/:ref", { preHandler: requireAuth }, async (request, reply) => {
    const params = request.params as { ref?: string };
    const ref = parse(z.string().min(1), params.ref, reply);
    if (!ref) return;
    // Remove the connector that owns this credential too, so deleting a
    // secret never leaves an orphaned connector row behind.
    const connectors = await repository.listConnectors();
    for (const connector of connectors) {
      if (connector.credentialRef.ref === ref) {
        await repository.deleteConnector(connector.id);
      }
    }
    await repository.deleteSecret(ref);
    return { status: "ok" };
  });
}
