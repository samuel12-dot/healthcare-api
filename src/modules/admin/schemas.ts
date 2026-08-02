import { z } from "zod";

export const createUserSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(10).max(128),
    fullName: z.string().min(1).max(200),
    role: z.enum(["clinician", "admin", "front_desk", "patient"]),
    clinician: z
      .object({
        specialty: z.string().min(1).max(200),
        licenseNumber: z.string().min(1).max(100),
      })
      .optional(),
  })
  .refine((data) => data.role !== "clinician" || data.clinician !== undefined, {
    message: "clinician.specialty and clinician.licenseNumber are required when role is clinician",
    path: ["clinician"],
  });
export type CreateUserInput = z.infer<typeof createUserSchema>;
