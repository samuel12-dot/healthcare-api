import { randomUUID } from "node:crypto";
import type { Prisma, AuditAction } from "@prisma/client";

export interface AuditEntryInput {
  actorUserId: string;
  action: AuditAction;
  resourceType: string;
  resourceId: string;
  patientId?: string | null;
  metadata?: Record<string, unknown> | null;
}

/**
 * Raw SQL by design (Section 5 / Section 4 of the spec): audit writes must
 * not go through an ORM abstraction that could hide the transaction
 * boundary. Callers pass the same `tx` they used for the authorization
 * check and the resource read/write, so a denied read is logged in the
 * exact same transaction as the denial -- there is no window where a read
 * happens without its corresponding entry existing.
 */
export async function writeAuditEntry(
  tx: Prisma.TransactionClient,
  entry: AuditEntryInput,
): Promise<void> {
  const id = randomUUID();
  const metadataJson = entry.metadata ? JSON.stringify(entry.metadata) : null;

  await tx.$executeRaw`
    INSERT INTO audit_log_entries
      (id, actor_user_id, action, resource_type, resource_id, patient_id, metadata, occurred_at)
    VALUES
      (${id}::uuid,
       ${entry.actorUserId}::uuid,
       ${entry.action}::"AuditAction",
       ${entry.resourceType},
       ${entry.resourceId}::uuid,
       ${entry.patientId ?? null}::uuid,
       ${metadataJson}::jsonb,
       now())
  `;
}
