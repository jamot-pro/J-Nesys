import { describe, expect, it, vi } from "vitest";
import type { Provenance } from "@jamot/contracts";
import { createInMemoryMemoryProvider } from "./memory-in-memory.js";
import { createMemoryService } from "./service.js";

const OWNER = "00000000-0000-4000-8000-000000000001";
const OTHER = "00000000-0000-4000-8000-000000000002";

function provenance(source: Provenance["source"] = "observed"): Provenance {
  const ts = new Date().toISOString();
  return { source, confidence: 0.8, createdAt: ts, updatedAt: ts };
}

describe("in-memory memory provider", () => {
  it("stores and lists by scope + owner", async () => {
    const provider = createInMemoryMemoryProvider();
    await provider.store({
      scope: "person",
      ownerId: OWNER,
      content: { name: "Ada" },
      provenance: provenance(),
    });
    await provider.store({
      scope: "person",
      ownerId: OTHER,
      content: { name: "Bob" },
      provenance: provenance(),
    });
    await provider.store({
      scope: "agent",
      ownerId: OWNER,
      content: { goal: "ship" },
      provenance: provenance(),
    });

    const list = await provider.list({ scope: "person", ownerId: OWNER });
    expect(list).toHaveLength(1);
    expect(list[0]?.content).toEqual({ name: "Ada" });
  });

  it("updates content", async () => {
    const provider = createInMemoryMemoryProvider();
    const stored = await provider.store({
      scope: "person",
      ownerId: OWNER,
      content: { name: "Ada" },
      provenance: provenance(),
    });

    const updated = await provider.update(stored.id, {
      content: { name: "Ada Lovelace" },
    });

    expect(updated?.content).toEqual({ name: "Ada Lovelace" });
    expect((await provider.get(stored.id))?.content).toEqual({
      name: "Ada Lovelace",
    });
  });

  it("forgets an entry", async () => {
    const provider = createInMemoryMemoryProvider();
    const stored = await provider.store({
      scope: "person",
      ownerId: OWNER,
      content: {},
      provenance: provenance(),
    });

    await provider.forget(stored.id);

    expect(await provider.get(stored.id)).toBeNull();
  });
});

describe("memory service", () => {
  it("remember publishes a memory.created event", async () => {
    const publish = vi.fn(async (e: unknown) => e);
    const service = createMemoryService({
      provider: createInMemoryMemoryProvider(),
      eventBus: { publish },
    });

    const entry = await service.remember({
      scope: "person",
      ownerId: OWNER,
      content: { name: "Ada" },
      provenance: provenance(),
    });

    expect(publish).toHaveBeenCalledTimes(1);
    const event = publish.mock.calls[0]?.[0] as {
      type: string;
      idempotencyKey: string;
    };
    expect(event.type).toBe("memory.created");
    expect(event.idempotencyKey).toBe(`memory:${entry.id}`);
  });

  it("recall filters by scope and owner", async () => {
    const provider = createInMemoryMemoryProvider();
    await provider.store({
      scope: "person",
      ownerId: OWNER,
      content: { name: "Ada" },
      provenance: provenance(),
    });
    const service = createMemoryService({ provider });

    const results = await service.recall("person", OWNER);

    expect(results).toHaveLength(1);
    expect(results[0]?.content).toEqual({ name: "Ada" });
  });
});
