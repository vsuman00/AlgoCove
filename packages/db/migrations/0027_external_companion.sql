ALTER TABLE content.external_readiness_rubric
 ADD COLUMN questions jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(questions)='array'),
 ADD COLUMN external_reference_id text REFERENCES content.external_reference(external_reference_id),
 ADD COLUMN mapping_kind text NOT NULL DEFAULT 'same_pattern' CHECK(mapping_kind IN ('same_pattern','equivalent_problem','prerequisite','transfer')),
 ADD COLUMN mapping_rationale text NOT NULL DEFAULT '' CHECK(char_length(mapping_rationale)<=1600);
-- Publication payload is already immutable through the Task 38 trigger.
CREATE TABLE content.external_readiness_audit (
 event_id text PRIMARY KEY, rubric_id text NOT NULL, rubric_version integer NOT NULL,
 actor_id text NOT NULL REFERENCES platform.learner(learner_id),
 action text NOT NULL CHECK(action IN ('created','technical_review','pedagogical_review','published','retired')),
 occurred_at timestamptz NOT NULL,
 FOREIGN KEY(rubric_id,rubric_version) REFERENCES content.external_readiness_rubric(rubric_id,version)
);
CREATE TRIGGER external_readiness_audit_immutable BEFORE UPDATE ON content.external_readiness_audit FOR EACH ROW EXECUTE FUNCTION practice.prevent_assessment_rewrite();
ALTER TABLE practice.external_practice_event ADD COLUMN attempt_id text,
 ADD COLUMN reference_version integer, ADD COLUMN readiness_rubric_id text, ADD COLUMN readiness_rubric_version integer,
 ADD FOREIGN KEY(attempt_id,learner_id) REFERENCES practice.attempt(attempt_id,learner_id) ON DELETE CASCADE;
CREATE INDEX external_practice_attempt_idx ON practice.external_practice_event(learner_id,attempt_id,occurred_at DESC);
ALTER TABLE practice.external_readiness_evidence ADD COLUMN source_observation_id text REFERENCES practice.assessment_observation(observation_id) ON DELETE CASCADE;
ALTER TABLE content.external_reference ADD COLUMN author_id text REFERENCES platform.learner(learner_id);
