import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";
import dotenv from "dotenv";

dotenv.config();

async function main() {
  const connectionString = process.env.DATABASE_MIGRATE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_MIGRATE_URL is not set");
  }

  const sql = readFileSync(join(__dirname, "db-roles.sql"), "utf8");
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query(sql);
    // eslint-disable-next-line no-console
    console.log("Applied scripts/db-roles.sql (restricted app_user grants)");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
