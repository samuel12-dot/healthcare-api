import { Router } from "express";
import { authRouter } from "../../modules/auth/routes";
import { patientsRouter } from "../../modules/patients/routes";
import { accessGrantsRouter } from "../../modules/accessGrants/routes";
import { recordsRouter } from "../../modules/records/routes";
import { appointmentsRouter } from "../../modules/appointments/routes";
import { cliniciansRouter } from "../../modules/clinicians/routes";
import { adminRouter } from "../../modules/admin/routes";
import { defaultRateLimit } from "../../middleware/rateLimit";

export const apiV1Router = Router();

apiV1Router.use(defaultRateLimit);
apiV1Router.use("/auth", authRouter);
apiV1Router.use("/patients", patientsRouter);
apiV1Router.use("/access-grants", accessGrantsRouter);
apiV1Router.use("/records", recordsRouter);
apiV1Router.use("/appointments", appointmentsRouter);
apiV1Router.use("/clinicians", cliniciansRouter);
apiV1Router.use("/admin", adminRouter);
