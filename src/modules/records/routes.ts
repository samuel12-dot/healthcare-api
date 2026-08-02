import { Router } from "express";
import { requireAuth } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { actorFromRequest } from "../../lib/actor";
import { param } from "../../lib/params";
import { patientIdParamSchema } from "../patients/schemas";
import {
  amendRecordSchema,
  createRecordSchema,
  listRecordsQuerySchema,
  recordIdParamSchema,
} from "./schemas";
import * as recordsService from "./service";

/** Mounted at /patients/:id/records (mergeParams for :id). */
export const patientRecordsRouter = Router({ mergeParams: true });

patientRecordsRouter.post(
  "/",
  requireAuth,
  validate(patientIdParamSchema, "params"),
  validate(createRecordSchema),
  async (req, res, next) => {
    try {
      const record = await recordsService.createRecord(actorFromRequest(req), param(req, "id"), req.body);
      res.status(201).json(record);
    } catch (err) {
      next(err);
    }
  },
);

patientRecordsRouter.get(
  "/",
  requireAuth,
  validate(patientIdParamSchema, "params"),
  validate(listRecordsQuerySchema, "query"),
  async (req, res, next) => {
    try {
      const page = await recordsService.listRecordsForPatient(
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

/** Mounted at /records. */
export const recordsRouter = Router();

recordsRouter.get(
  "/:id",
  requireAuth,
  validate(recordIdParamSchema, "params"),
  async (req, res, next) => {
    try {
      const record = await recordsService.getRecordById(actorFromRequest(req), param(req, "id"));
      res.status(200).json(record);
    } catch (err) {
      next(err);
    }
  },
);

recordsRouter.post(
  "/:id/amend",
  requireAuth,
  validate(recordIdParamSchema, "params"),
  validate(amendRecordSchema),
  async (req, res, next) => {
    try {
      const record = await recordsService.amendRecord(actorFromRequest(req), param(req, "id"), req.body);
      res.status(201).json(record);
    } catch (err) {
      next(err);
    }
  },
);
