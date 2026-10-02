-- Permit the domain's terminal retirement transition while retaining immutable payloads.
-- Reviews, manifests and validation remain protected by the existing triggers.
CREATE FUNCTION content.validate_content_retirement()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status = 'published' AND NEW.status = 'retired'
     AND NEW.retired_at IS NOT NULL AND NEW.retired_at >= OLD.published_at
     AND NEW.retirement_reason IN ('retired','rights_withdrawn','security_tombstone')
     AND NEW.payload_status = (CASE WHEN NEW.retirement_reason = 'retired' THEN 'available' ELSE 'tombstoned' END)
     AND (to_jsonb(OLD) - ARRAY['status','payload_status','retired_at','retirement_reason'])
       = (to_jsonb(NEW) - ARRAY['status','payload_status','retired_at','retirement_reason'])
  THEN RETURN NEW;
  END IF;
  RAISE EXCEPTION 'published and retired content payloads are immutable' USING ERRCODE = '55006';
END;
$$;
DROP TRIGGER content_version_immutable ON content.content_version;
CREATE TRIGGER content_version_immutable BEFORE UPDATE OR DELETE ON content.content_version
FOR EACH ROW WHEN (OLD.status IN ('published','retired'))
EXECUTE FUNCTION content.validate_content_retirement();
