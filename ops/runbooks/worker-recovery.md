# Worker heartbeat loss and recovery

Owner: platform operator. Severity: page only when the relevant worker is configured to run and its heartbeat is missing or over two minutes old.

Containment: pause optional indexing/evaluation admission; keep core learning independent of the optional worker. A one-shot local worker must be scheduled repeatedly before heartbeat alerting is enabled.

Evidence: record service heartbeat timestamp, oldest pending job age, aggregate lease/retry/dead-letter counts and handler versions. Never log job payloads or learner source.

Recovery: restart the approved worker with its dedicated role. Run reconciliation to release expired claims, obsolete withdrawn content/indexes and recover deliveries lacking an atomic consumer receipt. Replay only an inspected dead letter with expected lifetime attempt count and a reason code. Lease fencing and immutable effect receipts prevent duplicate effects.

Communication: operator reports delayed capabilities and recovery progress to the incident owner. AI/content owners approve reactivation of their optional channels. Worker recovery cannot override publication or privacy guards.
