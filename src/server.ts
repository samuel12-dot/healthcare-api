import { createApp } from "./app";
import { env } from "./config/env";
import { logger } from "./lib/logger";
import { prisma } from "./lib/prisma";
import { redis } from "./lib/redis";

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(`healthcare-api listening on port ${env.PORT}`);
});

async function shutdown(signal: string) {
  logger.info(`received ${signal}, shutting down`);
  server.close(async () => {
    await prisma.$disconnect();
    redis.disconnect();
    process.exit(0);
  });
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
