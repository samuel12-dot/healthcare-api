import { allow, deny, type Actor, type PolicyDecision } from "./types";
import { hasActiveGrant as defaultHasActiveGrant, type GrantLookup } from "./grantLookup";

/**
 * Invariant #1: a clinician may only read or write a patient's
 * MedicalRecord rows if an active AccessGrant exists for that pair, or the
 * requester is the patient themselves. Emergency ("break-glass") access is
 * not special-cased here — POST /patients/:id/emergency-access creates a
 * time-boxed AccessGrant with reason=emergency_override plus a distinct
 * audit entry, so it flows through the exact same `hasActiveGrant` check.
 *
 * front_desk and admin get no path through this function at all: front_desk
 * is hard-denied, and admin has no special case, so an admin must go through
 * the same break-glass endpoint as a clinician to ever read record content.
 */
export async function canAccessMedicalRecords(
  actor: Actor,
  targetPatientId: string,
  hasActiveGrant: GrantLookup = defaultHasActiveGrant,
): Promise<PolicyDecision> {
  if (actor.role === "patient") {
    return actor.patientId === targetPatientId ? allow("self") : deny("denied_not_self");
  }

  if (actor.role === "clinician") {
    if (!actor.clinicianId) return deny("denied_role");
    const granted = await hasActiveGrant(targetPatientId, actor.clinicianId);
    return granted ? allow("active_grant") : deny("denied_no_grant");
  }

  // front_desk, admin: no blanket read access to medical record content.
  return deny("denied_role");
}

/** Same rule as read access, but a patient can never author their own record. */
export async function canWriteMedicalRecord(
  actor: Actor,
  targetPatientId: string,
  hasActiveGrant: GrantLookup = defaultHasActiveGrant,
): Promise<PolicyDecision> {
  if (actor.role !== "clinician" || !actor.clinicianId) return deny("denied_role");
  const granted = await hasActiveGrant(targetPatientId, actor.clinicianId);
  return granted ? allow("active_grant") : deny("denied_no_grant");
}
