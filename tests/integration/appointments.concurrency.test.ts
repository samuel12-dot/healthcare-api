import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../src/lib/prisma";
import { hashPassword } from "../../src/modules/auth/password";
import { createAppointment } from "../../src/modules/appointments/service";
import { ProblemError } from "../../src/lib/problem";
import type { Actor } from "../../src/modules/policy/types";

/**
 * Section 4/8: fire many concurrent booking requests for overlapping slots
 * against the same clinician and assert exactly one wins. This exercises
 * the real appointments_no_overlap_per_clinician EXCLUDE constraint under
 * genuine concurrency -- an application-level "check then insert" could
 * pass this test with mocks but fail here, since 20 requests can all read
 * "no conflict yet" before any of them commits.
 */
describe("appointment booking concurrency", () => {
  let adminUserId: string;
  let clinicianId: string;
  let patientIds: string[] = [];

  beforeAll(async () => {
    const admin = await prisma.user.create({
      data: {
        email: `concurrency-admin-${randomUUID()}@test.local`,
        passwordHash: await hashPassword("irrelevant-password-1"),
        fullName: "Concurrency Test Admin",
        role: "admin",
      },
    });
    adminUserId = admin.id;

    const clinicianUser = await prisma.user.create({
      data: {
        email: `concurrency-doc-${randomUUID()}@test.local`,
        passwordHash: await hashPassword("irrelevant-password-1"),
        fullName: "Concurrency Test Doc",
        role: "clinician",
      },
    });
    const clinician = await prisma.clinician.create({
      data: { userId: clinicianUser.id, specialty: "Testing", licenseNumber: "LIC-CONCURRENCY" },
    });
    clinicianId = clinician.id;

    patientIds = await Promise.all(
      Array.from({ length: 20 }, async (_, i) => {
        const patientUser = await prisma.user.create({
          data: {
            email: `concurrency-pat-${i}-${randomUUID()}@test.local`,
            passwordHash: await hashPassword("irrelevant-password-1"),
            fullName: `Concurrency Test Patient ${i}`,
            role: "patient",
          },
        });
        const patient = await prisma.patient.create({
          data: { userId: patientUser.id, dateOfBirth: new Date("1990-01-01"), sex: "unspecified" },
        });
        return patient.id;
      }),
    );
  });

  afterAll(async () => {
    await prisma.appointment.deleteMany({ where: { clinicianId } });
    await prisma.clinician.deleteMany({ where: { id: clinicianId } });
    await prisma.patient.deleteMany({ where: { id: { in: patientIds } } });
    await prisma.user.deleteMany({
      where: { id: { in: [adminUserId] } },
    });
    await prisma.user.deleteMany({ where: { email: { contains: "concurrency-" } } });
  });

  it("lets exactly one of 20 concurrent overlapping bookings succeed", async () => {
    const actor: Actor = { userId: adminUserId, role: "admin" };
    const startTime = new Date("2027-03-15T10:00:00.000Z");
    const endTime = new Date("2027-03-15T10:30:00.000Z");

    const attempts = patientIds.map((patientId, i) =>
      createAppointment(
        actor,
        { patientId, clinicianId, startTime, endTime },
        `concurrency-key-${i}-${randomUUID()}`,
      ).then(
        (value) => ({ status: "fulfilled" as const, value }),
        (error) => ({ status: "rejected" as const, error }),
      ),
    );

    const results = await Promise.all(attempts);

    const succeeded = results.filter((r) => r.status === "fulfilled");
    const conflicted = results.filter(
      (r) => r.status === "rejected" && r.error instanceof ProblemError && r.error.status === 409,
    );
    const unexpected = results.filter(
      (r) => r.status === "rejected" && !(r.error instanceof ProblemError && r.error.status === 409),
    );

    expect(unexpected).toHaveLength(0);
    expect(succeeded).toHaveLength(1);
    expect(conflicted).toHaveLength(19);

    const rowsInDb = await prisma.appointment.count({
      where: { clinicianId, status: { not: "cancelled" } },
    });
    expect(rowsInDb).toBe(1);
  });
});
