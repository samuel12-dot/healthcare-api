import { Router } from "express";
import { authRouter } from "../../modules/auth/routes";
import { defaultRateLimit } from "../../middleware/rateLimit";

export const apiV1Router = Router();

apiV1Router.use(defaultRateLimit);
apiV1Router.use("/auth", authRouter);
