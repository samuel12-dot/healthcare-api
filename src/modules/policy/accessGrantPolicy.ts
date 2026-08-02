import { allow, deny, type Actor, type PolicyDecision } from "./types";

export function canCreateAccessGrant(actor: Actor, targetPatientId: string): PolicyDecision {
  if (actor.role === "admin") return allow("role:admin");
  if (actor.role === "patient") {
    return actor.patientId === targetPatientId ? allow("self") : deny("denied_not_self");
  }
  return deny("denied_role");
}

export function canRevokeAccessGrant(
  actor: Actor,
  grant: { patientId: string; grantedBy: string },
): PolicyDecision {
  if (actor.role === "admin") return allow("role:admin");
  if (actor.role === "patient" && actor.patientId === grant.patientId) return allow("self");
  if (actor.userId === grant.grantedBy) return allow("grantor");
  return deny("denied_role");
}

/** A patient can always see who currently has access to their own record. */
export function canListAccessGrants(actor: Actor, targetPatientId: string): PolicyDecision {
  if (actor.role === "admin") return allow("role:admin");
  if (actor.role === "patient") {
    return actor.patientId === targetPatientId ? allow("self") : deny("denied_not_self");
  }
  return deny("denied_role");
}
