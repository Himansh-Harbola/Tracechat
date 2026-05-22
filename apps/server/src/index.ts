import express from "express";
import cors from "cors";
import { ZodError } from "zod";
import { config } from "./config.js";
import { conversationsRouter } from "./conversations/routes.js";
import { chatRouter } from "./chat/routes.js";
import { ingestionRouter } from "./ingestion/routes.js";
import { dashboardRouter } from "./dashboard/routes.js";
import { providersRouter } from "./providers/routes.js";

const app = express();

app.use(cors({ origin: config.clientOrigin }));
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/conversations", conversationsRouter);
app.use("/api/chat", chatRouter);
app.use("/api/ingest", ingestionRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/providers", providersRouter);

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof ZodError) {
    res.status(400).json({ message: "Invalid request", errors: error.flatten() });
    return;
  }

  if (error instanceof Error) {
    console.error(error);
    res.status(500).json({ message: error.message });
    return;
  }

  res.status(500).json({ message: "Unknown server error" });
});

app.listen(config.port, () => {
  console.log(`API listening on http://localhost:${config.port}`);
});
