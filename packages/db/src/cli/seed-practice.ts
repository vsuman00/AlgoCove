/**
 * `pnpm db:seed:practice`
 *
 * Seeds the local, original Phase 5 learning bundle. This is an operator
 * command, not a migration: hosted environments must publish reviewed content
 * through the content workflow instead of receiving development fixtures.
 */
import { createPool, type DatabaseConnection } from "../connection.ts";
import { loadLocalEnvFile, requireEnv } from "./cli-support.ts";

loadLocalEnvFile();

const problemVersionId = "prb_dddddddddddddddd";
const contentId = "con_aaaaaaaaaaaaaaaa";
const problemId = "pro_aaaaaaaaaaaaaaaa";
const contentVersionId = "cnt_aaaaaaaaaaaaaaaa";
const authorId = "usr_aaaaaaaaaaaaaaaa";
const technicalReviewerId = "usr_bbbbbbbbbbbbbbbb";
const pedagogicalReviewerId = "usr_cccccccccccccccc";
const validatorId = "usr_dddddddddddddddd";

const fixtures = [
  ["container-single", "single_line"],
  ["container-wide", "wide_container"],
  ["container-equal", "equal_boundaries"],
] as const;

const manifests = [
  {
    id: "man_aaaaaaaaaaaaaaaa",
    language: "python",
    starter: "def max_area(heights):\n    return 0",
    entry: "solve(input)",
    adapter: "harness.python",
    limits: { compileTimeoutMs: 5_000, runTimeoutMs: 2_000, memoryLimitMb: 256 },
  },
  {
    id: "man_bbbbbbbbbbbbbbbb",
    language: "javascript",
    starter: "function maxArea(heights) {\n  return 0;\n}",
    entry: "function solve(input)",
    adapter: "harness.javascript",
    limits: { compileTimeoutMs: 5_000, runTimeoutMs: 2_000, memoryLimitMb: 256 },
  },
  {
    id: "man_cccccccccccccccc",
    language: "typescript",
    starter: "function maxArea(heights: number[]): number {\n  return 0;\n}",
    entry: "function solve(input): Output",
    adapter: "harness.typescript",
    limits: { compileTimeoutMs: 8_000, runTimeoutMs: 2_000, memoryLimitMb: 256 },
  },
  {
    id: "man_dddddddddddddddd",
    language: "java",
    starter: "static int maxArea(int[] heights) {\n    return 0;\n}",
    entry: "static Output solve(Input input)",
    adapter: "harness.java",
    limits: { compileTimeoutMs: 10_000, runTimeoutMs: 3_000, memoryLimitMb: 384 },
  },
  {
    id: "man_eeeeeeeeeeeeeeee",
    language: "cpp",
    starter: "int maxArea(const vector<int>& heights) {\n  return 0;\n}",
    entry: "Output solve(Input input)",
    adapter: "harness.cpp",
    limits: { compileTimeoutMs: 8_000, runTimeoutMs: 2_000, memoryLimitMb: 256 },
  },
  {
    id: "man_ffffffffffffffff",
    language: "c",
    starter: "int max_area(const int heights[], int length) {\n  return 0;\n}",
    entry: "Output solve(Input input)",
    adapter: "harness.c",
    limits: { compileTimeoutMs: 8_000, runTimeoutMs: 2_000, memoryLimitMb: 256 },
  },
] as const;

const hints = [
  ["hint-arrays-1", 1, "clarification", "What quantity is limited by the shorter boundary?"],
  ["hint-arrays-2", 2, "example", "Compare the area before moving either pointer."],
  ["hint-arrays-3", 3, "invariant", "After each move, the best area seen so far is preserved."],
  [
    "hint-arrays-4",
    4,
    "pseudocode_scaffold",
    "Measure the current pair, then move only the pointer at the shorter height.",
  ],
  [
    "hint-arrays-5",
    5,
    "partial_structure",
    "Stop when the pointers meet; the scan is linear and uses constant extra space.",
  ],
] as const;

const baseOperatorUrl = requireEnv("DATABASE_ADMIN_URL");
const connection: DatabaseConnection = {
  connectionString: baseOperatorUrl,
  applicationName: "algocove-practice-seed",
  maxConnections: 1,
  statementTimeoutMs: 5_000,
};
const pool = createPool(connection);
const client = await pool.connect();
const existingContent = await client.query<{ status: string }>(
  `SELECT status FROM content.content_version WHERE content_version_id = $1`,
  [contentVersionId],
);
if (existingContent.rows[0]?.status === "published") {
  console.log(`Local Phase 5 practice bundle already seeded: ${problemVersionId}`);
  client.release();
  await pool.end();
  process.exit(0);
}

