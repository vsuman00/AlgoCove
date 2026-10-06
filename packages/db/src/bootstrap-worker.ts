import { createPool } from "./connection.ts";
import { withTransaction } from "./transaction.ts";

function identifier(value: string): string {
  return '"' + value.replaceAll('"', '""') + '"';
}
function literal(value: string): string {
  return "'" + value.replaceAll("'", "''") + "'";
}
/** Provision a new dedicated maintenance-worker login. Never widen an existing role. */
export async function bootstrapWorkerRole(input: {
  operatorConnectionString: string;
  name: string;
  password: string;
  capability?: "maintenance" | "content_indexing";
}): Promise<void> {
  if (
    (input.capability !== undefined &&
      !["maintenance", "content_indexing"].includes(input.capability)) ||
    !/^[a-z][a-z0-9_]{0,62}$/.test(input.name) ||
    input.password.length < 16 ||
    input.password.includes("\0")
  )
    throw Error("Invalid dedicated worker role configuration.");
  const pool = createPool({
    connectionString: input.operatorConnectionString,
    applicationName: "worker-role-bootstrap",
    maxConnections: 1,
    statementTimeoutMs: 5000,
  });
  try {
    await withTransaction(
      pool,
      async (tx) => {
        const existing = await tx.query("SELECT 1 FROM pg_roles WHERE rolname=$1", [input.name]);
        if (existing.rowCount)
          throw Error(
            "Worker role already exists; role changes require a separate reviewed operation.",
          );
        const database = (await tx.query<{ name: string }>("SELECT current_database() AS name"))
          .rows[0]!.name;
        const role = identifier(input.name);
        await tx.query(
          `CREATE ROLE ${role} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT PASSWORD ${literal(input.password)}`,
        );
        await tx.query(`GRANT CONNECT ON DATABASE ${identifier(database)} TO ${role}`);
        await tx.query(`GRANT USAGE ON SCHEMA platform,content,practice,search TO ${role}`);
        await tx.query(`GRANT SELECT,UPDATE ON platform.outbox_event TO ${role}`);
        await tx.query(`GRANT SELECT,INSERT ON platform.worker_effect_receipt TO ${role}`);
        await tx.query(`GRANT SELECT,UPDATE ON platform.worker_derivation_expectation TO ${role}`);
        await tx.query(
          `GRANT SELECT(content_version_id,checksum,status,payload_status,rights_expires_at) ON content.content_version TO ${role}`,
        );
        await tx.query(
          `GRANT SELECT(index_id,content_version_id,source_checksum,state,created_at,valid_until),UPDATE(state) ON search.content_index TO ${role}`,
        );
        if (input.capability === "content_indexing") {
          await tx.query(`GRANT USAGE ON SCHEMA learning,search,public TO ${role}`);
          await tx.query(`GRANT EXECUTE ON FUNCTION content.lock_index_source(text) TO ${role}`);
          await tx.query(
            `GRANT SELECT(title,provenance_kind,published_at) ON content.content_version TO ${role}`,
          );
          await tx.query(
            `GRANT SELECT ON content.problem_version,content.problem_hint,content.problem_language_manifest,learning.problem_concept,learning.curriculum_node,learning.curriculum_graph_version TO ${role}`,
          );
          await tx.query(
            `GRANT SELECT,INSERT ON search.content_index,search.content_chunk,search.embedding_configuration,search.chunk_embedding,search.index_failure TO ${role}`,
          );
          await tx.query(`GRANT UPDATE(state) ON search.content_index TO ${role}`);
        } else {
          await tx.query(`GRANT SELECT(draft_id,expires_at),DELETE ON practice.draft TO ${role}`);
          await tx.query(
            `GRANT SELECT(draft_id,revision,expires_at),DELETE ON practice.draft_revision TO ${role}`,
          );
        }
      },
      { statementTimeoutMs: 5000 },
    );
  } finally {
    await pool.end();
  }
}
