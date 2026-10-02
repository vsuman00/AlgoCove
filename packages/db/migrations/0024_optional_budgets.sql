CREATE TABLE platform.optional_reservation (
 learner_id text NOT NULL REFERENCES platform.learner(learner_id) ON DELETE CASCADE,
 operation text NOT NULL CHECK(operation IN ('plan_proposal','code_execution')),
 reservation_key text NOT NULL, digest text NOT NULL, units integer NOT NULL CHECK(units>0),
 policy_version integer NOT NULL, created_at timestamptz NOT NULL,
 finished_at timestamptz, outcome text CHECK(outcome IN ('success','failure')),
 PRIMARY KEY(learner_id,operation,reservation_key), CHECK((finished_at IS NULL)=(outcome IS NULL))
);
CREATE INDEX optional_reservation_window ON platform.optional_reservation(learner_id,operation,created_at);
CREATE TABLE platform.operation_breaker (
 learner_id text NOT NULL REFERENCES platform.learner(learner_id) ON DELETE CASCADE,
 operation text NOT NULL CHECK(operation IN ('plan_proposal','code_execution')),
 failures integer NOT NULL DEFAULT 0 CHECK(failures>=0), open_until timestamptz,
 PRIMARY KEY(learner_id,operation)
);
