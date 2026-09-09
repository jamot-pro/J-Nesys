import type { LLMMessage, LLMProvider } from "./provider.js";

const KEYWORDS: ReadonlyArray<readonly [string, string]> = [
  ["task", "task"],
  ["todo", "task"],
  ["assign", "task"],
  ["question", "question"],
  ["ask", "question"],
  ["meeting", "meeting"],
  ["schedule", "meeting"],
  ["calendar", "meeting"],
  ["finance", "finance"],
  ["budget", "finance"],
  ["invoice", "finance"],
  ["payment", "finance"],
];

export function intentFromMessage(message: string): string {
  const lower = message.toLowerCase();
  for (const [keyword, intent] of KEYWORDS) {
    if (lower.includes(keyword)) return intent;
  }
  return "unknown";
}

export function createMockProvider(): LLMProvider {
  return {
    name: "mock",
    async complete(messages: LLMMessage[]) {
      const lastUser = [...messages]
        .reverse()
        .find((message) => message.role === "user");
      const intent = intentFromMessage(lastUser?.content ?? "");
      return { content: JSON.stringify({ intent }) };
    },
  };
}
