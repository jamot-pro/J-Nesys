import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { Id } from "@jamot/contracts";
import type { JamotRepository } from "../repository.js";
import type { SecretStore } from "@jamot/core/secrets/secret-store";
import {
  buildGoogleConnectorAuthUrl,
  createGoogleSyncService,
  exchangeGoogleConnectorCode,
  GOOGLE_CONNECTOR_SCOPES,
} from "@jamot/core/google";
import { fetchGoogleProfile } from "../auth.js";
import { actorRoleInSpace, requireAuth } from "../rbac.js";
import { fail, parse } from "../util.js";

const GOOGLE_CONNECTOR_PROVIDER = "google";

function config(clientId?: string, clientSecret?: string, redirectUri?: string) {
  return {
    clientId: clientId ?? process.env.GOOGLE_CLIENT_ID,
    clientSecret: clientSecret ?? process.env.GOOGLE_CLIENT_SECRET,
    redirectUri:
      redirectUri ??
      process.env.GOOGLE_CONNECTOR_REDIRECT_URI ??
      "https://api.jamot.pro/api/google/callback",
  };
}

export function googleConnectorRoutes(
  repo: JamotRepository,
  store: SecretStore,
  overrides?: { clientId?: string; clientSecret?: string; redirectUri?: string },
) {
  const syncService = () => {
    const { clientId, clientSecret } = config(
      overrides?.clientId,
      overrides?.clientSecret,
      overrides?.redirectUri,
    );
    if (!clientId || !clientSecret) throw new Error("Google OAuth is not configured");
    return createGoogleSyncService({ repo, store, clientId, clientSecret });
  };

  async function findSpaceConnector(spaceId: string) {
    const connectors = await repo.listConnectors();
    return (
      connectors.find(
        (c) =>
          c.provider === GOOGLE_CONNECTOR_PROVIDER &&
          (c.configuration as { spaceId?: string }).spaceId === spaceId,
      ) ?? null
    );
  }

  return async function (app: FastifyInstance): Promise<void> {
    app.get("/google/start", { preHandler: requireAuth }, async (request, reply) => {
      const { clientId, redirectUri } = config(
        overrides?.clientId,
        overrides?.clientSecret,
        overrides?.redirectUri,
      );
      if (!clientId) {
        return fail(reply, 501, "Google OAuth is not configured: missing GOOGLE_CLIENT_ID");
      }
      if (!redirectUri) {
        return fail(reply, 501, "Google OAuth is not configured: missing GOOGLE_CONNECTOR_REDIRECT_URI");
      }

      const query = parse(z.object({ spaceId: Id }), request.query, reply);
      if (!query) return;

      const actorId = request.session.actorId!;
      const role = await actorRoleInSpace(repo, actorId as never, query.spaceId);
      if (!role) return fail(reply, 403, "no access to this space");

      const state = randomUUID();
      request.session.set("googleConnectorState", JSON.stringify({ state, spaceId: query.spaceId }));
      return reply.redirect(buildGoogleConnectorAuthUrl(clientId, redirectUri, state));
    });

    app.get("/google/callback", async (request, reply) => {
      const { clientId, clientSecret, redirectUri } = config(
        overrides?.clientId,
        overrides?.clientSecret,
        overrides?.redirectUri,
      );
      const frontendUrl = process.env.FRONTEND_URL ?? "https://mvp.jamot.pro";
      if (!clientId) {
        return fail(reply, 501, "Google OAuth is not configured: missing GOOGLE_CLIENT_ID");
      }
      if (!clientSecret) {
        return fail(reply, 501, "Google OAuth is not configured: missing GOOGLE_CLIENT_SECRET");
      }
      if (!redirectUri) {
        return fail(reply, 501, "Google OAuth is not configured: missing GOOGLE_CONNECTOR_REDIRECT_URI");
      }

      const query = request.query as { code?: string; state?: string; error?: string };
      if (query.error) {
        return reply.redirect(`${frontendUrl}/settings?google=denied`);
      }

      const rawState = request.session.get("googleConnectorState");
      const parsed = rawState
        ? (JSON.parse(rawState) as { state?: string; spaceId?: string })
        : {};
      if (!query.code || !query.state || query.state !== parsed.state || !parsed.spaceId) {
        return reply.redirect(`${frontendUrl}/settings?google=error`);
      }
      request.session.set("googleConnectorState", "");

      try {
        const tokens = await exchangeGoogleConnectorCode(
          clientId,
          clientSecret,
          redirectUri,
          query.code,
        );
        if (!tokens.refreshToken) {
          return reply.redirect(`${frontendUrl}/settings?google=error`);
        }
        const profile = await fetchGoogleProfile(tokens.accessToken);

        const spaceId = parsed.spaceId;
        const actorId = request.session.actorId ?? null;
        const organization = await repo.getOrganizationBySpaceId(spaceId);

        const existing = await findSpaceConnector(spaceId);
        if (existing) {
          await repo.putSecret({
            ref: existing.credentialRef.ref,
            scope: existing.credentialRef.scope,
            ownerActorId: existing.ownerActorId,
            ownerOrganizationId: existing.ownerOrganizationId,
            ciphertext: store.encrypt(tokens.refreshToken),
          });
          await repo.updateConnector(existing.id, {
            status: "connected",
            configuration: { ...existing.configuration, email: profile.email },
          });
          void syncService()
            .syncConnector({ ...existing, configuration: { ...existing.configuration, email: profile.email } })
            .catch((err) => request.log.error(err, "google sync failed"));
          return reply.redirect(`${frontendUrl}/settings?google=success`);
        }

        const ref = `google/refresh-token/${randomUUID()}`;
        await repo.putSecret({
          ref,
          scope: organization ? "organization" : "user",
          ownerActorId: organization ? null : actorId,
          ownerOrganizationId: organization?.id ?? null,
          ciphertext: store.encrypt(tokens.refreshToken),
        });
        const connector = await repo.createConnector({
          provider: GOOGLE_CONNECTOR_PROVIDER,
          type: "data",
          ownerActorId: organization ? null : actorId,
          ownerOrganizationId: organization?.id ?? null,
          sharing: organization ? "organization" : "user",
          capabilities: ["people.sync", "gmail.ingest"],
          credentialRef: { ref, scope: organization ? "organization" : "user" },
          scopes: GOOGLE_CONNECTOR_SCOPES,
          configuration: { spaceId, email: profile.email },
          status: "connected",
        });

        void syncService()
          .syncConnector(connector)
          .catch((err) => request.log.error(err, "google sync failed"));

        return reply.redirect(`${frontendUrl}/settings?google=success`);
      } catch (err) {
        request.log.error(err, "google connector callback failed");
        return reply.redirect(`${frontendUrl}/settings?google=error`);
      }
    });

    app.get("/google/debug", async () => {
      const { clientId, redirectUri } = config(
        overrides?.clientId,
        overrides?.clientSecret,
        overrides?.redirectUri,
      );
      return {
        hasClientId: Boolean(clientId),
        hasClientSecret: Boolean(process.env.GOOGLE_CLIENT_SECRET),
        hasRedirectUri: Boolean(redirectUri),
        redirectUri: redirectUri ?? null,
        envKeys: Object.keys(process.env).filter((k) => k.startsWith("GOOGLE_")),
      };
    });

    app.get("/google/status", { preHandler: requireAuth }, async (request, reply) => {
      const query = parse(z.object({ spaceId: Id }), request.query, reply);
      if (!query) return;
      const actorId = request.session.actorId!;
      const role = await actorRoleInSpace(repo, actorId as never, query.spaceId);
      if (!role) return fail(reply, 403, "no access to this space");

      const connector = await findSpaceConnector(query.spaceId);
      if (!connector) return { connected: false };
      const configuration = connector.configuration as {
        email?: string;
        lastSyncAt?: string;
        contactsSynced?: number;
        sendersSynced?: number;
      };
      return {
        connected: connector.status === "connected",
        connectorId: connector.id,
        status: connector.status,
        email: configuration.email ?? null,
        lastSyncAt: configuration.lastSyncAt ?? null,
        contactsSynced: configuration.contactsSynced ?? 0,
        sendersSynced: configuration.sendersSynced ?? 0,
      };
    });

    app.post("/google/sync", { preHandler: requireAuth }, async (request, reply) => {
      const body = parse(z.object({ spaceId: Id }), request.body, reply);
      if (!body) return;
      const actorId = request.session.actorId!;
      const role = await actorRoleInSpace(repo, actorId as never, body.spaceId);
      if (!role) return fail(reply, 403, "no access to this space");

      const connector = await findSpaceConnector(body.spaceId);
      if (!connector) return fail(reply, 404, "no google connector for this space");

      try {
        const result = await syncService().syncConnector(connector);
        return result;
      } catch (err) {
        request.log.error(err, "google sync failed");
        await repo.updateConnectorStatus(connector.id, "error");
        return fail(reply, 502, "google sync failed");
      }
    });

    app.delete("/google/:id", { preHandler: requireAuth }, async (request, reply) => {
      const params = request.params as { id?: string };
      const id = parse(Id, params.id, reply);
      if (!id) return;

      const connector = await repo.getConnector(id);
      if (!connector || connector.provider !== GOOGLE_CONNECTOR_PROVIDER) {
        return fail(reply, 404, "google connector not found");
      }
      const spaceId = (connector.configuration as { spaceId?: string }).spaceId;
      if (!spaceId) return fail(reply, 400, "connector has no space");
      const actorId = request.session.actorId!;
      const role = await actorRoleInSpace(repo, actorId as never, spaceId as never);
      if (!role) return fail(reply, 403, "no access to this space");

      await repo.deleteSecret(connector.credentialRef.ref);
      await repo.deleteConnector(id);
      reply.code(204);
    });
  };
}
