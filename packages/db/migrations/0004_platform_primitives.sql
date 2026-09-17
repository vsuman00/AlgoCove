-- 0004_platform_primitives.sql
--
-- Durable exactly-once effect claims, append-only audit records, and an
-- at-least-once outbox. A worker is intentionally out of scope for Phase 2;
-- this migration only establishes the transactional source of truth.

CREATE TABLE platform.idempotency_claim (
  scope text NOT NULL CHECK (char_length(scope) BETWEEN 1 AND 120),
  claim_key text NOT NULL CHECK (char_length(claim_key) BETWEEN 1 AND 200),
  request_hash text NOT NULL CHECK (request_hash ~ '^sha256:[0-9a-f]{64}$'),
  state text NOT NULL CHECK (state IN ('pending', 'completed', 'failed')),
  response_status integer CHECK (response_status BETWEEN 100 AND 599),
  response_body jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  expires_at timestamptz,
  PRIMARY KEY (scope, claim_key),
  CHECK ((state = 'pending' AND response_status IS NULL) OR state <> 'pending'),
  CHECK (completed_at IS NULL OR completed_at >= created_at)
);

CREATE INDEX idempotency_claim_expiry_idx
  ON platform.idempotency_claim (expires_at)
  WHERE expires_at IS NOT NULL;

CREATE TABLE platform.audit_event (
  event_id text PRIMARY KEY CHECK (event_id ~ '^evt_[0-9a-hjkmnp-tv-z]{16,52}$'),
  actor_id text REFERENCES platform.learner(learner_id),
  action text NOT NULL CHECK (char_length(action) BETWEEN 1 AND 120),
  resource_type text NOT NULL CHECK (char_length(resource_type) BETWEEN 1 AND 120),
  resource_id text CHECK (resource_id IS NULL OR char_length(resource_id) BETWEEN 1 AND 200),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(payload) = 'object'),
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE platform.outbox_event (
  event_id text PRIMARY KEY CHECK (event_id ~ '^evt_[0-9a-hjkmnp-tv-z]{16,52}$'),
  topic text NOT NULL CHECK (char_length(topic) BETWEEN 1 AND 160),
  aggregate_id text NOT NULL CHECK (char_length(aggregate_id) BETWEEN 1 AND 200),
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  available_at timestamptz NOT NULL DEFAULT now(),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  published_at timestamptz
);

CREATE INDEX outbox_pending_idx
  ON platform.outbox_event (available_at, occurred_at)
  WHERE published_at IS NULL;

CREATE FUNCTION platform.prevent_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit events are append-only' USING ERRCODE = '55006';
END;
$$;

CREATE TRIGGER audit_event_immutable
BEFORE UPDATE OR DELETE ON platform.audit_event
FOR EACH ROW EXECUTE FUNCTION platform.prevent_audit_mutation();
