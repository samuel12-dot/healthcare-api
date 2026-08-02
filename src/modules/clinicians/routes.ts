import { Router } from "express";
import { requireAuth } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { param } from "../../lib/params";
import { availabilityQuerySchema, clinicianIdParamSchema } from "../appointments/schemas";
import * as appointmentsService from "../appointments/service";

export const cliniciansRouter = Router();

cliniciansRouter.get(
  "/:id/availability",
  requireAuth,
  validate(clinicianIdParamSchema, "params"),
  validate(availabilityQuerySchema, "query"),
  async (req, res, next) => {
    try {
      const availability = await appointmentsService.getAvailability(
        param(req, "id"),
        req.query as unknown as { date: string },
      );
      res.status(200).json(availability);
    } catch (err) {
      next(err);
    }
  },
);
