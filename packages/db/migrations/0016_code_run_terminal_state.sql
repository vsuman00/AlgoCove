-- 0016_code_run_terminal_state.sql
-- Persist the trusted terminal category for both Run and Submit. Submit keeps
-- its immutable assessment observation; Run needs the same bounded status for a
-- learner-facing result poll without creating assessment credit.

ALTER TABLE practice.code_run
  ADD COLUMN terminal_category text,
  ADD COLUMN classification text,
  ADD COLUMN completed_at timestamptz;

ALTER TABLE practice.code_run
  ADD CONSTRAINT code_run_terminal_category_check
    CHECK (terminal_category IS NULL OR terminal_category IN (
      'pass', 'wrong_answer', 'compile_error', 'type_error', 'runtime_error',
      'limits', 'cancelled', 'infrastructure_error'
    )),
  ADD CONSTRAINT code_run_classification_check
    CHECK (classification IS NULL OR classification IN (
      'success', 'learner_failure', 'infrastructure_failure', 'control_plane'
    )),
  ADD CONSTRAINT code_run_terminal_state_check
    CHECK (
      (terminal_result_id IS NULL
        AND terminal_category IS NULL
        AND classification IS NULL
        AND completed_at IS NULL)
      OR (terminal_result_id IS NOT NULL
        AND terminal_category IS NOT NULL
        AND classification IS NOT NULL
        AND completed_at IS NOT NULL
        AND completed_at >= requested_at)
    );
