import { describe, expect, it, vi } from "vitest";
import { refreshPersonContextSummary } from "./summarize-person.js";
import { createInMemoryMemoryProvider } from "./memory-in-memory.js";
import type { LLMProvider } from "../llm/provider.js";

const PERSON_ID = "00000000-0000-4000-8000-000000000001";
const PROV = {
  source: "observed" as const,
  confidence: 1,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe("refreshPersonContextSummary", () => {
  it("does nothing when the person has no memory entries", async () => {
    const memory = createInMemoryMemoryProvider();
    const updatePerson = vi.fn();
    const llm: LLMProvider = { name: "stub", complete: vi.fn() };

    await refreshPersonContextSummary({ repo: { updatePerson }, memory, llm }, PERSON_ID);

    expect(llm.complete).not.toHaveBeenCalled();
    expect(updatePerson).not.toHaveBeenCalled();
  });

  it("builds a prompt from the person's memory entries and persists the LLM's summary", async () => {
    const memory = createInMemoryMemoryProvider();
    await memory.store({
      scope: "person",
      ownerId: PERSON_ID,
      content: { channel: "whatsapp", direction: "inbound", text: "hi, interested in pricing" },
      provenance: PROV,
    });
    await memory.store({
      scope: "person",
      ownerId: PERSON_ID,
      content: { channel: "lead-gen", event: "captured", listName: "Milan restaurants" },
      provenance: PROV,
    });

    const updatePerson = vi.fn().mockResolvedValue(undefined);
    const llm: LLMProvider = {
      name: "stub",
      complete: vi.fn().mockResolvedValue({
        content: "A prospective lead from the Milan restaurants list, asked about pricing over WhatsApp.",
      }),
    };

    await refreshPersonContextSummary({ repo: { updatePerson }, memory, llm }, PERSON_ID);

    expect(llm.complete).toHaveBeenCalledTimes(1);
    const calls = (llm.complete as ReturnType<typeof vi.fn>).mock.calls as Array<
      [Array<{ role: string; content: string }>]
    >;
    const [messages] = calls[0]!;
    expect(messages[0]!.role).toBe("system");
    expect(messages[1]!.content).toContain("Milan restaurants");
    expect(messages[1]!.content).toContain("pricing");

    expect(updatePerson).toHaveBeenCalledWith(
      PERSON_ID,
      expect.objectContaining({
        contextSummary: "A prospective lead from the Milan restaurants list, asked about pricing over WhatsApp.",
      }),
    );
  });

  it("skips persisting when the LLM returns an empty summary", async () => {
    const memory = createInMemoryMemoryProvider();
    await memory.store({
      scope: "person",
      ownerId: PERSON_ID,
      content: { channel: "whatsapp", direction: "inbound", text: "hi" },
      provenance: PROV,
    });
    const updatePerson = vi.fn();
    const llm: LLMProvider = { name: "stub", complete: vi.fn().mockResolvedValue({ content: "   " }) };

    await refreshPersonContextSummary({ repo: { updatePerson }, memory, llm }, PERSON_ID);

    expect(updatePerson).not.toHaveBeenCalled();
  });
});
