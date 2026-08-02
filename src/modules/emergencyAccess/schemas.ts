import { z } from "zod";

export const emergencyAccessSchema = z.object({
  justification: z.string().min(10).max(2000),
});
export type EmergencyAccessInput = z.infer<typeof emergencyAccessSchema>;
