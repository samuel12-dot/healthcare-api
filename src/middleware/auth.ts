import type { NextFunction, Request, Response } from "express";
import type { UserRole } from "@prisma/client";
import { verifyAccessToken } from "../modules/auth/jwt";
import { ProblemError } from "../lib/problem";

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    next(ProblemError.unauthorized("Missing bearer token"));
    return;
  }

  const token = header.slice("Bearer ".length);
  try {
    req.user = verifyAccessToken(token);
    next();
  } catch {
    next(ProblemError.unauthorized("Invalid or expired access token"));
  }
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      next(ProblemError.unauthorized());
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(ProblemError.forbidden(`Requires one of roles: ${roles.join(", ")}`));
      return;
    }
    next();
  };
}
