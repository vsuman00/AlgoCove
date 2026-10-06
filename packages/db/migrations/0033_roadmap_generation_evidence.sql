CREATE TABLE tutor.roadmap_generation_evidence (
 evidence_id text PRIMARY KEY CHECK(evidence_id ~ '^evt_[0-9a-hjkmnp-tv-z]{16,52}$'),
 configuration_version text NOT NULL REFERENCES tutor.evaluation_configuration(version),
 body jsonb NOT NULL CHECK(jsonb_typeof(body)='object' AND octet_length(body::text)<=3000),
 checksum text NOT NULL CHECK(checksum ~ '^sha256:[0-9a-f]{64}$'),
 created_at timestamptz NOT NULL,
 CHECK(COALESCE(body->>'bundleVersion'=configuration_version,false))
);
CREATE TRIGGER roadmap_generation_evidence_immutable BEFORE UPDATE OR DELETE ON tutor.roadmap_generation_evidence
FOR EACH ROW EXECUTE FUNCTION platform.prevent_audit_mutation();
