-- Local privacy lifecycle. The account tombstone is retained without a provider subject.
ALTER TABLE platform.learner ADD COLUMN account_state text NOT NULL DEFAULT 'active'
 CHECK(account_state IN ('active','suspended','deletion_pending','deleted'));
CREATE TABLE platform.privacy_deletion (
 request_id text PRIMARY KEY CHECK(request_id ~ '^evt_[0-9a-hjkmnp-tv-z]{16,52}$'),
 learner_id text NOT NULL UNIQUE REFERENCES platform.learner(learner_id),
 state text NOT NULL CHECK(state IN ('pending','purging','completed','held')),
 policy_version text NOT NULL CHECK(policy_version='local-privacy.v1'),
 requested_at timestamptz NOT NULL,
 completed_at timestamptz,
 backup_expiry timestamptz NOT NULL,
 lease_token text, lease_expires_at timestamptz,
 CHECK((lease_token IS NULL)=(lease_expires_at IS NULL)),
 CHECK((state='completed')=(completed_at IS NOT NULL))
);
CREATE TABLE platform.privacy_cancellation (
 request_id text NOT NULL REFERENCES platform.privacy_deletion(request_id),
 run_id text NOT NULL, confirmed_at timestamptz,
 PRIMARY KEY(request_id,run_id)
);
CREATE TABLE platform.privacy_hold (
 learner_id text PRIMARY KEY REFERENCES platform.learner(learner_id),
 reason_code text NOT NULL CHECK(reason_code IN ('legal','security')),
 placed_at timestamptz NOT NULL, expires_at timestamptz NOT NULL,
 CHECK(expires_at>placed_at)
);
CREATE TABLE platform.privacy_backup (
 backup_id text PRIMARY KEY CHECK(backup_id ~ '^[a-zA-Z0-9._-]{8,100}$'),
 created_at timestamptz NOT NULL, expires_at timestamptz NOT NULL,
 destroyed_at timestamptz, checksum text NOT NULL CHECK(checksum ~ '^sha256:[0-9a-f]{64}$'),
 CHECK(expires_at>created_at), CHECK(destroyed_at IS NULL OR destroyed_at>=created_at)
);

-- Explicit owner-data inventory. Order is dependency order for purge.
CREATE TABLE platform.privacy_owned_table (
 ordinal integer PRIMARY KEY, relation_name text NOT NULL UNIQUE,
 identity_column text NOT NULL
);
INSERT INTO platform.privacy_owned_table VALUES
 (1,'tutor.assistance','request_id'),
 (2,'tutor.request','request_id'),
 (3,'tutor.evidence_package','package_id'),
 (4,'planning.plan_state','version_id'),
 (5,'planning.plan_journal','event_id'),
 (6,'planning.plan_item','occurrence_id'),
 (7,'planning.accepted_version','version_id'),
 (8,'planning.plan_candidate','candidate_id'),
 (9,'planning.plan_command','command_key'),
 (10,'planning.intent_command','idempotency_key'),
 (11,'planning.intent_collection','plan_id'),
 (12,'planning.roadmap_intent_version','plan_id'),
 (13,'planning.roadmap_intent','plan_id'),
 (14,'mastery.projection','concept_id'),
 (15,'mastery.review_event','event_id'),
 (16,'mastery.review_item','review_id'),
 (17,'mastery.evidence','observation_id'),
 (18,'practice.study_activity','observation_id'),
 (19,'practice.study_pause','pause_id'),
 (20,'practice.external_practice_event','event_id'),
 (21,'practice.external_readiness_evidence','evidence_id'),
 (22,'practice.learning_observation','observation_id'),
 (23,'practice.assessment_observation','observation_id'),
 (24,'practice.code_run','run_id'),
 (25,'practice.pseudocode_revision','pseudocode_id'),
 (26,'practice.pseudocode_artifact','pseudocode_id'),
 (27,'practice.draft_revision','draft_id'),
 (28,'practice.draft','draft_id'),
 (29,'practice.hint_exposure','exposure_id'),
 (30,'practice.attempt_event','event_id'),
 (31,'practice.attempt','attempt_id'),
 (32,'practice.learning_session','session_id'),
 (33,'platform.learner_profile','learner_id'),
 (34,'platform.optional_reservation','reservation_key'),
 (35,'platform.operation_breaker','learner_id'),
 (36,'platform.identity_account','learner_id'),
 (37,'platform.role_grant','learner_id');

