export type ChatMessageInput = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type LlmCompletionResult = {
  content: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
};

export type LlmStreamChunk = {
  content: string;
  usage?: LlmCompletionResult["usage"];
};

export type LlmProvider = {
  name: string;
  model: string;
  complete(messages: ChatMessageInput[], signal?: AbortSignal): Promise<LlmCompletionResult>;
  stream(messages: ChatMessageInput[], signal?: AbortSignal): AsyncIterable<LlmStreamChunk>;
};
