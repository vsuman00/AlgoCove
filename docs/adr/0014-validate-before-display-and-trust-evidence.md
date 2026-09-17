# ADR-0014: Validate before display and establish trusted evidence boundaries

**Status:** Proposed  
**Scope:** Refines ADR-0006 and ADR-0011; their provider-neutral and isolation decisions remain in force.

## Context

The architecture review found that final validation after displaying generated tokens cannot prevent disclosure. It also found that signing a sandbox result does not establish correctness if learner code can forge the result inside the sandbox. These are distinct trust boundaries requiring explicit contracts.

## Decision

Buffer generated tutor candidates on the server. Validate schema, citations, disclosure tier, and current content eligibility; persist the accepted message and assistance exposure before any learner-visible text. Then deliver the validated answer, optionally in chunks. Status events may be streamed while generation is pending. Restricted hint tiers use reviewed authored hints; generated feedback must pass evaluation but is never claimed to guarantee zero semantic leakage.

The execution controller owns judging outside the learner workload. Learner code returns bounded untrusted outputs, never authoritative verdicts. Expected outputs, comparator logic, result-signing keys, and host measurements remain inaccessible to learner code. The trusted judge computes verdicts and signs the final result. A candidate cannot pass by printing a forged success record or exiting with status zero.

Free-form pseudocode and explanations are artifacts, not deterministic proofs of correctness. Guided readiness may use authored structured checks; model feedback is advisory. Algorithmic mastery remains concept-level, with separate language proficiency and assistance records. Neither server observation nor external self-report certifies authorship.

## Alternatives and consequences

- Validate after raw-token streaming: rejected because already disclosed text cannot be recalled.
- Trust a self-reported sandbox verdict: rejected because signature authenticity does not prove the producer's assertion.
- Analyze arbitrary pseudocode as a proof: deferred; unrestricted pseudocode has no formal execution semantics.
- Buffering increases answer latency. Measure time to first validated answer and keep authored hints responsive.
- Independent judging requires serialization, comparator, input-disclosure, and sandbox-result tampering fixtures in all six languages.

## Evidence

PostgreSQL transaction correction is specified separately in the runtime flow: locks must surround the protected operation. See [PostgreSQL locking](https://www.postgresql.org/docs/current/explicit-locking.html).

Output checks and adversarial evaluation follow [OWASP prompt-injection prevention](https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html). Our pre-display buffering rule is a design conclusion from the irreversible nature of disclosure, not a claim that validation eliminates all model risk.

The sandbox protects the host boundary and still requires separate application controls; see [gVisor security model](https://gvisor.dev/docs/architecture_guide/security/).
