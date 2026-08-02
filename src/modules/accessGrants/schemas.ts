import { z } from "zod";

export const createAccessGrantSchema = z.object({
  clinicianId: z.string().uuid(),
  // emergency_override is deliberately excluded here -- it can only be set
  // by the break-glass endpoint (POST /patients/:id/emergency-access).
  reason: z.enum(["active_care", "referral"]),
  expiresAt: z.coerce.date().optional(),
});
export type CreateAccessGrantInput = z.infer<typeof createAccessGrantSchema>;

export const accessGrantIdParamSchema = z.object({ id: z.string().uuid() });
