-- Non-code learning assessments retain their real source; never fabricate code runs.
CREATE TABLE practice.learning_observation (
 observation_id text PRIMARY KEY CHECK (observation_id ~ '^evt_[0-9a-hjkmnp-tv-z]{16,52}$'),
 learner_id text NOT NULL REFERENCES platform.learner(learner_id) ON DELETE CASCADE,
 attempt_id text NOT NULL,
 problem_version_id text NOT NULL REFERENCES content.problem_version(problem_version_id),
 source_kind text NOT NULL CHECK (source_kind IN ('structured_explanation','review')),
 source_key text NOT NULL,
 submission_digest text NOT NULL CHECK(submission_digest ~ '^sha256:[0-9a-f]{64}$'),
 facts jsonb NOT NULL CHECK (jsonb_typeof(facts)='object'),
 observed_at timestamptz NOT NULL,
 UNIQUE (observation_id,learner_id), UNIQUE(learner_id,source_kind,source_key),
 FOREIGN KEY(attempt_id,learner_id) REFERENCES practice.attempt(attempt_id,learner_id) ON DELETE CASCADE
);
CREATE TRIGGER learning_observation_immutable BEFORE UPDATE ON practice.learning_observation FOR EACH ROW EXECUTE FUNCTION practice.prevent_assessment_rewrite();
ALTER TABLE mastery.evidence DROP CONSTRAINT evidence_observation_id_learner_id_fkey;
ALTER TABLE mastery.evidence ADD COLUMN source_kind text NOT NULL DEFAULT 'code' CHECK(source_kind IN ('code','structured_explanation','review')),
 ADD COLUMN assessment_observation_id text, ADD COLUMN learning_observation_id text;
-- Temporarily disable the owner-controlled immutability trigger only for this migration.
ALTER TABLE mastery.evidence DISABLE TRIGGER mastery_evidence_immutable;
UPDATE mastery.evidence SET assessment_observation_id=observation_id;
ALTER TABLE mastery.evidence ENABLE TRIGGER mastery_evidence_immutable;
ALTER TABLE mastery.evidence ADD FOREIGN KEY(assessment_observation_id,learner_id) REFERENCES practice.assessment_observation(observation_id,learner_id) ON DELETE CASCADE,
 ADD FOREIGN KEY(learning_observation_id,learner_id) REFERENCES practice.learning_observation(observation_id,learner_id) ON DELETE CASCADE,
 ADD CHECK((source_kind='code' AND assessment_observation_id=observation_id AND assessment_observation_id IS NOT NULL AND learning_observation_id IS NULL) OR (source_kind<>'code' AND learning_observation_id=observation_id AND learning_observation_id IS NOT NULL AND assessment_observation_id IS NULL));

