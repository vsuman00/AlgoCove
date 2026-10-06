-- Immutable derived snapshots. Publication is independent of evaluated retrieval readiness.
CREATE SCHEMA IF NOT EXISTS search;
CREATE TABLE search.content_index (
 index_id text PRIMARY KEY CHECK(index_id ~ '^idx_[0-9a-f]{40}$'),
 content_version_id text NOT NULL REFERENCES content.content_version(content_version_id),
 problem_version_id text NOT NULL REFERENCES content.problem_version(problem_version_id),
 policy_version text NOT NULL,
 source_checksum text NOT NULL CHECK(source_checksum ~ '^sha256:[0-9a-f]{64}$'),
 normalized_checksum text NOT NULL CHECK(normalized_checksum ~ '^sha256:[0-9a-f]{64}$'),
 scan_version text NOT NULL,
 concept_ids text[] NOT NULL CHECK(cardinality(concept_ids)>0),
 curriculum_version_ids text[] NOT NULL CHECK(cardinality(curriculum_version_ids)>0),
 languages text[] NOT NULL CHECK(cardinality(languages)>0),
 valid_from timestamptz NOT NULL,
 valid_until timestamptz,
 created_at timestamptz NOT NULL,
 state text NOT NULL DEFAULT 'candidate' CHECK(state IN ('candidate','ready','quarantined','obsolete')),
 evaluation_reference text,
 CHECK(state<>'ready' OR evaluation_reference IS NOT NULL),
 UNIQUE(content_version_id,policy_version,normalized_checksum)
);
CREATE TABLE search.content_chunk (
 chunk_id text PRIMARY KEY CHECK(chunk_id ~ '^chk_[0-9a-f]{40}$'),
 index_id text NOT NULL REFERENCES search.content_index(index_id),
 kind text NOT NULL CHECK(kind IN ('problem_statement','hint_tier')),
 ordinal integer NOT NULL CHECK(ordinal BETWEEN 0 AND 6),
 source_object_id text NOT NULL,
 text text NOT NULL CHECK(char_length(text) BETWEEN 1 AND 20000),
 text_checksum text NOT NULL CHECK(text_checksum ~ '^sha256:[0-9a-f]{64}$'),
 hint_tier smallint NOT NULL CHECK(hint_tier BETWEEN 0 AND 6),
 language text NOT NULL CHECK(language='neutral'),
 target_level text NOT NULL CHECK(target_level='unspecified'),
 visibility text NOT NULL CHECK(visibility='published_curriculum'),
 scan_status text NOT NULL CHECK(scan_status='passed'),
 lexical_document tsvector GENERATED ALWAYS AS (to_tsvector('english'::regconfig,text)) STORED,
 CHECK((kind='problem_statement' AND hint_tier=0 AND ordinal=0) OR (kind='hint_tier' AND hint_tier>0 AND ordinal>0)),
 UNIQUE(index_id,ordinal)
);
CREATE INDEX content_chunk_lexical_idx ON search.content_chunk USING gin(lexical_document);
CREATE TABLE search.embedding_configuration (
 configuration_id text PRIMARY KEY CHECK(configuration_id ~ '^emb_[0-9a-f]{40}$'),
 provider text NOT NULL,
 model text NOT NULL,
 dimensions integer NOT NULL CHECK(dimensions BETWEEN 1 AND 1536),
 normalization text NOT NULL CHECK(normalization IN ('unit','none')),
 policy_version text NOT NULL,
 enabled boolean NOT NULL DEFAULT false,
 CHECK(provider<>'fixture' OR NOT enabled),
 UNIQUE(provider,model,dimensions,normalization,policy_version)
);
CREATE TABLE search.chunk_embedding (
 chunk_id text NOT NULL REFERENCES search.content_chunk(chunk_id),
 configuration_id text NOT NULL REFERENCES search.embedding_configuration(configuration_id),
 vector public.vector NOT NULL,
 text_checksum text NOT NULL CHECK(text_checksum ~ '^sha256:[0-9a-f]{64}$'),
 created_at timestamptz NOT NULL,
 PRIMARY KEY(chunk_id,configuration_id)
);
CREATE FUNCTION search.validate_embedding_lineage() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE expected_dimensions integer; expected_checksum text; expected_normalization text;
BEGIN
 SELECT dimensions,normalization INTO expected_dimensions,expected_normalization FROM search.embedding_configuration WHERE configuration_id=NEW.configuration_id;
 SELECT text_checksum INTO expected_checksum FROM search.content_chunk WHERE chunk_id=NEW.chunk_id;
 IF public.vector_dims(NEW.vector) <> expected_dimensions OR NEW.text_checksum <> expected_checksum OR public.vector_norm(NEW.vector)=0 OR (expected_normalization='unit' AND abs(public.vector_norm(NEW.vector)-1)>0.0001) THEN
  RAISE EXCEPTION 'embedding dimension or lineage mismatch' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER chunk_embedding_lineage BEFORE INSERT ON search.chunk_embedding FOR EACH ROW EXECUTE FUNCTION search.validate_embedding_lineage();
