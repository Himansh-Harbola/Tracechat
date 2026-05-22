import { Worker } from "bullmq";
import { INFERENCE_LOG_QUEUE } from "../queue/inference-log-queue.js";
import { createRedisConnection } from "../queue/redis.js";
import { inferenceLogPayloadSchema } from "../ingestion/schemas.js";
import { persistInferenceLog } from "../ingestion/service.js";
import { prisma } from "../db.js";

const worker = new Worker(
  INFERENCE_LOG_QUEUE,
  async (job) => {
    const parsed = inferenceLogPayloadSchema.parse(job.data);
    await persistInferenceLog(parsed);
  },
  {
    concurrency: 5,
    connection: createRedisConnection()
  }
);

worker.on("completed", (job) => {
  console.log(`Persisted inference log event ${job.id}`);
});

worker.on("failed", (job, error) => {
  console.error(`Failed inference log event ${job?.id}`, error);
});

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

async function shutdown() {
  await worker.close();
  await prisma.$disconnect();
  process.exit(0);
}
