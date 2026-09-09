/**
 * Minimal fetch-based client for the Composio REST API (v3.1).
 *
 * Base URL: https://backend.composio.dev/api/v3.1 — authenticated via the
 * `x-api-key` header. Terminology: `toolkit` = an app (e.g. "github"),
 * `tool` = an executable action (e.g. "GITHUB_CREATE_ISSUE"), a
 * `connected_account` is a user's authenticated app connection, and a
 * `session` exposes those tools over MCP (`session.mcp.url` + headers).
 *
 * Responses are normalized defensively because Composio envelopes results in
 * bare arrays, `{ items }`, or `{ data }` depending on the endpoint/version.
 */

export interface ComposioToolkit {
  key: string;
  name: string;
  description?: string;
  icon?: string;
}

export interface ComposioTool {
  slug: string;
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

export interface ComposioConnectedAccount {
  id: string;
  status: string;
  toolkit?: string;
  user_id?: string;
  integrationId?: string;
  authConfigId?: string;
  accountInfo?: Record<string, unknown>;
}

export interface ComposioInitiateResult {
  connectedAccountId: string;
  redirectUrl: string;
}

export interface ComposioSessionMcp {
  url: string;
  headers: Record<string, string>;
}

export interface ComposioExecuteInput {
  toolSlug: string;
  connectedAccountId: string;
  userId?: string;
  arguments?: Record<string, unknown>;
}

export interface ComposioExecuteResult {
  data?: unknown;
  successful?: boolean;
  executionDetails?: unknown;
  response_data?: unknown;
}

export interface ComposioClientOptions {
  apiKey: string;
  baseUrl?: string;
}

export class ComposioError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = "ComposioError";
  }
}

function unwrap<T>(value: unknown): T {
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if ("data" in record) return unwrap<T>(record.data);
    if ("items" in record && Array.isArray(record.items)) {
      return record.items as T;
    }
  }
  return value as T;
}

function pickString(
  record: Record<string, unknown>,
  keys: string[],
): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return undefined;
}

