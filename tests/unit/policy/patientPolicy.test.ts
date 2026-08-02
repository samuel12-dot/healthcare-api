import { describe, expect, it } from "vitest";
import {
  canCreatePatient,
  canUpdatePatientProfile,
  canViewPatientProfile,
} from "../../../src/modules/policy/patientPolicy";
import type { Actor } from "../../../src/modules/policy/types";
import type { UserRole } from "@prisma/client";

const PATIENT_A = "patient-a";
const PATIENT_B = "patient-b";

function actorFor(role: Actor["role"], overrides: Partial<Actor> = {}): Actor {
  return { userId: `${role}-1`, role, ...overrides };
}

describe("patientPolicy.canCreatePatient", () => {
  it.each([
    ["admin", true],
    ["front_desk", true],
    ["patient", true],
    ["clinician", false],
  ] satisfies Array<[UserRole, boolean]>)("role=%s -> allowed=%s", (role, expected) => {
    expect(canCreatePatient(actorFor(role)).allowed).toBe(expected);
  });
});

describe("patientPolicy.canViewPatientProfile", () => {
  it.each([
    ["admin", true],
    ["front_desk", true],
    ["clinician", true],
  ] satisfies Array<[UserRole, boolean]>)("role=%s can view any patient's profile", (role, expected) => {
    expect(canViewPatientProfile(actorFor(role), PATIENT_A).allowed).toBe(expected);
  });

  it("allows a patient to view their own profile", () => {
    const decision = canViewPatientProfile(actorFor("patient", { patientId: PATIENT_A }), PATIENT_A);
    expect(decision).toEqual({ allowed: true, reason: "self" });
  });

  it("denies a patient viewing another patient's profile", () => {
    const decision = canViewPatientProfile(actorFor("patient", { patientId: PATIENT_A }), PATIENT_B);
    expect(decision).toEqual({ allowed: false, reason: "denied_not_self" });
  });
});

describe("patientPolicy.canUpdatePatientProfile", () => {
  it.each([
    ["admin", true],
    ["front_desk", true],
    ["clinician", false],
  ] satisfies Array<[UserRole, boolean]>)("role=%s -> allowed=%s", (role, expected) => {
    expect(canUpdatePatientProfile(actorFor(role), PATIENT_A).allowed).toBe(expected);
  });

  it("allows a patient to update their own profile", () => {
    expect(canUpdatePatientProfile(actorFor("patient", { patientId: PATIENT_A }), PATIENT_A).allowed).toBe(true);
  });

  it("denies a patient updating another patient's profile", () => {
    expect(canUpdatePatientProfile(actorFor("patient", { patientId: PATIENT_A }), PATIENT_B).allowed).toBe(false);
  });
});
