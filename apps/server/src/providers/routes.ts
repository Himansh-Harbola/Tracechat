import { Router } from "express";
import { z } from "zod";
import { getProviderStatus, setActiveProvider } from "../llm/provider.js";

export const providersRouter = Router();

const selectProviderSchema = z.object({
  providerId: z.string().min(1)
});

providersRouter.get("/", (_req, res) => {
  res.json(getProviderStatus());
});

providersRouter.patch("/active", (req, res, next) => {
  try {
    const { providerId } = selectProviderSchema.parse(req.body);
    res.json(setActiveProvider(providerId));
  } catch (error) {
    next(error);
  }
});
