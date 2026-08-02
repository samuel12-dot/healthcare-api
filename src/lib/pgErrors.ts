import { Prisma } from "@prisma/client";

/** Postgres SQLSTATE codes relevant to raw queries run through Prisma's $executeRaw/$queryRaw. */
export const PG_EXCLUSION_VIOLATION = "23P01";
export const PG_UNIQUE_VIOLATION = "23505";
export const PG_DEADLOCK_DETECTED = "40P01";

function rawQueryErrorCode(err: unknown): string | undefined {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2010") {
    const meta = err.meta as { code?: string } | undefined;
    return meta?.code;
  }
  return undefined;
}

export function isPgErrorCode(err: unknown, code: string): boolean {
  return rawQueryErrorCode(err) === code;
}

/**
 * Concurrent inserts/updates against a GiST exclusion constraint can
 * genuinely deadlock each other (Postgres takes locks on the conflicting
 * tuples it finds while checking the constraint, and two transactions
 * checking against each other's in-flight rows can form a cycle). This is
 * a transient artifact of the locking strategy, not evidence the operation
 * itself is invalid, so it's retried a handful of times with jittered
 * backoff before giving up.
 */
export async function withDeadlockRetry<T>(fn: () => Promise<T>, maxAttempts = 8): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (isPgErrorCode(err, PG_DEADLOCK_DETECTED) && attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, Math.random() * 25 * attempt));
        continue;
      }
      throw err;
    }
  }
  /* istanbul ignore next -- unreachable: loop always returns or throws */
  throw new Error("unreachable");
}
