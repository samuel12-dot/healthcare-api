import { Router } from "express";
import { requireAuth } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { actorFromRequest } from "../../lib/actor";
import { param } from "../../lib/params";
import { ProblemError } from "../../lib/problem";
import { patientIdParamSchema } from "../patients/schemas";
import {
  appointmentIdParamSchema,
  createAppointmentSchema,
  idempotencyKeyHeaderSchema,
  listAppointmentsQuerySchema,
  rescheduleAppointmentSchema,
} from "./schemas";
import * as appointmentsService from "./service";

/** Mounted at /appointments. */
export const appointmentsRouter = Router();

appointmentsRouter.post("/", requireAuth, validate(createAppointmentSchema), async (req, res, next) => {
  try {
    const headerResult = idempotencyKeyHeaderSchema.safeParse(req.headers["idempotency-key"]);
    if (!headerResult.success) {
      throw ProblemError.badRequest("Idempotency-Key header is required");
    }

    const { appointment, replayed } = await appointmentsService.createAppointment(
      actorFromRequest(req),
      req.body,
      headerResult.data,
    );
    res.status(replayed ? 200 : 201).json(appointment);
  } catch (err) {
    next(err);
  }
});

appointmentsRouter.patch(
  "/:id",
  requireAuth,
  validate(appointmentIdParamSchema, "params"),
  validate(rescheduleAppointmentSchema),
  async (req, res, next) => {
    try {
      const appointment = await appointmentsService.rescheduleAppointment(
        actorFromRequest(req),
        param(req, "id"),
        req.body,
      );
      res.status(200).json(appointment);
    } catch (err) {
      next(err);
    }
  },
);

appointmentsRouter.post(
  "/:id/cancel",
  requireAuth,
  validate(appointmentIdParamSchema, "params"),
  async (req, res, next) => {
    try {
      const appointment = await appointmentsService.cancelAppointment(actorFromRequest(req), param(req, "id"));
      res.status(200).json(appointment);
    } catch (err) {
      next(err);
    }
  },
);

/** Mounted at /patients/:id/appointments (mergeParams for :id). */
export const patientAppointmentsRouter = Router({ mergeParams: true });

patientAppointmentsRouter.get(
  "/",
  requireAuth,
  validate(patientIdParamSchema, "params"),
  validate(listAppointmentsQuerySchema, "query"),
  async (req, res, next) => {
    try {
      const page = await appointmentsService.listAppointmentsForPatient(
        actorFromRequest(req),
        param(req, "id"),
        req.query as unknown as { cursor?: string; limit: number },
      );
      res.status(200).json(page);
    } catch (err) {
      next(err);
    }
  },
);