-- The GUC alone is never sufficient: only the schema owner inside the scoped
-- SECURITY DEFINER purge can cross immutable-history guards. Runtime cannot SET ROLE.
CREATE FUNCTION platform.privacy_purge_authorized() RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT current_user=pg_get_userbyid((SELECT nspowner FROM pg_namespace WHERE nspname='platform'))
 AND EXISTS(SELECT 1 FROM platform.privacy_deletion d JOIN platform.learner l USING(learner_id)
 WHERE d.learner_id=current_setting('algocove.privacy_subject',true)
 AND d.state='purging' AND l.account_state='deletion_pending');
$$;
-- Add the narrow owner-only purge exception to existing history guards, retaining
-- the original guard bodies and ordinary cascade semantics.
DO $$ DECLARE item record; definition text; BEGIN
 FOR item IN SELECT DISTINCT p.oid FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid
 JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE NOT t.tgisinternal AND (n.nspname IN ('practice','mastery','planning','tutor')
 OR (n.nspname='platform' AND c.relname IN ('audit_event','worker_effect_receipt'))) LOOP
  definition:=pg_get_functiondef(item.oid);
  IF definition ~ 'BEGIN' THEN
   definition:=regexp_replace(definition,'BEGIN',
    'BEGIN IF TG_OP=''DELETE'' AND platform.privacy_purge_authorized() THEN RETURN OLD; END IF;');
   EXECUTE definition;
  END IF;
 END LOOP;
END $$;

CREATE FUNCTION platform.guard_private_account() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE subject text; state text;
BEGIN
 IF platform.privacy_purge_authorized() THEN RETURN NEW; END IF;
 subject:=to_jsonb(NEW)->>'learner_id';
 SELECT account_state INTO state FROM platform.learner WHERE learner_id=subject FOR SHARE;
 IF state IS DISTINCT FROM 'active' THEN
  RAISE EXCEPTION 'account is unavailable' USING ERRCODE='42501';
 END IF;
 RETURN NEW;
END $$;
DO $$ DECLARE item record; BEGIN
 FOR item IN SELECT relation_name FROM platform.privacy_owned_table LOOP
  EXECUTE format('CREATE TRIGGER privacy_account_guard BEFORE INSERT OR UPDATE ON %s FOR EACH ROW EXECUTE FUNCTION platform.guard_private_account()',item.relation_name);
 END LOOP;
END $$;
-- Fence asynchronous outbox retries before admitting a deleted subject.
CREATE FUNCTION platform.guard_private_outbox() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE subject text; state text;
BEGIN
 subject:=NEW.payload->>'learnerId';
 IF subject IS NOT NULL THEN
  SELECT account_state INTO state FROM platform.learner WHERE learner_id=subject FOR SHARE;
  IF state IS DISTINCT FROM 'active' THEN RAISE EXCEPTION 'private job subject unavailable' USING ERRCODE='42501'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER private_outbox_guard BEFORE INSERT ON platform.outbox_event FOR EACH ROW EXECUTE FUNCTION platform.guard_private_outbox();

