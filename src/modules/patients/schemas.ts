import { z } from "zod";

export const createPatientSchema = z.object({
  userId: z.string().uuid().optional(),
  dateOfBirth: z.coerce.date(),
  sex: z.string().min(1).max(20),
  phone: z.string().min(1).max(30).optional(),
  address: z.string().min(1).max(300).optional(),
});
export type CreatePatientInput = z.infer<typeof createPatientSchema>;

export const updatePatientSchema = z
  .object({
    phone: z.string().min(1).max(30).optional(),
    address: z.string().min(1).max(300).optional(),
  })
  .refine((obj) => Object.keys(obj).length > 0, { message: "At least one field is required" });
export type UpdatePatientInput = z.infer<typeof updatePatientSchema>;

export const patientIdParamSchema = z.object({ id: z.string().uuid() });
