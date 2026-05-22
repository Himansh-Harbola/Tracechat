import { z } from "zod";

export const inferenceLogPayloadSchema = z.object({
  conversationId: z.string().optional(),
  provider: z.string().min(1),
  model: z.string().min(1),
  latencyMs: z.number().int().nonnegative(),
  promptTokens: z.number().int().nonnegative().optional(),
  completionTokens: z.number().int().nonnegative().optional(),
  totalTokens: z.number().int().nonnegative().optional(),
  status: z.enum(["SUCCESS", "ERROR", "CANCELLED"]),
  errorMessage: z.string().optional(),
  inputPreview: z.string().optional(),
  outputPreview: z.string().optional(),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime()
});

export type InferenceLogPayload = z.infer<typeof inferenceLogPayloadSchema>;