try {
  await client.query("BEGIN");
  await client.query(
    `INSERT INTO platform.learner (learner_id)
     VALUES ($1), ($2), ($3), ($4)
     ON CONFLICT (learner_id) DO NOTHING`,
    [authorId, technicalReviewerId, pedagogicalReviewerId, validatorId],
  );
  await client.query(
    `INSERT INTO platform.role_grant (learner_id, role)
     VALUES ($1, 'author'), ($2, 'technical_reviewer'),
            ($3, 'pedagogical_reviewer'), ($4, 'evaluator')
     ON CONFLICT (learner_id, role) DO NOTHING`,
    [authorId, technicalReviewerId, pedagogicalReviewerId, validatorId],
  );
  await client.query(
    `INSERT INTO content.content_item (content_id, content_kind)
     VALUES ($1, 'problem')
     ON CONFLICT (content_id) DO NOTHING`,
    [contentId],
  );
  await client.query(
    `INSERT INTO content.problem (problem_id, content_id)
     VALUES ($1, $2)
     ON CONFLICT (problem_id) DO NOTHING`,
    [problemId, contentId],
  );
  await client.query(
    `INSERT INTO content.content_version
       (content_version_id, content_id, title, checksum, provenance_kind,
        rights_holder, license, author_id, status, payload_status)
     VALUES ($1, $2, 'Container with most water', $3, 'original',
             'AlgoCove', 'algocove-original-v1', $4, 'draft', 'available')
     ON CONFLICT (content_version_id) DO NOTHING`,
    [contentVersionId, contentId, `sha256:${"1".repeat(64)}`, authorId],
  );
  await client.query(
    `INSERT INTO content.problem_version
       (problem_version_id, problem_id, content_version_id, statement)
     VALUES ($1, $2, $3,
       'Given an array of heights, return the maximum area formed by two vertical lines and the x-axis.')
     ON CONFLICT (problem_version_id) DO NOTHING`,
    [problemVersionId, problemId, contentVersionId],
  );
  await client.query(
    `INSERT INTO content.content_review
       (content_version_id, review_kind, reviewer_id, decision, notes)
     VALUES ($1, 'technical', $2, 'approved', 'Boundaries and complexity reviewed.'),
            ($1, 'pedagogical', $3, 'approved', 'Guided progression and language reviewed.')
     ON CONFLICT (content_version_id, review_kind, reviewer_id) DO NOTHING`,
    [contentVersionId, technicalReviewerId, pedagogicalReviewerId],
  );
  await client.query(
    `INSERT INTO content.content_validation
       (content_version_id, status, validator_id, validated_at)
     VALUES ($1, 'passed', $2, now())
     ON CONFLICT (content_version_id) DO NOTHING`,
    [contentVersionId, validatorId],
  );
  for (const [fixtureId, semanticKey] of fixtures) {
    await client.query(
      `INSERT INTO content.semantic_fixture (fixture_id, semantic_key)
       VALUES ($1, $2)
       ON CONFLICT (fixture_id) DO NOTHING`,
      [fixtureId, semanticKey],
    );
    await client.query(
      `INSERT INTO content.problem_manifest_fixture (problem_version_id, fixture_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [problemVersionId, fixtureId],
    );
  }
  for (const manifest of manifests) {
    await client.query(
      `INSERT INTO content.problem_language_manifest
         (manifest_id, problem_version_id, language, starter_template,
          entry_signature, adapter_id, limits_profile, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, 'draft')
       ON CONFLICT (manifest_id) DO NOTHING`,
      [
        manifest.id,
        problemVersionId,
        manifest.language,
        manifest.starter,
        manifest.entry,
        manifest.adapter,
        JSON.stringify(manifest.limits),
      ],
    );
    await client.query(
      `UPDATE content.problem_language_manifest
          SET status = 'published'
        WHERE manifest_id = $1 AND status = 'draft'`,
      [manifest.id],
    );
  }
  for (const [hintId, tier, kind, body] of hints) {
    await client.query(
      `INSERT INTO content.problem_hint (problem_version_id, hint_id, tier, kind, body)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (problem_version_id, hint_id) DO NOTHING`,
      [problemVersionId, hintId, tier, kind, body],
    );
  }
  await client.query(
    `UPDATE content.content_version
        SET status = 'published', published_at = COALESCE(published_at, now())
      WHERE content_version_id = $1 AND status = 'draft'`,
    [contentVersionId],
  );
  await client.query("COMMIT");
  console.log(`Seeded local Phase 5 practice bundle: ${problemVersionId}`);
} catch (error) {
  await client.query("ROLLBACK");
  console.error(
    `Practice seed failed: ${error instanceof Error ? error.message : "unknown database error"}`,
  );
  process.exitCode = 2;
} finally {
  client.release();
  await pool.end();
}
