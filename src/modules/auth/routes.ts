import { Router } from "express";
import { validate } from "../../middleware/validate";
import { authRateLimit } from "../../middleware/rateLimit";
import { loginSchema, refreshSchema, registerSchema } from "./schemas";
import * as authService from "./service";

export const authRouter = Router();

authRouter.post("/register", authRateLimit, validate(registerSchema), async (req, res, next) => {
  try {
    const user = await authService.register(req.body);
    res.status(201).json(user);
  } catch (err) {
    next(err);
  }
});

authRouter.post("/login", authRateLimit, validate(loginSchema), async (req, res, next) => {
  try {
    const result = await authService.login(req.body);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

authRouter.post("/refresh", authRateLimit, validate(refreshSchema), async (req, res, next) => {
  try {
    const result = await authService.refresh(req.body.refreshToken);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

authRouter.post("/logout", validate(refreshSchema), async (req, res, next) => {
  try {
    await authService.logout(req.body.refreshToken);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
