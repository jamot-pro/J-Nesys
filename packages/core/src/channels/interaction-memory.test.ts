import { describe, expect, it, vi } from "vitest";
import { recordInteractionMemory } from "./interaction-memory.js";
import { createInMemoryMemoryProvider } from "../memory/memory-in-memory.js";
import type { LLMProvider } from "../llm/provider.js";

const PERSON_ID = "00000000-0000-4000-8000-000000000001";

describe("recordInteractionMemory", () => {
  it("no-ops when no memory provider is configured", async () => {
    await expect(
      recordInteractionMemory(undefined, {
        personId: PERSON_ID,
        channelKind: "whatsapp",
        direction: "inbound",
        text: "hi",
        timestamp: new Date().toISOString(),
      }),
    ).resolves.toBeUndefined();
  });

  it("stores a person-scoped, observed memory entry with the channel and direction", async () => {
    const memory = createInMemoryMemoryProvider();
    await recordInteractionMemory(memory, {
      personId: PERSON_ID,
      channelKind: "telegram",
      direction: "inbound",
      text: "hello there",
      timestamp: "2026-01-01T00:00:00.000Z",
    });

    const entries = await memory.list({ scope: "person", ownerId: PERSON_ID });
    expect(entries).toHaveLength(1);
    expect(entries[0]?.content).toMatchObject({
      channel: "telegram",
      direction: "inbound",
      text: "hello there",
    });
    expect(entries[0]?.provenance.source).toBe("observed");
  });

  it("swallows store failures instead of throwing", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const failingMemory = {
      store: vi.fn().mockRejectedValue(new Error("db down")),
      get: vi.fn(),
      list: vi.fn(),
      update: vi.fn(),
      forget: vi.fn(),
    };

    await expect(
      recordInteractionMemory(failingMemory, {
        personId: PERSON_ID,
        channelKind: "whatsapp",
        direction: "inbound",
        text: "hi",
        timestamp: new Date().toISOString(),
      }),
    ).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("kicks off a best-effort context summary refresh after a successful store", async () => {
    const memory = createInMemoryMemoryProvider();
    const updatePerson = vi.fn().mockResolvedValue(undefined);
    const llm: LLMProvider = {
      name: "stub",
      complete: vi.fn().mockResolvedValue({ content: "Ada asked about pricing over WhatsApp." }),
    };

    await recordInteractionMemory(
      memory,
      {
        personId: PERSON_ID,
        channelKind: "whatsapp",
        direction: "inbound",
        text: "how much does it cost?",
        timestamp: new Date().toISOString(),
      },
      { repo: { updatePerson }, llm },
    );

    // refresh is fire-and-forget; flush microtasks
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(llm.complete).toHaveBeenCalled();
    expect(updatePerson).toHaveBeenCalledWith(
      PERSON_ID,
      expect.objectContaining({ contextSummary: "Ada asked about pricing over WhatsApp." }),
    );
  });
});
