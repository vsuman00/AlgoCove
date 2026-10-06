-- The existing outbox remains the only delivery authority. Preserve lifetime
-- claim attempts for fencing while granting a fresh bounded retry budget on replay.
ALTER TABLE platform.outbox_event
  ADD COLUMN replay_attempt_base integer NOT NULL DEFAULT 0
    CHECK (replay_attempt_base >= 0 AND replay_attempt_base <= attempts);

CREATE TABLE platform.worker_effect_receipt (
  event_id text NOT NULL REFERENCES platform.outbox_event(event_id),
  handler_version text NOT NULL CHECK (handler_version ~ '^[A-Za-z0-9._:-]{1,128}$'),
  completed_at timestamptz NOT NULL,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(summary)='object'),
  PRIMARY KEY(event_id,handler_version)
);
CREATE TRIGGER worker_effect_receipt_immutable BEFORE UPDATE OR DELETE
ON platform.worker_effect_receipt FOR EACH ROW EXECUTE FUNCTION platform.prevent_audit_mutation();

-- Readiness is an eventual state, distinct from content publication. Module
-- consumers register expected work here; these descriptors contain no payload text.
CREATE TABLE platform.worker_derivation_expectation (
  content_version_id text NOT NULL REFERENCES content.content_version(content_version_id),
  policy_version text NOT NULL CHECK (policy_version ~ '^[A-Za-z0-9._:-]{1,128}$'),
  source_checksum text NOT NULL CHECK (source_checksum ~ '^sha256:[0-9a-f]{64}$'),
  topic text NOT NULL CHECK (topic IN ('content.derivation.requested','content.embedding.requested')),
  event_id text NOT NULL UNIQUE REFERENCES platform.outbox_event(event_id),
  registered_at timestamptz NOT NULL,
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','ready','quarantined','obsolete')),
  PRIMARY KEY(content_version_id,policy_version,topic)
);
CREATE FUNCTION platform.protect_derivation_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' OR (NEW.content_version_id,NEW.policy_version,NEW.source_checksum,NEW.topic,NEW.event_id,NEW.registered_at)
    IS DISTINCT FROM (OLD.content_version_id,OLD.policy_version,OLD.source_checksum,OLD.topic,OLD.event_id,OLD.registered_at) THEN
    RAISE EXCEPTION 'derivation lineage is immutable' USING ERRCODE='55006';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER worker_derivation_expectation_immutable BEFORE UPDATE OR DELETE
ON platform.worker_derivation_expectation FOR EACH ROW EXECUTE FUNCTION platform.protect_derivation_identity();
