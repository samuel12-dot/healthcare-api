import { describe, expect, it } from "vitest";
import { canQueryAuditLog, canRequestEmergencyAccess } from "../../../src/modules/policy/auditPolicy";
import type { Actor } from "../../../src/modules/policy/types";
import type { UserRole } from "@prisma/client";

function actorFor(role: Actor["role"], overrides: Partial<Actor> = {}): Actor {
  return { userId: `${role}-1`, role, ...overrides };
}

describe("auditPolicy.canQueryAuditLog", () => {
  it("allows admin", () => {
    expect(canQueryAuditLog(actorFor("admin"))).toEqual({ allowed: true, reason: "role:admin" });
  });

  it.each(["patient", "clinician", "front_desk"] satisfies UserRole[])("denies role=%s", (role) => {
    expect(canQueryAuditLog(actorFor(role)).allowed).toBe(false);
  });
});

describe("auditPolicy.canRequestEmergencyAccess", () => {
  it("allows a clinician with a clinicianId", () => {
    expect(canRequestEmergencyAccess(actorFor("clinician", { clinicianId: "c1" }))).toEqual({
      allowed: true,
      reason: "role:clinician",
    });
  });

  it("denies a clinician actor missing a clinicianId", () => {
    expect(canRequestEmergencyAccess(actorFor("clinician")).allowed).toBe(false);
  });

  it.each(["patient", "admin", "front_desk"] satisfies UserRole[])(
    "denies role=%s -- admins must not get a break-glass shortcut of their own",
    (role) => {
      expect(canRequestEmergencyAccess(actorFor(role)).allowed).toBe(false);
    },
  );
});
