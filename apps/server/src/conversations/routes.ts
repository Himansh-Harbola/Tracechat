import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";

export const conversationsRouter = Router();

const createConversationSchema = z.object({
  title: z.string().trim().min(1).max(120).optional()
});

conversationsRouter.get("/", async (_req, res, next) => {
  try {
    const conversations = await prisma.conversation.findMany({
      orderBy: { updatedAt: "desc" },
      include: {
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1
        }
      }
    });

    res.json(conversations);
  } catch (error) {
    next(error);
  }
});

conversationsRouter.post("/", async (req, res, next) => {
  try {
    const parsed = createConversationSchema.parse(req.body);
    const conversation = await prisma.conversation.create({
      data: {
        title: parsed.title ?? "New conversation"
      }
    });

    res.status(201).json(conversation);
  } catch (error) {
    next(error);
  }
});

conversationsRouter.get("/:id/messages", async (req, res, next) => {
  try {
    const messages = await prisma.chatMessage.findMany({
      where: { conversationId: req.params.id },
      orderBy: { createdAt: "asc" }
    });

    res.json(messages);
  } catch (error) {
    next(error);
  }
});

conversationsRouter.patch("/:id/cancel", async (req, res, next) => {
  try {
    const conversation = await prisma.conversation.update({
      where: { id: req.params.id },
      data: { status: "CANCELLED" }
    });

    res.json(conversation);
  } catch (error) {
    next(error);
  }
});

conversationsRouter.delete("/:id", async (req, res, next) => {
  try {
    await prisma.conversation.delete({
      where: { id: req.params.id }
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});
