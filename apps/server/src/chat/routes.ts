import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { createProvider } from "../llm/provider.js";
import { InstrumentedLlmClient } from "../llm/instrumented-client.js";
import type { ChatMessageInput } from "../types.js";

export const chatRouter = Router();

const chatRequestSchema = z.object({
  conversationId: z.string().optional(),
  message: z.string().trim().min(1).max(8000)
});

chatRouter.post("/", async (req, res, next) => {
  const abortController = new AbortController();
  res.on("close", () => {
    if (!res.writableEnded) {
      abortController.abort();
    }
  });

  try {
    const { conversationId, message } = chatRequestSchema.parse(req.body);
    const conversation = conversationId
      ? await prisma.conversation.update({
          where: { id: conversationId },
          data: { status: "ACTIVE" }
        })
      : await prisma.conversation.create({
          data: { title: titleFromMessage(message) }
        });

    await prisma.chatMessage.create({
      data: {
        conversationId: conversation.id,
        role: "USER",
        content: message
      }
    });

    const history = await prisma.chatMessage.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: "desc" },
      take: 10
    });

    const llmMessages: ChatMessageInput[] = [
      {
        role: "system",
        content:
          "You are a concise, helpful assistant. Keep answers practical and ask a clarifying question when the user request is ambiguous."
      },
      ...history
        .reverse()
        .map((item) => ({ role: item.role.toLowerCase() as ChatMessageInput["role"], content: item.content }))
    ];

    res.writeHead(200, {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive"
    });

    res.write(`event: meta\ndata: ${JSON.stringify({ conversationId: conversation.id })}\n\n`);

    const client = new InstrumentedLlmClient(createProvider());
    let assistantContent = "";

    try {
      for await (const chunk of client.stream(llmMessages, {
        conversationId: conversation.id,
        signal: abortController.signal
      })) {
        if (!chunk.content) {
          continue;
        }

        assistantContent += chunk.content;
        res.write(`event: token\ndata: ${JSON.stringify({ content: chunk.content })}\n\n`);
      }

      await prisma.chatMessage.create({
        data: {
          conversationId: conversation.id,
          role: "ASSISTANT",
          content: assistantContent
        }
      });

      await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          title: conversation.title === "New conversation" ? titleFromMessage(message) : conversation.title,
          status: "ACTIVE"
        }
      });

      res.write(`event: done\ndata: ${JSON.stringify({ conversationId: conversation.id })}\n\n`);
      res.end();
    } catch (error) {
      if (abortController.signal.aborted) {
        await prisma.conversation.update({
          where: { id: conversation.id },
          data: { status: "CANCELLED" }
        });
        return;
      }

      const errorMessage = error instanceof Error ? error.message : "Unknown chat error";
      res.write(`event: error\ndata: ${JSON.stringify({ message: errorMessage })}\n\n`);
      res.end();
    }
  } catch (error) {
    next(error);
  }
});

function titleFromMessage(message: string) {
  return message.length > 44 ? `${message.slice(0, 44)}...` : message;
}
