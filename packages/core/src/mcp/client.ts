export interface McpTool {
  name: string;
  description?: string;
  inputSchema?: unknown;
}

export interface McpClient {
  listTools(): Promise<McpTool[]>;
  callTool(name: string, args: unknown): Promise<unknown>;
}

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params?: unknown;
}

const PROTOCOL_VERSION = "2025-03-26";

function parsePayload(text: string): unknown {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return JSON.parse(trimmed);
  }
  const dataLines = trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice("data:".length).trim())
    .filter((line) => line.length > 0);
  if (dataLines.length === 0) {
    throw new Error(`unrecognized MCP response: ${trimmed.slice(0, 120)}`);
  }
  const last = dataLines[dataLines.length - 1];
  return JSON.parse(last as string);
}

export function createMcpClient(
  url: string,
  extraHeaders?: Record<string, string>,
): McpClient {
  let nextId = 1;
  let initialized = false;
  let sessionId: string | null = null;

  async function request(method: string, params?: unknown): Promise<unknown> {
    const id = nextId++;
    const body: JsonRpcRequest = { jsonrpc: "2.0", id, method };
    if (params !== undefined) {
      body.params = params;
    }

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        "mcp-protocol-version": PROTOCOL_VERSION,
        ...extraHeaders,
        ...(sessionId ? { "mcp-session-id": sessionId } : {}),
      },
      body: JSON.stringify(body),
    });

    const text = await res.text();
    const session = res.headers.get("mcp-session-id");
    if (session) sessionId = session;
    if (!res.ok) {
      throw new Error(`MCP request failed (${res.status}): ${text.slice(0, 200)}`);
    }

    const rpc = parsePayload(text) as {
      result?: unknown;
      error?: { message?: string };
    };
    if (rpc.error) {
      throw new Error(`MCP error: ${rpc.error.message ?? "unknown error"}`);
    }
    return rpc.result;
  }

  async function ensureInitialized(): Promise<void> {
    if (initialized) return;
    await request("initialize", {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: "jamot-core", version: "0.1.0" },
    });
    initialized = true;
  }

  return {
    async listTools() {
      await ensureInitialized();
      const result = await request("tools/list", {});
      if (
        result === null ||
        typeof result !== "object" ||
        !("tools" in result) ||
        !Array.isArray((result as { tools: unknown }).tools)
      ) {
        return [];
      }
      return ((result as { tools: unknown }).tools as unknown[])
        .filter((tool): tool is Record<string, unknown> => tool !== null && typeof tool === "object")
        .map((tool) => ({
          name: String(tool.name ?? ""),
          description: typeof tool.description === "string" ? tool.description : undefined,
          inputSchema: tool.inputSchema,
        }));
    },
    async callTool(name, args) {
      await ensureInitialized();
      return request("tools/call", { name, arguments: args });
    },
  };
}