-- Per-device scoping for SMS ingest tokens.
--
-- Before: one active token per user; rotating/revoking on one device (DELETE
-- deactivates ALL of the user's active tokens) silently de-armed every other
-- device. And a token had no device identity, so a token leaked from one phone
-- could be replayed from anywhere.
--
-- After: a token may be bound to the device that fetched it (device_id from the
-- X-Buddget-Device-Id header the Capacitor shell already sends). Web callers send
-- no header, so their tokens stay device_id = null and behave exactly as before —
-- this migration is additive and changes no existing row.
alter table public.sms_ingest_tokens
  add column if not exists device_id text;

-- Fast lookup for the per-device fetch path (user + device → active token).
create index if not exists sms_ingest_tokens_user_device_idx
  on public.sms_ingest_tokens (user_id, device_id)
  where is_active = true;
