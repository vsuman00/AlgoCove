-- Stable route identity is independent of immutable content/attempt versions.
CREATE TABLE content.problem_route (
 slug text PRIMARY KEY CHECK(slug ~ '^[a-z][a-z0-9-]{1,63}$'),
 problem_id text NOT NULL REFERENCES content.problem(problem_id),
 is_canonical boolean NOT NULL DEFAULT false
);
CREATE UNIQUE INDEX problem_route_one_canonical ON content.problem_route(problem_id) WHERE is_canonical;
INSERT INTO content.problem_route(slug,problem_id,is_canonical)
 SELECT 'arrays-two-pointer',problem_id,true FROM content.problem_version WHERE problem_version_id='prb_dddddddddddddddd';
INSERT INTO content.problem_route(slug,problem_id,is_canonical)
 SELECT pilot.slug,problem.problem_id,true FROM content.pilot_bundle pilot
 JOIN content.problem_version problem USING(problem_version_id);
-- New imports register the existing pilot identity in the same transaction.
CREATE FUNCTION content.register_pilot_route() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO content.problem_route(slug,problem_id,is_canonical)
 SELECT NEW.slug,problem_id,true FROM content.problem_version WHERE problem_version_id=NEW.problem_version_id;
 RETURN NEW;
END;
$$;
CREATE TRIGGER pilot_route_registration AFTER INSERT ON content.pilot_bundle
 FOR EACH ROW EXECUTE FUNCTION content.register_pilot_route();
-- Bootstrap/seed may introduce the original problem after migrations run.
CREATE FUNCTION content.register_legacy_problem_route() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.problem_version_id='prb_dddddddddddddddd' THEN
  INSERT INTO content.problem_route(slug,problem_id,is_canonical) VALUES('arrays-two-pointer',NEW.problem_id,true);
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER legacy_route_registration AFTER INSERT ON content.problem_version
 FOR EACH ROW EXECUTE FUNCTION content.register_legacy_problem_route();

-- One eligibility projection for discovery, slug lookup and planning.
-- No statement, solution, hidden checkpoint, trace or private learner fields.
CREATE VIEW content.eligible_problem_version AS
 SELECT problem.problem_id,problem.problem_version_id,version.content_version_id,
        version.checksum,version.title,version.published_at,pilot.pattern,
        ARRAY(SELECT manifest.language FROM content.problem_language_manifest manifest
              WHERE manifest.problem_version_id=problem.problem_version_id AND manifest.status='published'
              ORDER BY manifest.language) AS languages
 FROM content.problem_version problem
 JOIN content.content_version version USING(content_version_id)
 LEFT JOIN content.pilot_bundle pilot USING(problem_version_id)
 WHERE version.status='published' AND version.payload_status='available'
   AND (version.rights_expires_at IS NULL OR version.rights_expires_at>now())
   AND (SELECT count(DISTINCT manifest.language) FROM content.problem_language_manifest manifest
        WHERE manifest.problem_version_id=problem.problem_version_id AND manifest.status='published')=6;

CREATE VIEW content.eligible_learning_problem AS
 SELECT eligible.*,route.slug FROM content.eligible_problem_version eligible
 JOIN content.problem_route route ON route.problem_id=eligible.problem_id AND route.is_canonical;