CREATE TABLE search.index_failure (
 event_id text PRIMARY KEY REFERENCES platform.outbox_event(event_id),
 content_version_id text NOT NULL REFERENCES content.content_version(content_version_id),
 source_checksum text NOT NULL,
 policy_version text NOT NULL,
 reason text NOT NULL CHECK(reason IN ('invalid_source','injection_detected','unsupported_policy','invalid_embedding')),
 recorded_at timestamptz NOT NULL
);
CREATE TRIGGER index_failure_immutable BEFORE UPDATE OR DELETE ON search.index_failure FOR EACH ROW EXECUTE FUNCTION platform.prevent_audit_mutation();
CREATE TRIGGER content_chunk_immutable BEFORE UPDATE OR DELETE ON search.content_chunk FOR EACH ROW EXECUTE FUNCTION platform.prevent_audit_mutation();
CREATE TRIGGER chunk_embedding_immutable BEFORE UPDATE OR DELETE ON search.chunk_embedding FOR EACH ROW EXECUTE FUNCTION platform.prevent_audit_mutation();
CREATE FUNCTION search.protect_index_lineage() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' OR (to_jsonb(NEW)-ARRAY['state','evaluation_reference']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['state','evaluation_reference']) THEN
  RAISE EXCEPTION 'index lineage is immutable' USING ERRCODE='55006';
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER content_index_immutable BEFORE UPDATE OR DELETE ON search.content_index FOR EACH ROW EXECUTE FUNCTION search.protect_index_lineage();
CREATE FUNCTION search.protect_embedding_configuration() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' OR (to_jsonb(NEW)-'enabled') IS DISTINCT FROM (to_jsonb(OLD)-'enabled') THEN
  RAISE EXCEPTION 'embedding configuration is immutable' USING ERRCODE='55006';
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER embedding_configuration_immutable BEFORE UPDATE OR DELETE ON search.embedding_configuration FOR EACH ROW EXECUTE FUNCTION search.protect_embedding_configuration();
-- Freeze authored hints with their published parent, including inserts, so a
-- candidate cannot silently change its teaching payload after evaluation.
CREATE TRIGGER published_hint_immutable BEFORE INSERT OR UPDATE OR DELETE ON content.problem_hint FOR EACH ROW EXECUTE FUNCTION learning.prevent_published_problem_concept_mutation();
-- No promotion command is introduced here. Tasks 43/45 supply evaluated approval.
-- This view additionally rechecks current publication/rights and enabled models.
CREATE VIEW search.eligible_chunk AS
 SELECT c.*,i.content_version_id,i.problem_version_id,i.policy_version,i.source_checksum,i.normalized_checksum,
 i.concept_ids,i.curriculum_version_ids,i.languages,i.valid_from,i.valid_until
 FROM search.content_chunk c JOIN search.content_index i USING(index_id)
 JOIN content.content_version v ON v.content_version_id=i.content_version_id
 WHERE i.state='ready' AND i.evaluation_reference IS NOT NULL AND c.scan_status='passed'
 AND v.status='published' AND v.payload_status='available' AND v.provenance_kind='original' AND v.checksum=i.source_checksum
 AND (v.rights_expires_at IS NULL OR v.rights_expires_at>statement_timestamp())
 AND i.valid_from<=statement_timestamp() AND (i.valid_until IS NULL OR i.valid_until>statement_timestamp())
 AND EXISTS(SELECT 1 FROM search.chunk_embedding e JOIN search.embedding_configuration f USING(configuration_id)
 WHERE e.chunk_id=c.chunk_id AND f.enabled AND f.provider<>'fixture');
-- Expose only canonical row locking, without granting content mutation to indexers.
CREATE FUNCTION content.lock_index_source(version_id text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 PERFORM content_version_id FROM content.content_version WHERE content_version_id=version_id FOR SHARE;
END;
$$;
REVOKE ALL ON FUNCTION content.lock_index_source(text) FROM PUBLIC;
CREATE FUNCTION search.invalidate_retired_content() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 UPDATE search.content_index SET state='obsolete' WHERE content_version_id=NEW.content_version_id AND state<>'obsolete';
 UPDATE platform.worker_derivation_expectation SET state='obsolete' WHERE content_version_id=NEW.content_version_id AND state<>'obsolete';
 RETURN NEW;
END;
$$;
CREATE TRIGGER content_retirement_indexes AFTER UPDATE ON content.content_version FOR EACH ROW
WHEN (OLD.status='published' AND NEW.status='retired') EXECUTE FUNCTION search.invalidate_retired_content();
