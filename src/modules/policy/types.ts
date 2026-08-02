import type { UserRole } from "@prisma/client";

export interface Actor {
  userId: string;
  role: UserRole;
  patientId?: string;
  clinicianId?: string;
}

export type DenyReason =
  | "denied_role"
  | "denied_not_self"
  | "denied_no_grant";

export type AllowReason =
  | "self"
  | "self_service"
  | "grantor"
  | "active_grant"
  | `role:${UserRole}`;

export interface PolicyDecision {
  allowed: boolean;
  reason: AllowReason | DenyReason;
}

export function allow(reason: AllowReason): PolicyDecision {
  return { allowed: true, reason };
}

export function deny(reason: DenyReason): PolicyDecision {
  return { allowed: false, reason };
}
