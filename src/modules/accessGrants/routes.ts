import { Router } from "express";
import { requireAuth } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { actorFromRequest } from "../../lib/actor";
import { param } from "../../lib/params";
import { accessGrantIdParamSchema, createAccessGrantSchema } from "./schemas";
import { patientIdParamSchema } from "../patients/schemas";
import * as accessGrantsService from "./service";

/** Mounted at /patients/:id/access-grants (mergeParams for :id). */
export const patientAccessGrantsRouter = Router({ mergeParams: true });

patientAccessGrantsRouter.post(
  "/",
  requireAuth,
  validate(patientIdParamSchema, "params"),
  validate(createAccessGrantSchema),
  async (req, res, next) => {
    try {
      const grant = await accessGrantsService.createAccessGrant(
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

patientAccessGrantsRouter.get(
  "/",
  requireAuth,
  validate(patientIdParamSchema, "params"),
  async (req, res, next) => {
    try {
      const grants = await accessGrantsService.listAccessGrants(actorFromRequest(req), param(req, "id"));
      res.status(200).json({ data: grants });
    } catch (err) {
      next(err);
    }
  },
);

/** Mounted at /access-grants. */
export const accessGrantsRouter = Router();

accessGrantsRouter.post(
  "/:id/revoke",
  requireAuth,
  validate(accessGrantIdParamSchema, "params"),
  async (req, res, next) => {
    try {
      const grant = await accessGrantsService.revokeAccessGrant(actorFromRequest(req), param(req, "id"));
      res.status(200).json(grant);
    } catch (err) {
      next(err);
    }
  },
);
