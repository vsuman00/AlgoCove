# ADR-0004: Execute first-release learner JavaScript in a capability-restricted browser runtime

## Status

Superseded before acceptance by ADR-0011

## Date

2026-09-17

## Context

Learners need quick test feedback. Arbitrary server-side code execution is a high-risk capability requiring OS/process/network/resource isolation. The first audience is JavaScript-capable and does not require secure certification or hidden server tests.

This premise was corrected by the owner on 2026-09-17: Python, JavaScript, TypeScript, Java, C++, and C must all be first-class. This proposal was therefore superseded before architecture approval or implementation.

## Decision

Run bounded JavaScript exercises in a capability-restricted interpreter/runtime hosted in a dedicated browser Web Worker. Learner source must not run through native `eval`, `Function`, or a module loader against worker globals because ordinary workers expose host capabilities such as network APIs. Expose only allowlisted test primitives; apply source/input/output limits, an engine interrupt/deadline where available, outer-worker termination, and structured messages. Label outcomes `client_observed`; they are learning evidence, not tamper-resistant certification. Select the exact engine only after a source/security/performance review.

## Alternatives considered

- **Native evaluation in the page or ordinary worker globals:** rejected because infinite loops/resource use and browser host capabilities expose the UI/application/network surface.
- **Execute in the web server process:** rejected because language-level timeouts are not an OS security sandbox.
- **Container sandbox immediately:** deferred until multi-language or authoritative server execution is approved.

## Consequences

- Fast feedback and lower infrastructure cost than server execution, with a stronger capability boundary than a plain worker.
- Tests and fixtures delivered to the browser must be treated as visible.
- Learner-controlled outcomes cannot support proctoring/certification.
- The interpreter/runtime adds bundle, performance, and security-maintenance cost that must be benchmarked.
- Multi-language execution requires a new isolated service and ADR.
