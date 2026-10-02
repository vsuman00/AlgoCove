-- Replaceable projections are deliberately separated from source facts.
ALTER TABLE practice.assessment_observation
  ADD CONSTRAINT assessment_observation_owner_key UNIQUE (observation_id, learner_id);

CREATE TABLE mastery.policy_version (
  policy_version integer PRIMARY KEY CHECK (policy_version > 0),
  require_validated_explanation boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO mastery.policy_version (policy_version, require_validated_explanation) VALUES (1, false);

CREATE TABLE mastery.evidence (
  observation_id text NOT NULL,
  concept_id text NOT NULL REFERENCES learning.concept(concept_id) ON DELETE RESTRICT,
  learner_id text NOT NULL REFERENCES platform.learner(learner_id) ON DELETE CASCADE,
  problem_version_id text NOT NULL,
  source_event_id text NOT NULL CHECK (source_event_id ~ '^evt_[0-9a-hjkmnp-tv-z]{16,52}$'),
  evidence_policy_version integer NOT NULL CHECK (evidence_policy_version > 0),
  observed_at timestamptz NOT NULL,
  ingested_at timestamptz NOT NULL,
  facts jsonb NOT NULL CHECK (jsonb_typeof(facts) = 'object' AND facts ?& ARRAY['learnerId','conceptId','observationId','sourceEventId','problemVersionId']),
  PRIMARY KEY (observation_id, concept_id),
  UNIQUE (source_event_id, concept_id),
  FOREIGN KEY (observation_id, learner_id)
    REFERENCES practice.assessment_observation(observation_id, learner_id) ON DELETE CASCADE,
  FOREIGN KEY (problem_version_id, concept_id)
    REFERENCES learning.problem_concept(problem_version_id, concept_id) ON DELETE RESTRICT,
  CHECK (COALESCE(facts->>'learnerId' = learner_id AND facts->>'conceptId' = concept_id
     AND facts->>'observationId' = observation_id AND facts->>'sourceEventId' = source_event_id
     AND facts->>'problemVersionId' = problem_version_id, false))
);
CREATE INDEX mastery_evidence_owner_idx ON mastery.evidence (learner_id, concept_id, observed_at, observation_id);

CREATE TABLE mastery.projection (
  learner_id text NOT NULL REFERENCES platform.learner(learner_id) ON DELETE CASCADE,
  concept_id text NOT NULL REFERENCES learning.concept(concept_id) ON DELETE RESTRICT,
  policy_version integer NOT NULL REFERENCES mastery.policy_version(policy_version) ON DELETE RESTRICT,
  body jsonb NOT NULL CHECK (jsonb_typeof(body) = 'object' AND body ?& ARRAY['learnerId','conceptId','policyVersion']),
  PRIMARY KEY (learner_id, concept_id, policy_version),
  CHECK (COALESCE(body->>'learnerId' = learner_id AND body->>'conceptId' = concept_id
     AND (body->>'policyVersion')::integer = policy_version, false))
);

CREATE FUNCTION mastery.prevent_evidence_rewrite()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- Privacy deletion may cascade from learner/source ownership; direct removal
  -- and updates cannot be used to change historical mastery evidence.
  IF TG_OP = 'UPDATE' OR pg_trigger_depth() = 1 THEN
    RAISE EXCEPTION 'mastery evidence is append-only' USING ERRCODE = '55006';
  END IF;
  RETURN OLD;
END;
$$;
CREATE TRIGGER mastery_evidence_immutable BEFORE UPDATE OR DELETE ON mastery.evidence
FOR EACH ROW EXECUTE FUNCTION mastery.prevent_evidence_rewrite();

CREATE FUNCTION mastery.prevent_policy_rewrite()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'mastery policy versions are immutable' USING ERRCODE = '55006';
END;
$$;
CREATE TRIGGER mastery_policy_immutable BEFORE UPDATE OR DELETE ON mastery.policy_version
FOR EACH ROW EXECUTE FUNCTION mastery.prevent_policy_rewrite();

ALTER TABLE platform.outbox_event
  ADD COLUMN dead_lettered_at timestamptz,
  ADD COLUMN dead_letter_reason text CHECK (dead_letter_reason IN ('invalid_source', 'retry_exhausted')),
  ADD CONSTRAINT outbox_dead_letter_check CHECK ((dead_lettered_at IS NULL) = (dead_letter_reason IS NULL));
