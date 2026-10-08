# Provider failure and AI rollback

Owner: AI operator. Severity: warning for provider burn; page for suspected private-data disclosure.

Containment: disable optional provider admission and retain deterministic authored fallback. A successful authored answer is not a successful provider call. Never broaden context, change region, remove a privacy constraint or retry through an unapproved provider to recover availability.

Evidence: collect configuration/prompt/policy versions, accepted rollout decision, timeout/refusal categories and aggregate provider/authored SLOs. Exclude raw learner prompts, source, evidence packages and provider bodies.

Recovery: use the existing governed evaluation rollback with the current accepted promotion decision. Verify the versioned `authored.off.v1` target, stale-decision rejection and active channel before resuming optional admission. A fixture rollback does not activate or qualify a live provider. Re-evaluate the failed configuration before a new promotion.

Communication: AI operator owns technical updates; privacy administrator assesses exposure and required owner communication. No external message is sent automatically.