export function createComposioClient(opts: ComposioClientOptions) {
  const baseUrl = (opts.baseUrl ?? "https://backend.composio.dev/api/v3.1").replace(/\/+$/, "");

  async function request(
    path: string,
    method: "GET" | "POST" | "PATCH" | "DELETE" = "GET",
    body?: unknown,
  ): Promise<unknown> {
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        "x-api-key": opts.apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const text = await res.text();
    let parsed: unknown = undefined;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = undefined;
      }
    }
    if (!res.ok) {
      const message =
        (parsed !== null && typeof parsed === "object" && typeof (parsed as { message?: string }).message === "string"
          ? (parsed as { message: string }).message
          : `Composio request failed (${res.status})`);
      throw new ComposioError(message, res.status, parsed);
    }
    return parsed;
  }

  return {
    /** List the available toolkits (apps) in the Composio catalog. */
    async listToolkits(): Promise<ComposioToolkit[]> {
      const raw = await request("/toolkits");
      const list = unwrap<Array<Record<string, unknown>>>(raw);
      if (!Array.isArray(list)) return [];
      return list
        .filter((item) => item !== null && typeof item === "object")
        .map((item) => ({
          key: pickString(item, ["key", "slug", "name", "app"]) ?? "",
          name: pickString(item, ["name", "title", "key"]) ?? "",
          description: pickString(item, ["description", "summary"]),
          icon: pickString(item, ["icon", "logo", "logo_url"]),
        }))
        .filter((toolkit) => toolkit.key.length > 0);
    },

    /** List tools, optionally scoped to one toolkit. */
    async listTools(toolkit?: string): Promise<ComposioTool[]> {
      const query = toolkit
        ? `?toolkits=${encodeURIComponent(toolkit)}`
        : "";
      const raw = await request(`/tools${query}`);
      const list = unwrap<Array<Record<string, unknown>>>(raw);
      if (!Array.isArray(list)) return [];
      return list
        .filter((item) => item !== null && typeof item === "object")
        .map((item) => ({
          slug: pickString(item, ["slug", "name", "key"]) ?? "",
          name: pickString(item, ["name", "displayName", "slug"]) ?? "",
          description: pickString(item, ["description", "summary"]),
          inputSchema:
            typeof item.inputSchema === "object" &&
            item.inputSchema !== null
              ? (item.inputSchema as Record<string, unknown>)
              : typeof item.parameters === "object" && item.parameters !== null
                ? (item.parameters as Record<string, unknown>)
                : undefined,
        }))
        .filter((tool) => tool.slug.length > 0);
    },

    /** Kick off the OAuth flow for a toolkit. Returns a redirect URL the user
     * visits and a connected-account id to poll/verify afterwards. */
    async initiateConnection(input: {
      userId: string;
      toolkit: string;
      redirectUri: string;
    }): Promise<ComposioInitiateResult> {
      const raw = await request("/connected_accounts", "POST", {
        user_id: input.userId,
        entity_id: input.userId,
        toolkit: input.toolkit,
        redirect_uri: input.redirectUri,
      });
      const data = unwrap<Record<string, unknown>>(raw) ?? {};
      const connectedAccountId =
        pickString(data, ["connected_account_id", "connectedAccountId", "id"]) ?? "";
      const redirectUrl =
        pickString(data, ["redirect_url", "redirectUrl", "auth_url", "authUrl", "url"]) ?? "";
      if (!connectedAccountId || !redirectUrl) {
        throw new ComposioError(
          "Composio did not return a connected account / redirect URL",
          200,
          raw,
        );
      }
      return { connectedAccountId, redirectUrl };
    },

    async getConnectedAccount(id: string): Promise<ComposioConnectedAccount | null> {
      const raw = await request(`/connected_accounts/${encodeURIComponent(id)}`);
      const data = unwrap<Record<string, unknown>>(raw);
      if (!data || typeof data !== "object") return null;
      return {
        id: pickString(data, ["id", "connected_account_id"]) ?? id,
        status: pickString(data, ["status", "status_text"]) ?? "unknown",
        toolkit: pickString(data, ["toolkit", "app", "appType"]),
        user_id: pickString(data, ["user_id", "entity_id", "userId"]),
        integrationId: pickString(data, ["integration_id", "integrationId"]),
        authConfigId: pickString(data, ["auth_config_id", "authConfigId"]),
        accountInfo:
          typeof data.account_info === "object" && data.account_info !== null
            ? (data.account_info as Record<string, unknown>)
            : undefined,
      };
    },

    async deleteConnectedAccount(id: string): Promise<void> {
      await request(`/connected_accounts/${encodeURIComponent(id)}`, "DELETE");
    },

    /** Execute a tool on behalf of a connected account. */
    async executeTool(input: ComposioExecuteInput): Promise<ComposioExecuteResult> {
      const raw = await request(`/tools/execute/${encodeURIComponent(input.toolSlug)}`, "POST", {
        connected_account_id: input.connectedAccountId,
        ...(input.userId ? { user_id: input.userId, entity_id: input.userId } : {}),
        arguments: input.arguments ?? {},
      });
      const data = unwrap<Record<string, unknown>>(raw);
      return {
        data: data?.data,
        successful:
          data?.successful === true || data?.successful === false
            ? data.successful
            : undefined,
        executionDetails: data?.execution_details ?? data?.executionDetails,
        response_data: data?.response_data,
      };
    },

    /** Create (or resume) a session keyed by `user_id`. When `mcp: true` the
     * session exposes its tools over MCP via `mcp.url` + `mcp.headers`. */
    async createSession(input: { userId: string; mcp?: boolean }): Promise<{
      id: string;
      mcp?: ComposioSessionMcp;
    }> {
      const raw = await request("/sessions", "POST", {
        user_id: input.userId,
        mcp: input.mcp ?? false,
      });
      const data = unwrap<Record<string, unknown>>(raw) ?? {};
      const id = pickString(data, ["id", "session_id", "sessionId"]) ?? input.userId;
      let mcp: ComposioSessionMcp | undefined;
      const mcpObj =
        (data.mcp as Record<string, unknown> | undefined) ??
        (data.mcp_details as Record<string, unknown> | undefined) ??
        (data.session as Record<string, unknown> | undefined);
      if (mcpObj && typeof mcpObj === "object") {
        const url = pickString(mcpObj, ["url", "mcp_url", "mcpUrl"]);
        if (url) {
          mcp = { url, headers: (mcpObj.headers as Record<string, string>) ?? {} };
        }
      }
      return { id, mcp };
    },
  };
}

export type ComposioClient = ReturnType<typeof createComposioClient>;