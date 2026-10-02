# ADR-0018: Spatial trace presentation with equivalent flat and textual operation

## Status

Accepted for local Phase 1–7 implementation, following the owner's explicit 3D UI direction on 2026-10-03. No deployment approval is implied.

## Decision

The initial array/two-pointer trace uses CSS perspective and three-dimensional cell faces. Learners can rotate and tilt the stage, reset its camera, or choose a flat view. Both views consume the same validated deterministic replay state and expose the same semantic array list, pointer labels, steps, transcript and prediction workflow.

This supersedes ADR-0007's proposed deferral of 3D presentation. Its renderer-neutral trace, keyboard operation, provenance, assistance recording and evidence requirements remain intact. Camera movement never advances a trace, changes algorithm state or earns learning credit. Unsupported traces remain unavailable.

## Reasoning and limits

CSS 3D adds spatial inspection without a graphics framework, canvas context or GPU-dependent application state. The initial contract contains array/two-pointer traces; this decision does not invent support for trees, graphs or arbitrary source tracing. Flat view and text remain available, with reduced-motion operation and bounded narrow-screen scrolling.

The implementation does not claim that 3D improves learning outcomes. That requires educational evidence beyond visual or interaction tests. Browser accessibility, deterministic replay, responsive screenshots and existing execution/learning regression gates verify presentation and integration.

## Scope

Production-quality code through Phase 7 and local/CI verification. Age/country restrictions, privacy-policy implementation, deployment and later-phase features are outside this task. Existing authentication, ownership, source privacy and hostile-code isolation remain required.
