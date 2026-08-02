import type { NextFunction, Request, Response } from "express";
import type { ZodTypeAny } from "zod";
import { ProblemError } from "../lib/problem";

type Source = "body" | "query" | "params";

export function validate(schema: ZodTypeAny, source: Source = "body") {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      next(
        ProblemError.badRequest("Request validation failed", {
          errors: result.error.flatten(),
        }),
      );
      return;
    }
    req[source] = result.data;
    next();
  };
}
