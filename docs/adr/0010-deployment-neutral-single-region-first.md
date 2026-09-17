# ADR-0010: Remain deployment-neutral and use a single region first

## Status

Proposed
## Date

2026-09-17

## Context

The owner wants AWS later but no cloud selection now. Multi-region and cloud-specific services would force cost and consistency choices before traffic, residency, team, and availability requirements are approved.

## Decision

Define runtime capabilities rather than vendor resources: web runtime with streaming, PostgreSQL+pgvector, an isolated multi-language execution plane, optional content/evaluation worker, secret store, telemetry, identity, email, and later object storage. The first hosted pilot is single region with managed backups/PITR, horizontal web replicas as needed, dedicated sandbox hosts/pool, tested rollback, and declared RPO/RTO. Select a cloud/provider during a later deployment architecture phase.

## Alternatives considered

- **AWS-specific architecture now:** deferred because no deployment requirements/vendor approval exist.
- **Multi-region active-active:** rejected initially due to data consistency, cost, and operational complexity.
- **Single unmanaged host/database:** rejected for a hosted pilot because recovery and isolation evidence would be weak.

## Consequences

- Application contracts avoid unnecessary vendor lock-in.
- Some deployment details remain unresolved until region/privacy/load decisions exist.
- Single-region outage is an explicitly accepted initial risk.
- Multi-region adoption requires an ADR covering consistency, failover, residency, and test evidence.
