-- Original pilot extensions remain draft until checksum-bound independent review.
CREATE TABLE content.pilot_bundle (
 content_version_id text PRIMARY KEY REFERENCES content.content_version(content_version_id),
 problem_version_id text NOT NULL UNIQUE REFERENCES content.problem_version(problem_version_id),
 slug text NOT NULL UNIQUE CHECK(slug ~ '^[a-z][a-z0-9-]{1,63}$'),
 pattern text NOT NULL CHECK(pattern IN ('arrays-hashing','two-pointers','sliding-window','stack')),
 bundle_version text NOT NULL,
 checksum text NOT NULL CHECK(checksum ~ '^sha256:[0-9a-f]{64}$'),
 author_payload jsonb NOT NULL CHECK(jsonb_typeof(author_payload)='object'),
 public_payload jsonb NOT NULL CHECK(jsonb_typeof(public_payload)='object'),
 reference_trace jsonb NOT NULL CHECK(jsonb_typeof(reference_trace)='object'),
 CHECK(NOT public_payload ?| ARRAY['languages','solutions','hints','fixtures','trace','correctOption','expectedReasoning'])
);
CREATE TRIGGER pilot_bundle_immutable BEFORE INSERT OR UPDATE OR DELETE ON content.pilot_bundle FOR EACH ROW EXECUTE FUNCTION content.prevent_published_content_mutation();
CREATE TABLE content.pilot_review (
 content_version_id text NOT NULL REFERENCES content.pilot_bundle(content_version_id),
 kind text NOT NULL CHECK(kind IN ('technical','pedagogical','accessibility','rights','trace','conformance')),
 checksum text NOT NULL CHECK(checksum ~ '^sha256:[0-9a-f]{64}$'),
 reviewer_id text NOT NULL REFERENCES platform.learner(learner_id),
 decision text NOT NULL CHECK(decision IN ('approved','rejected')),
 notes text NOT NULL CHECK(char_length(notes) BETWEEN 1 AND 2000),
 reviewed_at timestamptz NOT NULL,
 PRIMARY KEY(content_version_id,kind,reviewer_id)
);
CREATE TRIGGER pilot_review_immutable BEFORE INSERT OR UPDATE OR DELETE ON content.pilot_review FOR EACH ROW EXECUTE FUNCTION content.prevent_published_content_mutation();
CREATE FUNCTION content.pilot_publication_gate() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE pilot content.pilot_bundle%ROWTYPE;
BEGIN
 IF NEW.status='published' AND OLD.status='draft' THEN
  SELECT * INTO pilot FROM content.pilot_bundle WHERE content_version_id=NEW.content_version_id;
  IF FOUND THEN
   IF pilot.checksum<>NEW.checksum OR NOT EXISTS(SELECT 1 FROM content.content_review t JOIN content.content_review p ON p.content_version_id=t.content_version_id WHERE t.content_version_id=NEW.content_version_id AND t.review_kind='technical' AND p.review_kind='pedagogical' AND t.decision='approved' AND p.decision='approved' AND t.reviewer_id<>p.reviewer_id AND t.reviewer_id<>NEW.author_id AND p.reviewer_id<>NEW.author_id) OR (SELECT count(*) FROM content.problem_language_manifest WHERE problem_version_id=pilot.problem_version_id AND status='published')<>6 OR (SELECT count(*) FROM content.review_exercise e JOIN learning.problem_concept m USING(concept_id) WHERE m.problem_version_id=pilot.problem_version_id AND e.status='published')<>2 OR EXISTS(SELECT 1 FROM unnest(ARRAY['technical','pedagogical','accessibility','rights','trace','conformance']) k WHERE NOT EXISTS(
    SELECT 1 FROM content.pilot_review r JOIN platform.role_grant g ON g.learner_id=r.reviewer_id
    WHERE r.content_version_id=NEW.content_version_id AND r.kind=k AND r.checksum=pilot.checksum AND r.decision='approved' AND r.reviewer_id<>NEW.author_id AND g.revoked_at IS NULL
     AND g.role=CASE WHEN k IN ('pedagogical','accessibility') THEN 'pedagogical_reviewer' ELSE 'technical_reviewer' END
   )) OR EXISTS(SELECT 1 FROM content.pilot_review r WHERE r.content_version_id=NEW.content_version_id AND r.checksum=pilot.checksum AND r.decision='rejected') THEN
    RAISE EXCEPTION 'pilot requires six current independent checksum-bound reviews' USING ERRCODE='23514';
   END IF;
  END IF;
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER pilot_publication_guard BEFORE UPDATE ON content.content_version FOR EACH ROW EXECUTE FUNCTION content.pilot_publication_gate();

-- General outbound references do not imply membership in a named sheet.
ALTER TABLE content.external_reference DROP CONSTRAINT external_reference_provider_check;
ALTER TABLE content.external_reference ADD CHECK(provider IN ('leetcode','blind','neetcode','top_interview_150','grind_75','striver_a2z'));
CREATE OR REPLACE FUNCTION content.validate_external_reference_url()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  hostname text;
BEGIN
  hostname := lower(regexp_replace(NEW.canonical_url, '^https://([^/?#]+).*$', '\1'));
  IF NOT (
    (NEW.provider = 'leetcode' AND hostname = 'leetcode.com')
    OR (NEW.provider = 'blind' AND (hostname = 'blind75.com' OR hostname LIKE '%.blind75.com'))
    OR (NEW.provider = 'neetcode' AND (hostname = 'neetcode.io' OR hostname LIKE '%.neetcode.io'))
    OR (NEW.provider = 'top_interview_150' AND (hostname = 'leetcode.com' OR hostname LIKE '%.leetcode.com'))
    OR (NEW.provider = 'grind_75' AND (hostname = 'grind75.com' OR hostname LIKE '%.grind75.com'))
    OR (NEW.provider = 'striver_a2z' AND (hostname = 'takeuforward.org' OR hostname LIKE '%.takeuforward.org'))
  ) THEN
    RAISE EXCEPTION 'external reference host is not allowlisted' USING ERRCODE = '23514';
  END IF;
  IF NEW.canonical_url ~ '@' THEN
    RAISE EXCEPTION 'external reference credentials are forbidden' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

