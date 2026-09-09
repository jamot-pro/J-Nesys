import { createMockProvider, intentFromMessage } from "./mock.js";
import { createOpenAIProvider } from "./openai.js";
import { createAnthropicProvider } from "./anthropic.js";
import type { LLMProvider } from "./provider.js";
import type { OpenAIProviderOptions } from "./openai.js";
import type { AnthropicProviderOptions } from "./anthropic.js";

export type { LLMMessage, LLMProvider, LLMResult } from "./provider.js";
export { createMockProvider, intentFromMessage } from "./mock.js";
export { createOpenAIProvider } from "./openai.js";
export { createAnthropicProvider } from "./anthropic.js";
export type { OpenAIProviderOptions } from "./openai.js";
export type { AnthropicProviderOptions } from "./anthropic.js";
export {
  discoverOpenAICompatibleModels,
  resolveEnabledModel,
} from "./provider-registry.js";
export type {
  ModelDiscoveryResult,
  ResolveEnabledModelInput,
  RuntimeModel,
} from "./provider-registry.js";

export type LLMProviderKind = "mock" | "openai" | "anthropic";

export type LLMProviderOptions = OpenAIProviderOptions &
  AnthropicProviderOptions;

export function createLLMProvider(
  kind: LLMProviderKind = "mock",
  opts: LLMProviderOptions = {},
): LLMProvider {
  switch (kind) {
    case "openai":
      return createOpenAIProvider(opts);
    case "anthropic":
      return createAnthropicProvider(opts);
    default:
      return createMockProvider();
  }
}
