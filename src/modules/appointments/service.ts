import { randomUUID } from "node:crypto";
import type { Appointment, Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { ProblemError } from "../../lib/problem";
import { isPgErrorCode, PG_EXCLUSION_VIOLATION, PG_UNIQUE_VIOLATION, withDeadlockRetry } from "../../lib/pgErrors";
import { decodeCursor, encodeCursor } from "../../lib/cursor";
import { WORKING_HOURS } from "../../config/clinicianHours";
import type { Actor } from "../policy/types";
import {
  canCreateAppointment,
  canModifyAppointment,
  canViewPatientAppointments,
} from "../policy/appointmentPolicy";
import type {
  AvailabilityQuery,
  CreateAppointmentInput,
  ListAppointmentsQuery,
  RescheduleAppointmentInput,
} from "./schemas";

function toDto(appointment: Appointment) {
  return {
    id: appointment.id,
    patientId: appointment.patientId,
    clinicianId: appointment.clinicianId,
    startTime: appointment.startTime.toISOString(),
    endTime: appointment.endTime.toISOString(),
    status: appointment.status,
    reason: appointment.reason,
    createdBy: appointment.createdBy,
    createdAt: appointment.createdAt.toISOString(),
  };
}

/**
 * Raw SQL by design (Section 4): the overlap rule is enforced by Postgres'
 * EXCLUDE USING gist constraint on the appointments table, not by an
 * application-level "check then insert" that a race could slip past. This
 * INSERT either succeeds outright or fails with 23P01
 * (exclusion_violation), which we translate to 409. A second, unrelated
 * race -- two requests reusing the same Idempotency-Key -- fails with
 * 23505 (unique_violation) on idempotency_key instead, and is resolved by
 * replaying whichever row actually won.
 */
export async function createAppointment(
  actor: Actor,
  input: CreateAppointmentInput,
  idempotencyKey: string,
): Promise<{ appointment: ReturnType<typeof toDto>; replayed: boolean }> {
  const decision = canCreateAppointment(actor, input);
  if (!decision.allowed) {
    throw ProblemError.forbidden("You are not allowed to book this appointment");
  }

  const existingByKey = await prisma.appointment.findUnique({ where: { idempotencyKey } });
  if (existingByKey) {
    return { appointment: toDto(existingByKey), replayed: true };
  }

  const [patient, clinician] = await Promise.all([
    prisma.patient.findUnique({ where: { id: input.patientId }, select: { id: true } }),
    prisma.clinician.findUnique({ where: { id: input.clinicianId }, select: { id: true } }),
  ]);
  if (!patient) throw ProblemError.badRequest("Patient not found");
  if (!clinician) throw ProblemError.badRequest("Clinician not found");

  const id = randomUUID();

  try {
    await withDeadlockRetry(() =>
      prisma.$transaction(async (tx) => {
        // Serializes concurrent writers for this one clinician before they
        // ever reach the exclusion-constraint check. Without this, N
        // concurrent inserts targeting the same overlapping range can form
        // a genuine deadlock cycle in Postgres (each transaction holds a
        // lock on the conflicting tuple it found while waiting on another),
        // and naive retries just re-enter the same cycle indefinitely. The
        // advisory lock only affects liveness/throughput -- the EXCLUDE
        // constraint below is still the actual source of correctness, so a
        // bug in this locking code could never let a real double-booking
        // through.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${input.clinicianId}, 0))`;
        await tx.$executeRaw`
          INSERT INTO appointments
            (id, patient_id, clinician_id, start_time, end_time, status, reason, created_by, idempotency_key, created_at)
          VALUES
            (${id}::uuid, ${input.patientId}::uuid, ${input.clinicianId}::uuid,
             ${input.startTime}::timestamptz, ${input.endTime}::timestamptz,
             'scheduled', ${input.reason ?? null}, ${actor.userId}::uuid, ${idempotencyKey}, now())
        `;
      }),
    );
  } catch (err) {
    if (isPgErrorCode(err, PG_EXCLUSION_VIOLATION)) {
      throw ProblemError.conflict("This clinician already has an overlapping appointment");
    }
    if (isPgErrorCode(err, PG_UNIQUE_VIOLATION)) {
      const raced = await prisma.appointment.findUnique({ where: { idempotencyKey } });
      if (raced) return { appointment: toDto(raced), replayed: true };
    }
    throw err;
  }

  const created = await prisma.appointment.findUniqueOrThrow({ where: { id } });
  return { appointment: toDto(created), replayed: false };
}

export async function rescheduleAppointment(
  actor: Actor,
  appointmentId: string,
  input: RescheduleAppointmentInput,
) {
  const appointment = await prisma.appointment.findUnique({ where: { id: appointmentId } });
  if (!appointment) throw ProblemError.notFound("Appointment not found");

  const decision = canModifyAppointment(actor, appointment);
  if (!decision.allowed) {
    throw ProblemError.forbidden("You are not allowed to reschedule this appointment");
  }

  if (appointment.status === "cancelled" || appointment.status === "completed" || appointment.status === "no_show") {
    throw ProblemError.unprocessable(`Cannot reschedule an appointment with status "${appointment.status}"`);
  }

  try {
    await withDeadlockRetry(() =>
      prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${appointment.clinicianId}, 0))`;
        await tx.$executeRaw`
          UPDATE appointments
          SET start_time = ${input.startTime}::timestamptz, end_time = ${input.endTime}::timestamptz
          WHERE id = ${appointmentId}::uuid
        `;
      }),
    );
  } catch (err) {
    if (isPgErrorCode(err, PG_EXCLUSION_VIOLATION)) {
      throw ProblemError.conflict("This clinician already has an overlapping appointment");
    }
    throw err;
  }

  const updated = await prisma.appointment.findUniqueOrThrow({ where: { id: appointmentId } });
  return toDto(updated);
}

export async function cancelAppointment(actor: Actor, appointmentId: string) {
  const appointment = await prisma.appointment.findUnique({ where: { id: appointmentId } });
  if (!appointment) throw ProblemError.notFound("Appointment not found");

  const decision = canModifyAppointment(actor, appointment);
  if (!decision.allowed) {
    throw ProblemError.forbidden("You are not allowed to cancel this appointment");
  }

  if (appointment.status === "cancelled") {
    return toDto(appointment);
  }

  const updated = await prisma.appointment.update({
    where: { id: appointmentId },
    data: { status: "cancelled" },
  });
  return toDto(updated);
}

export async function listAppointmentsForPatient(actor: Actor, patientId: string, query: ListAppointmentsQuery) {
  const decision = canViewPatientAppointments(actor, patientId);
  if (!decision.allowed) {
    throw ProblemError.forbidden("You are not allowed to view this patient's appointments");
  }

  const patient = await prisma.patient.findUnique({ where: { id: patientId }, select: { id: true } });
  if (!patient) throw ProblemError.notFound("Patient not found");

  const cursor = query.cursor ? decodeCursor(query.cursor) : null;
  const where: Prisma.AppointmentWhereInput = { patientId };
  if (cursor) {
    where.OR = [
      { startTime: { lt: new Date(cursor.createdAt) } },
      { startTime: new Date(cursor.createdAt), id: { lt: cursor.id } },
    ];
  }

  const rows = await prisma.appointment.findMany({
    where,
    orderBy: [{ startTime: "desc" }, { id: "desc" }],
    take: query.limit + 1,
  });

  const hasMore = rows.length > query.limit;
  const page = hasMore ? rows.slice(0, query.limit) : rows;
  const last = page[page.length - 1];
  const nextCursor = hasMore && last ? encodeCursor({ createdAt: last.startTime.toISOString(), id: last.id }) : null;

  return { data: page.map(toDto), nextCursor };
}

export async function getAvailability(clinicianId: string, query: AvailabilityQuery) {
  const clinician = await prisma.clinician.findUnique({ where: { id: clinicianId }, select: { id: true } });
  if (!clinician) throw ProblemError.notFound("Clinician not found");

  const dayStart = new Date(`${query.date}T00:00:00.000Z`);
  if (Number.isNaN(dayStart.getTime())) {
    throw ProblemError.badRequest("Invalid date");
  }
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

  const slots: Array<{ startTime: string; endTime: string }> = [];

  if ((WORKING_HOURS.workingDays as readonly number[]).includes(dayStart.getUTCDay())) {
    const existing = await prisma.appointment.findMany({
      where: {
        clinicianId,
        status: { not: "cancelled" },
        startTime: { lt: dayEnd },
        endTime: { gt: dayStart },
      },
      select: { startTime: true, endTime: true },
    });

    const slotMs = WORKING_HOURS.slotMinutes * 60 * 1000;
    const dayWorkStart = new Date(dayStart);
    dayWorkStart.setUTCHours(WORKING_HOURS.startHourUtc, 0, 0, 0);
    const dayWorkEnd = new Date(dayStart);
    dayWorkEnd.setUTCHours(WORKING_HOURS.endHourUtc, 0, 0, 0);

    for (let slotStart = dayWorkStart; slotStart.getTime() + slotMs <= dayWorkEnd.getTime(); ) {
      const slotEnd = new Date(slotStart.getTime() + slotMs);
      const overlaps = existing.some((a) => a.startTime < slotEnd && a.endTime > slotStart);
      if (!overlaps) {
        slots.push({ startTime: slotStart.toISOString(), endTime: slotEnd.toISOString() });
      }
      slotStart = slotEnd;
    }
  }

  return { clinicianId, date: query.date, slots };
}
