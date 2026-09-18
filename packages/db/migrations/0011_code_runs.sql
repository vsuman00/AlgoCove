-- 0011_code_runs.sql
--
-- Durable execution correlation and immutable assessment observations. Raw source
-- is intentionally absent; only its bounded checksum/length are persisted.

CREATE TABLE practice.code_run (
  run_id text PRIMARY KEY
    CHECK (run_id ~ '^run_[0-9a-hjkmnp-tv-z]{16,52}$'),
  learner_id text NOT NULL REFERENCES platform.learner(learner_id) ON DELETE CASCADE,
  attempt_id text NOT NULL,
  mode text NOT NULL CHECK (mode IN ('run', 'submit')),
  problem_version_id text NOT NULL,
  manifest_id text NOT NULL,
  language text NOT NULL REFERENCES content.language_profile(language),
  source_checksum text NOT NULL CHECK (source_checksum ~ '^sha256:[0-9a-f]{64}$'),
  source_length integer NOT NULL CHECK (source_length >= 0 AND source_length <= 1048576),
  requested_at timestamptz NOT NULL,
  terminal_result_id text CHECK (terminal_result_id IS NULL OR terminal_result_id ~ '^[A-Za-z0-9._:-]{1,128}$'),
  UNIQUE (run_id, learner_id),
  FOREIGN KEY (attempt_id, learner_id)
    REFERENCES practice.attempt(attempt_id, learner_id) ON DELETE CASCADE,
  FOREIGN KEY (manifest_id, problem_version_id, language)
    REFERENCES content.problem_language_manifest(manifest_id, problem_version_id, language)
);

CREATE INDEX code_run_owner_idx
  ON practice.code_run (learner_id, requested_at DESC, run_id DESC);

CREATE TABLE practice.assessment_observation (
  observation_id text PRIMARY KEY
    CHECK (observation_id ~ '^evt_[0-9a-hjkmnp-tv-z]{16,52}$'),
  run_id text NOT NULL UNIQUE REFERENCES practice.code_run(run_id) ON DELETE CASCADE,
  attempt_id text NOT NULL,
  learner_id text NOT NULL REFERENCES platform.learner(learner_id) ON DELETE CASCADE,
  problem_version_id text NOT NULL,
  manifest_id text NOT NULL,
  language text NOT NULL REFERENCES content.language_profile(language),
  source_checksum text NOT NULL CHECK (source_checksum ~ '^sha256:[0-9a-f]{64}$'),
  result_id text NOT NULL CHECK (result_id ~ '^[A-Za-z0-9._:-]{1,128}$'),
  terminal_category text NOT NULL CHECK (terminal_category IN (
    'pass', 'wrong_answer', 'compile_error', 'type_error', 'runtime_error',
    'limits', 'cancelled', 'infrastructure_error'
  )),
  classification text NOT NULL CHECK (classification IN (
    'success', 'learner_failure', 'infrastructure_failure', 'control_plane'
  )),
  descriptor_digest text NOT NULL CHECK (descriptor_digest ~ '^sha256:[0-9a-f]{64}$'),
  replay_id text NOT NULL CHECK (replay_id ~ '^[A-Za-z0-9._:-]{1,128}$'),
  lease_epoch integer NOT NULL CHECK (lease_epoch > 0),
  passed boolean NOT NULL,
  observed_at timestamptz NOT NULL,
  UNIQUE (result_id),
  FOREIGN KEY (attempt_id, learner_id)
    REFERENCES practice.attempt(attempt_id, learner_id) ON DELETE CASCADE,
  FOREIGN KEY (run_id, learner_id)
    REFERENCES practice.code_run(run_id, learner_id) ON DELETE CASCADE,
  FOREIGN KEY (manifest_id, problem_version_id, language)
    REFERENCES content.problem_language_manifest(manifest_id, problem_version_id, language)
);

CREATE INDEX assessment_observation_owner_idx
  ON practice.assessment_observation (learner_id, observed_at DESC, observation_id DESC);
