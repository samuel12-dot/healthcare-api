import { z } from "zod";

const noteContent = z.object({
  text: z.string().min(1).max(10_000),
});

const diagnosisContent = z.object({
  code: z.string().min(1).max(20),
  description: z.string().min(1).max(2000),
});

const prescriptionContent = z.object({
  medication: z.string().min(1).max(200),
  dosage: z.string().min(1).max(100),
  frequency: z.string().min(1).max(100),
  durationDays: z.number().int().positive().optional(),
});

const labResultContent = z.object({
  testName: z.string().min(1).max(200),
  value: z.string().min(1).max(200),
  unit: z.string().max(50).optional(),
  referenceRange: z.string().max(100).optional(),
  abnormal: z.boolean().optional(),
});

const vitalsContent = z
  .object({
    heartRateBpm: z.number().positive().optional(),
    bloodPressureSystolic: z.number().positive().optional(),
    bloodPressureDiastolic: z.number().positive().optional(),
    temperatureCelsius: z.number().optional(),
    respiratoryRate: z.number().positive().optional(),
    oxygenSaturationPercent: z.number().min(0).max(100).optional(),
  })
  .refine((obj) => Object.keys(obj).length > 0, { message: "At least one vitals field is required" });

/** content's shape is keyed on record_type so it stays structured/queryable jsonb, not a free-text blob. */
export const createRecordSchema = z.discriminatedUnion("recordType", [
  z.object({ recordType: z.literal("note"), content: noteContent }),
  z.object({ recordType: z.literal("diagnosis"), content: diagnosisContent }),
  z.object({ recordType: z.literal("prescription"), content: prescriptionContent }),
  z.object({ recordType: z.literal("lab_result"), content: labResultContent }),
  z.object({ recordType: z.literal("vitals"), content: vitalsContent }),
]);
export type CreateRecordInput = z.infer<typeof createRecordSchema>;

export const amendRecordSchema = createRecordSchema;
export type AmendRecordInput = z.infer<typeof amendRecordSchema>;

export const recordIdParamSchema = z.object({ id: z.string().uuid() });

export const listRecordsQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListRecordsQuery = z.infer<typeof listRecordsQuerySchema>;
