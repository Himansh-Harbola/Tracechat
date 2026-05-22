import { Redis } from "ioredis";
import { config } from "../config.js";

export function createRedisConnection() {
  return new Redis(config.redisUrl, {
    maxRetriesPerRequest: null
  });
}
