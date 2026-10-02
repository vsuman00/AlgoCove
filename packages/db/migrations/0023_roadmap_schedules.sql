ALTER TABLE mastery.review_item ADD UNIQUE(review_id,learner_id);
-- Candidates are private previews; only explicit, version-checked acceptance activates a snapshot.
CREATE TABLE planning.plan_candidate (
 candidate_id text PRIMARY KEY CHECK(candidate_id ~ '^evt_[0-9a-hjkmnp-tv-z]{16,52}$'),
 plan_id text NOT NULL, learner_id text NOT NULL, intent_version integer NOT NULL,
 expected_token text, status text NOT NULL CHECK(status IN ('building','valid','invalid','failed','expired','accepted')),
 body jsonb NOT NULL, created_at timestamptz NOT NULL, expires_at timestamptz NOT NULL,
 UNIQUE(candidate_id,learner_id),
 FOREIGN KEY(plan_id,intent_version,learner_id) REFERENCES planning.roadmap_intent_version(plan_id,version,learner_id) ON DELETE CASCADE
);
CREATE TABLE planning.accepted_version (
 version_id text PRIMARY KEY, learner_id text NOT NULL, plan_id text NOT NULL,
 schedule jsonb NOT NULL, accepted_at timestamptz NOT NULL, UNIQUE(version_id,learner_id),
 FOREIGN KEY(version_id,learner_id) REFERENCES planning.plan_candidate(candidate_id,learner_id) ON DELETE CASCADE,
 FOREIGN KEY(plan_id,learner_id) REFERENCES planning.roadmap_intent(plan_id,learner_id) ON DELETE CASCADE
);
CREATE TABLE planning.plan_state (
 learner_id text PRIMARY KEY REFERENCES platform.learner(learner_id) ON DELETE CASCADE,
 version_id text NOT NULL, token text NOT NULL, status text NOT NULL CHECK(status IN ('active','paused','completed','archived')),
 FOREIGN KEY(version_id,learner_id) REFERENCES planning.accepted_version(version_id,learner_id) ON DELETE CASCADE
);
CREATE TABLE planning.plan_item (
 version_id text NOT NULL, learner_id text NOT NULL, occurrence_id text NOT NULL,
 kind text NOT NULL CHECK(kind IN ('lesson','internal_problem','external_practice','review','buffer')),
 lesson_id text REFERENCES content.content_version(content_version_id),
 problem_id text REFERENCES content.problem_version(problem_version_id),
 reference_id text REFERENCES content.external_reference(external_reference_id), reference_version integer,
 review_id text, body jsonb NOT NULL,
 PRIMARY KEY(version_id,occurrence_id), UNIQUE(version_id,occurrence_id,learner_id),
 FOREIGN KEY(version_id,learner_id) REFERENCES planning.accepted_version(version_id,learner_id) ON DELETE CASCADE,
 FOREIGN KEY(review_id,learner_id) REFERENCES mastery.review_item(review_id,learner_id) ON DELETE CASCADE,
 CHECK((kind='lesson' AND lesson_id IS NOT NULL AND problem_id IS NULL AND reference_id IS NULL AND review_id IS NULL) OR
 (kind='internal_problem' AND lesson_id IS NULL AND problem_id IS NOT NULL AND reference_id IS NULL AND review_id IS NULL) OR
 (kind='external_practice' AND lesson_id IS NULL AND problem_id IS NULL AND reference_id IS NOT NULL AND review_id IS NULL AND reference_version>0) OR
 (kind='review' AND lesson_id IS NULL AND problem_id IS NULL AND reference_id IS NULL AND review_id IS NOT NULL) OR
 (kind='buffer' AND lesson_id IS NULL AND problem_id IS NULL AND reference_id IS NULL AND review_id IS NULL AND reference_version IS NULL))
);
CREATE TABLE planning.plan_journal (
 event_id text PRIMARY KEY, learner_id text NOT NULL, version_id text NOT NULL,
 kind text NOT NULL CHECK(kind IN ('accepted','superseded','paused','resumed','completed','archived','done','missed','reversed')),
 occurrence_id text, reverses_id text REFERENCES planning.plan_journal(event_id), local_day date NOT NULL,
 timezone text NOT NULL, occurred_at timestamptz NOT NULL,
 FOREIGN KEY(version_id,learner_id) REFERENCES planning.accepted_version(version_id,learner_id) ON DELETE CASCADE,
 FOREIGN KEY(version_id,occurrence_id,learner_id) REFERENCES planning.plan_item(version_id,occurrence_id,learner_id) ON DELETE CASCADE,
 CHECK((kind IN ('done','missed','reversed') AND occurrence_id IS NOT NULL) OR (kind NOT IN ('done','missed','reversed') AND occurrence_id IS NULL)),
 CHECK((kind='reversed')=(reverses_id IS NOT NULL)), UNIQUE(reverses_id)
);
CREATE TABLE planning.plan_command (
 learner_id text NOT NULL REFERENCES platform.learner(learner_id) ON DELETE CASCADE,
 command_key text NOT NULL, digest text NOT NULL, receipt jsonb NOT NULL,
 PRIMARY KEY(learner_id,command_key)
);
CREATE TRIGGER accepted_immutable BEFORE UPDATE OR DELETE ON planning.accepted_version FOR EACH ROW EXECUTE FUNCTION planning.prevent_intent_history_rewrite();
CREATE TRIGGER plan_item_immutable BEFORE UPDATE OR DELETE ON planning.plan_item FOR EACH ROW EXECUTE FUNCTION planning.prevent_intent_history_rewrite();
CREATE TRIGGER plan_journal_immutable BEFORE UPDATE OR DELETE ON planning.plan_journal FOR EACH ROW EXECUTE FUNCTION planning.prevent_intent_history_rewrite();
CREATE TRIGGER plan_command_immutable BEFORE UPDATE OR DELETE ON planning.plan_command FOR EACH ROW EXECUTE FUNCTION planning.prevent_intent_history_rewrite();
CREATE FUNCTION planning.guard_candidate() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' AND pg_trigger_depth()>1 THEN RETURN OLD; END IF;
 IF TG_OP='DELETE' OR (to_jsonb(NEW)-'status') IS DISTINCT FROM (to_jsonb(OLD)-'status') OR NOT ((OLD.status='building' AND NEW.status IN ('valid','invalid','failed')) OR (OLD.status='valid' AND NEW.status IN ('accepted','expired'))) THEN RAISE EXCEPTION 'candidate snapshot and transition are fixed' USING ERRCODE='55006'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER candidate_guard BEFORE UPDATE OR DELETE ON planning.plan_candidate FOR EACH ROW EXECUTE FUNCTION planning.guard_candidate();
