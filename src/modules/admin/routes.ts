import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { actorFromRequest } from "../../lib/actor";
import { createUserSchema } from "./schemas";
import * as adminService from "./service";
import { auditLogQuerySchema } from "../audit/schemas";
import { queryAuditLog } from "../audit/service";

export const adminRouter = Router();

adminRouter.use(requireAuth, requireRole("admin"));

adminRouter.post("/users", validate(createUserSchema), async (req, res, next) => {
  try {
    const user = await adminService.createUserAsAdmin(req.body);
    res.status(201).json(user);
  } catch (err) {
    next(err);
  }
});

adminRouter.get("/audit-log", validate(auditLogQuerySchema, "query"), async (req, res, next) => {
  try {
    const page = await queryAuditLog(actorFromRequest(req), req.query as unknown as Parameters<typeof queryAuditLog>[1]);
    res.status(200).json(page);
  } catch (err) {
    next(err);
  }
});
