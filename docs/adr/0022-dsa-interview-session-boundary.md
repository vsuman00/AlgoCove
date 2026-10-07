# ADR-0022: DSA interview session boundary

**Status:** Proposed
**Date:** 2026-10-07
**Scope:** Documentation proposal only; implementation and phase approvals remain pending.

## Context

Interview preparation needs timing, recovery and evidence rules beyond a normal lesson. The reference site advertises broader modes that AlgoCove has not implemented.

## Proposed decision

- Scope the first release to DSA coding sessions using approved problem releases, six-language execution and explicit guided-practice versus timed-session policies.
- Pin template, problem, runtime and rubric versions at start. Persist ownership, lifecycle, server start/deadline, attempts and assistance events.
- The server owns time expiry and submission eligibility. Reloads, retries, multiple tabs and delayed responses cannot extend deadlines or duplicate finalization.
- Reuse the isolated execution plane. Deterministic rubric components score only supported evidence; optional AI feedback is advisory and separately labelled.
- Debriefs distinguish execution results, reasoning checks, assistance and self-report. Feed only approved evidence types into reviews and mastery.
- Code review, low-level design and system design interview modes require separate contracts and approval.

## Alternatives and tradeoffs

A client-only timer is simpler but cannot enforce session state. Reusing ordinary lesson progress as an interview score would blur assistance and evidence. A separate service is unnecessary before measured scaling or security requirements justify it.

## Migration and delivery

Proposed Phase 14 Tasks 61–64 follow F13 by default and require owner authorization. Earlier scheduling requires an explicit plan decision after prerequisite catalog and execution capabilities are qualified.

## Acceptance evidence required

Exercise deadline races, reconnect, ownership, replayed finalization, assistance accounting, partial results and accessible timed operation; evaluate rubric reliability before making readiness claims.

See the [learning platform architecture](../architecture/learning-platform-evolution-2026-10-07.md), [implementation plan](../../tasks/plan.md) and [design contract](../../DESIGN.md). Existing accepted decisions remain in effect until an explicit acceptance or supersession decision is recorded.
