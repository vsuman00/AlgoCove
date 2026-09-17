# ADR-0011: Use isolated server-side execution for six first-class languages

## Status

Proposed
## Date

2026-09-17

## Context

AlgoCove serves learners using Python, JavaScript, TypeScript, Java, C++, and C. Equivalent practice requires real compiler/runtime behavior, shared semantic tests, consistent resource limits, and server-observed results. Browser-only JavaScript execution cannot meet that requirement. Learner programs, compiler inputs, and native binaries are hostile and can attempt network access, filesystem access, process/fork bombs, resource exhaustion, cross-run leakage, or sandbox escape.

## Decision

Create a dedicated code-execution plane outside the Next.js and background-worker trust boundaries from the first hosted release. Its control service accepts only authenticated, signed, server-constructed run descriptors. Each run uses an immutable language/problem manifest and a pinned runtime-image digest, executes in a fresh network-denied disposable sandbox, and is subject to hard CPU, wall-time, memory, PID, file, disk, input, output, and concurrency limits.

Use a strong sandboxed-container runtime such as a gVisor-class design, a microVM-class design, or a managed platform that proves equivalent controls. Default containers alone are insufficient. Sandbox jobs have no secrets, service credentials, host/runtime sockets, application/database access, or shared writable caches. The application verifies a signed normalized result before it records attempt events or mastery evidence.

Treat `python`, `javascript`, `typescript`, `java`, `cpp`, and `c` as stable language IDs. Concepts and mastery remain language-neutral; each problem-language combination has a reviewed manifest, starter/signature contract, harness, canonical solution, and shared semantic fixture mapping. TypeScript performs a pinned type-check/transpile step before JavaScript execution.

[ADR-0014](0014-validate-before-display-and-trust-evidence.md) refines result integrity: the comparator and signing authority remain outside the learner sandbox; signed candidate assertions are not trusted verdicts.

## Alternatives considered

- **Browser-only execution:** rejected because it cannot provide equivalent Python, Java, C++, or C behavior and cannot produce server-observed results.
- **Execute learner code inside Next.js/Node:** rejected because process timeouts do not provide filesystem, syscall, network, credential, or resource isolation.
- **Ordinary containers as the only boundary:** rejected because they share the host kernel, have no resource constraints by default, and require explicit network/resource/security policy.
- **One permanent container per learner:** rejected because it increases cross-run residue, patching, cost, and lifecycle risk.
- **Third-party judge as a hard-coded dependency:** rejected at architecture time; a managed execution provider remains an adapter option subject to isolation, privacy, language-version, availability, cost, residency, and exit criteria.
- **Implement languages sequentially as unrelated systems:** rejected because it fragments test semantics, results, mastery evidence, and operating controls.

## Consequences

- The core product remains a modular monolith, but code execution is a justified initial service boundary for security and runtime isolation.
- Hosted development cannot accept learner code until sandbox isolation and runtime-image gates pass.
- Language runtime images, compiler versions, manifests, harnesses, and normalized diagnostics require versioning and patch operations.
- Compiled languages add cold-start and compilation latency; SLOs and capacity are measured per language profile rather than hidden behind one average.
- A shared conformance suite must prove equivalent problem semantics across all six languages.
- Execution infrastructure adds meaningful cost and operational responsibility, but avoids unsafe in-process execution and device-dependent browser behavior.
- ADR-0004 is superseded before acceptance; no browser-only execution architecture remains part of the target design.
