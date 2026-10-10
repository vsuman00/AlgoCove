import type { Queryable } from "../../../packages/db/src/connection.ts";
import { DATA_SCHEMAS } from "../../../packages/db/src/bootstrap.ts";

export type HostedDatabaseChecks = {
  readonly encryptedTransport: boolean;
  readonly runtimeRole: boolean;
  readonly pgvector: boolean;
  readonly phase11Schema: boolean;
};

/** Read-only inspection of the actual connection and role, never a role-name guess. */
export async function inspectHostedDatabase(database: Queryable): Promise<HostedDatabaseChecks> {
  const result = await database.query<{
    tls: boolean;
    runtime_role: boolean;
    pgvector: boolean;
    phase11_schema: boolean;
  }>(
    `SELECT
      EXISTS (SELECT 1 FROM pg_stat_ssl WHERE pid=pg_backend_pid() AND ssl) AS tls,
      NOT EXISTS (
        SELECT 1 FROM pg_roles r WHERE pg_has_role(current_user,r.oid,'MEMBER') AND
        (r.rolsuper OR r.rolcreatedb OR r.rolcreaterole OR r.rolreplication OR r.rolbypassrls
         OR r.rolname IN ('pg_read_all_data','pg_write_all_data','pg_read_server_files',
           'pg_write_server_files','pg_execute_server_program','pg_signal_backend','pg_monitor'))
      ) AND NOT has_database_privilege(current_user,current_database(),'CREATE')
      AND NOT EXISTS (
        SELECT 1 FROM pg_database d WHERE d.datname=current_database()
        AND pg_has_role(current_user,d.datdba,'MEMBER')
      ) AND NOT EXISTS (
        SELECT 1 FROM pg_namespace n WHERE (n.nspname=ANY($1::text[]) OR n.nspname='public')
        AND (pg_has_role(current_user,n.nspowner,'MEMBER')
          OR has_schema_privilege(current_user,n.oid,'CREATE'))
      ) AND NOT EXISTS (
        SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname=ANY($1::text[]) AND pg_has_role(current_user,c.relowner,'MEMBER')
      ) AND NOT EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
        WHERE n.nspname='platform'
          AND p.proname IN ('claim_privacy_deletion','confirm_privacy_cancellation',
            'complete_privacy_deletion','apply_privacy_retention')
          AND has_function_privilege(current_user,p.oid,'EXECUTE')
      ) AS runtime_role,
      EXISTS (SELECT 1 FROM pg_extension WHERE extname='vector') AS pgvector,
      (SELECT applied_migrations>=40 FROM platform.healthcheck()) AS phase11_schema`,
    [DATA_SCHEMAS],
  );
  const row = result.rows[0];
  return {
    encryptedTransport: row?.tls === true,
    runtimeRole: row?.runtime_role === true,
    pgvector: row?.pgvector === true,
    phase11Schema: row?.phase11_schema === true,
  };
}
