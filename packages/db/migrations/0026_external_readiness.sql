-- Reviewed per-problem/mode readiness policy. No production policy is seeded.
CREATE TABLE content.external_readiness_rubric (
  rubric_id text NOT NULL CHECK (rubric_id ~ '^[A-Za-z0-9._:-]{1,128}$'),
  version integer NOT NULL CHECK (version > 0),
  problem_version_id text NOT NULL REFERENCES content.problem_version(problem_version_id),
  mode text NOT NULL CHECK (mode IN ('learn','practice','rescue')),
  requirements jsonb NOT NULL CHECK (jsonb_typeof(requirements) = 'array' AND jsonb_array_length(requirements) = 6),
  maximum_assistance_tier integer NOT NULL CHECK (maximum_assistance_tier BETWEEN 0 AND 6),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','retired')),
  author_id text NOT NULL REFERENCES platform.learner(learner_id),
  technical_reviewer_id text REFERENCES platform.learner(learner_id),
  pedagogical_reviewer_id text REFERENCES platform.learner(learner_id),
  publisher_id text REFERENCES platform.learner(learner_id),
  PRIMARY KEY (rubric_id,version),
  UNIQUE (rubric_id,version,problem_version_id,mode)
);
CREATE UNIQUE INDEX external_readiness_current_idx ON content.external_readiness_rubric(problem_version_id,mode) WHERE status='published';
CREATE FUNCTION content.external_readiness_publication_gate() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE category text; requirement jsonb;
BEGIN
 IF TG_OP<>'INSERT' AND OLD.status IN ('published','retired') THEN
  IF TG_OP='DELETE' OR (to_jsonb(NEW)-'status') IS DISTINCT FROM (to_jsonb(OLD)-'status') OR NEW.status<>'retired' THEN
   RAISE EXCEPTION 'published readiness rubrics are immutable' USING ERRCODE='55006';
  END IF;
 END IF;
 IF TG_OP<>'DELETE' AND NEW.status='published' THEN
  IF NEW.technical_reviewer_id IS NULL OR NEW.pedagogical_reviewer_id IS NULL OR NEW.publisher_id IS NULL OR
     cardinality(ARRAY(SELECT DISTINCT x FROM unnest(ARRAY[NEW.author_id,NEW.technical_reviewer_id,NEW.pedagogical_reviewer_id,NEW.publisher_id]) x))<>4 THEN
   RAISE EXCEPTION 'readiness review separation required' USING ERRCODE='23514';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM platform.role_grant WHERE learner_id=NEW.author_id AND role='author' AND revoked_at IS NULL) OR
     NOT EXISTS(SELECT 1 FROM platform.role_grant WHERE learner_id=NEW.technical_reviewer_id AND role='technical_reviewer' AND revoked_at IS NULL) OR
     NOT EXISTS(SELECT 1 FROM platform.role_grant WHERE learner_id=NEW.pedagogical_reviewer_id AND role='pedagogical_reviewer' AND revoked_at IS NULL) OR
     NOT EXISTS(SELECT 1 FROM platform.role_grant WHERE learner_id=NEW.publisher_id AND role='publisher' AND revoked_at IS NULL) THEN
   RAISE EXCEPTION 'active readiness author/reviewer/publisher grants required' USING ERRCODE='23514';
  END IF;
  FOREACH category IN ARRAY ARRAY['concept','pattern','invariant','pseudocode','execution','visualization'] LOOP
   IF (SELECT count(*) FROM jsonb_array_elements(NEW.requirements) r WHERE r->>'category'=category)<>1 THEN
    RAISE EXCEPTION 'every readiness category is required exactly once' USING ERRCODE='23514';
   END IF;
  END LOOP;
  FOR requirement IN SELECT * FROM jsonb_array_elements(NEW.requirements) LOOP
   IF jsonb_typeof(requirement->'checkIds') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'invalid readiness checks' USING ERRCODE='23514'; END IF;
   IF jsonb_array_length(requirement->'checkIds') NOT BETWEEN 1 AND 16 OR
      (SELECT count(DISTINCT value) FROM jsonb_array_elements(requirement->'checkIds'))<>jsonb_array_length(requirement->'checkIds') OR
      EXISTS(SELECT 1 FROM jsonb_array_elements(requirement->'checkIds') c WHERE jsonb_typeof(c)<>'string' OR c#>>'{}' !~ '^[A-Za-z0-9._:-]{1,128}$') THEN
    RAISE EXCEPTION 'invalid readiness checks' USING ERRCODE='23514';
   END IF;
  END LOOP;
 END IF;
 RETURN COALESCE(NEW,OLD);
END; $$;
CREATE TRIGGER external_readiness_publication BEFORE INSERT OR UPDATE OR DELETE ON content.external_readiness_rubric FOR EACH ROW EXECUTE FUNCTION content.external_readiness_publication_gate();

-- Only trusted grading workflows may append facts. No learner-facing write route.
CREATE TABLE practice.external_readiness_evidence (
 evidence_id text PRIMARY KEY CHECK(evidence_id ~ '^evt_[0-9a-hjkmnp-tv-z]{16,52}$'),
 learner_id text NOT NULL REFERENCES platform.learner(learner_id) ON DELETE CASCADE,
 attempt_id text NOT NULL,
 problem_version_id text NOT NULL,
 manifest_id text NOT NULL,
 mode text NOT NULL CHECK(mode IN ('learn','practice','rescue')),
 source_checksum text NOT NULL CHECK(source_checksum ~ '^sha256:[0-9a-f]{64}$'),
 reasoning_revision bigint NOT NULL CHECK(reasoning_revision>0),
 rubric_id text NOT NULL, rubric_version integer NOT NULL,
 category text NOT NULL CHECK(category IN ('concept','pattern','invariant','pseudocode','execution','visualization')),
 check_id text NOT NULL CHECK(check_id ~ '^[A-Za-z0-9._:-]{1,128}$'),
 provenance text NOT NULL CHECK(provenance IN ('server_observed_test','structured_check','human_reviewed')),
 correct boolean NOT NULL, observed_at timestamptz NOT NULL,
 FOREIGN KEY(attempt_id,learner_id) REFERENCES practice.attempt(attempt_id,learner_id) ON DELETE CASCADE,
 FOREIGN KEY(rubric_id,rubric_version,problem_version_id,mode) REFERENCES content.external_readiness_rubric(rubric_id,version,problem_version_id,mode),
 CHECK((category='execution' AND provenance='server_observed_test') OR (category<>'execution' AND provenance IN ('structured_check','human_reviewed')))
);
CREATE INDEX external_readiness_owner_idx ON practice.external_readiness_evidence(learner_id,attempt_id);
CREATE TRIGGER external_readiness_evidence_immutable BEFORE UPDATE ON practice.external_readiness_evidence FOR EACH ROW EXECUTE FUNCTION practice.prevent_assessment_rewrite();
