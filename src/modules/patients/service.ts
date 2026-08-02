import { prisma } from "../../lib/prisma";
import { ProblemError } from "../../lib/problem";
import type { Actor } from "../../modules/policy/types";
import { canCreatePatient, canUpdatePatientProfile, canViewPatientProfile } from "../../modules/policy/patientPolicy";
import type { CreatePatientInput, UpdatePatientInput } from "./schemas";

function toProfileDto(patient: {
  id: string;
  userId: string | null;
  dateOfBirth: Date;
  sex: string;
  phone: string | null;
  address: string | null;
  createdAt: Date;
}) {
  return {
    id: patient.id,
    userId: patient.userId,
    dateOfBirth: patient.dateOfBirth.toISOString().slice(0, 10),
    sex: patient.sex,
    phone: patient.phone,
    address: patient.address,
    createdAt: patient.createdAt.toISOString(),
  };
}

export async function createPatient(actor: Actor, input: CreatePatientInput) {
  const decision = canCreatePatient(actor);
  if (!decision.allowed) {
    throw ProblemError.forbidden("You are not allowed to create a patient record");
  }

  let userId: string | null = null;
  if (actor.role === "patient") {
    if (actor.patientId) {
      throw ProblemError.conflict("A patient profile already exists for this account");
    }
    userId = actor.userId;
  } else {
    userId = input.userId ?? null;
  }

  if (userId) {
    const existing = await prisma.patient.findUnique({ where: { userId } });
    if (existing) {
      throw ProblemError.conflict("A patient profile already exists for this user account");
    }
  }

  const patient = await prisma.patient.create({
    data: {
      userId,
      dateOfBirth: input.dateOfBirth,
      sex: input.sex,
      phone: input.phone,
      address: input.address,
    },
  });

  return toProfileDto(patient);
}

export async function getPatientProfile(actor: Actor, patientId: string) {
  const decision = canViewPatientProfile(actor, patientId);
  if (!decision.allowed) {
    throw ProblemError.forbidden("You are not allowed to view this patient's profile");
  }

  const patient = await prisma.patient.findUnique({ where: { id: patientId } });
  if (!patient) {
    throw ProblemError.notFound("Patient not found");
  }

  return toProfileDto(patient);
}

export async function updatePatientProfile(actor: Actor, patientId: string, input: UpdatePatientInput) {
  const decision = canUpdatePatientProfile(actor, patientId);
  if (!decision.allowed) {
    throw ProblemError.forbidden("You are not allowed to update this patient's profile");
  }

  const existing = await prisma.patient.findUnique({ where: { id: patientId } });
  if (!existing) {
    throw ProblemError.notFound("Patient not found");
  }

  const patient = await prisma.patient.update({
    where: { id: patientId },
    data: {
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.address !== undefined ? { address: input.address } : {}),
    },
  });

  return toProfileDto(patient);
}
