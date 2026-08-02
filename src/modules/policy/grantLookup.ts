import { prisma } from "../../lib/prisma";

/**
 * Whether an active, non-revoked, non-expired AccessGrant exists for this
 * (patient, clinician) pair. This is the single source of truth behind
 * invariant #1 — everything else (emergency access included) works by
 * creating a row this query will find, rather than special-casing checks.
 */
export async function hasActiveGrant(patientId: string, clinicianId: string): Promise<boolean> {
  const now = new Date();
  const grant = await prisma.accessGrant.findFirst({
    where: {
      patientId,
      clinicianId,
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    select: { id: true },
  });
  return grant !== null;
}

export type GrantLookup = typeof hasActiveGrant;
