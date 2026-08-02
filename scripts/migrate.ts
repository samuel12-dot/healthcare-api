import { spawnSync } from "node:child_process";
import dotenv from "dotenv";

dotenv.config();

/**
 * The app's DATABASE_URL points at the restricted app_user role (least
 * privilege at runtime). Migrations need CREATE/ALTER, which app_user
 * doesn't have, so this wrapper swaps in DATABASE_MIGRATE_URL (the
 * superuser connection) only for the `prisma migrate` subprocess.
 */
const migrateUrl = process.env.DATABASE_MIGRATE_URL;
if (!migrateUrl) {
  console.error("DATABASE_MIGRATE_URL is not set");
  process.exit(1);
}

const args = process.argv.slice(2);
const result = spawnSync("npx", ["prisma", ...args], {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: migrateUrl },
  shell: process.platform === "win32",
});

process.exit(result.status ?? 1);
