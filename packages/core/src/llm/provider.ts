export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMResult {
  content: string;
}

export interface LLMProvider {
  name: string;
  complete(messages: LLMMessage[]): Promise<LLMResult>;
}
