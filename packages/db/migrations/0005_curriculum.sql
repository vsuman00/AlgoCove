-- 0005_curriculum.sql
--
-- Stable concepts and immutable curriculum graph snapshots. A graph version is
-- the pin that future learning sessions resolve; changing a graph creates a
-- new version rather than mutating a published snapshot.

CREATE TABLE learning.concept (
  concept_id text PRIMARY KEY
    CHECK (concept_id ~ '^cpt_[0-9a-hjkmnp-tv-z]{16,52}$'),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$'),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 160),
  summary text NOT NULL CHECK (char_length(summary) BETWEEN 1 AND 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER concept_updated_at
BEFORE UPDATE ON learning.concept
FOR EACH ROW EXECUTE FUNCTION platform.set_updated_at();

CREATE TABLE learning.curriculum_graph_version (
  curriculum_version_id text PRIMARY KEY
    CHECK (curriculum_version_id ~ '^cur_[0-9a-hjkmnp-tv-z]{16,52}$'),
  version_number integer NOT NULL UNIQUE CHECK (version_number > 0),
  status text NOT NULL CHECK (status IN ('draft', 'published', 'retired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  CHECK ((status = 'published' AND published_at IS NOT NULL) OR status <> 'published')
);

CREATE TABLE learning.curriculum_node (
  curriculum_version_id text NOT NULL
    REFERENCES learning.curriculum_graph_version(curriculum_version_id),
  concept_id text NOT NULL REFERENCES learning.concept(concept_id),
  objective text NOT NULL CHECK (char_length(objective) BETWEEN 1 AND 500),
  ordinal integer NOT NULL CHECK (ordinal >= 0),
  PRIMARY KEY (curriculum_version_id, concept_id),
  UNIQUE (curriculum_version_id, ordinal)
);

CREATE TABLE learning.curriculum_edge (
  curriculum_version_id text NOT NULL
    REFERENCES learning.curriculum_graph_version(curriculum_version_id),
  from_concept_id text NOT NULL REFERENCES learning.concept(concept_id),
  to_concept_id text NOT NULL REFERENCES learning.concept(concept_id),
  edge_kind text NOT NULL CHECK (edge_kind IN ('required', 'recommended', 'related')),
  PRIMARY KEY (curriculum_version_id, from_concept_id, to_concept_id),
  CHECK (from_concept_id <> to_concept_id)
);

CREATE INDEX curriculum_edge_target_idx
  ON learning.curriculum_edge (curriculum_version_id, to_concept_id);

CREATE FUNCTION learning.prevent_published_graph_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  version_id text;
  graph_status text;
BEGIN
  version_id := COALESCE(OLD.curriculum_version_id, NEW.curriculum_version_id);
  SELECT status INTO graph_status
    FROM learning.curriculum_graph_version
   WHERE curriculum_version_id = version_id;
  IF graph_status = 'published' THEN
    RAISE EXCEPTION 'published curriculum graph versions are immutable' USING ERRCODE = '55006';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER curriculum_version_immutable
BEFORE UPDATE OR DELETE ON learning.curriculum_graph_version
FOR EACH ROW
WHEN (OLD.status = 'published')
EXECUTE FUNCTION learning.prevent_published_graph_mutation();

CREATE TRIGGER curriculum_node_version_immutable
BEFORE INSERT OR UPDATE OR DELETE ON learning.curriculum_node
FOR EACH ROW EXECUTE FUNCTION learning.prevent_published_graph_mutation();

CREATE TRIGGER curriculum_edge_version_immutable
BEFORE INSERT OR UPDATE OR DELETE ON learning.curriculum_edge
FOR EACH ROW EXECUTE FUNCTION learning.prevent_published_graph_mutation();
