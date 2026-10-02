-- 0018_problem_concept_mapping.sql
--
-- Bind each immutable problem version to the stable, language-neutral concepts
-- it teaches. The mapping is authored while content is a draft and freezes when
-- that exact content version is published, so later evidence replay cannot
-- silently retag historical submissions.

CREATE TABLE learning.problem_concept (
  problem_version_id text NOT NULL
    REFERENCES content.problem_version(problem_version_id) ON DELETE RESTRICT,
  concept_id text NOT NULL
    REFERENCES learning.concept(concept_id) ON DELETE RESTRICT,
  rationale text NOT NULL CHECK (char_length(rationale) BETWEEN 1 AND 500),
  mapped_by text NOT NULL REFERENCES platform.learner(learner_id) ON DELETE RESTRICT,
  mapped_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (problem_version_id, concept_id)
);

CREATE INDEX problem_concept_concept_idx
  ON learning.problem_concept (concept_id, problem_version_id);

CREATE FUNCTION learning.prevent_published_problem_concept_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  version_id text;
  content_status text;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    version_id := OLD.problem_version_id;
    SELECT item.status INTO content_status
      FROM content.problem_version AS problem
      JOIN content.content_version AS item
        ON item.content_version_id = problem.content_version_id
     WHERE problem.problem_version_id = version_id
       FOR SHARE OF item;
    IF content_status IN ('published', 'retired') THEN
      RAISE EXCEPTION 'published problem concept mappings are immutable'
        USING ERRCODE = '55006';
    END IF;
  END IF;

  IF TG_OP <> 'DELETE' THEN
    version_id := NEW.problem_version_id;
    SELECT item.status INTO content_status
      FROM content.problem_version AS problem
      JOIN content.content_version AS item
        ON item.content_version_id = problem.content_version_id
     WHERE problem.problem_version_id = version_id
       FOR SHARE OF item;
    IF content_status IN ('published', 'retired') THEN
      RAISE EXCEPTION 'published problem concept mappings are immutable'
        USING ERRCODE = '55006';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER problem_concept_mapping_immutable
BEFORE INSERT OR UPDATE OR DELETE ON learning.problem_concept
FOR EACH ROW EXECUTE FUNCTION learning.prevent_published_problem_concept_mutation();
