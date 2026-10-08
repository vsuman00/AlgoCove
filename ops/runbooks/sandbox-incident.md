# Sandbox or runtime-image incident

Owner: execution operator. Severity: page for suspected boundary escape; warning for a rejected/missing image candidate.

Containment: stop new dispatch, cancel active leases and quarantine the affected execution host. Keep application/data/control credentials and networks outside the learner runtime. Never fall back to native host execution or a less isolated runtime.

Evidence: retain run/replay/lease IDs, signed descriptor and validated digest/profile/limit versions, terminal infrastructure categories and teardown receipts. No source, compiler output containing source, secrets or raw provider bodies go into incident telemetry.

Recovery: select the prior approved immutable runtime digest and validated profile; verify local availability before dispatch. Run compiler/conformance and sandbox abuse checks on the approved Linux/gVisor reference host before reopening learner execution. Missing images fail closed. Do not delete a container/image that another task owns.

Communication: execution operator reports containment and teardown status; privacy and platform owners assess data exposure and affected learning evidence. The Phase 11 Docker Desktop digest smoke is a local rollback check, not a new gVisor security qualification.
