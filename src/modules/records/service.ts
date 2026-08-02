import type { Prisma, MedicalRecord } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { ProblemError } from "../../lib/problem";
import { decodeCursor, encodeCursor } from "../../lib/cursor";
import type { Actor } from "../policy/types";
import { canAccessMedicalRecords, canWriteMedicalRecord } from "../policy/medicalRecordPolicy";
import { hasActiveGrantWith } from "../policy/grantLookup";
import { writeAuditEntry } from "../audit/service";
import type { AmendRecordInput, CreateRecordInput, ListRecordsQuery } from "./schemas";

function toRecordDto(record: MedicalRecord) {
  return {
    id: record.id,
    patientId: record.patientId,
    authoredBy: record.authoredBy,
    recordType: record.recordType,
    content: record.content,
    amendsRecordId: record.amendsRecordId,
    createdAt: record.createdAt.toISOString(),
  };
}

type TxResult<T> = { ok: true; value: T } | { ok: false; status: "not_found" | "forbidden" };

function notFound<T>(): TxResult<T> {
  return { ok: false, status: "not_found" };
}
function forbidden<T>(): TxResult<T> {
  return { ok: false, status: "forbidden" };
}

function unwrap<T>(result: TxResult<T>, notFoundMessage: string, forbiddenMessage: string): T {
  if (result.ok) return result.value;
  if (result.status === "not_found") throw ProblemError.notFound(notFoundMessage);
  throw ProblemError.forbidden(forbiddenMessage);
}

/**
 * A denied read/write must still be committed as an audit entry (Section 5:
 * "a read that gets denied is also logged, as a denied attempt"). Every
 * function below therefore runs inside a single $transaction that always
 * commits -- authorization decisions are captured as a plain return value
 * (never a throw) so the audit INSERT it wrote is never rolled back by the
 * eventual 403/404 the caller raises *after* the transaction settles.
 */

export async function createRecord(actor: Actor, patientId: string, input: CreateRecordInput) {
  const result = await prisma.$transaction(async (tx) => {
    const patient = await tx.patient.findUnique({ where: { id: patientId }, select: { id: true } });
    if (!patient) return notFound<MedicalRecord>();

    const decision = await canWriteMedicalRecord(actor, patientId, hasActiveGrantWith(tx));

    if (!decision.allowed) {
      await writeAuditEntry(tx, {
        actorUserId: actor.userId,
        action: "create",
        resourceType: "medical_record",
        resourceId: patientId,
        patientId,
        metadata: { decision: "denied", reason: decision.reason, attemptedRecordType: input.recordType },
      });
      return forbidden<MedicalRecord>();
    }

    const record = await tx.medicalRecord.create({
      data: {
        patientId,
        authoredBy: actor.clinicianId as string,
        recordType: input.recordType,
        content: input.content,
      },
    });

    await writeAuditEntry(tx, {
      actorUserId: actor.userId,
      action: "create",
      resourceType: "medical_record",
      resourceId: record.id,
      patientId,
      metadata: { decision: "allowed", reason: decision.reason, recordType: input.recordType },
    });

    return { ok: true, value: record } as TxResult<MedicalRecord>;
  });

  return toRecordDto(
    unwrap(result, "Patient not found", "You are not allowed to create records for this patient"),
  );
}

export async function getRecordById(actor: Actor, recordId: string) {
  const result = await prisma.$transaction(async (tx) => {
    const record = await tx.medicalRecord.findUnique({ where: { id: recordId } });
    if (!record) return notFound<MedicalRecord>();

    const decision = await canAccessMedicalRecords(actor, record.patientId, hasActiveGrantWith(tx));
    const isOwnerRead = decision.allowed && decision.reason === "self";

    if (!isOwnerRead) {
      await writeAuditEntry(tx, {
        actorUserId: actor.userId,
        action: "view",
        resourceType: "medical_record",
        resourceId: record.id,
        patientId: record.patientId,
        metadata: { decision: decision.allowed ? "allowed" : "denied", reason: decision.reason },
      });
    }

    if (!decision.allowed) return forbidden<MedicalRecord>();

    return { ok: true, value: record } as TxResult<MedicalRecord>;
  });

  return toRecordDto(unwrap(result, "Medical record not found", "You are not allowed to view this record"));
}

