import { allow, deny, type Actor, type PolicyDecision } from "./types";

export function canCreatePatient(actor: Actor): PolicyDecision {
  if (actor.role === "admin" || actor.role === "front_desk") return allow(`role:${actor.role}`);
  if (actor.role === "patient") return allow("self_service");
  return deny("denied_role");
}

/** Profile fields only (contact/demographic PII) — never MedicalRecord content. */
export function canViewPatientProfile(actor: Actor, targetPatientId: string): PolicyDecision {
  if (actor.role === "admin" || actor.role === "front_desk" || actor.role === "clinician") {
    return allow(`role:${actor.role}`);
  }
  if (actor.role === "patient") {
    return actor.patientId === targetPatientId ? allow("self") : deny("denied_not_self");
  }
  return deny("denied_role");
}

export function canUpdatePatientProfile(actor: Actor, targetPatientId: string): PolicyDecision {
  if (actor.role === "admin" || actor.role === "front_desk") return allow(`role:${actor.role}`);
  if (actor.role === "patient") {
    return actor.patientId === targetPatientId ? allow("self") : deny("denied_not_self");
  }
  return deny("denied_role");
}
