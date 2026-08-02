import { allow, deny, type Actor, type PolicyDecision } from "./types";

export function canCreateAppointment(
  actor: Actor,
  target: { patientId: string; clinicianId: string },
): PolicyDecision {
  if (actor.role === "admin" || actor.role === "front_desk") return allow(`role:${actor.role}`);
  if (actor.role === "patient") {
    return actor.patientId === target.patientId ? allow("self") : deny("denied_not_self");
  }
  if (actor.role === "clinician") {
    return actor.clinicianId === target.clinicianId ? allow("self") : deny("denied_not_self");
  }
  return deny("denied_role");
}

export function canModifyAppointment(
  actor: Actor,
  appointment: { patientId: string; clinicianId: string },
): PolicyDecision {
  if (actor.role === "admin" || actor.role === "front_desk") return allow(`role:${actor.role}`);
  if (actor.role === "patient" && actor.patientId === appointment.patientId) return allow("self");
  if (actor.role === "clinician" && actor.clinicianId === appointment.clinicianId) return allow("self");
  return deny("denied_role");
}

export function canViewPatientAppointments(actor: Actor, targetPatientId: string): PolicyDecision {
  if (actor.role === "admin" || actor.role === "front_desk" || actor.role === "clinician") {
    return allow(`role:${actor.role}`);
  }
  if (actor.role === "patient") {
    return actor.patientId === targetPatientId ? allow("self") : deny("denied_not_self");
  }
  return deny("denied_role");
}