CREATE FUNCTION platform.claim_privacy_deletion(token text) RETURNS SETOF platform.privacy_deletion
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,platform AS $$
DECLARE chosen text;
BEGIN
 IF token !~ '^[a-zA-Z0-9._:-]{16,128}$' THEN RAISE EXCEPTION 'invalid lease'; END IF;
 SELECT request_id INTO chosen FROM platform.privacy_deletion d
 WHERE d.state IN ('pending','purging','held') AND (d.lease_expires_at IS NULL OR d.lease_expires_at<=clock_timestamp())
 AND NOT EXISTS(SELECT 1 FROM platform.privacy_hold h WHERE h.learner_id=d.learner_id AND h.expires_at>clock_timestamp())
 ORDER BY requested_at,request_id LIMIT 1 FOR UPDATE SKIP LOCKED;
 RETURN QUERY UPDATE platform.privacy_deletion SET state='purging',lease_token=token,lease_expires_at=clock_timestamp()+interval '2 minutes'
 WHERE request_id=chosen RETURNING *;
END $$;
CREATE FUNCTION platform.confirm_privacy_cancellation(request text,run text,token text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,platform AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM platform.privacy_deletion WHERE request_id=request AND lease_token=token
 AND state='purging' AND lease_expires_at>clock_timestamp()) THEN RAISE EXCEPTION 'stale deletion lease'; END IF;
 UPDATE platform.privacy_cancellation SET confirmed_at=clock_timestamp() WHERE request_id=request AND run_id=run;
 IF NOT FOUND THEN RAISE EXCEPTION 'unknown cancellation'; END IF;
END $$;

