# ADR-0007: Use active 2D visualization with a renderer-neutral trace protocol

## Status

Proposed
## Date

2026-09-17

## Context

Visualization helps when learners predict, manipulate, or explain state. Passive animation and unnecessary 3D can increase cognitive load and accessibility cost. Algorithm logic should not be coupled to one renderer.

## Decision

Represent algorithm state changes as a versioned, deterministic trace-event protocol. Render initial experiences through accessible SVG, semantic HTML, or Canvas with text equivalents. Insert prediction checkpoints and record them as learning evidence. Provide keyboard and reduced-motion operation. Treat 3D as a later controlled experiment with a 2D/text alternative.

## Alternatives considered

- **Hard-code animations per lesson:** rejected because logic, testing, accessibility, and rendering become coupled.
- **3D-first experience:** rejected because spatial depth is rarely necessary for initial topics and its learning benefit is unproven.
- **Passive videos only:** rejected because viewing does not provide active mastery evidence.

## Consequences

- One trace can drive visuals, transcripts, snapshots, and tests.
- Trace schema/version governance is required.
- Canvas renderers need parallel semantic representations.
- 3D cannot be added as decoration; it needs a learning hypothesis and delayed assessment.