CREATE TABLE content.review_exercise (
 exercise_id text PRIMARY KEY CHECK(exercise_id ~ '^[a-z0-9._-]{1,128}$'),
 concept_id text NOT NULL REFERENCES learning.concept(concept_id),
 kind text NOT NULL CHECK(kind IN ('recall','transfer')),
 problem_version_id text REFERENCES content.problem_version(problem_version_id),
 rights_holder text NOT NULL DEFAULT 'AlgoCove', license text NOT NULL DEFAULT 'algocove-original-v1',
 rights_expires_at timestamptz,
 CHECK(kind<>'recall' OR problem_version_id IS NOT NULL),
 title text NOT NULL CHECK(char_length(title) BETWEEN 1 AND 200),
 questions jsonb NOT NULL CHECK(jsonb_typeof(questions)='array' AND jsonb_array_length(questions) BETWEEN 1 AND 8),
 author_id text NOT NULL REFERENCES platform.learner(learner_id),
 technical_reviewer_id text REFERENCES platform.learner(learner_id),
 pedagogical_reviewer_id text REFERENCES platform.learner(learner_id),
 publisher_id text REFERENCES platform.learner(learner_id),
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','retired')),
 rubric_version integer NOT NULL DEFAULT 1 CHECK(rubric_version>0),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE FUNCTION content.review_exercise_gate() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE question jsonb; option_count integer;
BEGIN
 IF TG_OP<>'INSERT' AND OLD.status IN ('published','retired') THEN
  IF TG_OP='DELETE' OR (to_jsonb(NEW)-'status') IS DISTINCT FROM (to_jsonb(OLD)-'status') OR NEW.status<>'retired' THEN RAISE EXCEPTION 'published review exercises are immutable' USING ERRCODE='55006'; END IF;
 END IF;
 IF TG_OP<>'DELETE' AND NEW.status='published' THEN
  IF NEW.technical_reviewer_id IS NULL OR NEW.pedagogical_reviewer_id IS NULL OR NEW.publisher_id IS NULL OR cardinality(ARRAY(SELECT DISTINCT x FROM unnest(ARRAY[NEW.author_id,NEW.technical_reviewer_id,NEW.pedagogical_reviewer_id,NEW.publisher_id]) x))<>4 THEN RAISE EXCEPTION 'review exercise separation of duties required' USING ERRCODE='23514'; END IF;
  IF NOT EXISTS(SELECT 1 FROM platform.role_grant WHERE learner_id=NEW.author_id AND role='author' AND revoked_at IS NULL) OR NOT EXISTS(SELECT 1 FROM platform.role_grant WHERE learner_id=NEW.technical_reviewer_id AND role='technical_reviewer' AND revoked_at IS NULL) OR NOT EXISTS(SELECT 1 FROM platform.role_grant WHERE learner_id=NEW.pedagogical_reviewer_id AND role='pedagogical_reviewer' AND revoked_at IS NULL) OR NOT EXISTS(SELECT 1 FROM platform.role_grant WHERE learner_id=NEW.publisher_id AND role='publisher' AND revoked_at IS NULL) THEN RAISE EXCEPTION 'active review/publisher grants required' USING ERRCODE='23514'; END IF;
  IF char_length(NEW.rights_holder)=0 OR char_length(NEW.license)=0 THEN RAISE EXCEPTION 'review rights required' USING ERRCODE='23514'; END IF;
  IF (SELECT count(DISTINCT q->>'id') FROM jsonb_array_elements(NEW.questions) q)<>jsonb_array_length(NEW.questions) THEN RAISE EXCEPTION 'unique question identifiers required' USING ERRCODE='23514'; END IF;
  FOR question IN SELECT * FROM jsonb_array_elements(NEW.questions) LOOP
   IF jsonb_typeof(question->'options') IS DISTINCT FROM 'array' OR COALESCE(question->>'id','') !~ '^[a-z][a-z0-9_]{0,63}$' OR char_length(COALESCE(question->>'prompt','')) NOT BETWEEN 1 AND 1600 THEN RAISE EXCEPTION 'invalid reviewed question' USING ERRCODE='23514'; END IF;
   option_count:=jsonb_array_length(question->'options');
   IF option_count NOT BETWEEN 2 AND 8 OR (SELECT count(DISTINCT o->>'value') FROM jsonb_array_elements(question->'options') o)<>option_count OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(question->'options') o WHERE o->>'value'=question->>'answer') OR EXISTS(SELECT 1 FROM jsonb_array_elements(question->'options') o WHERE char_length(COALESCE(o->>'value','')) NOT BETWEEN 1 AND 128 OR char_length(COALESCE(o->>'label','')) NOT BETWEEN 1 AND 500) THEN RAISE EXCEPTION 'invalid reviewed answer key' USING ERRCODE='23514'; END IF;
  END LOOP;
 END IF;
 RETURN COALESCE(NEW,OLD);
END; $$;
CREATE TRIGGER review_exercise_publication BEFORE INSERT OR UPDATE OR DELETE ON content.review_exercise FOR EACH ROW EXECUTE FUNCTION content.review_exercise_gate();

