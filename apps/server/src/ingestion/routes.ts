import { Router } from "express";
import { ingestInferenceLog } from "./service.js";

export const ingestionRouter = Router();

ingestionRouter.post("/inference", async (req, res, next) => {
  try {
    const result = await ingestInferenceLog(req.body);
    res.status(result.accepted ? 202 : 400).json(result);
  } catch (error) {
    next(error);
  }
});
