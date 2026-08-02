import type { Request } from "express";
import type { Actor } from "../modules/policy/types";
import { ProblemError } from "./problem";

export function actorFromRequest(req: Request): Actor {
  if (!req.user) {
    throw ProblemError.unauthorized();
  }
  return {
    userId: req.user.sub,
    role: req.user.role,
    patientId: req.user.patientId,
    clinicianId: req.user.clinicianId,
  };
}