interface ListRecordsResult {
  records: MedicalRecord[];
  nextCursor: string | null;
}

export async function listRecordsForPatient(actor: Actor, patientId: string, query: ListRecordsQuery) {
  const result = await prisma.$transaction(async (tx) => {
    const patient = await tx.patient.findUnique({ where: { id: patientId }, select: { id: true } });
    if (!patient) return notFound<ListRecordsResult>();

    const decision = await canAccessMedicalRecords(actor, patientId, hasActiveGrantWith(tx));
    const isOwnerRead = decision.allowed && decision.reason === "self";

    let records: MedicalRecord[] = [];
    let nextCursor: string | null = null;

    if (decision.allowed) {
      const cursor = query.cursor ? decodeCursor(query.cursor) : null;
      const where: Prisma.MedicalRecordWhereInput = { patientId };
      if (cursor) {
        where.OR = [
          { createdAt: { lt: new Date(cursor.createdAt) } },
          { createdAt: new Date(cursor.createdAt), id: { lt: cursor.id } },
        ];
      }

      const rows = await tx.medicalRecord.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: query.limit + 1,
      });

      const hasMore = rows.length > query.limit;
      records = hasMore ? rows.slice(0, query.limit) : rows;
      const last = records[records.length - 1];
      if (hasMore && last) {
        nextCursor = encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id });
      }
    }

    if (!isOwnerRead) {
      await writeAuditEntry(tx, {
        actorUserId: actor.userId,
        action: "view",
        resourceType: "medical_record",
        resourceId: patientId,
        patientId,
        metadata: {
          decision: decision.allowed ? "allowed" : "denied",
          reason: decision.reason,
          recordIds: records.map((r) => r.id),
        },
      });
    }

    if (!decision.allowed) return forbidden<ListRecordsResult>();

    return { ok: true, value: { records, nextCursor } } as TxResult<ListRecordsResult>;
  });

  const { records, nextCursor } = unwrap(
    result,
    "Patient not found",
    "You are not allowed to view this patient's records",
  );

  return { data: records.map(toRecordDto), nextCursor };
}

export async function amendRecord(actor: Actor, originalRecordId: string, input: AmendRecordInput) {
  const result = await prisma.$transaction(async (tx) => {
    const original = await tx.medicalRecord.findUnique({ where: { id: originalRecordId } });
    if (!original) return notFound<MedicalRecord>();

    const decision = await canWriteMedicalRecord(actor, original.patientId, hasActiveGrantWith(tx));

    if (!decision.allowed) {
      await writeAuditEntry(tx, {
        actorUserId: actor.userId,
        action: "update",
        resourceType: "medical_record",
        resourceId: original.id,
        patientId: original.patientId,
        metadata: { decision: "denied", reason: decision.reason, amendsRecordId: original.id },
      });
      return forbidden<MedicalRecord>();
    }

    const amendment = await tx.medicalRecord.create({
      data: {
        patientId: original.patientId,
        authoredBy: actor.clinicianId as string,
        recordType: input.recordType,
        content: input.content,
        amendsRecordId: original.id,
      },
    });

    await writeAuditEntry(tx, {
      actorUserId: actor.userId,
      action: "update",
      resourceType: "medical_record",
      resourceId: amendment.id,
      patientId: original.patientId,
      metadata: { decision: "allowed", reason: decision.reason, amendsRecordId: original.id },
    });

    return { ok: true, value: amendment } as TxResult<MedicalRecord>;
  });

  return toRecordDto(unwrap(result, "Medical record not found", "You are not allowed to amend this record"));
}
