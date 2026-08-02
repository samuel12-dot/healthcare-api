import { Router } from "express";
import { prisma } from "../lib/prisma";
import { redis } from "../lib/redis";
import { registry } from "../lib/metrics";

export const healthRouter = Router();

healthRouter.get("/health", async (_req, res) => {
  const checks: Record<string, "ok" | "error"> = { db: "ok", redis: "ok" };

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    checks.db = "error";
  }

  try {
    await redis.ping();
  } catch {
    checks.redis = "error";
  }

  const healthy = Object.values(checks).every((v) => v === "ok");
  res.status(healthy ? 200 : 503).json({ status: healthy ? "ok" : "degraded", checks });
});

export const metricsRouter = Router();

metricsRouter.get("/metrics", async (_req, res) => {
  res.set("Content-Type", registry.contentType);
  res.end(await registry.metrics());
});
