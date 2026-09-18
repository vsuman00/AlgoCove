-- 0010_practice.sql
--
-- Durable learning sessions, version-pinned attempts, and meaningful attempt
-- events. Source text and keystrokes deliberately do not belong in this slice;
-- recoverable drafts arrive through the separate Task 25b contract.

ALTER TABLE content.problem_language_manifest
  ADD CONSTRAINT problem_language_manifest_exact_key
  UNIQUE (manifest_id, problem_version_id, language);

CREATE TABLE practice.learning_session (
  session_id text PRIMARY KEY
    CHECK (session_id ~ '^ses_[0-9a-hjkmnp-tv-z]{16,52}$'),
  learner_id text NOT NULL REFERENCES platform.learner(learner_id) ON DELETE CASCADE,
  mode text NOT NULL CHECK (mode IN ('learn', 'practice', 'rescue')),
  status text NOT NULL CHECK (status IN ('active', 'completed', 'abandoned', 'expired')),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  started_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  ended_at timestamptz,
  UNIQUE (session_id, learner_id),
  CHECK ((status = 'active' AND ended_at IS NULL) OR (status <> 'active' AND ended_at IS NOT NULL)),
  CHECK (updated_at >= started_at),
  CHECK (ended_at IS NULL OR ended_at >= started_at)
);

CREATE TABLE practice.attempt (
  attempt_id text PRIMARY KEY
    CHECK (attempt_id ~ '^att_[0-9a-hjkmnp-tv-z]{16,52}$'),
  session_id text NOT NULL,
  learner_id text NOT NULL REFERENCES platform.learner(learner_id) ON DELETE CASCADE,
  problem_version_id text NOT NULL,
  manifest_id text NOT NULL,
  language text NOT NULL REFERENCES content.language_profile(language),
  mode text NOT NULL CHECK (mode IN ('learn', 'practice', 'rescue')),
  status text NOT NULL CHECK (status IN ('active', 'submitted', 'abandoned', 'expired')),
  terminal_reason text CHECK (terminal_reason IN ('submitted', 'learner', 'language_changed', 'session_ended', 'expired')),
  reset_from_attempt_id text REFERENCES practice.attempt(attempt_id),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  event_sequence bigint NOT NULL DEFAULT 1 CHECK (event_sequence > 0),
  started_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  ended_at timestamptz,
  UNIQUE (attempt_id, learner_id),
  FOREIGN KEY (session_id, learner_id)
    REFERENCES practice.learning_session(session_id, learner_id),
  FOREIGN KEY (manifest_id, problem_version_id, language)
    REFERENCES content.problem_language_manifest(manifest_id, problem_version_id, language),
  CHECK ((status = 'active' AND terminal_reason IS NULL AND ended_at IS NULL)
      OR (status = 'submitted' AND terminal_reason = 'submitted' AND ended_at IS NOT NULL)
      OR (status = 'abandoned' AND terminal_reason IN ('learner', 'language_changed', 'session_ended') AND ended_at IS NOT NULL)
      OR (status = 'expired' AND terminal_reason = 'expired' AND ended_at IS NOT NULL)),
  CHECK (updated_at >= started_at),
  CHECK (ended_at IS NULL OR ended_at >= started_at)
);

CREATE INDEX attempt_owner_history_idx
  ON practice.attempt (learner_id, updated_at DESC, attempt_id DESC);

CREATE TABLE practice.attempt_event (
  event_id text PRIMARY KEY
    CHECK (event_id ~ '^evt_[0-9a-hjkmnp-tv-z]{16,52}$'),
  attempt_id text NOT NULL,
  learner_id text NOT NULL,
  sequence bigint NOT NULL CHECK (sequence > 0),
  kind text NOT NULL CHECK (kind IN ('started', 'source_saved', 'run_requested', 'submitted', 'abandoned', 'expired')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  occurred_at timestamptz NOT NULL,
  UNIQUE (attempt_id, sequence),
  FOREIGN KEY (attempt_id, learner_id)
    REFERENCES practice.attempt(attempt_id, learner_id) ON DELETE CASCADE,
  CHECK (NOT (metadata ? 'source' OR metadata ? 'sourceCode' OR metadata ? 'keystrokes'))
);

CREATE INDEX attempt_event_owner_history_idx
  ON practice.attempt_event (learner_id, occurred_at DESC, event_id DESC);
