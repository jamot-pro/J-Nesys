import type { LLMMessage, LLMProvider } from "./provider.js";

export interface AnthropicProviderOptions {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}

interface AnthropicMessageResponse {
  content?: Array<{ type?: string; text?: string }>;
}

export function createAnthropicProvider(
  opts: AnthropicProviderOptions = {},
): LLMProvider {
  const apiKey = opts.apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Anthropic provider requires an API key (set ANTHROPIC_API_KEY or pass opts.apiKey)",
    );
  }
  const baseUrl = (
    opts.baseUrl ??
    process.env.ANTHROPIC_BASE_URL ??
    "https://api.anthropic.com"
  ).replace(/\/+$/, "");
  const model = opts.model ?? "claude-3-5-haiku-latest";

  return {
    name: "anthropic",
    async complete(messages: LLMMessage[]) {
      const system = messages
        .filter((message) => message.role === "system")
        .map((message) => message.content)
        .join("\n");
      const conversation = messages
        .filter((message) => message.role !== "system")
        .map((message) => ({ role: message.role, content: message.content }));

      const response = await fetch(`${baseUrl}/v1/messages`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: 1024,
          system,
          messages: conversation,
        }),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(
          `Anthropic request failed (${response.status}): ${text}`,
        );
      }
      const data = (await response.json()) as AnthropicMessageResponse;
      const content = (data.content ?? [])
        .filter((block) => block.type === "text")
        .map((block) => block.text ?? "")
        .join("");
      return { content };
    },
  };
}
