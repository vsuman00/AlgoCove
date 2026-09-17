-- 0006_content.sql
--
-- Governed content identities and immutable problem versions. External or
-- licensed content stores rights metadata only; copied statements are rejected
-- by the problem-version trigger below.

CREATE TABLE content.content_item (
  content_id text PRIMARY KEY
    CHECK (content_id ~ '^con_[0-9a-hjkmnp-tv-z]{16,52}$'),
  content_kind text NOT NULL CHECK (content_kind IN ('problem')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE content.problem (
  problem_id text PRIMARY KEY
    CHECK (problem_id ~ '^pro_[0-9a-hjkmnp-tv-z]{16,52}$'),
  content_id text NOT NULL UNIQUE REFERENCES content.content_item(content_id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE content.content_version (
  content_version_id text PRIMARY KEY
    CHECK (content_version_id ~ '^cnt_[0-9a-hjkmnp-tv-z]{16,52}$'),
  content_id text NOT NULL REFERENCES content.content_item(content_id),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  checksum text NOT NULL CHECK (checksum ~ '^sha256:[0-9a-f]{64}$'),
  provenance_kind text NOT NULL CHECK (provenance_kind IN ('original', 'licensed')),
  rights_holder text NOT NULL CHECK (char_length(rights_holder) BETWEEN 1 AND 200),
  license text NOT NULL CHECK (char_length(license) BETWEEN 1 AND 160),
  source_url text CHECK (
    source_url IS NULL OR source_url ~ '^https://[^[:space:]]+$'
  ),
  rights_expires_at timestamptz,
  author_id text NOT NULL REFERENCES platform.learner(learner_id),
  status text NOT NULL CHECK (status IN ('draft', 'published', 'retired')),
  payload_status text NOT NULL CHECK (payload_status IN ('available', 'tombstoned')),
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  retired_at timestamptz,
  retirement_reason text CHECK (retirement_reason IN ('retired', 'rights_withdrawn', 'security_tombstone')),
  CHECK ((status = 'published' AND published_at IS NOT NULL) OR status <> 'published'),
  CHECK ((status = 'retired' AND retired_at IS NOT NULL) OR status <> 'retired'),
  CHECK ((payload_status = 'tombstoned' AND retirement_reason IN ('rights_withdrawn', 'security_tombstone'))
      OR payload_status = 'available')
);

CREATE TABLE content.problem_version (
  problem_version_id text PRIMARY KEY
    CHECK (problem_version_id ~ '^prb_[0-9a-hjkmnp-tv-z]{16,52}$'),
  problem_id text NOT NULL REFERENCES content.problem(problem_id),
  content_version_id text NOT NULL UNIQUE REFERENCES content.content_version(content_version_id),
  statement text CHECK (statement IS NULL OR char_length(statement) BETWEEN 1 AND 20000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE content.content_review (
  content_version_id text NOT NULL REFERENCES content.content_version(content_version_id),
  review_kind text NOT NULL CHECK (review_kind IN ('technical', 'pedagogical')),
  reviewer_id text NOT NULL REFERENCES platform.learner(learner_id),
  decision text NOT NULL CHECK (decision IN ('approved', 'rejected')),
  notes text CHECK (notes IS NULL OR char_length(notes) BETWEEN 1 AND 2000),
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (content_version_id, review_kind, reviewer_id)
);

CREATE TABLE content.content_validation (
  content_version_id text PRIMARY KEY REFERENCES content.content_version(content_version_id),
  status text NOT NULL CHECK (status IN ('pending', 'passed', 'failed')),
  validator_id text REFERENCES platform.learner(learner_id),
  message text CHECK (message IS NULL OR char_length(message) BETWEEN 1 AND 2000),
  validated_at timestamptz,
  CHECK ((status = 'pending' AND validated_at IS NULL) OR status <> 'pending')
);

CREATE FUNCTION content.validate_problem_payload()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  provenance text;
BEGIN
  SELECT provenance_kind INTO provenance
    FROM content.content_version
   WHERE content_version_id = NEW.content_version_id;
  IF provenance = 'licensed' AND NEW.statement IS NOT NULL THEN
    RAISE EXCEPTION 'licensed problem versions cannot store copied statements' USING ERRCODE = '23514';
  END IF;
  IF provenance = 'original' AND NEW.statement IS NULL THEN
    RAISE EXCEPTION 'original problem versions require a statement' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER problem_payload_contract
BEFORE INSERT OR UPDATE ON content.problem_version
FOR EACH ROW EXECUTE FUNCTION content.validate_problem_payload();

CREATE FUNCTION content.prevent_published_content_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  version_id text;
  version_status text;
BEGIN
  version_id := COALESCE(OLD.content_version_id, NEW.content_version_id);
  SELECT status INTO version_status
    FROM content.content_version
   WHERE content_version_id = version_id;
  IF version_status IN ('published', 'retired') THEN
    RAISE EXCEPTION 'published and retired content versions are immutable' USING ERRCODE = '55006';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER content_version_immutable
BEFORE UPDATE OR DELETE ON content.content_version
FOR EACH ROW
WHEN (OLD.status IN ('published', 'retired'))
EXECUTE FUNCTION content.prevent_published_content_mutation();

CREATE TRIGGER problem_version_immutable
BEFORE UPDATE OR DELETE ON content.problem_version
FOR EACH ROW EXECUTE FUNCTION content.prevent_published_content_mutation();

CREATE TRIGGER content_review_immutable
BEFORE UPDATE OR DELETE ON content.content_review
FOR EACH ROW EXECUTE FUNCTION content.prevent_published_content_mutation();

CREATE TRIGGER content_validation_immutable
BEFORE UPDATE OR DELETE ON content.content_validation
FOR EACH ROW EXECUTE FUNCTION content.prevent_published_content_mutation();
