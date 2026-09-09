import type { LLMMessage, LLMProvider } from "./provider.js";

export interface OpenAIProviderOptions {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  maxTokens?: number;
}

interface OpenAICompletionResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

export function createOpenAIProvider(
  opts: OpenAIProviderOptions = {},
): LLMProvider {
  const apiKey = opts.apiKey ?? process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OpenAI provider requires an API key (set OPENAI_API_KEY or pass opts.apiKey)",
    );
  }
  const baseUrl = (
    opts.baseUrl ??
    process.env.OPENAI_BASE_URL ??
    "https://api.openai.com/v1"
  ).replace(/\/+$/, "");
  const model = opts.model ?? process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  const maxTokens = opts.maxTokens ?? 512;

  return {
    name: "openai",
    async complete(messages: LLMMessage[]) {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ model, messages, max_tokens: maxTokens }),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`OpenAI request failed (${response.status}): ${text}`);
      }
      const data = (await response.json()) as OpenAICompletionResponse;
      return { content: data.choices?.[0]?.message?.content ?? "" };
    },
  };
}
