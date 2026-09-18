-- 0012_practice_drafts.sql
--
-- Replaceable private current snapshots plus explicit saved revisions. Current
-- updates overwrite one row; only learner-confirmed saves append revisions.

CREATE TABLE practice.draft (
  draft_id text PRIMARY KEY
    CHECK (draft_id ~ '^drf_[0-9a-hjkmnp-tv-z]{16,52}$'),
  attempt_id text NOT NULL,
  learner_id text NOT NULL REFERENCES platform.learner(learner_id) ON DELETE CASCADE,
  problem_version_id text NOT NULL,
  manifest_id text NOT NULL,
  language text NOT NULL REFERENCES content.language_profile(language),
  kind text NOT NULL CHECK (kind IN ('source', 'pseudocode')),
  current_text text NOT NULL,
  current_revision bigint NOT NULL DEFAULT 0 CHECK (current_revision >= 0),
  saved_revision bigint NOT NULL DEFAULT 0 CHECK (saved_revision >= 0),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  updated_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  local_recovery_enabled boolean NOT NULL DEFAULT false,
  UNIQUE (draft_id, learner_id),
  FOREIGN KEY (attempt_id, learner_id)
    REFERENCES practice.attempt(attempt_id, learner_id) ON DELETE CASCADE,
  FOREIGN KEY (manifest_id, problem_version_id, language)
    REFERENCES content.problem_language_manifest(manifest_id, problem_version_id, language),
  CHECK (saved_revision <= current_revision),
  CHECK (expires_at > updated_at),
  CHECK ((kind = 'source' AND char_length(current_text) <= 1048576)
      OR (kind = 'pseudocode' AND char_length(current_text) <= 100000))
);

CREATE INDEX draft_owner_expiry_idx
  ON practice.draft (learner_id, expires_at, updated_at DESC, draft_id DESC);

CREATE TABLE practice.draft_revision (
  draft_id text NOT NULL,
  learner_id text NOT NULL,
  revision bigint NOT NULL CHECK (revision > 0),
  kind text NOT NULL CHECK (kind IN ('source', 'pseudocode')),
  text text NOT NULL,
  saved_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  PRIMARY KEY (draft_id, revision),
  FOREIGN KEY (draft_id, learner_id)
    REFERENCES practice.draft(draft_id, learner_id) ON DELETE CASCADE,
  CHECK (expires_at > saved_at),
  CHECK ((kind = 'source' AND char_length(text) <= 1048576)
      OR (kind = 'pseudocode' AND char_length(text) <= 100000))
);

CREATE INDEX draft_revision_owner_idx
  ON practice.draft_revision (learner_id, draft_id, revision DESC);
