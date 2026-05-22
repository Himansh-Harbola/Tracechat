import type { ChatMessageInput, LlmProvider, LlmStreamChunk } from "../types.js";

export class MockProvider implements LlmProvider {
  name = "mock";
  model = "local-mock-model";

  async complete(messages: ChatMessageInput[]): Promise<{ content: string }> {
    return { content: this.composeReply(messages) };
  }

  async *stream(messages: ChatMessageInput[]): AsyncIterable<LlmStreamChunk> {
    const reply = this.composeReply(messages);
    const words = reply.split(" ");

    for (const word of words) {
      await new Promise((resolve) => setTimeout(resolve, 35));
      yield { content: `${word} ` };
    }
  }

  private composeReply(messages: ChatMessageInput[]) {
    const lastUserMessage = [...messages].reverse().find((message) => message.role === "user");
    return `I am running in mock mode because no OpenAI API key is configured. You said: "${lastUserMessage?.content ?? "hello"}". The logging, ingestion, database, and UI flows still work for demo purposes.`;
  }
}
