-- 0015_practice_workspace_uniqueness.sql
-- A learner may resume one active workspace per problem/manifest/language.
-- Private artifacts are one current source and one current pseudocode record per
-- attempt. Historical attempts and explicit revisions remain append-only.

CREATE UNIQUE INDEX learning_session_active_owner_mode_idx
  ON practice.learning_session (learner_id, mode)
  WHERE status = 'active';

CREATE UNIQUE INDEX attempt_active_workspace_idx
  ON practice.attempt (learner_id, problem_version_id, manifest_id, language)
  WHERE status = 'active';

CREATE UNIQUE INDEX draft_attempt_kind_idx
  ON practice.draft (attempt_id, kind);

CREATE UNIQUE INDEX pseudocode_attempt_idx
  ON practice.pseudocode_artifact (attempt_id);
