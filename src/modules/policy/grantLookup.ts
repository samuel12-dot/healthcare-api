import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../../lib/prisma";

export type GrantLookup = (patientId: string, clinicianId: string) => Promise<boolean>;

type Queryable = PrismaClient | Prisma.TransactionClient;

/**
 * Whether an active, non-revoked, non-expired AccessGrant exists for this
 * (patient, clinician) pair. This is the single source of truth behind
 * invariant #1 -- everything else (emergency access included) works by
 * creating a row this query will find, rather than special-casing checks.
 *
 * Bound to a specific client (module-level `prisma` or a `$transaction`
 * callback's `tx`) so callers that need the grant check and the subsequent
 * audit write to be atomic can pass the same `tx` through both.
 */
export function hasActiveGrantWith(client: Queryable): GrantLookup {
  return async (patientId, clinicianId) => {
    const now = new Date();
    const grant = await client.accessGrant.findFirst({
      where: {
        patientId,
        clinicianId,
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      select: { id: true },
    });
    return grant !== null;
  };
}

export const hasActiveGrant: GrantLookup = hasActiveGrantWith(prisma);
