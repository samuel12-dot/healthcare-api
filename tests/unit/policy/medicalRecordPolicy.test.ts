import { describe, expect, it, vi } from "vitest";
import { canAccessMedicalRecords, canWriteMedicalRecord } from "../../../src/modules/policy/medicalRecordPolicy";
import type { Actor } from "../../../src/modules/policy/types";

const PATIENT_A = "patient-a";
const PATIENT_B = "patient-b";
const CLINICIAN = "clinician-1";

function actor(overrides: Partial<Actor> & Pick<Actor, "role" | "userId">): Actor {
  return overrides;
}

describe("medicalRecordPolicy.canAccessMedicalRecords (read)", () => {
  it("allows a patient to read their own records", async () => {
    const grantLookup = vi.fn();
    const decision = await canAccessMedicalRecords(
      actor({ userId: "u1", role: "patient", patientId: PATIENT_A }),
      PATIENT_A,
      grantLookup,
    );
    expect(decision).toEqual({ allowed: true, reason: "self" });
    expect(grantLookup).not.toHaveBeenCalled();
  });

  it("denies a patient reading someone else's records", async () => {
    const decision = await canAccessMedicalRecords(
      actor({ userId: "u1", role: "patient", patientId: PATIENT_A }),
      PATIENT_B,
      vi.fn(),
    );
    expect(decision).toEqual({ allowed: false, reason: "denied_not_self" });
  });

  it("allows a clinician with an active access grant", async () => {
    const grantLookup = vi.fn().mockResolvedValue(true);
    const decision = await canAccessMedicalRecords(
      actor({ userId: "u2", role: "clinician", clinicianId: CLINICIAN }),
      PATIENT_A,
      grantLookup,
    );
    expect(decision).toEqual({ allowed: true, reason: "active_grant" });
    expect(grantLookup).toHaveBeenCalledWith(PATIENT_A, CLINICIAN);
  });

  it("denies a clinician with no active access grant (invariant #1)", async () => {
    const grantLookup = vi.fn().mockResolvedValue(false);
    const decision = await canAccessMedicalRecords(
      actor({ userId: "u2", role: "clinician", clinicianId: CLINICIAN }),
      PATIENT_A,
      grantLookup,
    );
    expect(decision).toEqual({ allowed: false, reason: "denied_no_grant" });
  });

  it("denies a clinician actor missing a clinicianId (malformed token)", async () => {
    const grantLookup = vi.fn();
    const decision = await canAccessMedicalRecords(
      actor({ userId: "u2", role: "clinician" }),
      PATIENT_A,
      grantLookup,
    );
    expect(decision).toEqual({ allowed: false, reason: "denied_role" });
    expect(grantLookup).not.toHaveBeenCalled();
  });

  it("denies front_desk unconditionally, even with a grant present", async () => {
    const grantLookup = vi.fn().mockResolvedValue(true);
    const decision = await canAccessMedicalRecords(
      actor({ userId: "u3", role: "front_desk" }),
      PATIENT_A,
      grantLookup,
    );
    expect(decision).toEqual({ allowed: false, reason: "denied_role" });
    expect(grantLookup).not.toHaveBeenCalled();
  });

  it("denies admin unconditionally -- admins must use break-glass instead", async () => {
    const grantLookup = vi.fn().mockResolvedValue(true);
    const decision = await canAccessMedicalRecords(
      actor({ userId: "u4", role: "admin" }),
      PATIENT_A,
      grantLookup,
    );
    expect(decision).toEqual({ allowed: false, reason: "denied_role" });
    expect(grantLookup).not.toHaveBeenCalled();
  });
});

describe("medicalRecordPolicy.canWriteMedicalRecord (create/amend)", () => {
  it("denies a patient authoring their own record", async () => {
    const decision = await canWriteMedicalRecord(
      actor({ userId: "u1", role: "patient", patientId: PATIENT_A }),
      PATIENT_A,
      vi.fn(),
    );
    expect(decision).toEqual({ allowed: false, reason: "denied_role" });
  });

  it("allows a clinician with an active access grant", async () => {
    const grantLookup = vi.fn().mockResolvedValue(true);
    const decision = await canWriteMedicalRecord(
      actor({ userId: "u2", role: "clinician", clinicianId: CLINICIAN }),
      PATIENT_A,
      grantLookup,
    );
    expect(decision).toEqual({ allowed: true, reason: "active_grant" });
  });

  it("denies a clinician without an active access grant", async () => {
    const grantLookup = vi.fn().mockResolvedValue(false);
    const decision = await canWriteMedicalRecord(
      actor({ userId: "u2", role: "clinician", clinicianId: CLINICIAN }),
      PATIENT_A,
      grantLookup,
    );
    expect(decision).toEqual({ allowed: false, reason: "denied_no_grant" });
  });

  it("denies front_desk", async () => {
    const decision = await canWriteMedicalRecord(
      actor({ userId: "u3", role: "front_desk" }),
      PATIENT_A,
      vi.fn(),
    );
    expect(decision).toEqual({ allowed: false, reason: "denied_role" });
  });

  it("denies admin", async () => {
    const decision = await canWriteMedicalRecord(
      actor({ userId: "u4", role: "admin" }),
      PATIENT_A,
      vi.fn(),
    );
    expect(decision).toEqual({ allowed: false, reason: "denied_role" });
  });
});
