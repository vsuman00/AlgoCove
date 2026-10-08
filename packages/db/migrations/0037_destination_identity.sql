-- Keep every legacy reference/journal/membership ID; destination identity is independent.
CREATE TABLE content.practice_destination (
 destination_id text PRIMARY KEY,
 platform text NOT NULL CHECK(platform IN ('leetcode','neetcode')),
 canonical_key text NOT NULL CHECK(canonical_key ~ '^[a-z][a-z0-9-]{0,199}$'),
 canonical_url text NOT NULL,
 UNIQUE(platform,canonical_key),
 CHECK((platform='leetcode' AND canonical_url='https://leetcode.com/problems/'||canonical_key||'/')
    OR (platform='neetcode' AND canonical_url='https://neetcode.io/problems/'||canonical_key))
);
CREATE TABLE content.external_destination_mapping (
 external_reference_id text PRIMARY KEY REFERENCES content.external_reference(external_reference_id),
 destination_id text REFERENCES content.practice_destination(destination_id),
 status text NOT NULL CHECK(status IN ('pending_review','reviewed')),
 reviewed_by text REFERENCES platform.learner(learner_id),
 reviewed_at timestamptz,
 reason text NOT NULL,
 CHECK(status<>'reviewed' OR (destination_id IS NOT NULL AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL))
);
CREATE FUNCTION content.sync_practice_destination() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE site text; problem_key text; destination text; target_url text;
BEGIN
 -- Inspect the URL, never infer a platform from a legacy collection/provider enum.
 IF NEW.canonical_url ~ '^https://leetcode\.com/problems/[a-z][a-z0-9-]{0,199}/?$' THEN
  site:='leetcode'; problem_key:=split_part(NEW.canonical_url,'/',5); target_url:='https://leetcode.com/problems/'||problem_key||'/';
 ELSIF NEW.canonical_url ~ '^https://neetcode\.io/problems/[a-z][a-z0-9-]{0,199}/?$' THEN
  site:='neetcode'; problem_key:=split_part(NEW.canonical_url,'/',5); target_url:='https://neetcode.io/problems/'||problem_key;
 END IF;
 IF site IS NOT NULL THEN
  destination:='dst_'||md5(site||':'||problem_key);
  INSERT INTO content.practice_destination(destination_id,platform,canonical_key,canonical_url) VALUES(destination,site,problem_key,target_url) ON CONFLICT(platform,canonical_key) DO NOTHING;
  INSERT INTO content.external_destination_mapping(external_reference_id,destination_id,status,reviewed_by,reviewed_at,reason)
   VALUES(NEW.external_reference_id,destination,CASE WHEN NEW.url_status='reviewed' AND NEW.reviewed_by IS NOT NULL AND NEW.reviewed_at IS NOT NULL THEN 'reviewed' ELSE 'pending_review' END,NEW.reviewed_by,NEW.reviewed_at,'exact_canonical_problem_url')
   ON CONFLICT(external_reference_id) DO UPDATE SET destination_id=EXCLUDED.destination_id,status=EXCLUDED.status,reviewed_by=EXCLUDED.reviewed_by,reviewed_at=EXCLUDED.reviewed_at,reason=EXCLUDED.reason;
 ELSE
  INSERT INTO content.external_destination_mapping(external_reference_id,status,reason) VALUES(NEW.external_reference_id,'pending_review','ambiguous_source_or_explanation_url')
   ON CONFLICT(external_reference_id) DO UPDATE SET destination_id=NULL,status='pending_review',reviewed_by=NULL,reviewed_at=NULL,reason=EXCLUDED.reason;
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER practice_destination_candidate AFTER INSERT OR UPDATE OF canonical_url,url_status,reviewed_by,reviewed_at ON content.external_reference
 FOR EACH ROW EXECUTE FUNCTION content.sync_practice_destination();
-- Run the same strict URL rules over legacy rows without changing their values or versions.
DO $$ DECLARE row_record record; BEGIN
 FOR row_record IN SELECT external_reference_id FROM content.external_reference LOOP
  UPDATE content.external_reference SET canonical_url=canonical_url WHERE external_reference_id=row_record.external_reference_id;
 END LOOP;
END; $$;
CREATE VIEW content.reviewed_practice_destination AS
 SELECT r.external_reference_id,d.destination_id,d.platform,d.canonical_key,d.canonical_url,r.title,r.attribution,r.version,r.reviewed_by,r.reviewed_at
 FROM content.external_reference r JOIN content.external_destination_mapping m USING(external_reference_id)
 JOIN content.practice_destination d USING(destination_id)
 WHERE r.url_status='reviewed' AND r.reviewed_by IS NOT NULL AND r.reviewed_at IS NOT NULL AND m.status='reviewed';
CREATE VIEW content.collection_entry_availability AS
 SELECT m.collection_id,m.external_reference_id,m.ordinal,
   COALESCE(d.destination_id,'reference:'||r.external_reference_id) AS canonical_identity,
   r.title,r.attribution,r.canonical_url AS source_url,d.canonical_url AS solve_url,d.platform,
   internal.slug AS internal_slug,internal.problem_version_id AS internal_problem_version_id,
   internal.mapping_kind,internal.mapping_rationale,
   CASE WHEN internal.problem_version_id IS NOT NULL THEN 'supported_internal' WHEN d.destination_id IS NOT NULL THEN 'external_only' ELSE 'unavailable' END AS availability
 FROM content.external_collection_membership m JOIN content.external_reference r USING(external_reference_id)
 LEFT JOIN content.reviewed_practice_destination d USING(external_reference_id)
 LEFT JOIN LATERAL (
  SELECT eligible.slug,eligible.problem_version_id,x.mapping_kind,x.mapping_rationale FROM content.external_readiness_rubric x
   JOIN content.eligible_learning_problem eligible USING(problem_version_id)
   WHERE x.external_reference_id=r.external_reference_id AND x.status='published'
   ORDER BY x.version DESC,eligible.published_at DESC,eligible.problem_version_id DESC LIMIT 1
 ) internal ON true;
