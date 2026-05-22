import { Router } from "express";
import { prisma } from "../db.js";

export const dashboardRouter = Router();

dashboardRouter.get("/metrics", async (_req, res, next) => {
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const [totalRequests, successfulRequests, failedRequests, cancelledRequests, recentLogs] = await Promise.all([
      prisma.inferenceLog.count(),
      prisma.inferenceLog.count({ where: { status: "SUCCESS" } }),
      prisma.inferenceLog.count({ where: { status: "ERROR" } }),
      prisma.inferenceLog.count({ where: { status: "CANCELLED" } }),
      prisma.inferenceLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 30
      })
    ]);

    const latencyValues = recentLogs.map((log) => log.latencyMs);
    const averageLatencyMs =
      latencyValues.length > 0
        ? Math.round(latencyValues.reduce((total, latency) => total + latency, 0) / latencyValues.length)
        : 0;

    const totalTokens = recentLogs.reduce((total, log) => total + (log.totalTokens ?? 0), 0);
    const errorRate = totalRequests > 0 ? Number(((failedRequests / totalRequests) * 100).toFixed(1)) : 0;
    const requestsLastHour = recentLogs.filter((log) => log.createdAt >= oneHourAgo).length;
    const throughputPerMinute = Number((requestsLastHour / 60).toFixed(2));
    const timeline = buildTimeline(recentLogs);

    res.json({
      totalRequests,
      successfulRequests,
      failedRequests,
      cancelledRequests,
      averageLatencyMs,
      errorRate,
      throughputPerMinute,
      totalTokens,
      timeline,
      recentLogs
    });
  } catch (error) {
    next(error);
  }
});

function buildTimeline(logs: { createdAt: Date; latencyMs: number; status: string }[]) {
  const buckets = new Map<string, { errors: number; latencyTotal: number; requests: number }>();

  for (const log of logs) {
    const bucketTime = new Date(log.createdAt);
    bucketTime.setSeconds(0, 0);
    const key = bucketTime.toISOString();
    const bucket = buckets.get(key) ?? { errors: 0, latencyTotal: 0, requests: 0 };

    bucket.requests += 1;
    bucket.latencyTotal += log.latencyMs;
    if (log.status === "ERROR") {
      bucket.errors += 1;
    }

    buckets.set(key, bucket);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([timestamp, bucket]) => ({
      timestamp,
      requests: bucket.requests,
      errors: bucket.errors,
      averageLatencyMs: Math.round(bucket.latencyTotal / bucket.requests)
    }));
}
