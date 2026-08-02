import { z } from "zod";

export const auditLogQuerySchema = z.object({
  patient_id: z.string().uuid().optional(),
  actor_user_id: z.string().uuid().optional(),
  action: z.enum(["view", "create", "update", "export", "emergency_override"]).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
export type AuditLogQuery = z.infer<typeof auditLogQuerySchema>;
