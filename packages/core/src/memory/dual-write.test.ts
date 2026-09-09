import { describe, expect, it, vi } from "vitest";
import type { Provenance } from "@jamot/contracts";
import { createDualWriteMemoryProvider, type MemoryMirror } from "./dual-write.js";
import { createInMemoryMemoryProvider } from "./memory-in-memory.js";
import type { MemoryEntry, MemoryProvider } from "./memory.js";

const OWNER = "00000000-0000-4000-8000-000000000001";

function provenance(source: Provenance["source"] = "observed"): Provenance {
  const ts = new Date().toISOString();
  return { source, confidence: 0.8, createdAt: ts, updatedAt: ts };
}

function recordingMirror(): MemoryMirror & {
  stored: MemoryEntry[];
  updated: MemoryEntry[];
  forgotten: string[];
  failStore: boolean;
  failForget: boolean;
} {
  const mirror = {
    stored: [] as MemoryEntry[],
    updated: [] as MemoryEntry[],
    forgotten: [] as string[],
    failStore: false,
    failForget: false,
    name: "test-mirror",
    async store(entry: MemoryEntry) {
      if (mirror.failStore) throw new Error("mirror down");
      mirror.stored.push(entry);
    },
    async update(entry: MemoryEntry) {
      mirror.updated.push(entry);
    },
    async forget(id: string) {
      if (mirror.failForget) throw new Error("mirror down");
      mirror.forgotten.push(id);
    },
  };
  return mirror;
}

describe("createDualWriteMemoryProvider", () => {
  it("writes to primary then mirror, passing the primary-generated id", async () => {
    const primary = createInMemoryMemoryProvider();
    const mirror = recordingMirror();
    const provider = createDualWriteMemoryProvider(primary, mirror);

    const entry = await provider.store({
      scope: "person",
      ownerId: OWNER,
      content: { name: "Ada" },
      provenance: provenance(),
    });

    expect(await primary.get(entry.id)).not.toBeNull();
    expect(mirror.stored).toHaveLength(1);
    expect(mirror.stored[0]?.id).toBe(entry.id);
    expect(mirror.stored[0]?.content).toEqual({ name: "Ada" });
  });

  it("reads only from the primary (mirror is never touched for reads)", async () => {
    const primary = createInMemoryMemoryProvider();
    const mirror = recordingMirror();
    const provider = createDualWriteMemoryProvider(primary, mirror);
    const entry = await provider.store({
      scope: "person",
      ownerId: OWNER,
      content: { name: "Ada" },
      provenance: provenance(),
    });

    expect(await provider.get(entry.id)).toEqual(await primary.get(entry.id));
    expect(mirror.stored).toHaveLength(1);

    const listed = await provider.list({ scope: "person", ownerId: OWNER });
    expect(listed).toHaveLength(1);
    expect(mirror.stored).toHaveLength(1);
  });

  it("swallows mirror store failures and still returns the primary entry", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const primary = createInMemoryMemoryProvider();
    const mirror = recordingMirror();
    mirror.failStore = true;
    const provider = createDualWriteMemoryProvider(primary, mirror);

    const entry = await provider.store({
      scope: "person",
      ownerId: OWNER,
      content: { name: "Ada" },
      provenance: provenance(),
    });

    expect(entry.id).toBeTruthy();
    expect(await primary.get(entry.id)).not.toBeNull();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("propagates update and forget to the mirror, swallowing mirror errors", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const primary = createInMemoryMemoryProvider();
    const mirror = recordingMirror();
    const provider = createDualWriteMemoryProvider(primary, mirror);
    const entry = await provider.store({
      scope: "person",
      ownerId: OWNER,
      content: { name: "Ada" },
      provenance: provenance(),
    });

    const updated = await provider.update(entry.id, {
      content: { name: "Ada Lovelace" },
    });
    expect(updated?.content).toEqual({ name: "Ada Lovelace" });
    expect(mirror.updated).toHaveLength(1);
    expect(mirror.updated[0]?.content).toEqual({ name: "Ada Lovelace" });

    await provider.forget(entry.id);
    expect(mirror.forgotten).toEqual([entry.id]);
    expect(await primary.get(entry.id)).toBeNull();

    mirror.failForget = true;
    mirror.forgotten.length = 0;
    const second = await provider.store({
      scope: "person",
      ownerId: OWNER,
      content: { name: "Bob" },
      provenance: provenance(),
    });
    await provider.forget(second.id);
    expect(mirror.forgotten).toHaveLength(0);
    expect(await primary.get(second.id)).toBeNull();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe("MemoryProvider typing", () => {
  it("the composite satisfies the MemoryProvider interface", () => {
    const provider: MemoryProvider = createDualWriteMemoryProvider(
      createInMemoryMemoryProvider(),
      recordingMirror(),
    );
    expect(typeof provider.store).toBe("function");
    expect(typeof provider.get).toBe("function");
    expect(typeof provider.list).toBe("function");
    expect(typeof provider.update).toBe("function");
    expect(typeof provider.forget).toBe("function");
  });
});