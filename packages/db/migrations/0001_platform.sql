-- 0001_platform.sql
--
-- Platform baseline for AlgoCove.
--
-- Applied by the migration role (schema owner), never by the application runtime
-- role. This migration establishes only what later migrations depend on:
--
--   * the shared `set_updated_at` trigger function used by every mutable table;
--   * a bounded `healthcheck` function used by the readiness endpoint and by the
--     integration harness to prove that the runtime role can actually reach the
--     schema it was granted.
--
-- Domain tables arrive in later, phase-owned migrations (identity and platform
-- primitives in 0002-0004, curriculum in 0005, content in 0006, and so on).

CREATE FUNCTION platform.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION platform.set_updated_at() IS
  'Maintains updated_at on mutable rows. Attached per table so the contract is visible in the schema.';

-- Readiness probe. Bounded, stable, and safe for the runtime role: it exposes no
-- learner data and performs no writes.
CREATE FUNCTION platform.healthcheck()
RETURNS TABLE (
  ok boolean,
  server_time timestamptz,
  applied_migrations integer,
  schema_version text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT
    true AS ok,
    now() AS server_time,
    (SELECT count(*)::integer FROM platform.schema_migration) AS applied_migrations,
    COALESCE((SELECT max(migration_id) FROM platform.schema_migration), '0000') AS schema_version;
$$;

COMMENT ON FUNCTION platform.healthcheck() IS
  'Readiness probe for the application runtime role. Returns schema watermarks only.';

-- No EXECUTE grant is required: PostgreSQL grants EXECUTE on new functions to
-- PUBLIC by default, while the `platform` schema itself is reachable only by the
-- roles the bootstrap granted USAGE to. Role names therefore stay out of
-- migration files, and a deployment may choose its own role names.
