# ADR-0006: Use a provider-neutral, grounded tutor governed by deterministic policy

## Status

Proposed
## Date

2026-09-17

## Context

An LLM can adapt explanations but may hallucinate, follow injected instructions, reveal solutions prematurely, or fail due to provider limits. Learning and privacy rules cannot depend on probabilistic compliance or one vendor's API types.

## Decision

Place generation and embedding providers behind narrow ports. Calculate authorization, privacy scope, budget, and maximum hint tier before retrieval/generation. Give the model an immutable evidence package and require a structured, cited response. Validate tier, citations, leakage, and schema. Abstain or use reviewed authored content when evidence/provider/validation is inadequate. Start with one primary provider and one tested fallback.

## Alternatives considered

- **Unrestricted chat interface:** rejected because it bypasses the learning loop and safety policy.
- **Model chooses hint depth:** rejected because policy must be deterministic and auditable.
- **Multi-model router from launch:** deferred until quality, availability, latency, or cost measurements justify it.
- **No AI, fixed hints only:** retained as the baseline and fallback, but rejected as the sole long-term adaptive explanation mechanism pending evaluation.

## Consequences

- Provider changes require adapter/evaluation work, not domain rewrites.
- AI is optional for core learning availability.
- Evidence/prompt/model/config lineage increases storage and test needs.
- Delivery is refined by [ADR-0014](0014-validate-before-display-and-trust-evidence.md): buffer generated answers before display; the UI distinguishes pending status from a validated answer. Raw candidate streaming is not permitted.
