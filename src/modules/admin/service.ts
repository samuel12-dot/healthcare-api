import { prisma } from "../../lib/prisma";
import { ProblemError } from "../../lib/problem";
import { hashPassword } from "../auth/password";
import type { CreateUserInput } from "./schemas";

export async function createUserAsAdmin(input: CreateUserInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw ProblemError.conflict("An account with this email already exists");
  }

  const passwordHash = await hashPassword(input.password);

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: { email: input.email, passwordHash, fullName: input.fullName, role: input.role },
    });

    if (input.role === "clinician" && input.clinician) {
      await tx.clinician.create({
        data: {
          userId: created.id,
          specialty: input.clinician.specialty,
          licenseNumber: input.clinician.licenseNumber,
        },
      });
    }

    return created;
  });

  return { id: user.id, email: user.email, fullName: user.fullName, role: user.role };
}
