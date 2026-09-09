import { describe, expect, it } from "vitest";
import type { Provenance } from "@jamot/contracts";
import type { McpClient } from "../mcp/client.js";
import { createMemoryProvider } from "./adapters.js";
import { createGraphitiMemoryMirror } from "./graphiti.js";
import type { MemoryEntry } from "./memory.js";

const OWNER = "00000000-0000-4000-8000-000000000001";

function provenance(source: Provenance["source"] = "observed"): Provenance {
  const ts = new Date().toISOString();
  return { source, confidence: 0.8, createdAt: ts, updatedAt: ts };
}

function entry(overrides: Partial<MemoryEntry> = {}): MemoryEntry {
  return {
    id: "00000000-0000-4000-8000-0000000000aa",
    scope: "person",
    ownerId: OWNER,
    content: { name: "Ada", role: "engineer" },
    provenance: provenance(),
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function recordingClient(): {
  client: McpClient;
  calls: Array<{ name: string; args: Record<string, unknown> }>;
} {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const client: McpClient = {
    async listTools() {
      return [];
    },
    async callTool(name, args) {
      calls.push({ name, args: args as Record<string, unknown> });
      return { content: [{ type: "text", text: JSON.stringify({ message: "ok" }) }] };
    },
  };
  return { client, calls };
}

describe("createGraphitiMemoryMirror", () => {
  it("maps store() to add_memory with group_id/content/provenance/uuid", async () => {
    const { client, calls } = recordingClient();
    const mirror = createGraphitiMemoryMirror({ client });
    const e = entry();

    await mirror.store(e);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.name).toBe("add_memory");
    expect(calls[0]?.args).toEqual({
      name: "person:00000000-0000-4000-8000-000000000001",
      episode_body: JSON.stringify(e.content),
      group_id: "person:00000000-0000-4000-8000-000000000001",
      source: "json",
      source_description: "source=observed;confidence=0.8",
      uuid: e.id,
      reference_time: e.createdAt,
    });
  });

  it("forget() calls delete_episode with the entry id", async () => {
    const { client, calls } = recordingClient();
    const mirror = createGraphitiMemoryMirror({ client });

    await mirror.forget("00000000-0000-4000-8000-0000000000aa");

    expect(calls).toHaveLength(1);
    expect(calls[0]?.name).toBe("delete_episode");
    expect(calls[0]?.args).toEqual({
      uuid: "00000000-0000-4000-8000-0000000000aa",
    });
  });

  it("update() deletes then re-adds with the updated content and updatedAt", async () => {
    const { client, calls } = recordingClient();
    const mirror = createGraphitiMemoryMirror({ client });
    const e = entry({ content: { name: "Ada Lovelace" } });

    await mirror.update(e);

    expect(calls.map((c) => c.name)).toEqual(["delete_episode", "add_memory"]);
    expect(calls[1]?.args).toMatchObject({
      uuid: e.id,
      episode_body: JSON.stringify({ name: "Ada Lovelace" }),
      reference_time: e.updatedAt,
    });
  });

  it("throws when the server returned an ErrorResponse", async () => {
    const client: McpClient = {
      async listTools() {
        return [];
      },
      async callTool() {
        return {
          content: [
            { type: "text", text: JSON.stringify({ error: "LLM failed" }) },
          ],
        };
      },
    };
    const mirror = createGraphitiMemoryMirror({ client });

    await expect(mirror.store(entry())).rejects.toThrow(/LLM failed/);
  });
});

describe("createMemoryProvider('graphiti')", () => {
  it("returns a provider whose store writes via add_memory", async () => {
    const { client, calls } = recordingClient();
    const provider = createMemoryProvider("graphiti", { mcpClient: client });

    const stored = await provider.store({
      scope: "person",
      ownerId: OWNER,
      content: { name: "Ada" },
      provenance: provenance(),
    });

    expect(stored.id).toBeTruthy();
    expect(calls[0]?.name).toBe("add_memory");
    expect(calls[0]?.args).toMatchObject({
      group_id: "person:00000000-0000-4000-8000-000000000001",
      source: "json",
      uuid: stored.id,
    });
  });

  it("throws when no mcpClient is provided", () => {
    expect(() => createMemoryProvider("graphiti")).toThrow(/mcpClient/);
  });
});