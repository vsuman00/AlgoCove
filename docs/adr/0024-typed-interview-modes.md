# ADR-0024: Typed interview modes with separate assessment rules

**Status:** Proposed

**Date:** 2026-10-07

## Context

DSA execution evidence does not establish code-review or design quality. The reference advertises coding, code review, low-level design and system design; private scoring has not been inspected.

## Proposed decision

- Keep ADR-0022's owned session, authoritative deadline, assistance history and version-pinned lifecycle. Extend with a discriminated session kind and compatible versioned template/artifact/rubric contract.
- Code review uses a governed code artifact, stable line anchors, structured findings and proposed fixes. LLD and system design use separate requirements and typed design responses.
- Define schema and size limits, safe rendering, autosave/recovery, finalization and debrief access per mode. Typed text is the initial input; uploads, voice and collaborative canvases are separate decisions.
- Reuse the modular monolith and existing provider boundaries. AI feedback stays advisory; objective checks and human observations retain explicit provenance. New mode-specific evidence does not enter concept mastery without a reviewed policy.
- Calibrate rubrics against valid alternative answers, partial work and reviewer disagreement. Publish mode limitations and avoid a universal interview-readiness score.

## Alternatives and tradeoffs

Treating every mode as a coding problem gives misleading correctness results. An unconstrained chat transcript is simple to launch but hard to recover, assess and audit. Typed artifacts add per-mode authoring and evaluation work while supporting explicit evidence and safe state transitions. A new interview microservice is not justified by current evidence.

## Migration and acceptance

Phase 15 Tasks 65–68 require their own authorization after F14 by default. Existing DSA sessions remain valid; unknown kinds/versions are rejected, not coerced. Acceptance covers mode-specific artifacts, timing/recovery, rubric disagreement, alternate valid designs, accessibility, privacy, provider-off operation and an explicit scoped release decision.

See the [journey and edge-case contract](../architecture/website-journeys-and-coverage.md) and [implementation plan](../../tasks/plan.md). This record authorizes no implementation.
