-- Private planning inputs, separate from validated candidates and accepted schedules.
CREATE TABLE planning.roadmap_intent (
 plan_id text PRIMARY KEY CHECK(plan_id ~ '^pln_[0-9a-hjkmnp-tv-z]{16,52}$'),
 learner_id text NOT NULL UNIQUE REFERENCES platform.learner(learner_id) ON DELETE CASCADE,
 current_version integer NOT NULL CHECK(current_version>0),
 created_at timestamptz NOT NULL,
 UNIQUE(plan_id,learner_id)
);
CREATE TABLE planning.roadmap_intent_version (
 plan_id text NOT NULL, learner_id text NOT NULL, version integer NOT NULL CHECK(version>0),
 preferences jsonb NOT NULL CHECK(jsonb_typeof(preferences)='object'), saved_at timestamptz NOT NULL,
 PRIMARY KEY(plan_id,version), UNIQUE(plan_id,version,learner_id),
 FOREIGN KEY(plan_id,learner_id) REFERENCES planning.roadmap_intent(plan_id,learner_id) ON DELETE CASCADE,
 CHECK((preferences->>'horizonMonths')::integer IN (1,2,3,4,6)),
 CHECK((preferences->>'dailyCapacityMinutes')::integer BETWEEN 15 AND 480)
);
ALTER TABLE planning.roadmap_intent ADD FOREIGN KEY(plan_id,current_version,learner_id) REFERENCES planning.roadmap_intent_version(plan_id,version,learner_id) DEFERRABLE INITIALLY DEFERRED;
CREATE TABLE planning.intent_collection (
 plan_id text NOT NULL, version integer NOT NULL, learner_id text NOT NULL,
 collection_id text NOT NULL REFERENCES content.external_collection(collection_id),
 PRIMARY KEY(plan_id,version,collection_id),
 FOREIGN KEY(plan_id,version,learner_id) REFERENCES planning.roadmap_intent_version(plan_id,version,learner_id) ON DELETE CASCADE
);
CREATE TABLE planning.intent_command (
 learner_id text NOT NULL REFERENCES platform.learner(learner_id) ON DELETE CASCADE,
 idempotency_key text NOT NULL CHECK(char_length(idempotency_key) BETWEEN 8 AND 128),
 digest text NOT NULL CHECK(digest ~ '^sha256:[0-9a-f]{64}$'),
 plan_id text NOT NULL, version integer NOT NULL,
 PRIMARY KEY(learner_id,idempotency_key),
 FOREIGN KEY(plan_id,version,learner_id) REFERENCES planning.roadmap_intent_version(plan_id,version,learner_id) ON DELETE CASCADE
);
CREATE FUNCTION planning.prevent_intent_history_rewrite() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' AND pg_trigger_depth()>1 THEN RETURN OLD; END IF;
 RAISE EXCEPTION 'planning input history is immutable' USING ERRCODE='55006';
END; $$;
CREATE TRIGGER intent_version_immutable BEFORE UPDATE OR DELETE ON planning.roadmap_intent_version FOR EACH ROW EXECUTE FUNCTION planning.prevent_intent_history_rewrite();
CREATE TRIGGER intent_collection_immutable BEFORE UPDATE OR DELETE ON planning.intent_collection FOR EACH ROW EXECUTE FUNCTION planning.prevent_intent_history_rewrite();
CREATE TRIGGER intent_command_immutable BEFORE UPDATE OR DELETE ON planning.intent_command FOR EACH ROW EXECUTE FUNCTION planning.prevent_intent_history_rewrite();
CREATE FUNCTION planning.guard_intent_pointer() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.plan_id<>OLD.plan_id OR NEW.learner_id<>OLD.learner_id OR NEW.created_at<>OLD.created_at OR NEW.current_version<>OLD.current_version+1 THEN RAISE EXCEPTION 'planning identity is fixed and revision must advance once' USING ERRCODE='55006'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER intent_pointer_guard BEFORE UPDATE ON planning.roadmap_intent FOR EACH ROW EXECUTE FUNCTION planning.guard_intent_pointer();
