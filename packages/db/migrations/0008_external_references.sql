-- 0008_external_references.sql
--
-- Reviewed outbound links and collection membership. No external statement,
-- solution, test, credential, or account state is stored here.

CREATE TABLE content.external_reference (
  external_reference_id text PRIMARY KEY
    CHECK (external_reference_id ~ '^ref_[0-9a-hjkmnp-tv-z]{16,52}$'),
  provider text NOT NULL CHECK (provider IN ('blind', 'neetcode', 'top_interview_150', 'grind_75', 'striver_a2z')),
  external_key text NOT NULL CHECK (char_length(external_key) BETWEEN 1 AND 200),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 240),
  canonical_url text NOT NULL,
  attribution text NOT NULL CHECK (char_length(attribution) BETWEEN 1 AND 240),
  url_status text NOT NULL CHECK (url_status IN ('unreviewed', 'reviewed', 'unavailable', 'blocked')),
  reviewed_by text REFERENCES platform.learner(learner_id),
  reviewed_at timestamptz,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, external_key),
  CHECK (canonical_url ~ '^https://[^[:space:]#]+$'),
  CHECK ((url_status = 'unreviewed' AND reviewed_by IS NULL AND reviewed_at IS NULL)
      OR url_status <> 'unreviewed')
);

CREATE TABLE content.external_collection (
  collection_id text PRIMARY KEY
    CHECK (collection_id ~ '^col_[0-9a-hjkmnp-tv-z]{16,52}$'),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$'),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE content.external_collection_membership (
  collection_id text NOT NULL REFERENCES content.external_collection(collection_id),
  external_reference_id text NOT NULL REFERENCES content.external_reference(external_reference_id),
  ordinal integer CHECK (ordinal IS NULL OR ordinal >= 0),
  PRIMARY KEY (collection_id, external_reference_id)
);

CREATE FUNCTION content.validate_external_reference_url()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  hostname text;
BEGIN
  hostname := lower(regexp_replace(NEW.canonical_url, '^https://([^/?#]+).*$', '\1'));
  IF NOT (
    (NEW.provider = 'blind' AND (hostname = 'blind75.com' OR hostname LIKE '%.blind75.com'))
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

CREATE TRIGGER external_reference_url_contract
BEFORE INSERT OR UPDATE ON content.external_reference
FOR EACH ROW EXECUTE FUNCTION content.validate_external_reference_url();
