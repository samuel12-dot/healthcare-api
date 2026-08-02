import { allow, deny, type Actor, type PolicyDecision } from "./types";

/** Querying the audit trail is itself a sensitive, admin-only, audited action. */
export function canQueryAuditLog(actor: Actor): PolicyDecision {
  return actor.role === "admin" ? allow("role:admin") : deny("denied_role");
}

/** Only clinicians can invoke the break-glass path; admins are deliberately excluded. */
export function canRequestEmergencyAccess(actor: Actor): PolicyDecision {
  return actor.role === "clinician" && actor.clinicianId
    ? allow("role:clinician")
    : deny("denied_role");
}
