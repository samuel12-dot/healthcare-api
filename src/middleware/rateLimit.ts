import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env";
import { consumeToken } from "../lib/tokenBucket";
import { ProblemError } from "../lib/problem";

function keyFor(prefix: string, req: Request): string {
  const identity = req.user?.sub ?? req.ip ?? "anonymous";
  return `ratelimit:${prefix}:${identity}`;
}

function rateLimiter(prefix: string, points: number, durationSeconds: number) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const result = await consumeToken(keyFor(prefix, req), points, durationSeconds);
      if (!result.allowed) {
        next(ProblemError.tooManyRequests(`Rate limit exceeded, retry after ${result.retryAfterSeconds}s`));
        return;
      }
      next();
    } catch {
      // Fail open: a Redis outage shouldn't take down the whole API.
      next();
    }
  };
}

export const authRateLimit = rateLimiter(
  "auth",
  env.RATE_LIMIT_AUTH_POINTS,
  env.RATE_LIMIT_AUTH_DURATION_SECONDS,
);

export const defaultRateLimit = rateLimiter(
  "default",
  env.RATE_LIMIT_DEFAULT_POINTS,
  env.RATE_LIMIT_DEFAULT_DURATION_SECONDS,
);
