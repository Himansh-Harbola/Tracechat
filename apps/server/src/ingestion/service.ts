import { prisma } from "../db.js";
import { inferenceLogQueue } from "../queue/inference-log-queue.js";
import { inferenceLogPayloadSchema, type InferenceLogPayload } from "./schemas.js";

export async function ingestInferenceLog(payload: unknown) {
  const parsed = inferenceLogPayloadSchema.safeParse(payload);

  if (!parsed.success) {
    await prisma.ingestionEvent.create({
      data: {
        source: "llm-sdk",
        validationStatus: "REJECTED",
        errorMessage: parsed.error.message,
        payload: payload as object
      }
    });

    return { accepted: false, errors: parsed.error.flatten() };
  }

  const data: InferenceLogPayload = parsed.data;

  await inferenceLogQueue.add("inference-log.received", data);

  return { accepted: true, queued: true };
}

export async function persistInferenceLog(data: InferenceLogPayload) {
  await prisma.$transaction([
    prisma.ingestionEvent.create({
      data: {
        source: "llm-sdk",
        validationStatus: "ACCEPTED",
        payload: data
      }
    }),
    prisma.inferenceLog.create({
      data: {
        conversationId: data.conversationId,
        provider: data.provider,
        model: data.model,
        latencyMs: data.latencyMs,
        promptTokens: data.promptTokens,
        completionTokens: data.completionTokens,
        totalTokens: data.totalTokens,
        status: data.status,
        errorMessage: data.errorMessage,
        inputPreview: data.inputPreview,
        outputPreview: data.outputPreview,
        startedAt: new Date(data.startedAt),
        completedAt: new Date(data.completedAt)
      }
    })
  ]);

  return { persisted: true };
}
