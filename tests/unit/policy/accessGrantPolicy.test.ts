import { describe, expect, it } from "vitest";
import {
  canCreateAccessGrant,
  canListAccessGrants,
  canRevokeAccessGrant,
} from "../../../src/modules/policy/accessGrantPolicy";
import type { Actor } from "../../../src/modules/policy/types";
import type { UserRole } from "@prisma/client";

const PATIENT_A = "patient-a";
const PATIENT_B = "patient-b";

function actorFor(role: Actor["role"], overrides: Partial<Actor> = {}): Actor {
  return { userId: `${role}-1`, role, ...overrides };
}

describe("accessGrantPolicy.canCreateAccessGrant", () => {
  it("allows admin to grant access for any patient", () => {
    expect(canCreateAccessGrant(actorFor("admin"), PATIENT_A).allowed).toBe(true);
  });

  it("allows a patient to grant access to their own record", () => {
    expect(canCreateAccessGrant(actorFor("patient", { patientId: PATIENT_A }), PATIENT_A).allowed).toBe(true);
  });

  it("denies a patient granting access to someone else's record", () => {
    expect(canCreateAccessGrant(actorFor("patient", { patientId: PATIENT_A }), PATIENT_B).allowed).toBe(false);
  });

  it.each(["clinician", "front_desk"] satisfies UserRole[])("denies role=%s", (role) => {
    expect(canCreateAccessGrant(actorFor(role), PATIENT_A).allowed).toBe(false);
  });
});

describe("accessGrantPolicy.canRevokeAccessGrant", () => {
  const grant = { patientId: PATIENT_A, grantedBy: "grantor-user-id" };

  it("allows admin", () => {
    expect(canRevokeAccessGrant(actorFor("admin"), grant).allowed).toBe(true);
  });

  it("allows the patient who owns the grant", () => {
    expect(canRevokeAccessGrant(actorFor("patient", { patientId: PATIENT_A }), grant).allowed).toBe(true);
  });

  it("denies a different patient", () => {
    expect(canRevokeAccessGrant(actorFor("patient", { patientId: PATIENT_B }), grant).allowed).toBe(false);
  });

  it("allows the original grantor regardless of role", () => {
    const decision = canRevokeAccessGrant(
      { userId: "grantor-user-id", role: "front_desk" },
      grant,
    );
    expect(decision).toEqual({ allowed: true, reason: "grantor" });
  });

  it("denies an unrelated clinician", () => {
    expect(canRevokeAccessGrant(actorFor("clinician"), grant).allowed).toBe(false);
  });
});

describe("accessGrantPolicy.canListAccessGrants", () => {
  it("allows admin", () => {
    expect(canListAccessGrants(actorFor("admin"), PATIENT_A).allowed).toBe(true);
  });

  it("allows the patient themselves -- 'who has access to my record' must be self-serve", () => {
    expect(canListAccessGrants(actorFor("patient", { patientId: PATIENT_A }), PATIENT_A).allowed).toBe(true);
  });

  it("denies a different patient", () => {
    expect(canListAccessGrants(actorFor("patient", { patientId: PATIENT_B }), PATIENT_A).allowed).toBe(false);
  });

  it.each(["clinician", "front_desk"] satisfies UserRole[])("denies role=%s", (role) => {
    expect(canListAccessGrants(actorFor(role), PATIENT_A).allowed).toBe(false);
  });
});
