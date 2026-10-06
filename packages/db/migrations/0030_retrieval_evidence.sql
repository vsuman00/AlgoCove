CREATE SCHEMA IF NOT EXISTS tutor;
CREATE TABLE search.retrieval_configuration (
 configuration_version text PRIMARY KEY CHECK(configuration_version ~ '^[A-Za-z0-9._:-]{1,128}$'),
 embedding_configuration_id text NOT NULL REFERENCES search.embedding_configuration(configuration_id),
 body jsonb NOT NULL CHECK(jsonb_typeof(body)='object'),
 enabled boolean NOT NULL DEFAULT false,
 CHECK(COALESCE(body->>'version'=configuration_version AND body->>'embeddingConfigurationId'=embedding_configuration_id,false))
);
CREATE FUNCTION search.protect_retrieval_configuration() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' OR (to_jsonb(NEW)-'enabled') IS DISTINCT FROM (to_jsonb(OLD)-'enabled') THEN
  RAISE EXCEPTION 'retrieval configuration is immutable' USING ERRCODE='55006';
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER retrieval_configuration_immutable BEFORE UPDATE OR DELETE ON search.retrieval_configuration
FOR EACH ROW EXECUTE FUNCTION search.protect_retrieval_configuration();
CREATE TABLE tutor.evidence_package (
 package_id text PRIMARY KEY CHECK(package_id ~ '^evt_[0-9a-hjkmnp-tv-z]{16,52}$'),
 learner_id text NOT NULL REFERENCES platform.learner(learner_id),
 attempt_id text NOT NULL,
 idempotency_key text NOT NULL CHECK(idempotency_key ~ '^[A-Za-z0-9._:-]{8,128}$'),
 request_digest text NOT NULL CHECK(request_digest ~ '^sha256:[0-9a-f]{64}$'),
 configuration_version text NOT NULL REFERENCES search.retrieval_configuration(configuration_version),
 body jsonb NOT NULL CHECK(jsonb_typeof(body)='object' AND octet_length(body::text)<=500000),
 checksum text NOT NULL CHECK(checksum ~ '^sha256:[0-9a-f]{64}$'),
 created_at timestamptz NOT NULL,
 UNIQUE(learner_id,idempotency_key),
 FOREIGN KEY(attempt_id,learner_id) REFERENCES practice.attempt(attempt_id,learner_id),
 CHECK(COALESCE(body->>'packageId'=package_id AND body->>'checksum'=checksum AND body->'scope'->>'learnerId'=learner_id AND body->'scope'->>'attemptId'=attempt_id AND body->'request'->>'attemptId'=attempt_id AND body->'configuration'->>'version'=configuration_version,false))
);
CREATE INDEX evidence_package_owner_idx ON tutor.evidence_package(learner_id,created_at,package_id);
CREATE TRIGGER evidence_package_immutable BEFORE UPDATE OR DELETE ON tutor.evidence_package
FOR EACH ROW EXECUTE FUNCTION platform.prevent_audit_mutation();
