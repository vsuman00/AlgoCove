-- Rollout metadata is separate from learner evidence and optional provider enablement.
CREATE TABLE tutor.evaluation_suite (
 version text PRIMARY KEY, body jsonb NOT NULL CHECK(jsonb_typeof(body)='object' AND octet_length(body::text)<=200000),
 checksum text NOT NULL CHECK(checksum ~ '^sha256:[0-9a-f]{64}$'),
 owner_id text NOT NULL REFERENCES platform.learner(learner_id), created_at timestamptz NOT NULL,
 CHECK(COALESCE(body->>'version'=version,false))
);
CREATE TABLE tutor.evaluation_configuration (
 version text PRIMARY KEY, body jsonb NOT NULL CHECK(jsonb_typeof(body)='object' AND octet_length(body::text)<=4000),
 checksum text NOT NULL CHECK(checksum ~ '^sha256:[0-9a-f]{64}$'),
 available boolean NOT NULL DEFAULT true,
 registered_by text REFERENCES platform.learner(learner_id), registered_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK(COALESCE(body->>'version'=version,false))
);
CREATE TABLE tutor.evaluation_run (
 run_id text PRIMARY KEY CHECK(run_id ~ '^evt_[0-9a-hjkmnp-tv-z]{16,52}$'),
 suite_version text NOT NULL REFERENCES tutor.evaluation_suite(version),
 configuration_version text NOT NULL REFERENCES tutor.evaluation_configuration(version),
 evaluator_id text NOT NULL REFERENCES platform.learner(learner_id),
 body jsonb NOT NULL CHECK(jsonb_typeof(body)='object' AND octet_length(body::text)<=300000),
 checksum text NOT NULL CHECK(checksum ~ '^sha256:[0-9a-f]{64}$'), created_at timestamptz NOT NULL,
 CHECK(COALESCE(body->>'suiteVersion'=suite_version AND body->>'configurationVersion'=configuration_version,false))
);
CREATE TABLE tutor.evaluation_review (
 run_id text NOT NULL REFERENCES tutor.evaluation_run(run_id), case_id text NOT NULL,
 reviewer_id text NOT NULL REFERENCES platform.learner(learner_id),
 rubric_version text NOT NULL, score double precision NOT NULL CHECK(score>=0 AND score<=1),
 accepted boolean NOT NULL, rationale_code text NOT NULL CHECK(rationale_code ~ '^[a-z0-9_.:-]{1,80}$'),
 created_at timestamptz NOT NULL, PRIMARY KEY(run_id,case_id,reviewer_id)
);
CREATE TABLE tutor.configuration_decision (
 decision_id text PRIMARY KEY CHECK(decision_id ~ '^evt_[0-9a-hjkmnp-tv-z]{16,52}$'),
 channel text NOT NULL CHECK(channel IN('fixture','production')),
 action text NOT NULL CHECK(action IN('promote','rollback')),
 previous_version text NOT NULL REFERENCES tutor.evaluation_configuration(version),
 target_version text NOT NULL REFERENCES tutor.evaluation_configuration(version),
 rollback_version text NOT NULL REFERENCES tutor.evaluation_configuration(version),
 run_id text REFERENCES tutor.evaluation_run(run_id),
 operator_id text NOT NULL REFERENCES platform.learner(learner_id),
 accepted boolean NOT NULL, evidence jsonb NOT NULL CHECK(octet_length(evidence::text)<=5000),
 created_at timestamptz NOT NULL
);
CREATE TABLE tutor.configuration_channel (
 channel text PRIMARY KEY CHECK(channel IN('fixture','production')),
 active_version text NOT NULL REFERENCES tutor.evaluation_configuration(version),
 decision_id text REFERENCES tutor.configuration_decision(decision_id)
);
-- An authored/off rollback target is always known; it invokes no provider.
INSERT INTO tutor.evaluation_configuration(version,body,checksum)
VALUES('authored.off.v1','{"version":"authored.off.v1","kind":"authored-off"}',
 'sha256:' || encode(sha256(convert_to('{"kind":"authored-off","version":"authored.off.v1"}','UTF8')),'hex'));
INSERT INTO tutor.configuration_channel(channel,active_version) VALUES('fixture','authored.off.v1'),('production','authored.off.v1');
CREATE FUNCTION tutor.protect_evaluation_configuration() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' OR (to_jsonb(NEW)-'available') IS DISTINCT FROM (to_jsonb(OLD)-'available') THEN
  RAISE EXCEPTION 'evaluation configuration is immutable' USING ERRCODE='55006';
 END IF;
 IF NOT NEW.available AND EXISTS(SELECT 1 FROM tutor.configuration_channel WHERE active_version=NEW.version) THEN
  RAISE EXCEPTION 'active configuration cannot be removed' USING ERRCODE='55006';
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER evaluation_configuration_immutable BEFORE UPDATE OR DELETE ON tutor.evaluation_configuration FOR EACH ROW EXECUTE FUNCTION tutor.protect_evaluation_configuration();
CREATE FUNCTION tutor.protect_configuration_channel() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' OR NOT EXISTS(
  SELECT 1 FROM tutor.configuration_decision d JOIN tutor.evaluation_configuration c ON c.version=d.target_version
  WHERE d.decision_id=NEW.decision_id AND d.channel=OLD.channel AND NEW.channel=OLD.channel
   AND d.accepted AND d.previous_version=OLD.active_version AND d.target_version=NEW.active_version AND c.available
 ) THEN RAISE EXCEPTION 'accepted decision required for rollout change' USING ERRCODE='55006'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER configuration_channel_guard BEFORE UPDATE OR DELETE ON tutor.configuration_channel FOR EACH ROW EXECUTE FUNCTION tutor.protect_configuration_channel();
CREATE TRIGGER evaluation_suite_immutable BEFORE UPDATE OR DELETE ON tutor.evaluation_suite FOR EACH ROW EXECUTE FUNCTION platform.prevent_audit_mutation();
CREATE TRIGGER evaluation_run_immutable BEFORE UPDATE OR DELETE ON tutor.evaluation_run FOR EACH ROW EXECUTE FUNCTION platform.prevent_audit_mutation();
CREATE TRIGGER evaluation_review_immutable BEFORE UPDATE OR DELETE ON tutor.evaluation_review FOR EACH ROW EXECUTE FUNCTION platform.prevent_audit_mutation();
CREATE TRIGGER configuration_decision_immutable BEFORE UPDATE OR DELETE ON tutor.configuration_decision FOR EACH ROW EXECUTE FUNCTION platform.prevent_audit_mutation();
