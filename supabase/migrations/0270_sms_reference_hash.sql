-- S2c step 2 (invariants I1, I2). A refund is matched to its original purchase by the payment reference the two
-- messages share. The message text is purged after 30 days, so the reference is kept as a per-user salted hash on
-- the log row: it can be compared for equality and never read back.
alter table public.sms_parse_log add column if not exists reference_hash text;

create index if not exists sms_parse_log_user_reference_idx
  on public.sms_parse_log (user_id, reference_hash)
  where reference_hash is not null;

comment on column public.sms_parse_log.reference_hash is
  'sha256 of "<user_id>|<lowercased payment reference>", first 32 hex chars. Compared for equality by the refund matcher; the reference itself is never stored.';
