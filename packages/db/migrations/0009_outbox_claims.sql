-- 0009_outbox_claims.sql
--
-- Add bounded relay leases to the application-owned outbox. A lease prevents
-- concurrent relays from publishing the same pending row while allowing a
-- crashed relay's claim to become available again.

ALTER TABLE platform.outbox_event
  ADD COLUMN claimed_by text
    CHECK (claimed_by IS NULL OR claimed_by ~ '^[A-Za-z0-9._:-]{1,128}$'),
  ADD COLUMN claim_expires_at timestamptz;
