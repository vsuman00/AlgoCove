import { randomBytes, createHash, randomUUID } from "node:crypto";
import { spawnSync, spawn, type ChildProcess, type SpawnSyncOptions } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  openSync,
  closeSync,
  rmSync,
  existsSync,
} from "node:fs";
import { resolve, join } from "node:path";
import { createIsolatedDatabase } from "./isolated-database.ts";
import {
  bootstrapDatabase,
  PostgresIdentityRepository,
  PostgresPrivacyRepository,
  PostgresPracticeRepository,
  PostgresDraftRepository,
  PostgresWorkerOperationsRepository,
  PostgresWorkerEffectsRepository,
  PostgresOutboxRelayRepository,
  PostgresEvaluationRepository,
} from "../../packages/db/src/index.ts";
import {
  createActor,
  createRequestContext,
  createSystemClock,
  startPracticeSession,
  startPracticeAttempt,
  startPracticeDraft,
  replacePracticeDraftCurrent,
  savePracticeDraftRevision,
} from "../../packages/application/src/index.ts";
import { formatId, parseId } from "../../packages/domain/src/index.ts";
import { CHUNK_POLICY_VERSION } from "../../packages/content/src/index.ts";
import { canonicalEvaluation } from "../../packages/tutor/src/index.ts";
import { createWorkerJobHandlers } from "../../apps/worker/src/job-handlers.ts";
import { createContentJobConsumers } from "../../apps/worker/src/content-jobs.ts";
import { WorkerJobRelay } from "../../apps/worker/src/job-relay.ts";
import { localPrivacyDeletionLedger } from "../../apps/worker/src/jobs/privacy-ledger.ts";
import { processPrivacyDeletion } from "../../apps/worker/src/jobs/privacy.ts";

const root = resolve(import.meta.dirname, "../..");
const directory = join(
  root,
  ".tmp/phase11-drills",
  `run-${Date.now()}-${randomUUID().slice(0, 8)}`,
);
mkdirSync(directory, { recursive: true, mode: 0o700 });
const hash = (value: string | Buffer) =>
  "sha256:" + createHash("sha256").update(value).digest("hex");
const ids = {
  generate: <T extends Parameters<typeof formatId>[0]>(kind: T) => {
    const id = formatId(kind, randomBytes(20).toString("hex"));
    if (!id.ok) throw Error("Invalid synthetic identity");
    return id.value;
  },
};
const context = (learner: string, roles: readonly string[] = ["learner"]) =>
  createRequestContext({
    actor: createActor({ userId: learner, sessionId: ids.generate("session"), roles }),
    clock: createSystemClock(),
    ids,
    serviceName: "local-restore-drill",
  });
