import { prisma } from "../../lib/prisma";
import { ProblemError } from "../../lib/problem";
import { hashPassword, verifyPassword } from "./password";
import { signAccessToken } from "./jwt";
import { issueRefreshToken, rotateRefreshToken, revokeRefreshToken } from "./refreshTokenService";
import type { RegisterInput, LoginInput } from "./schemas";

async function loadProfileIds(userId: string) {
  const [patient, clinician] = await Promise.all([
    prisma.patient.findUnique({ where: { userId }, select: { id: true } }),
    prisma.clinician.findUnique({ where: { userId }, select: { id: true } }),
  ]);
  return { patientId: patient?.id, clinicianId: clinician?.id };
}

export async function register(input: RegisterInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw ProblemError.conflict("An account with this email already exists");
  }

  const passwordHash = await hashPassword(input.password);
  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      fullName: input.fullName,
      role: "patient",
    },
  });

  return { id: user.id, email: user.email, fullName: user.fullName, role: user.role };
}

export async function login(input: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user || !(await verifyPassword(user.passwordHash, input.password))) {
    throw ProblemError.unauthorized("Invalid email or password");
  }

  const { patientId, clinicianId } = await loadProfileIds(user.id);
  const accessToken = signAccessToken({ sub: user.id, role: user.role, patientId, clinicianId });
  const refresh = await issueRefreshToken(user.id);

  return {
    accessToken,
    refreshToken: refresh.value,
    refreshExpiresAt: refresh.expiresAt,
    user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role },
  };
}

export async function refresh(refreshToken: string) {
  const rotated = await rotateRefreshToken(refreshToken);
  const user = await prisma.user.findUnique({ where: { id: rotated.userId } });
  if (!user) {
    throw ProblemError.unauthorized("Invalid refresh token");
  }

  const { patientId, clinicianId } = await loadProfileIds(user.id);
  const accessToken = signAccessToken({ sub: user.id, role: user.role, patientId, clinicianId });

  return {
    accessToken,
    refreshToken: rotated.value,
    refreshExpiresAt: rotated.expiresAt,
  };
}

export async function logout(refreshToken: string) {
  await revokeRefreshToken(refreshToken);
}
