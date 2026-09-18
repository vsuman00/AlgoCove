-- 0013_pseudocode.sql
-- Structured pseudocode is a private learner artifact. Current fields are
-- replaceable; only explicit saves append immutable revisions.

CREATE TABLE practice.pseudocode_artifact (
  pseudocode_id text PRIMARY KEY
    CHECK (pseudocode_id ~ '^psc_[0-9a-hjkmnp-tv-z]{16,52}$'),
  attempt_id text NOT NULL,
  learner_id text NOT NULL REFERENCES platform.learner(learner_id) ON DELETE CASCADE,
  problem_version_id text NOT NULL,
  manifest_id text NOT NULL,
  language text NOT NULL REFERENCES content.language_profile(language),
  current_fields jsonb NOT NULL CHECK (jsonb_typeof(current_fields) = 'object'),
  current_revision bigint NOT NULL DEFAULT 0 CHECK (current_revision >= 0),
  saved_revision bigint NOT NULL DEFAULT 0 CHECK (saved_revision >= 0),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  updated_at timestamptz NOT NULL,
  UNIQUE (pseudocode_id, learner_id),
  FOREIGN KEY (attempt_id, learner_id)
    REFERENCES practice.attempt(attempt_id, learner_id) ON DELETE CASCADE,
  FOREIGN KEY (manifest_id, problem_version_id, language)
    REFERENCES content.problem_language_manifest(manifest_id, problem_version_id, language),
  CHECK (saved_revision <= current_revision),
  CHECK (current_fields ?& ARRAY[
    'inputs', 'state', 'initialization', 'invariant',
    'loop', 'termination', 'output', 'complexity'
  ]),
  CHECK (jsonb_typeof(current_fields->'inputs') = 'string'),
  CHECK (jsonb_typeof(current_fields->'state') = 'string'),
  CHECK (jsonb_typeof(current_fields->'initialization') = 'string'),
  CHECK (jsonb_typeof(current_fields->'invariant') = 'string'),
  CHECK (jsonb_typeof(current_fields->'loop') = 'string'),
  CHECK (jsonb_typeof(current_fields->'termination') = 'string'),
  CHECK (jsonb_typeof(current_fields->'output') = 'string'),
  CHECK (jsonb_typeof(current_fields->'complexity') = 'string'),
  CHECK (char_length(current_fields->>'inputs') <= 20000),
  CHECK (char_length(current_fields->>'state') <= 20000),
  CHECK (char_length(current_fields->>'initialization') <= 20000),
  CHECK (char_length(current_fields->>'invariant') <= 20000),
  CHECK (char_length(current_fields->>'loop') <= 20000),
  CHECK (char_length(current_fields->>'termination') <= 20000),
  CHECK (char_length(current_fields->>'output') <= 20000),
  CHECK (char_length(current_fields->>'complexity') <= 20000)
);

CREATE INDEX pseudocode_owner_idx
  ON practice.pseudocode_artifact (learner_id, updated_at DESC, pseudocode_id DESC);

CREATE TABLE practice.pseudocode_revision (
  pseudocode_id text NOT NULL,
  learner_id text NOT NULL REFERENCES platform.learner(learner_id) ON DELETE CASCADE,
  attempt_id text NOT NULL,
  problem_version_id text NOT NULL,
  manifest_id text NOT NULL,
  language text NOT NULL REFERENCES content.language_profile(language),
  revision bigint NOT NULL CHECK (revision > 0),
  fields jsonb NOT NULL CHECK (jsonb_typeof(fields) = 'object'),
  saved_at timestamptz NOT NULL,
  PRIMARY KEY (pseudocode_id, revision),
  FOREIGN KEY (pseudocode_id, learner_id)
    REFERENCES practice.pseudocode_artifact(pseudocode_id, learner_id) ON DELETE CASCADE,
  FOREIGN KEY (attempt_id, learner_id)
    REFERENCES practice.attempt(attempt_id, learner_id) ON DELETE CASCADE,
  CHECK (fields ?& ARRAY[
    'inputs', 'state', 'initialization', 'invariant',
    'loop', 'termination', 'output', 'complexity'
  ])
);

CREATE INDEX pseudocode_revision_owner_idx
  ON practice.pseudocode_revision (learner_id, saved_at DESC, pseudocode_id DESC, revision DESC);
