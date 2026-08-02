import { Router } from "express";
import { requireAuth } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { actorFromRequest } from "../../lib/actor";
import { param } from "../../lib/params";
import { patientIdParamSchema } from "../patients/schemas";
import { emergencyAccessSchema } from "./schemas";
import * as emergencyAccessService from "./service";

/** Mounted at /patients/:id/emergency-access (mergeParams for :id). */
export const emergencyAccessRouter = Router({ mergeParams: true });

emergencyAccessRouter.post(
  "/",
  requireAuth,
  validate(patientIdParamSchema, "params"),
  validate(emergencyAccessSchema),
  async (req, res, next) => {
    try {
      const grant = await emergencyAccessService.requestEmergencyAccess(
        actorFromRequest(req),
        param(req, "id"),
        req.body,
      );
      res.status(201).json(grant);
    } catch (err) {
      next(err);
    }
  },
);
