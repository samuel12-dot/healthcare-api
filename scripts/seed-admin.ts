import dotenv from "dotenv";
dotenv.config();

import { prisma } from "../src/lib/prisma";
import { hashPassword } from "../src/modules/auth/password";

/**
 * Bootstraps the very first admin account. Every other clinician/admin/
 * front_desk account is created via POST /admin/users once an admin exists
 * -- this script exists only to break that chicken-and-egg problem on a
 * fresh database.
 */
async function main() {
  const email = process.env.SEED_ADMIN_EMAIL ?? "admin@healthcare.local";
  const password = process.env.SEED_ADMIN_PASSWORD ?? "change-me-admin-password";

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Admin already exists: ${email}`);
    return;
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { email, passwordHash, fullName: "Seed Admin", role: "admin" },
  });

  console.log(`Created admin user ${user.email} (id=${user.id})`);
  console.log(`Password: ${password}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
