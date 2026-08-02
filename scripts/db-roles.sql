-- Restricted runtime DB role. Run as a superuser AFTER migrations, using
-- DATABASE_MIGRATE_URL. The app itself connects as app_user (DATABASE_URL),
-- which physically cannot UPDATE or DELETE medical_records or
-- audit_log_entries -- invariants #3 and #5 are enforced by Postgres GRANTs,
-- not application code, so a bug or compromised app process cannot mutate
-- or erase either table.

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user WITH LOGIN PASSWORD 'app_password';
  END IF;
END
$$;

GRANT CONNECT ON DATABASE healthcare TO app_user;
GRANT USAGE ON SCHEMA public TO app_user;

-- Default: full CRUD for everything else the app owns.
GRANT SELECT, INSERT, UPDATE, DELETE ON
  users,
  refresh_tokens,
  patients,
  clinicians,
  appointments,
  access_grants
TO app_user;

-- Append-only tables: INSERT + SELECT only. No UPDATE, no DELETE, ever.
REVOKE UPDATE, DELETE ON medical_records FROM app_user;
GRANT SELECT, INSERT ON medical_records TO app_user;

REVOKE UPDATE, DELETE ON audit_log_entries FROM app_user;
GRANT SELECT, INSERT ON audit_log_entries TO app_user;

-- Prisma's uuid()/enum defaults are generated client-side, so no sequence
-- grants are required. Re-run this script (idempotent) after any migration
-- that adds a new table the app needs to touch.
