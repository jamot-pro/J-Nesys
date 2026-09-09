import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { ConnectorSharing, Id } from "@jamot/contracts";
import type { ComposioService } from "@jamot/core/composio";
import { COMPOSIO_KEY_REF } from "@jamot/core/composio";
import type { JamotRepository } from "../repository.js";
import { requireAuth } from "../rbac.js";
import { actorRoleInSpace, ROLE_WEIGHT } from "../rbac.js";
import { fail, parse } from "../util.js";

export interface ComposioRoutesOptions {
  repository: JamotRepository;
  composioService: ComposioService;
  secretStore: { encrypt(plaintext: string): string };
}

const ConnectBody = z.object({
  toolkit: z.string().min(1),
  sharing: ConnectorSharing.default("user"),
  organizationId: Id.nullable().optional(),
});

const SetKeyBody = z.object({
  apiKey: z.string().trim().min(1).max(500),
});

const ExecuteBody = z.object({
  connectorId: Id,
  tool: z.string().min(1),
  arguments: z.record(z.string(), z.unknown()).optional(),
});

function frontendUrl(): string {
  return (process.env.FRONTEND_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

function redirectUri(): string {
  return (
    process.env.COMPOSIO_REDIRECT_URI ??
    "http://localhost:4000/api/composio/callback"
  );
}

export default async function composioRoutes(
  app: FastifyInstance,
  opts: ComposioRoutesOptions,
): Promise<void> {
  const { repository: repo, composioService, secretStore } = opts;

  async function hasOrgAccess(
    actorId: string,
    organizationId?: string | null,
  ): Promise<boolean> {
    if (!organizationId) return false;
    const user = await repo.findUserByActor(actorId);
    if (user?.isSuperAdmin) return true;
    const org = await repo.getOrganization(organizationId as Id);
    if (!org) return false;
    return (await actorRoleInSpace(repo, actorId as Id, org.spaceId)) !== null;
  }

  async function isAdminInOrg(
    actorId: string,
    organizationId?: string | null,
  ): Promise<boolean> {
    if (!organizationId) return false;
    const user = await repo.findUserByActor(actorId);
    if (user?.isSuperAdmin) return true;
    const org = await repo.getOrganization(organizationId as Id);
    if (!org) return false;
    const role = await actorRoleInSpace(repo, actorId as Id, org.spaceId);
    return Boolean(role && ROLE_WEIGHT[role] >= ROLE_WEIGHT.admin);
  }

  async function canAccessConnector(
    connectorId: string,
    actorId: string,
    organizationId?: string | null,
  ): Promise<boolean> {
    const connector = await repo.getConnector(connectorId);
    if (!connector || connector.provider !== "composio") return false;
    const user = await repo.findUserByActor(actorId);
    if (user?.isSuperAdmin) return true;
    if (connector.ownerActorId === actorId) return true;
    if (
      connector.sharing === "organization" &&
      connector.ownerOrganizationId === organizationId
    ) {
      return true;
    }
    return false;
  }

  app.get("/composio/toolkits", { preHandler: requireAuth }, async () => {
    return { items: await composioService.listToolkits() };
  });

  // Global Composio key management. Any authenticated user may set the
  // platform-level Composio key (ref composio/api-key) so the connector
  // catalog is usable. Only that exact ref is writable here.
  app.get("/composio/key", { preHandler: requireAuth }, async () => {
    return { configured: await composioService.keyConfigured() };
  });

  app.put("/composio/key", { preHandler: requireAuth }, async (request, reply) => {
    const body = parse(SetKeyBody, request.body, reply);
    if (!body) return;
    await repo.putSecret({
      ref: COMPOSIO_KEY_REF,
      scope: "system",
      ownerActorId: null,
      ownerOrganizationId: null,
      ciphertext: secretStore.encrypt(body.apiKey),
    });
    return { configured: true };
  });

  app.get(
    "/composio/connections",
    { preHandler: requireAuth },
    async (request, reply) => {
      const actorId = request.session.actorId!;
      const query = request.query as { organizationId?: string };
      let organizationId: string | null = null;
      if (query.organizationId) {
        const parsed = parse(Id, query.organizationId, reply);
        if (!parsed) return;
        organizationId = parsed;
        if (!(await hasOrgAccess(actorId, organizationId))) {
          return fail(reply, 403, "no access to this organization");
        }
      }
      const isAdmin = await isAdminInOrg(actorId, organizationId);
      const items = await composioService.listConnections({
        actorId,
        organizationId,
        isAdmin,
      });
      return { items };
    },
  );

  app.post(
    "/composio/connections",
    { preHandler: requireAuth },
    async (request, reply) => {
      const actorId = request.session.actorId!;
      const body = parse(ConnectBody, request.body, reply);
      if (!body) return;

      const organizationId = body.organizationId ?? null;
      if (organizationId) {
        if (body.sharing === "organization") {
          if (!(await isAdminInOrg(actorId, organizationId))) {
            return fail(reply, 403, "only org admins can create shared connections");
          }
        } else if (!(await hasOrgAccess(actorId, organizationId))) {
          return fail(reply, 403, "no access to this organization");
        }
      }

      try {
        const result = await composioService.startConnect({
          toolkit: body.toolkit,
          sharing: body.sharing,
          organizationId,
          actorId,
          redirectUri: redirectUri(),
        });
        reply.code(201);
        return result;
      } catch (err) {
        return fail(
          reply,
          502,
          err instanceof Error ? err.message : "could not start connection",
        );
      }
    },
  );

  // OAuth callback from Composio — deliberately unauthenticated. Legitimacy is
  // established via the one-time `state` token persisted at connect time.
  app.get("/composio/callback", async (request, reply) => {
    const query = request.query as {
      state?: string;
      connected_account_id?: string;
      error?: string;
    };
    const base = frontendUrl();
    const state = query.state ?? "";
    if (query.error || !state) {
      return reply.redirect(
        `${base}?composio=error&message=${encodeURIComponent(query.error ?? "missing state")}`,
      );
    }
    try {
      await composioService.handleCallback({
        state,
        connectedAccountId: query.connected_account_id,
      });
      return reply.redirect(`${base}?composio=success&state=${encodeURIComponent(state)}`);
    } catch (err) {
      return reply.redirect(
        `${base}?composio=error&message=${encodeURIComponent(
          err instanceof Error ? err.message : "callback failed",
        )}`,
      );
    }
  });

  app.get(
    "/composio/connections/:id/tools",
    { preHandler: requireAuth },
    async (request, reply) => {
      const actorId = request.session.actorId!;
      const params = request.params as { id?: string };
      const id = parse(Id, params.id, reply);
      if (!id) return;
      if (!(await canAccessConnector(id, actorId))) {
        return fail(reply, 403, "no access to this connection");
      }
      try {
        return { items: await composioService.listTools(id) };
      } catch (err) {
        return fail(
          reply,
          502,
          err instanceof Error ? err.message : "could not list tools",
        );
      }
    },
  );

  app.post(
    "/composio/execute",
    { preHandler: requireAuth },
    async (request, reply) => {
      const actorId = request.session.actorId!;
      const body = parse(ExecuteBody, request.body, reply);
      if (!body) return;
      if (!(await canAccessConnector(body.connectorId, actorId))) {
        return fail(reply, 403, "no access to this connection");
      }
      try {
        return await composioService.executeTool({
          connectorId: body.connectorId,
          toolSlug: body.tool,
          arguments: body.arguments,
        });
      } catch (err) {
        return fail(
          reply,
          502,
          err instanceof Error ? err.message : "could not execute tool",
        );
      }
    },
  );

  app.post(
    "/composio/connections/:id/mcp",
    { preHandler: requireAuth },
    async (request, reply) => {
      const actorId = request.session.actorId!;
      const params = request.params as { id?: string };
      const id = parse(Id, params.id, reply);
      if (!id) return;
      if (!(await canAccessConnector(id, actorId))) {
        return fail(reply, 403, "no access to this connection");
      }
      try {
        return await composioService.ensureSession(id);
      } catch (err) {
        return fail(
          reply,
          502,
          err instanceof Error ? err.message : "could not create MCP session",
        );
      }
    },
  );

  app.delete(
    "/composio/connections/:id",
    { preHandler: requireAuth },
    async (request, reply) => {
      const actorId = request.session.actorId!;
      const params = request.params as { id?: string };
      const id = parse(Id, params.id, reply);
      if (!id) return;
      const connector = await repo.getConnector(id);
      if (!connector || connector.provider !== "composio") {
        return fail(reply, 404, "connection not found");
      }
      const isAdmin = await isAdminInOrg(actorId, connector.ownerOrganizationId);
      try {
        await composioService.disconnect({ connectorId: id, actorId, isAdmin });
        return { status: "ok" };
      } catch (err) {
        return fail(
          reply,
          502,
          err instanceof Error ? err.message : "could not disconnect",
        );
      }
    },
  );
}