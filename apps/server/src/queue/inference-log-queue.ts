import { Queue } from "bullmq";
import { createRedisConnection } from "./redis.js";

export const INFERENCE_LOG_QUEUE = "inference-log-events";

export const inferenceLogQueue = new Queue(INFERENCE_LOG_QUEUE, {
  connection: createRedisConnection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 500
    },
    removeOnComplete: {
      age: 60 * 60,
      count: 1000
    },
    removeOnFail: {
      age: 24 * 60 * 60,
      count: 1000
    }
  }
});