CREATE FUNCTION platform.complete_privacy_deletion(request text,token text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,platform AS $$
DECLARE job platform.privacy_deletion%ROWTYPE; item record; identities text[]; owned text[];
 remaining bigint; total bigint:=0; old_subject text;
BEGIN
 SELECT * INTO job FROM platform.privacy_deletion WHERE request_id=request FOR UPDATE;
 IF job.state='completed' THEN RETURN jsonb_build_object('activePrivateReferences',0,'state','completed'); END IF;
 IF job.request_id IS NULL OR job.state<>'purging' OR job.lease_token IS DISTINCT FROM token OR job.lease_expires_at<=clock_timestamp() THEN
  RAISE EXCEPTION 'stale deletion lease';
 END IF;
 PERFORM 1 FROM platform.learner WHERE learner_id=job.learner_id AND account_state='deletion_pending' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'account deletion is not pending'; END IF;
 IF EXISTS(SELECT 1 FROM platform.privacy_hold WHERE learner_id=job.learner_id AND expires_at>clock_timestamp()) THEN
  UPDATE platform.privacy_deletion SET state='held',lease_token=NULL,lease_expires_at=NULL WHERE request_id=request;
  RETURN jsonb_build_object('state','held');
 END IF;
 IF EXISTS(SELECT 1 FROM platform.privacy_cancellation WHERE request_id=request AND confirmed_at IS NULL) THEN
  RAISE EXCEPTION 'execution cancellation incomplete';
 END IF;
 old_subject:=current_setting('algocove.privacy_subject',true);
 PERFORM set_config('algocove.privacy_subject',job.learner_id,true);
 identities:=ARRAY[job.learner_id];
 FOR item IN SELECT * FROM platform.privacy_owned_table
 WHERE identity_column IN ('request_id','package_id','version_id','event_id','candidate_id','plan_id','review_id','observation_id','run_id','pseudocode_id','draft_id','exposure_id','attempt_id','session_id') LOOP
  EXECUTE format('SELECT array_agg(%I::text) FROM %s WHERE learner_id=$1',item.identity_column,item.relation_name) INTO owned USING job.learner_id;
  identities:=identities||coalesce(owned,ARRAY[]::text[]);
 END LOOP;
 -- Raw tutor responses have no owner column; resolve them before deleting requests.
 DELETE FROM tutor.assistance WHERE learner_id=job.learner_id;
 DELETE FROM tutor.response WHERE request_id IN (SELECT request_id FROM tutor.request WHERE learner_id=job.learner_id);
 DELETE FROM practice.attempt_release_pin WHERE attempt_id IN (SELECT attempt_id FROM practice.attempt WHERE learner_id=job.learner_id);
 FOR item IN SELECT * FROM platform.privacy_owned_table ORDER BY ordinal LOOP
  EXECUTE format('DELETE FROM %s WHERE learner_id=$1',item.relation_name) USING job.learner_id;
 END LOOP;
 -- Retain public content authorship under the unlinked pseudonymous tombstone.
 -- Private audit payloads and delivery payloads must not survive as secondary stores.
 DELETE FROM platform.worker_effect_receipt WHERE event_id IN
 (SELECT event_id FROM platform.outbox_event e WHERE aggregate_id=ANY(identities) OR EXISTS
  (SELECT 1 FROM unnest(identities) id WHERE jsonb_path_exists(e.payload,'$.** ? (@ == $subject)',jsonb_build_object('subject',id))));
 DELETE FROM platform.worker_derivation_expectation WHERE event_id IN
 (SELECT event_id FROM platform.outbox_event e WHERE aggregate_id=ANY(identities) OR EXISTS
  (SELECT 1 FROM unnest(identities) id WHERE jsonb_path_exists(e.payload,'$.** ? (@ == $subject)',jsonb_build_object('subject',id))));
 DELETE FROM platform.outbox_event e WHERE aggregate_id=ANY(identities) OR EXISTS
 (SELECT 1 FROM unnest(identities) id WHERE jsonb_path_exists(e.payload,'$.** ? (@ == $subject)',jsonb_build_object('subject',id)));
 DELETE FROM platform.audit_event e WHERE actor_id=job.learner_id OR resource_id=ANY(identities) OR EXISTS
 (SELECT 1 FROM unnest(identities) id WHERE jsonb_path_exists(e.payload,'$.** ? (@ == $subject)',jsonb_build_object('subject',id)));
 DELETE FROM platform.idempotency_claim WHERE position(job.learner_id in scope)>0 OR position(job.learner_id in claim_key)>0
 OR EXISTS(SELECT 1 FROM unnest(identities) id WHERE jsonb_path_exists(response_body,'$.** ? (@ == $subject)',jsonb_build_object('subject',id)));
 FOR item IN SELECT * FROM platform.privacy_owned_table LOOP
  EXECUTE format('SELECT count(*) FROM %s WHERE learner_id=$1',item.relation_name) INTO remaining USING job.learner_id;
  total:=total+remaining;
 END LOOP;
 IF total<>0 THEN RAISE EXCEPTION 'private reference reconciliation failed'; END IF;
 DELETE FROM platform.privacy_cancellation WHERE request_id=request;
 UPDATE platform.learner SET account_state='deleted' WHERE learner_id=job.learner_id;
 UPDATE platform.privacy_deletion SET state='completed',completed_at=clock_timestamp(),lease_token=NULL,lease_expires_at=NULL WHERE request_id=request;
 UPDATE platform.outbox_event SET published_at=clock_timestamp(),claimed_by=NULL,claim_expires_at=NULL WHERE event_id=request;
 PERFORM set_config('algocove.privacy_subject',coalesce(old_subject,''),true);
 RETURN jsonb_build_object('activePrivateReferences',total,'state','completed');
END $$;
REVOKE ALL ON FUNCTION platform.claim_privacy_deletion(text),platform.confirm_privacy_cancellation(text,text,text),platform.complete_privacy_deletion(text,text) FROM PUBLIC;
CREATE FUNCTION platform.guard_account_tombstone() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.account_state='deleted' OR (OLD.account_state='deletion_pending' AND NOT platform.privacy_purge_authorized()) THEN
  RAISE EXCEPTION 'account tombstone is immutable' USING ERRCODE='55006';
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 IF NEW.account_state='deleted' AND NOT platform.privacy_purge_authorized() THEN
  RAISE EXCEPTION 'scoped privacy purge required' USING ERRCODE='42501';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER account_tombstone_guard BEFORE UPDATE OR DELETE ON platform.learner FOR EACH ROW EXECUTE FUNCTION platform.guard_account_tombstone();
