# ADR-0021: Synchronized algorithm walkthroughs

**Status:** Accepted for local Phase 10 implementation, 2026-10-07; delivery evidence remains task-specific
**Date:** 2026-10-07
**Scope:** Owner instruction on 2026-10-07 authorizes the remaining Phase 10 extensions against the new architecture. The [shared learning contract](../architecture/shared-learning-contract.md) resolves implementation contracts. Independent publication, live-provider and later-phase gates remain separate.

## Context

The existing array/two-pointer trace does not contain generic pseudocode-line mappings. Container-specific annotations cannot describe every algorithm.

## Proposed decision

- Introduce a versioned, renderer-neutral event contract with stable pseudocode line IDs, approach and scenario identity, variables, structure state, narration and checkpoints.
- A deterministic replay reducer produces one frame consumed by code highlighting, state panels, visuals and accessible transcript.
- Play, pause, step, restart, speed and scrubbing operate on that same timeline. Scrubbing restores state by replay or validated checkpoints.
- Keep structure-specific adapters for arrays, hash maps, windows and stacks; add trees/graphs only with authored semantics and acceptance evidence.
- Separate authored demonstration, learner-created trace, predictions and judged program execution. Demonstration playback grants no correctness credit.
- Keep prediction answers and restricted reference material server-controlled under existing reveal policy. Every visual state has flat/text and reduced-motion equivalents.

## Alternatives and tradeoffs

Separate animation and pseudocode timers drift and are harder to reproduce. Arbitrary-code visualization expands language instrumentation and sandbox scope substantially. A deterministic authored trace requires content work but supports repeatable explanations.

## Migration and delivery

Task 45e extends the existing pilot first. Preserve schema-1 reading or explicitly convert it with equivalent semantics; reject unsupported schema versions. Task 46 onward supplies reviewed pattern-specific adapters and scenarios.

## Acceptance evidence required

At every step and after backward scrubbing, highlighted lines, variables, narration and structures agree; malformed line IDs fail validation; historical traces remain usable and prediction answers stay restricted.

See the [learning platform architecture](../architecture/learning-platform-evolution-2026-10-07.md), [implementation plan](../../tasks/plan.md) and [design contract](../../DESIGN.md). Existing accepted decisions remain in effect until an explicit acceptance or supersession decision is recorded.
