import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { config } from "../config.js";
import type { ChatMessageInput, LlmProvider, LlmStreamChunk } from "../types.js";

export class OpenAiProvider implements LlmProvider {
  name: string;
  model: string;
  private client: OpenAI;
  private includeStreamUsage: boolean;

  constructor(
    apiKey: string,
    options?: { baseURL?: string; includeStreamUsage?: boolean; model?: string; name?: string }
  ) {
    this.name = options?.name ?? "openai";
    this.model = options?.model ?? config.openAiModel;
    this.includeStreamUsage = options?.includeStreamUsage ?? true;
    this.client = new OpenAI({ apiKey, baseURL: options?.baseURL });
  }

  async complete(messages: ChatMessageInput[], signal?: AbortSignal) {
    const response = await this.client.chat.completions.create(
      {
        model: this.model,
        messages: this.toOpenAiMessages(messages)
      },
      { signal }
    );

    return {
      content: response.choices[0]?.message.content ?? "",
      usage: {
        promptTokens: response.usage?.prompt_tokens,
        completionTokens: response.usage?.completion_tokens,
        totalTokens: response.usage?.total_tokens
      }
    };
  }

  async *stream(messages: ChatMessageInput[], signal?: AbortSignal): AsyncIterable<LlmStreamChunk> {
    const stream = await this.client.chat.completions.create(
      this.includeStreamUsage
        ? {
            model: this.model,
            messages: this.toOpenAiMessages(messages),
            stream: true,
            stream_options: { include_usage: true }
          }
        : {
            model: this.model,
            messages: this.toOpenAiMessages(messages),
            stream: true
          },
      { signal }
    );

    for await (const event of stream) {
      const content = event.choices[0]?.delta?.content ?? "";
      const usage = event.usage
        ? {
            promptTokens: event.usage.prompt_tokens,
            completionTokens: event.usage.completion_tokens,
            totalTokens: event.usage.total_tokens
          }
        : undefined;

      yield { content, usage };
    }
  }

  private toOpenAiMessages(messages: ChatMessageInput[]): ChatCompletionMessageParam[] {
    return messages.map((message) => ({
      role: message.role,
      content: message.content
    }));
  }
}
