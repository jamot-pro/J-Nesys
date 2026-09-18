import type { LLMProvider } from "../llm/provider.js";
import type { MemoryProvider } from "./memory.js";

export interface ContextSummaryRepo {
  updatePerson(
    id: string,
    patch: { contextSummary: string; contextSummaryUpdatedAt: string },
  ): Promise<unknown>;
}

const MAX_ENTRIES = 30;
const MAX_CHARS = 4000;

/**
 * Rebuilds a person's concise "what we know about them from every
 * interaction" summary from their memory entries. Best-effort: callers
 * should treat failures as non-fatal (see `recordInteractionMemory`).
 */
export async function refreshPersonContextSummary(
  deps: { repo: ContextSummaryRepo; memory: MemoryProvider; llm: LLMProvider },
  personId: string,
): Promise<void> {
  const entries = await deps.memory.list({ scope: "person", ownerId: personId });
  if (entries.length === 0) return;

  const recent = [...entries]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, MAX_ENTRIES);

  const context = recent
    .map((e) => JSON.stringify(e.content))
    .join("\n")
    .slice(0, MAX_CHARS);

  const result = await deps.llm.complete([
    {
      role: "system",
      content:
        "You maintain a concise running summary of who a person is and what we know about them, " +
        "based strictly on the interaction records below. Write 2-4 plain-language sentences: who " +
        "they are, what channels they use, what they've asked about or care about, and any concrete " +
        "facts learned. Never speculate beyond what the records say. No preamble, just the summary.",
    },
    { role: "user", content: context },
  ]);

  const summary = result.content.trim();
  if (!summary) return;

  await deps.repo.updatePerson(personId, {
    contextSummary: summary,
    contextSummaryUpdatedAt: new Date().toISOString(),
  });
}
