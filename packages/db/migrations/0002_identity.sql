-- 0002_identity.sql
--
-- Internal learner identity and onboarding state. Clerk remains the external
-- authentication authority; these tables own AlgoCove identity, profile data,
-- and the provider-subject mapping used by the application boundary.

CREATE TABLE platform.learner (
  learner_id text PRIMARY KEY
    CHECK (learner_id ~ '^usr_[0-9a-hjkmnp-tv-z]{16,52}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0)
);

CREATE TRIGGER learner_updated_at
BEFORE UPDATE ON platform.learner
FOR EACH ROW EXECUTE FUNCTION platform.set_updated_at();

CREATE TABLE platform.identity_account (
  provider text NOT NULL CHECK (provider IN ('clerk')),
  provider_subject text NOT NULL CHECK (char_length(provider_subject) BETWEEN 8 AND 256),
  learner_id text NOT NULL REFERENCES platform.learner(learner_id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (provider, provider_subject),
  UNIQUE (provider, learner_id)
);

CREATE INDEX identity_account_learner_idx ON platform.identity_account (learner_id);

CREATE TABLE platform.learner_profile (
  learner_id text PRIMARY KEY REFERENCES platform.learner(learner_id) ON DELETE CASCADE,
  goal text NOT NULL CHECK (char_length(goal) BETWEEN 1 AND 500),
  target_role text NOT NULL CHECK (char_length(target_role) BETWEEN 1 AND 120),
  timezone text NOT NULL CHECK (char_length(timezone) BETWEEN 1 AND 128),
  daily_capacity_minutes integer NOT NULL CHECK (daily_capacity_minutes BETWEEN 15 AND 480),
  horizon_days integer NOT NULL CHECK (horizon_days BETWEEN 7 AND 365),
  accessibility_settings jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(accessibility_settings) = 'object'),
  preferred_languages text[] NOT NULL
    CHECK (cardinality(preferred_languages) BETWEEN 1 AND 6)
    CHECK (preferred_languages <@ ARRAY['python', 'javascript', 'typescript', 'java', 'cpp', 'c']::text[]),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text NOT NULL CHECK (updated_by ~ '^usr_[0-9a-hjkmnp-tv-z]{16,52}$')
    REFERENCES platform.learner(learner_id)
);

CREATE TRIGGER learner_profile_updated_at
BEFORE UPDATE ON platform.learner_profile
FOR EACH ROW EXECUTE FUNCTION platform.set_updated_at();
