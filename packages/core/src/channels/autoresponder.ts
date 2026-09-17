import type { LLMProvider } from "../llm/provider.js";
import type { MemoryProvider } from "../memory/memory.js";

export interface AutoresponderRepo {
  listPeopleListsForPerson(
    personId: string,
    spaceId: string,
  ): Promise<{ id: string; replyAgentId: string | null }[]>;
  getSpaceSettings(spaceId: string): Promise<Record<string, unknown>>;
  getAgent(id: string): Promise<{ id: string; purpose: string | null; systemPrompt: string | null } | null>;
}

export interface ResolveReplyAgentInput {
  personId: string;
  spaceId: string;
  /** True when this inbound message just provisioned a brand-new Person. */
  isNewPerson: boolean;
}

/**
 * List → agent routing for inbound channel messages.
 *
 * A person can sit on several lists; the first one carrying a reply agent
 * wins (lists are already returned in no guaranteed order, so this is a
 * "some assignment applies" rule, not a priority rule). A brand-new person —
 * on no list yet — falls back to the space's configured default reply
 * agent, when the org has bothered to set one; otherwise no one replies.
 */
export async function resolveReplyAgent(
  repo: AutoresponderRepo,
  input: ResolveReplyAgentInput,
): Promise<string | null> {
  const lists = await repo.listPeopleListsForPerson(input.personId, input.spaceId);
  for (const list of lists) {
    if (list.replyAgentId) return list.replyAgentId;
  }
  if (lists.length > 0) return null; // known person, but no list of theirs has an agent assigned

  if (!input.isNewPerson) return null;

  const settings = await repo.getSpaceSettings(input.spaceId);
  const fallback = settings.defaultReplyAgentId;
  return typeof fallback === "string" && fallback ? fallback : null;
}

export interface DraftReplyInput {
  agentId: string;
  personId: string;
  messageText: string;
}

/**
 * Turn an inbound message into the agent's reply text: its purpose/system
 * prompt plus whatever this person's memory holds, so the same question
 * gets a personalized answer instead of a form letter.
 */
export async function draftAgentReply(
  deps: { repo: AutoresponderRepo; llm: LLMProvider; memory?: MemoryProvider },
  input: DraftReplyInput,
): Promise<string | null> {
  const agent = await deps.repo.getAgent(input.agentId);
  if (!agent) return null;

  const memories = deps.memory
    ? await deps.memory.list({ scope: "person", ownerId: input.personId }).catch(() => [])
    : [];
  const memoryContext = memories
    .map((m) => JSON.stringify(m.content))
    .join("\n")
    .slice(0, 4000);

  const systemParts = [
    agent.systemPrompt ?? agent.purpose ?? "You are a helpful assistant replying over WhatsApp.",
    "Reply in the same language the person wrote in. Keep it short, like a real WhatsApp message.",
  ];
  if (memoryContext) {
    systemParts.push(`What you remember about this person:\n${memoryContext}`);
  }

  const result = await deps.llm.complete([
    { role: "system", content: systemParts.join("\n\n") },
    { role: "user", content: input.messageText },
  ]);
  return result.content.trim() || null;
}
