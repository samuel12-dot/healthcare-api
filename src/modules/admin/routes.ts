import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { createUserSchema } from "./schemas";
import * as adminService from "./service";

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
