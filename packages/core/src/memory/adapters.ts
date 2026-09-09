import type { Db } from "../db.js";
import type { McpClient } from "../mcp/client.js";
import { createInMemoryMemoryProvider } from "./memory-in-memory.js";
import { createGraphitiMemoryProvider } from "./graphiti.js";
import type { MemoryProvider } from "./memory.js";
import { createPostgresMemoryProvider } from "./postgres.js";

export type MemoryProviderKind = "postgres" | "letta" | "honcho" | "graphiti";

export interface MemoryProviderOptions {
  db?: Db;
  mcpClient?: McpClient;
}

function notWired(kind: string): MemoryProvider {
  const fail = async (): Promise<never> => {
    throw new Error(`provider ${kind} not wired`);
  };
  return {
    store: fail,
    get: fail,
    list: fail,
    update: fail,
    forget: fail,
  };
}

export function createMemoryProvider(
  kind: MemoryProviderKind,
  opts?: MemoryProviderOptions,
): MemoryProvider {
  switch (kind) {
    case "postgres": {
      if (!opts?.db) {
        throw new Error("postgres memory provider requires opts.db");
      }
      return createPostgresMemoryProvider(opts.db);
    }
    case "letta":
    case "honcho":
      return notWired(kind);
    case "graphiti": {
      if (!opts?.mcpClient) {
        throw new Error("graphiti memory provider requires opts.mcpClient");
      }
      return createGraphitiMemoryProvider({ client: opts.mcpClient });
    }
    default:
      throw new Error(`unknown memory provider: ${kind}`);
  }
}

export { createInMemoryMemoryProvider };
