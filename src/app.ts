import express from "express";
import cors from "cors";
import helmet from "helmet";
import { requestLogger } from "./middleware/requestLogger";
import { metricsMiddleware } from "./middleware/metrics";
import { errorHandler, notFoundHandler } from "./lib/problem";
import { healthRouter, metricsRouter } from "./routes/health";
import { apiV1Router } from "./routes/v1";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));
  app.use(requestLogger);
  app.use(metricsMiddleware);

  app.use(healthRouter);
  app.use(metricsRouter);
  app.use("/api/v1", apiV1Router);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
