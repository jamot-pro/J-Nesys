import { randomBytes } from "node:crypto";
import type { Connector } from "@jamot/contracts";
import type { JamotRepository } from "../repository/repository.js";
import type { SecretStore } from "../secrets/secret-store.js";
import {
  createComposioClient,
  type ComposioClient,
  type ComposioSessionMcp,
  type ComposioToolkit,
  type ComposioTool,
} from "./client.js";

export const COMPOSIO_KEY_REF = "composio/api-key";

export type ComposioSharing = "user" | "organization";

export interface ComposioServiceDeps {
  repo: JamotRepository;
  store: SecretStore;
  baseUrl?: string;
  /** Env used when the global key secret has `environment` scope. */
  env?: NodeJS.ProcessEnv;
}

export interface ResolvedApiKey {
  apiKey: string;
  ref: string;
  scope: "system" | "environment" | "organization";
}

export interface StartConnectInput {
  toolkit: string;
  sharing: ComposioSharing;
  organizationId?: string | null;
  actorId: string;
  redirectUri: string;
}

export interface StartConnectResult {
  state: string;
  redirectUrl: string;
}

export interface ComposioConnectionView {
  connector: Connector;
  toolkit: string;
  connectedAccountId: string;
  composioUserId: string;
  accountStatus?: string;
}

export interface ComposioService {
  keyConfigured(organizationId?: string | null): Promise<boolean>;
  listToolkits(): Promise<ComposioToolkit[]>;
  listConnections(input: {
    actorId: string;
    organizationId?: string | null;
    isAdmin?: boolean;
  }): Promise<ComposioConnectionView[]>;
  startConnect(input: StartConnectInput): Promise<StartConnectResult>;
  handleCallback(input: {
    state: string;
    connectedAccountId?: string;
  }): Promise<Connector>;
  disconnect(input: {
    connectorId: string;
    actorId: string;
    isAdmin?: boolean;
  }): Promise<void>;
  listTools(connectorId: string): Promise<ComposioTool[]>;
  executeTool(input: {
    connectorId: string;
    toolSlug: string;
    arguments?: Record<string, unknown>;
  }): Promise<unknown>;
  ensureSession(connectorId: string): Promise<ComposioSessionMcp>;
}

function orgKeyRef(organizationId: string): string {
  return `${COMPOSIO_KEY_REF}/${organizationId}`;
}

export function composioUserId(input: {
  actorId: string;
  organizationId?: string | null;
  sharing: ComposioSharing;
}): string {
  const { actorId, organizationId, sharing } = input;
  if (!organizationId) return `jamot:user:${actorId}`;
  if (sharing === "organization") return `jamot:org:${organizationId}:shared`;
  return `jamot:org:${organizationId}:user:${actorId}`;
}

