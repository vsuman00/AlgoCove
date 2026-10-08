CREATE TABLE platform.operational_sample (
 sample_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 operation text NOT NULL CHECK(operation IN ('workspace','privacy','privacy_export','privacy_deletion','code_execution','roadmap','database','tutor_provider','tutor_authored')),
 outcome text NOT NULL CHECK(outcome IN ('success','failure','timeout','cancelled','rejected','fallback')),
 duration_ms integer NOT NULL CHECK(duration_ms BETWEEN 0 AND 600000),
 trace_id text NOT NULL CHECK(trace_id ~ '^[A-Za-z0-9._-]{7,128}$'),
 request_id text NOT NULL CHECK(request_id ~ '^[A-Za-z0-9._-]{7,128}$'),
 session_correlation text CHECK(session_correlation ~ '^corr_[a-f0-9]{64}$'),
 language text CHECK(language IN ('python','javascript','typescript','java','cpp','c')),
 observed_at timestamptz NOT NULL,
 UNIQUE(request_id,operation,outcome)
);
CREATE INDEX operational_sample_window ON platform.operational_sample(observed_at,operation);
CREATE TABLE platform.service_heartbeat (
 service text PRIMARY KEY CHECK(service IN ('content-worker','privacy-worker','execution-relay')),
 observed_at timestamptz NOT NULL
);
CREATE FUNCTION platform.apply_privacy_retention(batch_limit integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,platform AS $$
DECLARE drafts bigint; revisions bigint; telemetry bigint;
BEGIN
 IF batch_limit<1 OR batch_limit>500 THEN RAISE EXCEPTION 'invalid retention bound'; END IF;
 DELETE FROM practice.draft_revision WHERE (draft_id,revision) IN
 (SELECT draft_id,revision FROM practice.draft_revision r WHERE expires_at<=clock_timestamp()
 AND NOT EXISTS(SELECT 1 FROM platform.privacy_hold h WHERE h.learner_id=r.learner_id AND h.expires_at>clock_timestamp()) ORDER BY expires_at LIMIT batch_limit);
 GET DIAGNOSTICS revisions=ROW_COUNT;
 DELETE FROM practice.draft WHERE draft_id IN
 (SELECT draft_id FROM practice.draft d WHERE expires_at<=clock_timestamp()
 AND NOT EXISTS(SELECT 1 FROM platform.privacy_hold h WHERE h.learner_id=d.learner_id AND h.expires_at>clock_timestamp()) ORDER BY expires_at LIMIT batch_limit);
 GET DIAGNOSTICS drafts=ROW_COUNT;
 DELETE FROM platform.operational_sample WHERE sample_id IN
 (SELECT sample_id FROM platform.operational_sample WHERE observed_at<clock_timestamp()-interval '7 days' ORDER BY observed_at LIMIT batch_limit);
 GET DIAGNOSTICS telemetry=ROW_COUNT;
 RETURN jsonb_build_object('expiredDrafts',drafts,'expiredRevisions',revisions,'expiredTelemetry',telemetry);
END $$;
REVOKE ALL ON FUNCTION platform.apply_privacy_retention(integer) FROM PUBLIC;
