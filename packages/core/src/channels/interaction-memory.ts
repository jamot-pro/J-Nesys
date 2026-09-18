import type { LLMProvider } from "../llm/provider.js";
import type { MemoryProvider } from "../memory/memory.js";
import { refreshPersonContextSummary, type ContextSummaryRepo } from "../memory/summarize-person.js";

export interface RecordInteractionInput {
  personId: string;
  channelKind: string;
  direction: "inbound" | "outbound";
  text: string;
  timestamp: string;
}

/**
 * Turns one channel message into a durable `person`-scoped memory entry, and
 * kicks off a best-effort summary refresh. A memory-write or summary failure
 * must never break message delivery — every step here is soft-failing.
 */
export async function recordInteractionMemory(
  memory: MemoryProvider | undefined,
  input: RecordInteractionInput,
  refresh?: { repo: ContextSummaryRepo; llm: LLMProvider },
): Promise<void> {
  if (!memory) return;
  const now = new Date().toISOString();
  try {
    await memory.store({
      scope: "person",
      ownerId: input.personId,
      content: {
        channel: input.channelKind,
        direction: input.direction,
        text: input.text,
        timestamp: input.timestamp,
      },
      sourceEventId: null,
      provenance: {
        source: "observed",
        confidence: 1,
        createdAt: now,
        updatedAt: now,
      },
    });
  } catch (err) {
    console.warn(
      `[memory] failed to record ${input.channelKind} interaction for person ${input.personId}`,
      err,
    );
    return;
  }

  if (refresh) {
    void refreshPersonContextSummary(
      { repo: refresh.repo, memory, llm: refresh.llm },
      input.personId,
    ).catch((err) => {
      console.warn(`[memory] context summary refresh failed for person ${input.personId}`, err);
    });
  }
}
