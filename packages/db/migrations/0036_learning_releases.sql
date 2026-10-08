-- Expand the governed content model; indexing still admits existing problem content only.
ALTER TABLE content.content_item DROP CONSTRAINT content_item_content_kind_check;
ALTER TABLE content.content_item ADD CHECK(content_kind IN ('problem','lesson','approach','walkthrough'));
CREATE TABLE content.learning_release (
 content_version_id text PRIMARY KEY REFERENCES content.content_version(content_version_id),
 problem_version_id text NOT NULL UNIQUE REFERENCES content.problem_version(problem_version_id),
 packet_checksum text NOT NULL CHECK(packet_checksum ~ '^sha256:[0-9a-f]{64}$'),
 packet jsonb NOT NULL CHECK(jsonb_typeof(packet)='object' AND packet->>'schemaVersion'='1'),
 public_payload jsonb NOT NULL CHECK(jsonb_typeof(public_payload)='object' AND NOT public_payload ?| ARRAY['answer','solutions','fixtures','questionsWithAnswers']),
 manifest jsonb,
 walkthrough jsonb,
 CHECK(manifest IS NULL OR (jsonb_typeof(manifest)='object' AND manifest->>'contentVersionId'=content_version_id AND manifest->>'problemVersionId'=problem_version_id))
);
CREATE TRIGGER learning_release_immutable BEFORE INSERT OR UPDATE OR DELETE ON content.learning_release
 FOR EACH ROW EXECUTE FUNCTION content.prevent_published_content_mutation();
CREATE TABLE practice.attempt_release_pin (
 attempt_id text PRIMARY KEY REFERENCES practice.attempt(attempt_id),
 content_version_id text NOT NULL REFERENCES content.content_version(content_version_id),
 source_checksum text NOT NULL CHECK(source_checksum ~ '^sha256:[0-9a-f]{64}$')
);
-- Backfill exact historical version ownership; never infer pins from current slugs.
INSERT INTO practice.attempt_release_pin(attempt_id,content_version_id,source_checksum)
 SELECT attempt.attempt_id,version.content_version_id,version.checksum
 FROM practice.attempt attempt JOIN content.problem_version problem USING(problem_version_id)
 JOIN content.content_version version USING(content_version_id);
CREATE FUNCTION practice.pin_learning_release() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO practice.attempt_release_pin(attempt_id,content_version_id,source_checksum)
 SELECT NEW.attempt_id,version.content_version_id,version.checksum FROM content.problem_version problem
 JOIN content.content_version version USING(content_version_id) WHERE problem.problem_version_id=NEW.problem_version_id;
 RETURN NEW;
END;
$$;
CREATE TRIGGER attempt_learning_release_pin AFTER INSERT ON practice.attempt FOR EACH ROW EXECUTE FUNCTION practice.pin_learning_release();
CREATE FUNCTION practice.keep_learning_release_pin() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'attempt release pins are immutable' USING ERRCODE='55006'; END;
$$;
CREATE TRIGGER attempt_release_pin_immutable BEFORE UPDATE ON practice.attempt_release_pin FOR EACH ROW EXECUTE FUNCTION practice.keep_learning_release_pin();
CREATE FUNCTION content.learning_release_publication_gate() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.status='published' AND OLD.status='draft' AND EXISTS(SELECT 1 FROM content.learning_release WHERE content_version_id=NEW.content_version_id) THEN
  IF NOT EXISTS(SELECT 1 FROM content.learning_release r WHERE r.content_version_id=NEW.content_version_id
   AND r.manifest->>'sourceChecksum'=NEW.checksum
   AND jsonb_array_length(r.manifest->'languages')=6
   AND (SELECT count(*) FROM content.problem_language_manifest m WHERE m.problem_version_id=r.problem_version_id AND m.status='published')=6
   AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(r.manifest->'languages') pin
     WHERE NOT EXISTS(SELECT 1 FROM content.problem_language_manifest m WHERE m.manifest_id=pin->>'manifestId' AND m.language=pin->>'language' AND m.problem_version_id=r.problem_version_id AND m.status='published')))
  THEN RAISE EXCEPTION 'typed release requires current exact asset and language pins' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER learning_release_publication_guard BEFORE UPDATE ON content.content_version FOR EACH ROW EXECUTE FUNCTION content.learning_release_publication_gate();
