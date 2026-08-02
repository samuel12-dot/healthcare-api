import { describe, expect, it } from "vitest";
import {
  canCreateAppointment,
  canModifyAppointment,
  canViewPatientAppointments,
} from "../../../src/modules/policy/appointmentPolicy";
import type { Actor } from "../../../src/modules/policy/types";
import type { UserRole } from "@prisma/client";

const PATIENT_A = "patient-a";
const PATIENT_B = "patient-b";
const CLINICIAN_A = "clinician-a";
const CLINICIAN_B = "clinician-b";

function actorFor(role: Actor["role"], overrides: Partial<Actor> = {}): Actor {
  return { userId: `${role}-1`, role, ...overrides };
}

const target = { patientId: PATIENT_A, clinicianId: CLINICIAN_A };

describe("appointmentPolicy.canCreateAppointment", () => {
  it.each(["admin", "front_desk"] satisfies UserRole[])("allows role=%s to book for anyone", (role) => {
    expect(canCreateAppointment(actorFor(role), target).allowed).toBe(true);
  });

  it("allows a patient booking for themselves", () => {
    expect(canCreateAppointment(actorFor("patient", { patientId: PATIENT_A }), target).allowed).toBe(true);
  });

  it("denies a patient booking on behalf of someone else", () => {
    expect(canCreateAppointment(actorFor("patient", { patientId: PATIENT_B }), target).allowed).toBe(false);
  });

  it("allows a clinician booking their own slot", () => {
    expect(canCreateAppointment(actorFor("clinician", { clinicianId: CLINICIAN_A }), target).allowed).toBe(true);
  });

  it("denies a clinician booking a different clinician's slot", () => {
    expect(canCreateAppointment(actorFor("clinician", { clinicianId: CLINICIAN_B }), target).allowed).toBe(false);
  });
});

describe("appointmentPolicy.canModifyAppointment", () => {
  const appointment = { patientId: PATIENT_A, clinicianId: CLINICIAN_A };

  it.each(["admin", "front_desk"] satisfies UserRole[])("allows role=%s", (role) => {
    expect(canModifyAppointment(actorFor(role), appointment).allowed).toBe(true);
  });

  it("allows the patient on the appointment", () => {
    expect(canModifyAppointment(actorFor("patient", { patientId: PATIENT_A }), appointment).allowed).toBe(true);
  });

  it("denies a different patient", () => {
    expect(canModifyAppointment(actorFor("patient", { patientId: PATIENT_B }), appointment).allowed).toBe(false);
  });

  it("allows the clinician on the appointment", () => {
    expect(canModifyAppointment(actorFor("clinician", { clinicianId: CLINICIAN_A }), appointment).allowed).toBe(
      true,
    );
  });

  it("denies a different clinician", () => {
    expect(canModifyAppointment(actorFor("clinician", { clinicianId: CLINICIAN_B }), appointment).allowed).toBe(
      false,
    );
  });
});

describe("appointmentPolicy.canViewPatientAppointments", () => {
  it.each(["admin", "front_desk", "clinician"] satisfies UserRole[])("allows role=%s", (role) => {
    expect(canViewPatientAppointments(actorFor(role), PATIENT_A).allowed).toBe(true);
  });

  it("allows the patient viewing their own appointment history", () => {
    expect(canViewPatientAppointments(actorFor("patient", { patientId: PATIENT_A }), PATIENT_A).allowed).toBe(
      true,
    );
  });

  it("denies a patient viewing someone else's appointment history", () => {
    expect(canViewPatientAppointments(actorFor("patient", { patientId: PATIENT_B }), PATIENT_A).allowed).toBe(
      false,
    );
  });
});
