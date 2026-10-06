ALTER TABLE platform.optional_reservation DROP CONSTRAINT optional_reservation_operation_check;
ALTER TABLE platform.optional_reservation ADD CHECK(operation IN ('plan_proposal','code_execution','tutor_generation'));
ALTER TABLE platform.operation_breaker DROP CONSTRAINT operation_breaker_operation_check;
ALTER TABLE platform.operation_breaker ADD CHECK(operation IN ('plan_proposal','code_execution','tutor_generation'));
CREATE TABLE tutor.request (
 request_id text PRIMARY KEY CHECK(request_id ~ '^evt_[0-9a-hjkmnp-tv-z]{16,52}$'),
 learner_id text NOT NULL REFERENCES platform.learner(learner_id),attempt_id text NOT NULL,
 idempotency_key text NOT NULL CHECK(idempotency_key ~ '^[A-Za-z0-9._:-]{8,128}$'),
 digest text NOT NULL CHECK(digest ~ '^sha256:[0-9a-f]{64}$'),input jsonb NOT NULL CHECK(jsonb_typeof(input)='object' AND octet_length(input::text)<=10000),action jsonb NOT NULL CHECK(jsonb_typeof(action)='object'),
 state text NOT NULL CHECK(state IN ('pending','running','completed','fallback','cancelled')),
 claim text,reason text,created_at timestamptz NOT NULL,expires_at timestamptz NOT NULL,
 UNIQUE(learner_id,idempotency_key),FOREIGN KEY(attempt_id,learner_id) REFERENCES practice.attempt(attempt_id,learner_id),
 CHECK((state='running')=(claim IS NOT NULL)),CHECK(expires_at>created_at),
 CHECK(COALESCE(input->>'attemptId'=attempt_id AND action->>'attemptId'=attempt_id AND action->>'learnerId'=learner_id,false))
);
CREATE TABLE tutor.response (
 request_id text PRIMARY KEY REFERENCES tutor.request(request_id),
 evidence_id text REFERENCES tutor.evidence_package(package_id),
 model_configuration jsonb,
 CHECK((evidence_id IS NULL)=(model_configuration IS NULL)),
 CHECK(model_configuration IS NULL OR COALESCE(jsonb_typeof(model_configuration)='object' AND model_configuration->>'version'=body->>'modelConfigVersion',false)),
 body jsonb NOT NULL CHECK(jsonb_typeof(body)='object' AND octet_length(body::text)<=50000),
 checksum text NOT NULL CHECK(checksum ~ '^sha256:[0-9a-f]{64}$'),
 created_at timestamptz NOT NULL
);
CREATE TABLE tutor.assistance (
 request_id text PRIMARY KEY REFERENCES tutor.response(request_id),
 learner_id text NOT NULL REFERENCES platform.learner(learner_id),attempt_id text NOT NULL,
 problem_version_id text NOT NULL REFERENCES content.problem_version(problem_version_id),
 tier smallint NOT NULL CHECK(tier BETWEEN 0 AND 6),recorded_at timestamptz NOT NULL,
 FOREIGN KEY(attempt_id,learner_id) REFERENCES practice.attempt(attempt_id,learner_id)
);
CREATE INDEX tutor_assistance_scope ON tutor.assistance(learner_id,problem_version_id,tier DESC);
CREATE TRIGGER tutor_response_immutable BEFORE UPDATE OR DELETE ON tutor.response FOR EACH ROW EXECUTE FUNCTION platform.prevent_audit_mutation();
CREATE TRIGGER tutor_assistance_immutable BEFORE UPDATE OR DELETE ON tutor.assistance FOR EACH ROW EXECUTE FUNCTION platform.prevent_audit_mutation();
CREATE FUNCTION tutor.protect_request() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' OR (to_jsonb(NEW)-ARRAY['state','claim','reason']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['state','claim','reason']) OR OLD.state IN ('completed','fallback','cancelled') THEN
  RAISE EXCEPTION 'tutor request is immutable or terminal' USING ERRCODE='55006';
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER tutor_request_guard BEFORE UPDATE OR DELETE ON tutor.request FOR EACH ROW EXECUTE FUNCTION tutor.protect_request();
