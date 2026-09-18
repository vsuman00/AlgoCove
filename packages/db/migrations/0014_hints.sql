-- 0014_hints.sql
-- Authored hints remain content-owned. Learner exposure is append-only and is
-- persisted before the hint body is returned to the caller.

CREATE TABLE content.problem_hint (
  problem_version_id text NOT NULL,
  hint_id text NOT NULL CHECK (hint_id ~ '^[A-Za-z0-9._:-]{1,128}$'),
  tier smallint NOT NULL CHECK (tier BETWEEN 1 AND 6),
  kind text NOT NULL CHECK (kind IN (
    'clarification', 'example', 'invariant', 'pseudocode_scaffold',
    'partial_structure', 'solution_review'
  )),
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 20000),
  PRIMARY KEY (problem_version_id, hint_id),
  FOREIGN KEY (problem_version_id) REFERENCES content.problem_version(problem_version_id)
    ON DELETE CASCADE
);

CREATE TABLE practice.hint_exposure (
  exposure_id text PRIMARY KEY
    CHECK (exposure_id ~ '^evt_[0-9a-hjkmnp-tv-z]{16,52}$'),
  learner_id text NOT NULL REFERENCES platform.learner(learner_id) ON DELETE CASCADE,
  attempt_id text NOT NULL,
  problem_version_id text NOT NULL,
  hint_id text NOT NULL,
  tier smallint NOT NULL CHECK (tier BETWEEN 1 AND 6),
  idempotency_key text NOT NULL CHECK (idempotency_key ~ '^[A-Za-z0-9._:-]{1,128}$'),
  exposed_at timestamptz NOT NULL,
  UNIQUE (learner_id, idempotency_key),
  FOREIGN KEY (attempt_id, learner_id)
    REFERENCES practice.attempt(attempt_id, learner_id) ON DELETE CASCADE,
  FOREIGN KEY (problem_version_id, hint_id)
    REFERENCES content.problem_hint(problem_version_id, hint_id) ON DELETE RESTRICT
);

CREATE INDEX hint_exposure_owner_problem_idx
  ON practice.hint_exposure (learner_id, problem_version_id, tier DESC, exposed_at DESC);