export function createComposioService(
  deps: ComposioServiceDeps,
): ComposioService {
  const { repo, store } = deps;
  const env = deps.env ?? process.env;

  function clientFor(apiKey: string): ComposioClient {
    return createComposioClient({ apiKey, baseUrl: deps.baseUrl });
  }

  async function resolveApiKey(
    organizationId?: string | null,
  ): Promise<ResolvedApiKey | null> {
    if (organizationId) {
      const orgSecret = await repo.getSecret(orgKeyRef(organizationId));
      if (orgSecret) {
        try {
          return {
            apiKey: store.decrypt(orgSecret.ciphertext),
            ref: orgSecret.ref,
            scope: "organization",
          };
        } catch {
          // fall through to the global key
        }
      }
    }
    const global = await repo.getSecret(COMPOSIO_KEY_REF);
    if (global) {
      if (global.scope === "environment") {
        const value = env.COMPOSIO_API_KEY ?? env[COMPOSIO_KEY_REF];
        if (typeof value === "string" && value.length > 0) {
          return { apiKey: value, ref: global.ref, scope: "environment" };
        }
        return null;
      }
      try {
        return {
          apiKey: store.decrypt(global.ciphertext),
          ref: global.ref,
          scope: global.scope === "user" ? "system" : global.scope,
        };
      } catch {
        return null;
      }
    }
    const envKey = env.COMPOSIO_API_KEY;
    return typeof envKey === "string" && envKey.length > 0
      ? { apiKey: envKey, ref: COMPOSIO_KEY_REF, scope: "environment" }
      : null;
  }

  async function getComposioConnector(connectorId: string): Promise<Connector> {
    const connector = await repo.getConnector(connectorId);
    if (!connector) throw new Error("connector not found");
    if (connector.provider !== "composio") {
      throw new Error("connector is not a composio connection");
    }
    return connector;
  }

  function toView(connector: Connector): ComposioConnectionView {
    const config = connector.configuration as Record<string, unknown>;
    return {
      connector,
      toolkit: String(config.toolkit ?? ""),
      connectedAccountId: String(config.connectedAccountId ?? ""),
      composioUserId: String(config.composioUserId ?? ""),
      accountStatus:
        typeof config.accountStatus === "string" ? config.accountStatus : undefined,
    };
  }

  return {
    async keyConfigured(organizationId) {
      return (await resolveApiKey(organizationId)) !== null;
    },

    async listToolkits() {
      const key = await resolveApiKey();
      if (!key) return [];
      return clientFor(key.apiKey).listToolkits();
    },

    async listConnections({ actorId, organizationId, isAdmin }) {
      const all = await repo.listConnectors(
        organizationId ? { ownerOrganizationId: organizationId } : undefined,
      );
      return all
        .filter((connector) => {
          if (connector.provider !== "composio") return false;
          if (isAdmin) return true;
          if (connector.ownerActorId === actorId) return true;
          return (
            connector.sharing === "organization" &&
            connector.ownerOrganizationId === organizationId
          );
        })
        .map(toView);
    },

    async startConnect(input) {
      const { toolkit, sharing, organizationId, actorId, redirectUri } = input;
      if (sharing === "organization" && !organizationId) {
        throw new Error("organizationId is required for org-shared connections");
      }
      const key = await resolveApiKey(organizationId);
      if (!key) throw new Error("Composio API key is not configured");

      const userId = composioUserId({ actorId, organizationId, sharing });
      const state = randomBytes(24).toString("hex");

      const initiated = await clientFor(key.apiKey).initiateConnection({
        userId,
        toolkit,
        redirectUri,
      });

      await repo.putComposioOAuthState({
        state,
        actorId,
        organizationId: organizationId ?? null,
        sharing,
        toolkit,
        composioUserId: userId,
        apiKeyScope: key.scope === "organization" ? "organization" : "system",
        redirectUri,
        consumed: false,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      });

      return { state, redirectUrl: initiated.redirectUrl };
    },

    async handleCallback({ state, connectedAccountId }) {
      const record = await repo.getComposioOAuthState(state);
      if (!record || record.consumed) {
        throw new Error("unknown or already-used connection state");
      }
      if (new Date(record.expiresAt).getTime() < Date.now()) {
        throw new Error("connection state expired");
      }
      const key = await resolveApiKey(record.organizationId);
      if (!key) throw new Error("Composio API key is not configured");
      const client = clientFor(key.apiKey);

      const id = connectedAccountId ?? "";
      const account = id
        ? await client.getConnectedAccount(id)
        : null;
      const status =
        account?.status === "ACTIVE" || account?.status === "active"
          ? "connected"
          : account
            ? "error"
            : "disconnected";

      await repo.consumeComposioOAuthState(state);

      return repo.createConnector({
        provider: "composio",
        type: "data",
        ownerActorId: record.actorId,
        ownerOrganizationId: record.organizationId ?? null,
        sharing: record.sharing,
        credentialRef: {
          ref: record.organizationId ? orgKeyRef(record.organizationId) : COMPOSIO_KEY_REF,
          scope: record.apiKeyScope,
        },
        scopes: [],
        configuration: {
          toolkit: record.toolkit,
          connectedAccountId: id,
          composioUserId: record.composioUserId,
          accountStatus: account?.status ?? undefined,
        },
        status,
      });
    },

    async disconnect({ connectorId, actorId, isAdmin }) {
      const connector = await getComposioConnector(connectorId);
      const canManage =
        isAdmin ||
        connector.ownerActorId === actorId ||
        connector.sharing === "organization";
      if (!canManage) throw new Error("not allowed to disconnect this connection");

      const config = connector.configuration as Record<string, unknown>;
      const connectedAccountId = String(config.connectedAccountId ?? "");
      if (connectedAccountId) {
        const key = await resolveApiKey(connector.ownerOrganizationId);
        if (key) {
          await clientFor(key.apiKey)
            .deleteConnectedAccount(connectedAccountId)
            .catch(() => {
              // the account may already be gone upstream; proceed locally
            });
        }
      }
      await repo.deleteConnector(connectorId);
    },

    async listTools(connectorId) {
      const connector = await getComposioConnector(connectorId);
      const config = connector.configuration as Record<string, unknown>;
      const key = await resolveApiKey(connector.ownerOrganizationId);
      if (!key) throw new Error("Composio API key is not configured");
      const toolkit = String(config.toolkit ?? "");
      return clientFor(key.apiKey).listTools(toolkit || undefined);
    },

    async executeTool({ connectorId, toolSlug, arguments: args }) {
      const connector = await getComposioConnector(connectorId);
      const config = connector.configuration as Record<string, unknown>;
      const connectedAccountId = String(config.connectedAccountId ?? "");
      if (!connectedAccountId) {
        throw new Error("connection has no connected account");
      }
      const key = await resolveApiKey(connector.ownerOrganizationId);
      if (!key) throw new Error("Composio API key is not configured");
      const result = await clientFor(key.apiKey).executeTool({
        toolSlug,
        connectedAccountId,
        userId: String(config.composioUserId ?? ""),
        arguments: args ?? {},
      });
      return {
        data: result.data ?? result.response_data,
        successful: result.successful,
        executionDetails: result.executionDetails,
      };
    },

    async ensureSession(connectorId) {
      const connector = await getComposioConnector(connectorId);
      const config = connector.configuration as Record<string, unknown>;
      const key = await resolveApiKey(connector.ownerOrganizationId);
      if (!key) throw new Error("Composio API key is not configured");

      const userId = String(config.composioUserId ?? "");
      const session = await clientFor(key.apiKey).createSession({
        userId,
        mcp: true,
      });
      if (!session.mcp) {
        throw new Error("Composio did not return an MCP endpoint for the session");
      }
      const updated = await repo.updateConnector(connector.id, {
        configuration: {
          ...config,
          mcpUrl: session.mcp.url,
          mcpHeaders: session.mcp.headers,
        },
      });
      if (!updated) throw new Error("failed to persist composio session");
      return session.mcp;
    },
  };
}