import { randomUUID } from "node:crypto";
import type { McpClient } from "../mcp/client.js";
import type { MemoryMirror } from "./dual-write.js";
import type { MemoryEntry, MemoryProvider, MemoryScope } from "./memory.js";

export interface GraphitiMemoryOptions {
  client: McpClient;
  log?: (message: string) => void;
}

const noop = (): void => {};

function groupId(scope: MemoryScope, ownerId: string): string {
  return `${scope}:${ownerId}`;
}

function sourceDescription(entry: MemoryEntry): string {
  return `source=${entry.provenance.source};confidence=${entry.provenance.confidence}`;
}

function fallbackProvenance(ts: string) {
  return { source: "self_declared" as const, confidence: 0.5, createdAt: ts, updatedAt: ts };
}

/** Extract the structured response object from a FastMCP tool result. */
function toolPayload(result: unknown): Record<string, unknown> | null {
  if (result === null || typeof result !== "object") return null;
  const r = result as Record<string, unknown>;
  if (r.structuredContent && typeof r.structuredContent === "object") {
    return r.structuredContent as Record<string, unknown>;
  }
  if (Array.isArray(r.content)) {
    for (const part of r.content) {
      if (part !== null && typeof part === "object" && "text" in part) {
        const text = String((part as { text: unknown }).text);
        try {
          return JSON.parse(text) as Record<string, unknown>;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

/** Throw when Graphiti returned an ErrorResponse (not a JSON-RPC error). */
function parseToolResult(result: unknown): void {
  const payload = toolPayload(result);
  if (payload && typeof payload.error === "string") {
    throw new Error(`graphiti: ${payload.error}`);
  }
}

function parseContent(content: unknown): Record<string, unknown> {
  if (typeof content !== "string") return {};
  try {
    const parsed = JSON.parse(content) as unknown;
    return parsed !== null && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : { text: content };
  } catch {
    return { text: content };
  }
}

interface EpisodeResult {
  uuid: string;
  content: unknown;
  created_at: string | null;
}

function extractEpisodes(result: unknown): EpisodeResult[] {
  const payload = toolPayload(result);
  const episodes = Array.isArray(payload?.episodes) ? payload.episodes : [];
  return episodes
    .filter(
      (ep): ep is Record<string, unknown> =>
        ep !== null && typeof ep === "object",
    )
    .map((ep) => ({
      uuid: String(ep.uuid ?? ""),
      content: ep.content,
      created_at: typeof ep.created_at === "string" ? ep.created_at : null,
    }));
}

/**
 * Write-only projection of Jamot memories into the self-hosted Graphiti MCP
 * server (zepai/knowledge-graph-mcp:standalone over the existing MCP client).
 *
 * Mapping:
 * - scope + ownerId          -> group_id (e.g. "person:0000...01")
 * - content (jsonb)          -> episode_body as a JSON string, source="json"
 * - provenance               -> source_description
 * - entry.id                 -> episode uuid (so forget/update can target it)
 * - createdAt / updatedAt    -> reference_time (bi-temporal event time)
 */
export function createGraphitiMemoryMirror(
  opts: GraphitiMemoryOptions,
): MemoryMirror {
  const { client } = opts;

  async function addEpisode(
    entry: MemoryEntry,
    referenceTime: string,
  ): Promise<void> {
    const result = await client.callTool("add_memory", {
      name: groupId(entry.scope, entry.ownerId),
      episode_body: JSON.stringify(entry.content),
      group_id: groupId(entry.scope, entry.ownerId),
      source: "json",
      source_description: sourceDescription(entry),
      uuid: entry.id,
      reference_time: referenceTime,
    });
    parseToolResult(result);
  }

  return {
    name: "graphiti",
    async store(entry) {
      await addEpisode(entry, entry.createdAt);
    },
    async update(entry) {
      await client.callTool("delete_episode", { uuid: entry.id });
      await addEpisode(entry, entry.updatedAt);
    },
    async forget(id) {
      const result = await client.callTool("delete_episode", { uuid: id });
      parseToolResult(result);
    },
  };
}

/**
 * Standalone `MemoryProvider` backed by Graphiti, satisfying the adapter switch.
 * Writes mirror to the graph; reads are best-effort via `get_episodes` (the
 * dual-write path always reads from the primary Postgres provider instead).
 */
export function createGraphitiMemoryProvider(
  opts: GraphitiMemoryOptions,
): MemoryProvider {
  const { client, log = noop } = opts;
  const mirror = createGraphitiMemoryMirror(opts);
  const now = (): string => new Date().toISOString();
  const meta = new Map<
    string,
    { scope: MemoryScope; ownerId: string; createdAt: string }
  >();

  function toEntry(
    ep: EpisodeResult,
    scope: MemoryScope,
    ownerId: string,
  ): MemoryEntry {
    const ts = ep.created_at ?? now();
    return {
      id: ep.uuid,
      scope,
      ownerId,
      content: parseContent(ep.content),
      provenance: fallbackProvenance(ts),
      createdAt: ts,
      updatedAt: ts,
    };
  }

  return {
    async store(input) {
      const entry: MemoryEntry = {
        id: randomUUID(),
        scope: input.scope,
        ownerId: input.ownerId,
        content: input.content,
        sourceEventId: input.sourceEventId ?? null,
        provenance: input.provenance,
        createdAt: now(),
        updatedAt: now(),
      };
      await mirror.store(entry);
      meta.set(entry.id, {
        scope: entry.scope,
        ownerId: entry.ownerId,
        createdAt: entry.createdAt,
      });
      return entry;
    },

    async get(id) {
      const m = meta.get(id);
      if (!m) {
        log(`graphiti read-through unsupported for ${id}; reads come from the primary provider`);
        return null;
      }
      const result = await client.callTool("get_episodes", {
        group_ids: [groupId(m.scope, m.ownerId)],
        max_episodes: 50,
      });
      const ep = extractEpisodes(result).find((e) => e.uuid === id);
      return ep ? toEntry(ep, m.scope, m.ownerId) : null;
    },

    async list(filter) {
      const result = await client.callTool("get_episodes", {
        group_ids: [groupId(filter.scope, filter.ownerId)],
        max_episodes: 50,
      });
      return extractEpisodes(result).map((ep) =>
        toEntry(ep, filter.scope, filter.ownerId),
      );
    },

    async update(id, patch) {
      const m = meta.get(id);
      if (!m) return null;
      const entry: MemoryEntry = {
        id,
        scope: m.scope,
        ownerId: m.ownerId,
        content: patch.content ?? {},
        sourceEventId: null,
        provenance:
          patch.provenance ?? fallbackProvenance(m.createdAt),
        createdAt: m.createdAt,
        updatedAt: now(),
      };
      await mirror.update(entry);
      meta.set(id, {
        scope: entry.scope,
        ownerId: entry.ownerId,
        createdAt: entry.createdAt,
      });
      return entry;
    },

    async forget(id) {
      await mirror.forget(id);
      meta.delete(id);
    },
  };
}