CREATE TABLE mastery.review_item (
 review_id text PRIMARY KEY CHECK(review_id ~ '^evt_[0-9a-hjkmnp-tv-z]{16,52}$'),
 learner_id text NOT NULL REFERENCES platform.learner(learner_id) ON DELETE CASCADE,
 concept_id text NOT NULL REFERENCES learning.concept(concept_id),
 origin_observation_id text NOT NULL,
 origin_problem_version_id text NOT NULL REFERENCES content.problem_version(problem_version_id),
 origin_attempt_id text NOT NULL,
 origin_at timestamptz NOT NULL,
 evidence_watermark text NOT NULL, policy_version integer NOT NULL CHECK(policy_version>0),
 due_start timestamptz NOT NULL, due_end timestamptz NOT NULL CHECK(due_end>due_start),
 status text NOT NULL CHECK(status IN ('due','deferred','awaiting_projection','completed','superseded')),
 completed_observation_id text REFERENCES practice.learning_observation(observation_id) ON DELETE SET NULL,
 UNIQUE(learner_id,concept_id,evidence_watermark,policy_version),
 FOREIGN KEY(origin_attempt_id,learner_id) REFERENCES practice.attempt(attempt_id,learner_id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX review_one_open_idx ON mastery.review_item(learner_id,concept_id) WHERE status IN ('due','deferred');
CREATE INDEX review_queue_idx ON mastery.review_item(learner_id,status,due_start);
CREATE TABLE mastery.review_event (
 event_id text PRIMARY KEY,
 review_id text NOT NULL REFERENCES mastery.review_item(review_id) ON DELETE CASCADE,
 learner_id text NOT NULL REFERENCES platform.learner(learner_id) ON DELETE CASCADE,
 kind text NOT NULL CHECK(kind IN ('scheduled','deferred','answered','completed','superseded')),
 occurred_at timestamptz NOT NULL, metadata jsonb NOT NULL DEFAULT '{}'
);
CREATE TRIGGER review_event_immutable BEFORE UPDATE ON mastery.review_event FOR EACH ROW EXECUTE FUNCTION practice.prevent_assessment_rewrite();
CREATE TABLE practice.study_activity (
 observation_id text PRIMARY KEY,
 learner_id text NOT NULL REFERENCES platform.learner(learner_id) ON DELETE CASCADE,
 occurred_at timestamptz NOT NULL, local_day date NOT NULL, timezone text NOT NULL,
 kind text NOT NULL CHECK(kind IN ('assessment','explanation','review')),
 policy_version integer NOT NULL DEFAULT 1,
 assessment_observation_id text REFERENCES practice.assessment_observation(observation_id) ON DELETE CASCADE,
 learning_observation_id text REFERENCES practice.learning_observation(observation_id) ON DELETE CASCADE,
 CHECK((kind='assessment' AND assessment_observation_id=observation_id AND assessment_observation_id IS NOT NULL AND learning_observation_id IS NULL) OR (kind<>'assessment' AND learning_observation_id=observation_id AND learning_observation_id IS NOT NULL AND assessment_observation_id IS NULL))
);
CREATE TRIGGER study_activity_immutable BEFORE UPDATE ON practice.study_activity FOR EACH ROW EXECUTE FUNCTION practice.prevent_assessment_rewrite();
CREATE TABLE practice.study_pause (
 pause_id text PRIMARY KEY, learner_id text NOT NULL REFERENCES platform.learner(learner_id) ON DELETE CASCADE,
 start_day date NOT NULL, end_day date NOT NULL CHECK(end_day>=start_day AND end_day-start_day<365),
 timezone text NOT NULL, created_at timestamptz NOT NULL,
 UNIQUE(learner_id,start_day,end_day,timezone)
);
CREATE TRIGGER study_pause_immutable BEFORE UPDATE ON practice.study_pause FOR EACH ROW EXECUTE FUNCTION practice.prevent_assessment_rewrite();
CREATE TABLE practice.external_practice_event (
 event_id text PRIMARY KEY, learner_id text NOT NULL REFERENCES platform.learner(learner_id) ON DELETE CASCADE,
 reference_id text NOT NULL REFERENCES content.external_reference(external_reference_id),
 kind text NOT NULL CHECK(kind IN ('handoff_requested','completed','corrected')),
 idempotency_key text NOT NULL CHECK(char_length(idempotency_key) BETWEEN 8 AND 128),
 occurred_at timestamptz NOT NULL,
 UNIQUE(learner_id,idempotency_key)
);
CREATE TRIGGER external_practice_immutable BEFORE UPDATE ON practice.external_practice_event FOR EACH ROW EXECUTE FUNCTION practice.prevent_assessment_rewrite();
