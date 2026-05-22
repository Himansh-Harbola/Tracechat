import { config } from "../config.js";
import type { ChatMessageInput, LlmProvider, LlmStreamChunk } from "../types.js";
import { redactPreview } from "../utils/redact.js";

type InstrumentedCallOptions = {
  conversationId?: string;
  signal?: AbortSignal;
};

export class InstrumentedLlmClient {
  constructor(private provider: LlmProvider) {}

  async *stream(messages: ChatMessageInput[], options: InstrumentedCallOptions = {}): AsyncIterable<LlmStreamChunk> {
    const startedAt = new Date();
    let output = "";
    let usage: LlmStreamChunk["usage"];
    let status: "SUCCESS" | "ERROR" | "CANCELLED" = "SUCCESS";
    let errorMessage: string | undefined;

    try {
      for await (const chunk of this.provider.stream(messages, options.signal)) {
        output += chunk.content;
        usage = chunk.usage ?? usage;
        yield chunk;
      }
    } catch (error) {
      status = options.signal?.aborted ? "CANCELLED" : "ERROR";
      errorMessage = error instanceof Error ? error.message : "Unknown LLM error";
      throw error;
    } finally {
      const completedAt = new Date();
      await this.emitLog({
        conversationId: options.conversationId,
        provider: this.provider.name,
        model: this.provider.model,
        latencyMs: completedAt.getTime() - startedAt.getTime(),
        promptTokens: usage?.promptTokens,
        completionTokens: usage?.completionTokens,
        totalTokens: usage?.totalTokens,
        status,
        errorMessage,
        inputPreview: redactPreview(messages.map((message) => `${message.role}: ${message.content}`).join("\n")),
        outputPreview: redactPreview(output),
        startedAt: startedAt.toISOString(),
        completedAt: completedAt.toISOString()
      });
    }
  }

  private async emitLog(payload: object) {
    try {
      await fetch(`http://localhost:${config.port}/api/ingest/inference`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
    } catch (error) {
      console.error("Failed to send inference log", error);
    }
  }
}
