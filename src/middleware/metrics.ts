import type { NextFunction, Request, Response } from "express";
import { httpErrorsTotal, httpRequestDuration, httpRequestsTotal } from "../lib/metrics";

export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  if (req.path === "/metrics" || req.path === "/health") {
    next();
    return;
  }
  const start = process.hrtime.bigint();
  res.on("finish", () => {
    const durationSeconds = Number(process.hrtime.bigint() - start) / 1e9;
    const route = req.route?.path ? `${req.baseUrl}${req.route.path}` : req.path;
    const labels = { method: req.method, route, status_code: String(res.statusCode) };
    httpRequestDuration.observe(labels, durationSeconds);
    httpRequestsTotal.inc(labels);
    if (res.statusCode >= 500) {
      httpErrorsTotal.inc({ method: req.method, route });
    }
  });
  next();
}
