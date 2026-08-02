import { prisma } from "../../lib/prisma";
import { ProblemError } from "../../lib/problem";
import type { Actor } from "../policy/types";
import { canRequestEmergencyAccess } from "../policy/auditPolicy";
import { writeAuditEntry } from "../audit/service";
import { toGrantDto } from "../accessGrants/service";
import type { EmergencyAccessInput } from "./schemas";

/**
 * Break-glass access lasts 24 hours before it must be re-justified or
 * replaced with a normal AccessGrant -- long enough to cover a single
 * emergency episode of care, short enough that it can't quietly become a
 * permanent, ungoverned grant.
 */
const EMERGENCY_ACCESS_DURATION_MS = 24 * 60 * 60 * 1000;

/**
 * Deliberately does NOT special-case medical record access: this just
 * creates a normal AccessGrant row (reason=emergency_override, time-boxed)
 * plus a distinct, prominently-taggable AuditLogEntry
 * (action=emergency_override). Every subsequent record read/write flows
 * through the exact same hasActiveGrant() check every other clinician
 * access uses -- break-glass is "create a grant", not "bypass the grant
 * check".
 */
export async function requestEmergencyAccess(actor: Actor, patientId: string, input: EmergencyAccessInput) {
  const decision = canRequestEmergencyAccess(actor);
  if (!decision.allowed) {
    throw ProblemError.forbidden("Only clinicians can request emergency access");
  }

  const patient = await prisma.patient.findUnique({ where: { id: patientId }, select: { id: true } });
  if (!patient) {
    throw ProblemError.notFound("Patient not found");
  }

  const expiresAt = new Date(Date.now() + EMERGENCY_ACCESS_DURATION_MS);

  const grant = await prisma.$transaction(async (tx) => {
    const created = await tx.accessGrant.create({
      data: {
        patientId,
        clinicianId: actor.clinicianId as string,
        grantedBy: actor.userId,
        reason: "emergency_override",
        expiresAt,
      },
    });

    await writeAuditEntry(tx, {
      actorUserId: actor.userId,
      action: "emergency_override",
      resourceType: "access_grant",
      resourceId: created.id,
      patientId,
      metadata: { justification: input.justification, expiresAt: expiresAt.toISOString() },
    });

    return created;
  });

  return toGrantDto(grant);
}
