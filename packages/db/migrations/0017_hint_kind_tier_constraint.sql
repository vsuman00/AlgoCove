-- 0017_hint_kind_tier_constraint.sql
-- The authored hint ladder is a content contract: each progressive tier has
-- exactly one permitted kind. Keep database rows compatible with the domain
-- parser so invalid content fails at the persistence boundary.

ALTER TABLE content.problem_hint
  ADD CONSTRAINT problem_hint_kind_tier_check
    CHECK (
      (tier = 1 AND kind = 'clarification') OR
      (tier = 2 AND kind = 'example') OR
      (tier = 3 AND kind = 'invariant') OR
      (tier = 4 AND kind = 'pseudocode_scaffold') OR
      (tier = 5 AND kind = 'partial_structure') OR
      (tier = 6 AND kind = 'solution_review')
    );