ALTER TABLE planning.plan_journal ADD UNIQUE(event_id,learner_id,version_id,occurrence_id);
ALTER TABLE planning.plan_journal ADD FOREIGN KEY(reverses_id,learner_id,version_id,occurrence_id) REFERENCES planning.plan_journal(event_id,learner_id,version_id,occurrence_id) ON DELETE CASCADE;
CREATE FUNCTION planning.guard_state() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.learner_id<>OLD.learner_id OR NEW.token=OLD.token OR (NEW.version_id=OLD.version_id AND NOT ((OLD.status='active' AND NEW.status IN ('active','paused','completed','archived')) OR (OLD.status='paused' AND NEW.status IN ('paused','active','completed','archived')) OR (OLD.status='completed' AND NEW.status IN ('completed','archived')) OR (OLD.status='archived' AND NEW.status='archived'))) OR (NEW.version_id<>OLD.version_id AND NEW.status<>'active') THEN RAISE EXCEPTION 'invalid planning lifecycle transition' USING ERRCODE='55006'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER state_guard BEFORE UPDATE ON planning.plan_state FOR EACH ROW EXECUTE FUNCTION planning.guard_state();
ALTER TABLE planning.roadmap_intent_version ADD CHECK(NOT (preferences ? 'bufferPercent') OR (preferences->>'bufferPercent')::integer BETWEEN 5 AND 40);
ALTER TABLE planning.plan_item ADD CHECK((kind='external_practice')=(reference_version IS NOT NULL));
ALTER TABLE planning.plan_item ADD CHECK(COALESCE(body->>'kind'=kind AND (body->>'minutes')::integer BETWEEN 1 AND 480 AND body->>'occurrenceId'=occurrence_id AND CASE kind WHEN 'buffer' THEN body->>'targetId' IS NULL WHEN 'lesson' THEN body->>'targetId'=lesson_id WHEN 'internal_problem' THEN body->>'targetId'=problem_id WHEN 'review' THEN body->>'targetId'=review_id ELSE body->>'targetId'=reference_id AND (body->>'targetVersion')::integer=reference_version END,false));
ALTER TABLE planning.plan_journal ADD UNIQUE(event_id,learner_id);
ALTER TABLE planning.plan_state ADD FOREIGN KEY(token,learner_id) REFERENCES planning.plan_journal(event_id,learner_id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
