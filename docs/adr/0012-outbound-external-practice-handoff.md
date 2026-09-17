# ADR-0012: Use outbound-only external practice handoff

**Status:** Proposed  
**Date:** 2026-09-17

## Context

Learners should first learn and validate a DSA problem in AlgoCove, then open the original problem on LeetCode or another external provider and solve it on that provider's own site and account. AlgoCove must not become a mirror of third-party problem content or depend on provider account synchronization.

## Decision

Model external practice as a one-way, learner-initiated handoff:

1. AlgoCove prepares the learner through its own topic, pattern, pseudocode, hint, visualization, and execution flow.
2. A deterministic readiness gate may unlock an `Open on provider` action.
3. AlgoCove opens the stored, reviewed canonical provider URL in a new tab or explicit external navigation.
4. AlgoCove records the handoff event and may offer an explicitly learner-confirmed completion journal entry.
5. AlgoCove does not scrape, import, crawl, submit to, or automatically synchronize provider content, credentials, submissions, or profile counts.

External references contain only the minimum permitted metadata: provider, external identifier where permitted, canonical URL, collection membership, attribution, link status, and verification timestamp. Full statements, editorials, hidden tests, and provider solutions require an explicit license and remain separate from the link-only model.

## Consequences

### Positive

- Clear legal and trust boundary around third-party content.
- No credential, cookie, account takeover, or provider-availability dependency.
- LeetCode/NeetCode remain the authoritative destination for the external solve.
- The product can still measure AlgoCove learning evidence and learner-reported follow-through.

### Negative

- AlgoCove cannot claim that an external submission actually succeeded without an official provider integration or user evidence.
- External completion metrics are self-reported and must be labelled accordingly.
- Broken, changed, or retired provider links require content-operations review.

## Rejected alternatives

- **Private GraphQL endpoint or community scraper:** unsupported contract, terms risk, brittle, and contrary to the product boundary.
- **Collecting provider passwords or session cookies:** unacceptable security and privacy risk.
- **Automatic browser automation of external submissions:** creates account-control, reliability, and terms risk and is not required for the learning outcome.