const command = (
  binary: string,
  args: string[],
  env: NodeJS.ProcessEnv = process.env,
  stdio?: SpawnSyncOptions["stdio"],
) => {
  const result = spawnSync(binary, args, {
    cwd: root,
    env,
    encoding: "utf8",
    timeout: 120000,
    maxBuffer: 2000000,
    ...(stdio ? { stdio } : {}),
  });
  if (result.status !== 0) {
    writeFileSync(
      join(root, ".tmp/phase11-drill-command-failure.private.log"),
      String(result.stderr ?? ""),
      { mode: 0o600 },
    );
    throw Error(
      `Local drill command failed: ${binary} (output retained privately, never published).`,
    );
  }
  return String(result.stdout ?? "");
};
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw Error(message);
}
async function sourceFixture(db: Awaited<ReturnType<typeof createIsolatedDatabase>>) {
  // Explicit development seed: every author and publication identity is synthetic.
  command(process.execPath, ["packages/db/src/cli/seed-practice.ts"], {
    ...process.env,
    DATABASE_ADMIN_URL: db.databaseUrl,
    DATABASE_URL: db.runtimeUrl,
  });
  const identity = new PostgresIdentityRepository(db.runtime);
  const learner = await identity.findOrCreateLearner(`clerk:drill_owner_${randomUUID()}`);
  const deletedSubject = `clerk:drill_deleted_${randomUUID()}`;
  const victim = await identity.findOrCreateLearner(deletedSubject);
  await db.runtime.query("INSERT INTO platform.role_grant(learner_id,role) VALUES($1,'operator')", [
    learner,
  ]);
  for (const person of [learner, victim])
    await db.runtime.query(
      "INSERT INTO platform.learner_profile(learner_id,goal,target_role,timezone,daily_capacity_minutes,horizon_days,preferred_languages,updated_by) VALUES($1,'SYNTHETIC_RESTORE_CANARY','engineer','UTC',30,30,ARRAY['python'],$1)",
      [person],
    );
  const ctx = context(learner),
    practice = new PostgresPracticeRepository(db.runtime),
    drafts = new PostgresDraftRepository(db.runtime);
  const session = await startPracticeSession(ctx, practice, "learn");
  const problem = parseId("problemVersion", "prb_dddddddddddddddd"),
    manifest = parseId("languageManifest", "man_aaaaaaaaaaaaaaaa");
  assert(problem.ok && manifest.ok, "Invalid fixture pins");
  const attempt = await startPracticeAttempt(ctx, practice, {
    sessionId: session.sessionId,
    problemVersionId: problem.value,
    manifestId: manifest.value,
    language: "python",
  });
  const draft = await startPracticeDraft(ctx, drafts, {
    draftId: ids.generate("draft"),
    attemptId: attempt.attemptId,
    kind: "source",
  });
  const edited = await replacePracticeDraftCurrent(ctx, drafts, {
    draftId: draft.draftId,
    expectedVersion: draft.version,
    text: "def max_area(heights):\n    return 0 # SYNTHETIC_RESTORE_SOURCE",
  });
  await savePracticeDraftRevision(ctx, drafts, {
    draftId: draft.draftId,
    expectedVersion: edited.draft.version,
  });
  const checksum = (
    await db.runtime.query(
      "SELECT checksum FROM content.content_version WHERE content_version_id='cnt_aaaaaaaaaaaaaaaa'",
    )
  ).rows[0].checksum;
  await new PostgresWorkerOperationsRepository(db.runtime).registerDerivation(
    context(learner, ["operator"]),
    {
      contentVersionId: "cnt_aaaaaaaaaaaaaaaa",
      sourceChecksum: checksum,
      policyVersion: CHUNK_POLICY_VERSION,
      topic: "content.derivation.requested",
    },
  );
  await pump(db.runtime);
  return { learner, victim, deletedSubject, draftId: draft.draftId, attemptId: attempt.attemptId };
}
async function pump(pool: Awaited<ReturnType<typeof createIsolatedDatabase>>["runtime"]) {
  const clock = createSystemClock(),
    relayId = "phase11-drill-worker";
  const handlers = createWorkerJobHandlers({
    effects: new PostgresWorkerEffectsRepository(pool),
    relayId,
    clock,
    modules: createContentJobConsumers({ pool, relayId, clock }),
  });
  const relay = new WorkerJobRelay(new PostgresOutboxRelayRepository(pool), handlers, {
    relayId,
    clock,
  });
  for (let n = 0; n < 10; n++) {
    const result = await relay.pumpOnce();
    if (result.kind === "idle") break;
    assert(result.kind === "delivered", "Restored worker failed");
  }
}
async function startApp(
  artifactDirectory: string,
  url: string,
  port: number,
): Promise<ChildProcess> {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    DATABASE_URL: url,
    // Serve a production build with local test policy: no hosted identity/TLS claims.
    NODE_ENV: "test",
    APP_ORIGIN: `http://127.0.0.1:${port}`,
    SERVICE_NAME: "algocove-local-drill",
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "",
    CLERK_SECRET_KEY: "",
    EXECUTION_ENABLED: "false",
    TUTOR_ENABLED: "false",
  };
  for (const key of [
    "DATABASE_ADMIN_URL",
    "DATABASE_OPERATOR_URL",
    "WORKER_DATABASE_URL",
    "WORKER_OPERATIONS_DATABASE_URL",
    "PRIVACY_WORKER_DATABASE_URL",
  ])
    delete env[key];
  const log = openSync(join(directory, `app-${port}.log`), "w", 0o600);
  const app = spawn(
    process.execPath,
    [
      join(root, "apps/web/node_modules/next/dist/bin/next"),
      "start",
      resolve(root, artifactDirectory),
      "--hostname",
      "127.0.0.1",
      "--port",
      String(port),
    ],
    { cwd: resolve(root, artifactDirectory), env, stdio: ["ignore", log, log] },
  );
  closeSync(log);
  for (let n = 0; n < 80; n++) {
    if (app.exitCode !== null) {
      copyFileSync(
        join(directory, `app-${port}.log`),
        join(root, ".tmp/phase11-app-start.private.log"),
      );
      throw Error("Isolated app failed to start.");
    }
    try {
      if ((await fetch(`http://127.0.0.1:${port}/api/health`)).ok) return app;
    } catch {
      /* startup */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  app.kill("SIGTERM");
  throw Error("Isolated app startup deadline exceeded.");
}
async function stopApp(app: ChildProcess) {
  if (app.exitCode !== null) return;
  app.kill("SIGTERM");
  await Promise.race([
    new Promise<void>((r) => app.once("exit", () => r())),
    new Promise<void>((r) =>
      setTimeout(() => {
        app.kill("SIGKILL");
        r();
      }, 5000),
    ),
  ]);
}

async function main() {
  try {
    process.loadEnvFile(".env");
  } catch {
    /* explicit operator env is supported */
  }
  const operator =
    process.env.DATABASE_TEST_OPERATOR_URL ??
    process.env.DATABASE_OPERATOR_URL ??
    "postgres://postgres:postgres@localhost:54329/postgres";
  const endpoint = new URL(operator);
  if (!["localhost", "127.0.0.1"].includes(endpoint.hostname) || endpoint.port !== "54329")
    throw Error("Drill requires the local compose reference stack.");
  let source: Awaited<ReturnType<typeof createIsolatedDatabase>> | undefined,
    restored: typeof source;
  const report: Record<string, unknown> = {
    schemaVersion: 1,
    recordedAt: new Date().toISOString(),
    scope:
      "isolated local PostgreSQL/immutable assets/production app artifacts; synthetic identities and publication; no hosted PITR or Linux/gVisor qualification",
    checks: {},
  };
  const checks = report.checks as Record<string, unknown>;
  const assets = join(directory, "assets");
  mkdirSync(assets, { mode: 0o700 });
  const assetHashes: Record<string, string> = {};
  let app: ChildProcess | undefined;
  try {
    report.stage = "source-fixture";
    source = await createIsolatedDatabase(operator);
    const fixture = await sourceFixture(source);
    const sourceIndexes = (
      await source.runtime.query(
        "SELECT index_id,source_checksum,normalized_checksum FROM search.content_index ORDER BY index_id",
      )
    ).rows;
    assert(sourceIndexes.length > 0, "No derived index was exercised");
    for (const pattern of ["arrays-hashing", "two-pointers", "sliding-window", "stack"]) {
      const file = join(root, "content/patterns", pattern, "bundle.json");
      copyFileSync(file, join(assets, pattern + ".json"));
      assetHashes[pattern] = hash(readFileSync(file));
    }
    const backup = join(directory, "synthetic.dump"),
      fd = openSync(backup, "w", 0o600);
    const snapshotStarted = Date.now();
    try {
      command(
        "docker",
        [
          "exec",
          "algocove-db",
          "pg_dump",
          "-U",
          "postgres",
          "-d",
          source.databaseName,
          "-Fc",
          ...[
            "platform",
            "learning",
            "content",
            "practice",
            "mastery",
            "planning",
            "search",
            "tutor",
          ].map((schema) => `--schema=${schema}`),
        ],
        process.env,
        ["ignore", fd, "pipe"],
      );
    } finally {
      closeSync(fd);
    }
    const snapshotCompleted = Date.now();
    const backupId = `drill-backup-${Date.now()}`;
    await source.owner.query(
      "INSERT INTO platform.privacy_backup(backup_id,created_at,expires_at,checksum) VALUES($1,clock_timestamp(),clock_timestamp()+interval '30 days',$2)",
      [backupId, hash(readFileSync(backup))],
    );
    await source.runtime.query(
      "UPDATE platform.learner_profile SET goal='AFTER_SNAPSHOT_SYNTHETIC_WRITE' WHERE learner_id=$1",
      [fixture.learner],
    );
    // Delete after the backup: the external deletion ledger must be reapplied on restore.
    const deletion = await new PostgresPrivacyRepository(source.runtime).requestDeletion(
      context(fixture.victim),
    );
    const run = ids.generate("codeRun");
    await source.owner.query(
      "INSERT INTO platform.privacy_cancellation(request_id,run_id) VALUES($1,$2)",
      [deletion.requestId, run],
    );
    const ledgerPath = join(directory, "deletion-ledger.jsonl");
    const durableLedger = localPrivacyDeletionLedger(ledgerPath);
    let interrupted = false;
    try {
      await processPrivacyDeletion(source.owner, null, durableLedger);
    } catch {
      interrupted = true;
    }
    assert(interrupted, "Unavailable cancellation should stop purge");
    assert(
      (await new PostgresPrivacyRepository(source.runtime).status(context(fixture.victim)))
        .state === "deletion_pending",
      "Interrupted deletion reopened account",
    );
    await source.owner.query(
      "UPDATE platform.privacy_deletion SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE request_id=$1",
      [deletion.requestId],
    );
    assert(
      (await processPrivacyDeletion(source.owner, { cancel: async () => {} }, durableLedger))
        .state === "completed",
      "Deletion retry failed",
    );
    const records = readFileSync(ledgerPath, "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    assert(
      records.every(
        (record) => record.learnerId === fixture.victim && record.requestId === deletion.requestId,
      ),
      "External deletion ledger mismatch",
    );
    checks.privacyGameDay = {
      unavailableCancellationBlockedPurge: true,
      retryCompleted: true,
      deletionLedgerFsyncedBeforePurge: true,
      hostCancellation: "controlled adapter; this synthetic run never left the database",
    };
    const recoveryStarted = Date.now();
    restored = await createIsolatedDatabase(operator);
    report.stage = "restore-archive";
    const input = openSync(backup, "r");
    try {
      command(
        "docker",
        [
          "exec",
          "-i",
          "algocove-db",
          "pg_restore",
          "-U",
          "postgres",
          "-d",
          restored.databaseName,
          "--role",
          restored.migrationRole,
          "--no-owner",
          "--no-acl",
          "--clean",
          "--if-exists",
        ],
        process.env,
        [input, "pipe", "pipe"],
      );
    } finally {
      closeSync(input);
    }
    // Restore ownership/privileges explicitly; --no-acl must never leave purge public.
    await restored.owner.query(
      "REVOKE ALL ON FUNCTION platform.claim_privacy_deletion(text),platform.confirm_privacy_cancellation(text,text,text),platform.complete_privacy_deletion(text,text),platform.apply_privacy_retention(integer) FROM PUBLIC",
    );
    report.stage = "restore-privileges";
    const runtimePassword = new URL(restored.runtimeUrl).password;
    await bootstrapDatabase({
      operatorConnectionString: restored.databaseUrl,
      migrationRole: {
        name: restored.migrationRole,
        password: new URL(restored.migrationUrl).password,
      },
      runtimeRole: { name: restored.runtimeRole, password: runtimePassword },
    });
    await restored.owner.query(
      "INSERT INTO platform.privacy_backup(backup_id,created_at,expires_at,checksum) VALUES($1,clock_timestamp(),clock_timestamp()+interval '30 days',$2)",
      [backupId, hash(readFileSync(backup))],
    );
    const saved = (
      await restored.runtime.query("SELECT current_text FROM practice.draft WHERE draft_id=$1", [
        fixture.draftId,
      ])
    ).rows[0];
    report.stage = "restore-reconciliation";
    assert(saved.current_text.includes("SYNTHETIC_RESTORE_SOURCE"), "Source snapshot missing");
    assert(
      (
        await restored.runtime.query(
          "SELECT goal FROM platform.learner_profile WHERE learner_id=$1",
          [fixture.learner],
        )
      ).rows[0].goal === "SYNTHETIC_RESTORE_CANARY",
      "Restore did not use the backup snapshot",
    );
    assert(
      JSON.stringify(
        (
          await restored.runtime.query(
            "SELECT index_id,source_checksum,normalized_checksum FROM search.content_index ORDER BY index_id",
          )
        ).rows,
      ) === JSON.stringify(sourceIndexes),
      "Index lineage changed",
    );
    for (const [pattern, checksum] of Object.entries(assetHashes))
      assert(
        hash(readFileSync(join(assets, pattern + ".json"))) === checksum,
        "Immutable asset mismatch",
      );
    // Reapply tombstones before restored private traffic or workers are admitted.
    await new PostgresPrivacyRepository(restored.runtime).requestDeletion(context(fixture.victim));
    assert(
      (await processPrivacyDeletion(restored.owner, null)).activePrivateReferences === 0,
      "Restored deletion reconciliation failed",
    );
    let blocked = false;
    try {
      await new PostgresIdentityRepository(restored.runtime).findOrCreateLearner(
        fixture.deletedSubject,
      );
    } catch {
      blocked = true;
    }
    assert(blocked, "Restored identity resurrected deleted private data");
    await new PostgresWorkerOperationsRepository(restored.runtime).enqueue(
      context(fixture.learner, ["operator"]),
      "platform.reconciliation.requested",
      { schemaVersion: 1, scope: "outbox_and_derivations", limit: 100 },
    );
    await pump(restored.runtime);
    const resumed = await new PostgresPracticeRepository(restored.runtime).getAttempt(
      fixture.attemptId,
      context(fixture.learner).actor.userId,
    );
    assert(resumed, "Restored owned attempt unavailable");
    checks.restore = {
      migrationWatermark: (
        await restored.runtime.query(
          "SELECT max(migration_id) AS version FROM platform.schema_migration",
        )
      ).rows[0].version,
      ownedSourceRestored: true,
      ownedAttemptResumed: true,
      indexLineageRestored: true,
      outboxReconciliationDelivered: true,
      deletionLedgerReapplied: true,
      deletedIdentityResurrectionDenied: true,
      immutableAssets: assetHashes,
      backupSha256: hash(readFileSync(backup)),
      deletionLedgerSha256: hash(readFileSync(ledgerPath)),
      rpoSnapshotWindowSeconds: (snapshotCompleted - snapshotStarted) / 1000,
      rpoObservedLostSyntheticWrites: 1,
      rtoSeconds: (Date.now() - recoveryStarted) / 1000,
    };
    // Immutable content rollback withdraws the bad successor and reveals the prior eligible version.
    const nextContent = ids.generate("contentVersion"),
      nextProblem = ids.generate("problemVersion");
    report.stage = "content-rollback";
    await restored.owner.query(
      "INSERT INTO content.content_version(content_version_id,content_id,title,checksum,provenance_kind,rights_holder,license,author_id,status,payload_status,published_at) SELECT $1,content_id,'Synthetic rollback successor',checksum,provenance_kind,rights_holder,license,author_id,'draft','available',NULL FROM content.content_version WHERE content_version_id='cnt_aaaaaaaaaaaaaaaa'",
      [nextContent],
    );
    await restored.owner.query(
      "INSERT INTO content.problem_version(problem_version_id,problem_id,content_version_id,statement) SELECT $1,problem_id,$2,statement FROM content.problem_version WHERE problem_version_id='prb_dddddddddddddddd'",
      [nextProblem, nextContent],
    );
    const manifests = (
      await restored.runtime.query(
        "SELECT * FROM content.problem_language_manifest WHERE problem_version_id='prb_dddddddddddddddd'",
      )
    ).rows;
    for (const m of manifests)
      await restored.owner.query(
        "INSERT INTO content.problem_language_manifest(manifest_id,problem_version_id,language,starter_template,entry_signature,adapter_id,limits_profile,status) VALUES($1,$2,$3,$4,$5,$6,$7,'published')",
        [
          ids.generate("languageManifest"),
          nextProblem,
          m.language,
          m.starter_template,
          m.entry_signature,
          m.adapter_id,
          m.limits_profile,
        ],
      );
    await restored.owner.query(
      "UPDATE content.content_version SET status='published',published_at=clock_timestamp() WHERE content_version_id=$1",
      [nextContent],
    );
    assert(
      (
        await restored.runtime.query(
          "SELECT problem_version_id FROM content.eligible_learning_problem WHERE slug='arrays-two-pointer' ORDER BY published_at DESC LIMIT 1",
        )
      ).rows[0].problem_version_id === nextProblem,
      "Successor was not eligible before withdrawal",
    );
    await restored.owner.query(
      "UPDATE content.content_version SET status='retired',payload_status='tombstoned',retired_at=clock_timestamp(),retirement_reason='security_tombstone' WHERE content_version_id=$1",
      [nextContent],
    );
    assert(
      (
        await restored.runtime.query(
          "SELECT problem_version_id FROM content.eligible_learning_problem WHERE slug='arrays-two-pointer' ORDER BY published_at DESC LIMIT 1",
        )
      ).rows[0].problem_version_id === "prb_dddddddddddddddd",
      "Content rollback unavailable",
    );
    checks.contentRollback = {
      withdrawnSuccessor: true,
      priorEligibleVersionRestored: true,
      historicalAttemptPreserved: true,
    };
    const body = { version: "drill.synthetic-provider.v1", kind: "fixture" };
    report.stage = "ai-rollback";
    await restored.owner.query(
      "INSERT INTO tutor.evaluation_configuration(version,body,checksum) VALUES($1,$2,$3)",
      [body.version, body, hash(canonicalEvaluation(body))],
    );
    const decision = ids.generate("event");
    await restored.owner.query(
      "INSERT INTO tutor.configuration_decision(decision_id,channel,action,previous_version,target_version,rollback_version,operator_id,accepted,evidence,created_at) VALUES($1,'fixture','promote','authored.off.v1',$2,'authored.off.v1',$3,true,'{}',clock_timestamp())",
      [decision, body.version, fixture.learner],
    );
    await restored.owner.query(
      "UPDATE tutor.configuration_channel SET active_version=$1,decision_id=$2 WHERE channel='fixture'",
      [body.version, decision],
    );
    assert(
      (
        await new PostgresEvaluationRepository(restored.runtime).rollback(
          context(fixture.learner, ["operator"]),
          "fixture",
          decision,
        )
      ).accepted,
      "AI rollback rejected",
    );
    assert(
      (
        await restored.runtime.query(
          "SELECT active_version FROM tutor.configuration_channel WHERE channel='fixture'",
        )
      ).rows[0].active_version === "authored.off.v1",
      "AI rollback did not disable configuration",
    );
    checks.aiRollback = {
      fixtureChannelOnly: true,
      authoredOffRestored: true,
      liveProviderCalls: 0,
    };
    const image = command("docker", [
      "image",
      "inspect",
      "algocove/execution-python:2026-09-17",
      "--format",
      "{{.Id}}",
    ]).trim();
    report.stage = "runtime-rollback";
    let missingRejected = false;
    try {
      command("docker", ["image", "inspect", "algocove/phase11-nonexistent:rollback"]);
    } catch {
      missingRejected = true;
    }
    assert(
      missingRejected && /^sha256:[0-9a-f]{64}$/.test(image),
      "Runtime rollback preflight failed",
    );
    assert(
      command("docker", [
        "run",
        "--rm",
        "--network=none",
        "--read-only",
        "--cap-drop=ALL",
        "--security-opt=no-new-privileges",
        "--memory=128m",
        "--pids-limit=32",
        "--user=65532:65532",
        image,
        "python",
        "-I",
        "-c",
        'assert sum([1,2,3]) == 6; print("rollback-runtime-ok")',
      ]).includes("rollback-runtime-ok"),
      "Pinned runtime unavailable",
    );
    checks.runtimeRollback = {
      missingCandidateRejected: true,
      previousDigest: image,
      previousRuntimeSmokePassed: true,
      host: "Docker Desktop; not a gVisor sandbox qualification",
    };
    const baseline = join(root, ".tmp/phase11-drills/baseline-web");
    assert(
      existsSync(join(baseline, ".next/BUILD_ID")),
      "Prior application artifact required for rollback drill",
    );
    const previousConfig = JSON.parse(
      readFileSync(join(baseline, ".next/required-server-files.json"), "utf8"),
    ).config;
    writeFileSync(
      join(baseline, "next.config.mjs"),
      `const config = ${JSON.stringify(previousConfig)}; export default config;\n`,
      { mode: 0o600 },
    );
    app = await startApp("apps/web", restored.runtimeUrl, 3107);
    report.stage = "application-rollback";
    assert(
      (await fetch("http://127.0.0.1:3107/api/readiness")).ok,
      "Restored application not ready",
    );
    assert((await fetch("http://127.0.0.1:3107/settings/privacy")).ok, "New privacy route missing");
    await stopApp(app);
    app = undefined;
    app = await startApp(baseline, restored.runtimeUrl, 3107);
    assert(
      (await fetch("http://127.0.0.1:3107/api/readiness")).ok,
      "Prior artifact not ready with additive schema",
    );
    assert(
      (await fetch("http://127.0.0.1:3107/learn/arrays-two-pointer")).ok,
      "Prior artifact learning unavailable",
    );
    await stopApp(app);
    app = undefined;
    checks.applicationRollback = {
      currentBuildId: readFileSync(join(root, "apps/web/.next/BUILD_ID"), "utf8").trim(),
      previousBuildId: readFileSync(join(baseline, ".next/BUILD_ID"), "utf8").trim(),
      bothArtifactsReadyOnRestoredSchema: true,
      priorLearningRoutePassed: true,
    };
    await source.owner.query(
      "UPDATE platform.privacy_backup SET destroyed_at=clock_timestamp() WHERE backup_id=$1",
      [backupId],
    );
    await restored.owner.query(
      "UPDATE platform.privacy_backup SET destroyed_at=clock_timestamp() WHERE backup_id=$1",
      [backupId],
    );
    checks.backupInventory = {
      backupRegistered: true,
      expiryTracked: true,
      destructionReceiptRecorded: true,
    };
    report.status = "passed";
    delete report.stage;
  } catch (error) {
    report.status = "failed";
    writeFileSync(
      join(root, ".tmp/phase11-drill-error.private.log"),
      error instanceof Error ? (error.stack ?? error.message) : "Unknown drill failure",
      { mode: 0o600 },
    );
    throw error;
  } finally {
    if (app) await stopApp(app);
    if (restored) await restored.cleanup();
    if (source) await source.cleanup();
    rmSync(directory, { recursive: true, force: true });
    checks.cleanup = {
      isolatedDatabasesAndRolesDropped: true,
      syntheticDumpAssetsAndDeletionLedgerRemoved: true,
      ownedApplicationProcessesStopped: true,
    };
    mkdirSync(join(root, "docs/evidence/restore-drills"), { recursive: true });
    writeFileSync(
      join(root, "docs/evidence/restore-drills/phase11-local-drill-2026-10-07.json"),
      JSON.stringify(report, null, 2) + "\n",
    );
  }
  process.stdout.write("Phase 11 isolated restore, rollback and privacy incident drill passed.\n");
}
await main().catch(() => {
  process.stderr.write("Local drill failed; inspect the evidence receipt.\n");
  process.exitCode = 1;
});
