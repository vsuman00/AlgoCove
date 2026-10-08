CREATE OR REPLACE VIEW content.eligible_problem_version AS
 SELECT problem.problem_id,problem.problem_version_id,version.content_version_id,
        version.checksum,version.title,version.published_at,COALESCE(pilot.pattern,release.packet->>'pattern') AS pattern,
        ARRAY(SELECT manifest.language FROM content.problem_language_manifest manifest
              WHERE manifest.problem_version_id=problem.problem_version_id AND manifest.status='published'
              ORDER BY manifest.language) AS languages
 FROM content.problem_version problem JOIN content.content_version version USING(content_version_id)
 LEFT JOIN content.pilot_bundle pilot USING(problem_version_id)
 LEFT JOIN content.learning_release release ON release.content_version_id=version.content_version_id
 WHERE version.status='published' AND version.payload_status='available'
   AND (version.rights_expires_at IS NULL OR version.rights_expires_at>now())
   AND (SELECT count(DISTINCT manifest.language) FROM content.problem_language_manifest manifest
        WHERE manifest.problem_version_id=problem.problem_version_id AND manifest.status='published')=6;
-- Transfer exercises belonging to a release share its withdrawal boundary.
CREATE VIEW content.available_release_exercise AS
 SELECT e.* FROM content.review_exercise e
 WHERE e.status='published' AND (e.rights_expires_at IS NULL OR e.rights_expires_at>now())
 AND (e.problem_version_id IS NULL OR EXISTS(SELECT 1 FROM content.eligible_problem_version p WHERE p.problem_version_id=e.problem_version_id));
