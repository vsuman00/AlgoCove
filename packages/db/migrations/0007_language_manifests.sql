-- 0007_language_manifests.sql
--
-- Six explicit language contracts for one internal problem version. This stores
-- starter/signature/limits metadata and semantic fixture IDs, never solutions or
-- third-party test payloads.

CREATE TABLE content.language_profile (
  language text PRIMARY KEY CHECK (language IN ('python', 'javascript', 'typescript', 'java', 'cpp', 'c')),
  display_name text NOT NULL,
  runtime_family text NOT NULL CHECK (runtime_family IN ('python', 'javascript', 'jvm', 'native-cpp', 'native-c')),
  adapter_id text NOT NULL UNIQUE,
  entry_signature text NOT NULL,
  limits_profile jsonb NOT NULL CHECK (jsonb_typeof(limits_profile) = 'object')
);

INSERT INTO content.language_profile
  (language, display_name, runtime_family, adapter_id, entry_signature, limits_profile)
VALUES
  ('python', 'Python', 'python', 'harness.python', 'solve(input)', '{"compileTimeoutMs":5000,"runTimeoutMs":2000,"memoryLimitMb":256}'),
  ('javascript', 'JavaScript', 'javascript', 'harness.javascript', 'function solve(input)', '{"compileTimeoutMs":5000,"runTimeoutMs":2000,"memoryLimitMb":256}'),
  ('typescript', 'TypeScript', 'javascript', 'harness.typescript', 'function solve(input): Output', '{"compileTimeoutMs":8000,"runTimeoutMs":2000,"memoryLimitMb":256}'),
  ('java', 'Java', 'jvm', 'harness.java', 'static Output solve(Input input)', '{"compileTimeoutMs":10000,"runTimeoutMs":3000,"memoryLimitMb":384}'),
  ('cpp', 'C++', 'native-cpp', 'harness.cpp', 'Output solve(Input input)', '{"compileTimeoutMs":8000,"runTimeoutMs":2000,"memoryLimitMb":256}'),
  ('c', 'C', 'native-c', 'harness.c', 'Output solve(Input input)', '{"compileTimeoutMs":8000,"runTimeoutMs":2000,"memoryLimitMb":256}');

CREATE TABLE content.semantic_fixture (
  fixture_id text PRIMARY KEY CHECK (fixture_id ~ '^[a-z][a-z0-9_-]{1,80}$'),
  semantic_key text NOT NULL CHECK (char_length(semantic_key) BETWEEN 1 AND 160)
);

CREATE TABLE content.problem_language_manifest (
  manifest_id text PRIMARY KEY
    CHECK (manifest_id ~ '^man_[0-9a-hjkmnp-tv-z]{16,52}$'),
  problem_version_id text NOT NULL REFERENCES content.problem_version(problem_version_id),
  language text NOT NULL REFERENCES content.language_profile(language),
  starter_template text NOT NULL CHECK (char_length(starter_template) BETWEEN 1 AND 20000),
  entry_signature text NOT NULL,
  adapter_id text NOT NULL,
  limits_profile jsonb NOT NULL CHECK (jsonb_typeof(limits_profile) = 'object'),
  status text NOT NULL CHECK (status IN ('draft', 'published')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (problem_version_id, language)
);

CREATE TABLE content.problem_manifest_fixture (
  problem_version_id text NOT NULL REFERENCES content.problem_version(problem_version_id),
  fixture_id text NOT NULL REFERENCES content.semantic_fixture(fixture_id),
  PRIMARY KEY (problem_version_id, fixture_id)
);

CREATE FUNCTION content.prevent_published_manifest_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  version_status text;
  version_id text;
BEGIN
  version_id := COALESCE(OLD.problem_version_id, NEW.problem_version_id);
  SELECT content_version.status INTO version_status
    FROM content.problem_version
    JOIN content.content_version USING (content_version_id)
   WHERE problem_version.problem_version_id = version_id;
  IF version_status IN ('published', 'retired') THEN
    RAISE EXCEPTION 'published and retired language manifests are immutable' USING ERRCODE = '55006';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER language_manifest_immutable
BEFORE INSERT OR UPDATE OR DELETE ON content.problem_language_manifest
FOR EACH ROW EXECUTE FUNCTION content.prevent_published_manifest_mutation();

CREATE TRIGGER manifest_fixture_immutable
BEFORE INSERT OR UPDATE OR DELETE ON content.problem_manifest_fixture
FOR EACH ROW EXECUTE FUNCTION content.prevent_published_manifest_mutation();
