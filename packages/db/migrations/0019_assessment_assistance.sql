-- Legacy observations deliberately retain NULL assistance. Reconstructing their
-- historical exposure from today's cumulative hints would invent independence.
ALTER TABLE practice.assessment_observation
  ADD COLUMN assistance_tier smallint CHECK (assistance_tier BETWEEN 0 AND 6),
  ADD COLUMN assistance_captured_at timestamptz,
  ADD CONSTRAINT assessment_assistance_snapshot_check CHECK (
    (assistance_tier IS NULL AND assistance_captured_at IS NULL)
    OR (assistance_tier IS NOT NULL AND assistance_captured_at IS NOT NULL)
  );

CREATE FUNCTION practice.prevent_assessment_rewrite()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'assessment observations are immutable' USING ERRCODE = '55006';
END;
$$;

CREATE TRIGGER assessment_observation_immutable
BEFORE UPDATE ON practice.assessment_observation
FOR EACH ROW EXECUTE FUNCTION practice.prevent_assessment_rewrite();
