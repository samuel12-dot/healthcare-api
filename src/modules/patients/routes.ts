import { Router } from "express";
import { requireAuth } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { actorFromRequest } from "../../lib/actor";
import { param } from "../../lib/params";
import { patientAccessGrantsRouter } from "../accessGrants/routes";
import { patientRecordsRouter } from "../records/routes";
import { patientAppointmentsRouter } from "../appointments/routes";
import { emergencyAccessRouter } from "../emergencyAccess/routes";
import { createPatientSchema, patientIdParamSchema, updatePatientSchema } from "./schemas";
import * as patientsService from "./service";

export const patientsRouter = Router();

patientsRouter.use("/:id/access-grants", patientAccessGrantsRouter);
patientsRouter.use("/:id/records", patientRecordsRouter);
patientsRouter.use("/:id/appointments", patientAppointmentsRouter);
patientsRouter.use("/:id/emergency-access", emergencyAccessRouter);

patientsRouter.post("/", requireAuth, validate(createPatientSchema), async (req, res, next) => {
  try {
    const patient = await patientsService.createPatient(actorFromRequest(req), req.body);
    res.status(201).json(patient);
  } catch (err) {
    next(err);
  }
});

patientsRouter.get(
  "/:id",
  requireAuth,
  validate(patientIdParamSchema, "params"),
  async (req, res, next) => {
    try {
      const patient = await patientsService.getPatientProfile(actorFromRequest(req), param(req, "id"));
      res.status(200).json(patient);
    } catch (err) {
      next(err);
    }
  },
);

patientsRouter.patch(
  "/:id",
  requireAuth,
  validate(patientIdParamSchema, "params"),
  validate(updatePatientSchema),
  async (req, res, next) => {
    try {
      const patient = await patientsService.updatePatientProfile(actorFromRequest(req), param(req, "id"), req.body);
      res.status(200).json(patient);
    } catch (err) {
      next(err);
    }
  },
);
