-- 0003_roles.sql
--
-- Roles are AlgoCove data, not Clerk metadata. Every authorization decision
-- reads active grants from this table and defaults to least privilege.

CREATE TABLE platform.role_grant (
  learner_id text NOT NULL REFERENCES platform.learner(learner_id) ON DELETE CASCADE,
  role text NOT NULL CHECK (
    role IN (
      'learner',
      'author',
      'technical_reviewer',
      'pedagogical_reviewer',
      'publisher',
      'evaluator',
      'operator',
      'privacy_administrator'
    )
  ),
  granted_at timestamptz NOT NULL DEFAULT now(),
  granted_by text REFERENCES platform.learner(learner_id),
  revoked_at timestamptz,
  PRIMARY KEY (learner_id, role),
  CHECK (revoked_at IS NULL OR revoked_at >= granted_at)
);

CREATE INDEX role_grant_active_idx
  ON platform.role_grant (learner_id, role)
  WHERE revoked_at IS NULL;
