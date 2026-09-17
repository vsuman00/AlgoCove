# ADR-0013: Use configurable timeboxed roadmap planning

**Status:** Proposed  
**Date:** 2026-09-17

## Context

The learner may want a 1-, 2-, 3-, 4-, or 6-month DSA plan. A fixed six-month curriculum would ignore available time, prior knowledge, preferred languages, target role, and study capacity. Curated collections such as Blind, NeetCode, Top Interview, Grind-style, and Striver sheets also overlap and must not be treated as cumulative mandatory work.

## Decision

Represent a plan as a versioned intent plus a generated schedule:

- `horizon`: 1, 2, 3, 4, or 6 months;
- target date, timezone, study days, session duration, and buffer days;
- learner level, preferred languages, target role, and selected collections;
- required topic/pattern coverage and optional extension coverage;
- internal AlgoCove learning units and outbound external practice references;
- review and transfer requirements.

AI may propose sequencing, explanations, alternatives, and a draft daily/weekly plan. Deterministic application policy validates prerequisite order, workload, language availability, review spacing, plan horizon, and capacity before the plan is published. A learner must explicitly accept a validated candidate before activation; acceptance checks the expected active version. The learner may edit, pause, or replan. Kind-specific schedule items and calendar/concurrency rules are defined in [implementation contracts](../architecture/implementation-contracts.md#2-roadmap-data-and-state). Every published plan is versioned; historical adherence is never rewritten by a later replan.

## Consequences

The home experience can show a daily plan without hard-coding a six-month product. Recommendations remain explainable and bounded. AI outages or unsafe proposals fall back to a deterministic template. Progress is reported separately for internal mastery, external handoffs, review health, and consistency.
