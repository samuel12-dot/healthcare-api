import { z } from "zod";

export const createAppointmentSchema = z
  .object({
    patientId: z.string().uuid(),
    clinicianId: z.string().uuid(),
    startTime: z.coerce.date(),
    endTime: z.coerce.date(),
    reason: z.string().min(1).max(2000).optional(),
  })
  .refine((data) => data.endTime > data.startTime, {
    message: "endTime must be after startTime",
    path: ["endTime"],
  });
export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;

export const rescheduleAppointmentSchema = z
  .object({
    startTime: z.coerce.date(),
    endTime: z.coerce.date(),
  })
  .refine((data) => data.endTime > data.startTime, {
    message: "endTime must be after startTime",
    path: ["endTime"],
  });
export type RescheduleAppointmentInput = z.infer<typeof rescheduleAppointmentSchema>;

export const appointmentIdParamSchema = z.object({ id: z.string().uuid() });

export const clinicianIdParamSchema = z.object({ id: z.string().uuid() });

export const availabilityQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
});
export type AvailabilityQuery = z.infer<typeof availabilityQuerySchema>;

export const listAppointmentsQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListAppointmentsQuery = z.infer<typeof listAppointmentsQuerySchema>;

export const idempotencyKeyHeaderSchema = z
  .string({ required_error: "Idempotency-Key header is required" })
  .min(1)
  .max(255);
