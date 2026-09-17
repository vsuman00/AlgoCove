# ADR-0005: Treat learning content as immutable, governed, versioned data

## Status

Proposed
## Date

2026-09-17

## Context

Tutor correctness, hint policy, mastery interpretation, copyright compliance, and reproducibility all depend on knowing exactly which content a learner saw. Mutable documents and anonymous chunks cannot provide that evidence.

## Decision

Separate stable content identities from immutable versions. Require provenance/license, author, technical review, pedagogical review, validation, checksum, and lifecycle state before publication. Attempts, citations, traces, chunks, and evaluations reference exact versions. Changes create new versions; withdrawal retires versions from new use.

## Alternatives considered

- **Mutable wiki-style pages:** rejected because history and historical outcomes become ambiguous.
- **Ingest arbitrary web/platform content:** rejected for rights, quality, injection, and change-control risk.
- **Treat chunks as primary content:** rejected because chunking is a replaceable search derivation, not the pedagogical source.

## Consequences

- Authoring/review work is heavier but traceable.
- Storage retains multiple versions.
- Search indexes and caches must include version/checksum.
- Copyright takedown and historical audit have defined behavior.

