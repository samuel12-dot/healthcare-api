import { randomUUID } from "node:crypto";
import { prisma } from "../../lib/prisma";
import { env } from "../../config/env";
import { generateRefreshTokenValue, hashRefreshToken } from "./jwt";
import { ProblemError } from "../../lib/problem";

/** Issues a brand-new refresh token starting a new rotation family (login). */
export async function issueRefreshToken(userId: string) {
  const family = randomUUID();
  return createAndPersistToken(userId, family);
}

async function createAndPersistToken(userId: string, family: string) {
  const value = generateRefreshTokenValue();
  const tokenHash = hashRefreshToken(value);
  const expiresAt = new Date(Date.now() + env.JWT_REFRESH_TTL_SECONDS * 1000);

  const row = await prisma.refreshToken.create({
    data: { userId, tokenHash, family, expiresAt },
  });

  return { id: row.id, value, family, expiresAt };
}

/**
 * Rotates a refresh token: the presented token is consumed and a new one is
 * issued in the same family. If a token that was already revoked/replaced is
 * presented again, that's a signal of token theft (the legitimate holder
 * already rotated past it) — the entire family is revoked and reuse is
 * rejected, forcing re-login.
 */
export async function rotateRefreshToken(presentedToken: string) {
  const tokenHash = hashRefreshToken(presentedToken);
  const existing = await prisma.refreshToken.findUnique({ where: { tokenHash } });

  if (!existing) {
    throw ProblemError.unauthorized("Invalid refresh token");
  }

  if (existing.revokedAt) {
    await prisma.refreshToken.updateMany({
      where: { family: existing.family, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw ProblemError.unauthorized("Refresh token reuse detected; session revoked");
  }

  if (existing.expiresAt < new Date()) {
    throw ProblemError.unauthorized("Refresh token expired");
  }

  const next = await createAndPersistToken(existing.userId, existing.family);

  await prisma.refreshToken.update({
    where: { id: existing.id },
    data: { revokedAt: new Date(), replacedBy: next.id },
  });

  return { userId: existing.userId, ...next };
}

export async function revokeRefreshToken(presentedToken: string) {
  const tokenHash = hashRefreshToken(presentedToken);
  await prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function revokeAllForUser(userId: string) {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
