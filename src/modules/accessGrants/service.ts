import { prisma } from "../../lib/prisma";
import { ProblemError } from "../../lib/problem";
import type { Actor } from "../policy/types";
import {
  canCreateAccessGrant,
  canListAccessGrants,
  canRevokeAccessGrant,
} from "../policy/accessGrantPolicy";
import type { CreateAccessGrantInput } from "./schemas";

export function toGrantDto(grant: {
  id: string;
  patientId: string;
  clinicianId: string;
  grantedBy: string;
  reason: string;
  expiresAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: grant.id,
    patientId: grant.patientId,
    clinicianId: grant.clinicianId,
    grantedBy: grant.grantedBy,
    reason: grant.reason,
    expiresAt: grant.expiresAt?.toISOString() ?? null,
    revokedAt: grant.revokedAt?.toISOString() ?? null,
    createdAt: grant.createdAt.toISOString(),
    active: grant.revokedAt === null && (grant.expiresAt === null || grant.expiresAt > new Date()),
  };
}

export async function createAccessGrant(actor: Actor, patientId: string, input: CreateAccessGrantInput) {
  const decision = canCreateAccessGrant(actor, patientId);
  if (!decision.allowed) {
    throw ProblemError.forbidden("You are not allowed to grant access to this patient's records");
  }

  const patient = await prisma.patient.findUnique({ where: { id: patientId } });
  if (!patient) {
    throw ProblemError.notFound("Patient not found");
  }

  const clinician = await prisma.clinician.findUnique({ where: { id: input.clinicianId } });
  if (!clinician) {
    throw ProblemError.badRequest("Clinician not found");
  }

  const grant = await prisma.accessGrant.create({
    data: {
      patientId,
      clinicianId: input.clinicianId,
      grantedBy: actor.userId,
      reason: input.reason,
      expiresAt: input.expiresAt,
    },
  });

  return toGrantDto(grant);
}

export async function revokeAccessGrant(actor: Actor, grantId: string) {
  const grant = await prisma.accessGrant.findUnique({ where: { id: grantId } });
  if (!grant) {
    throw ProblemError.notFound("Access grant not found");
  }

  const decision = canRevokeAccessGrant(actor, { patientId: grant.patientId, grantedBy: grant.grantedBy });
  if (!decision.allowed) {
    throw ProblemError.forbidden("You are not allowed to revoke this access grant");
  }

  if (grant.revokedAt) {
    return toGrantDto(grant);
  }

  const updated = await prisma.accessGrant.update({
    where: { id: grantId },
    data: { revokedAt: new Date() },
  });

  return toGrantDto(updated);
}

export async function listAccessGrants(actor: Actor, patientId: string) {
  const decision = canListAccessGrants(actor, patientId);
  if (!decision.allowed) {
    throw ProblemError.forbidden("You are not allowed to view this patient's access grants");
  }

  const patient = await prisma.patient.findUnique({ where: { id: patientId } });
  if (!patient) {
    throw ProblemError.notFound("Patient not found");
  }

  const grants = await prisma.accessGrant.findMany({
    where: { patientId },
    orderBy: { createdAt: "desc" },
  });

  return grants.map(toGrantDto);
}
