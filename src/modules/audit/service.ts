import { randomUUID } from "node:crypto";
import type { AuditLogEntry, Prisma, AuditAction } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { ProblemError } from "../../lib/problem";
import { decodeCursor, encodeCursor } from "../../lib/cursor";
import type { Actor } from "../policy/types";
import { canQueryAuditLog } from "../policy/auditPolicy";
import type { AuditLogQuery } from "./schemas";

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

function toAuditDto(entry: AuditLogEntry) {
  return {
    id: entry.id,
    actorUserId: entry.actorUserId,
    action: entry.action,
    resourceType: entry.resourceType,
    resourceId: entry.resourceId,
    patientId: entry.patientId,
    metadata: entry.metadata,
    occurredAt: entry.occurredAt.toISOString(),
  };
}

/**
 * GET /admin/audit-log is the proof-point endpoint for the whole project,
 * and per Section 5 querying it is itself a sensitive action: every call
 * writes its own AuditLogEntry (action=view, resourceType=audit_log) in the
 * same transaction as the query, so "who looked at the audit trail, and
 * with what filters" is answerable from the audit trail itself.
 */
export async function queryAuditLog(actor: Actor, query: AuditLogQuery) {
  const decision = canQueryAuditLog(actor);
  if (!decision.allowed) {
    throw ProblemError.forbidden("Only admins may query the audit log");
  }

  const where: Prisma.AuditLogEntryWhereInput = {};
  if (query.patient_id) where.patientId = query.patient_id;
  if (query.actor_user_id) where.actorUserId = query.actor_user_id;
  if (query.action) where.action = query.action;
  if (query.from || query.to) {
    where.occurredAt = {
      ...(query.from ? { gte: query.from } : {}),
      ...(query.to ? { lte: query.to } : {}),
    };
  }

  const cursor = query.cursor ? decodeCursor(query.cursor) : null;
  if (cursor) {
    where.OR = [
      { occurredAt: { lt: new Date(cursor.createdAt) } },
      { occurredAt: new Date(cursor.createdAt), id: { lt: cursor.id } },
    ];
  }

  const { entries, nextCursor } = await prisma.$transaction(async (tx) => {
    const rows = await tx.auditLogEntry.findMany({
      where,
      orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
      take: query.limit + 1,
    });

    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;
    const last = page[page.length - 1];
    const next = hasMore && last ? encodeCursor({ createdAt: last.occurredAt.toISOString(), id: last.id }) : null;

    await writeAuditEntry(tx, {
      actorUserId: actor.userId,
      action: "view",
      resourceType: "audit_log",
      resourceId: actor.userId,
      patientId: query.patient_id ?? null,
      metadata: {
        filters: {
          patientId: query.patient_id ?? null,
          actorUserId: query.actor_user_id ?? null,
          action: query.action ?? null,
          from: query.from?.toISOString() ?? null,
          to: query.to?.toISOString() ?? null,
        },
        resultCount: page.length,
      },
    });

    return { entries: page, nextCursor: next };
  });

  return { data: entries.map(toAuditDto), nextCursor };
}
