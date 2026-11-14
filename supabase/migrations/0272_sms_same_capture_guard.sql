-- S2c step 4 (invariant I5): the same capture is never booked twice, whatever capture id the phone sent.
--
-- sms_hash is the retry identity: the text plus the phone's capture id. A copy re-sent under a NEW capture id hashes
-- differently and used to be booked again. body_hash is the text alone, and captured_at is the capture time the
-- phone reported, so the pair identifies one capture with no time limit.

alter table public.sms_parse_log add column if not exists body_hash text;
alter table public.sms_parse_log add column if not exists captured_at timestamptz;

comment on column public.sms_parse_log.body_hash is
  'sha256 of the message text after trim, whitespace collapse and lowercase. Not tied to a capture id.';
comment on column public.sms_parse_log.captured_at is
  'The capture time the phone reported, cut to the second; null when it sent none. With body_hash it identifies one capture whatever capture id was sent, with no time limit.';

create unique index if not exists sms_parse_log_same_capture_idx
  on public.sms_parse_log (user_id, body_hash, captured_at)
  where is_duplicate = false and body_hash is not null and captured_at is not null;

-- Serves the possible-second-copy lookup (same user and text, received within minutes).
create index if not exists sms_parse_log_user_body_idx
  on public.sms_parse_log (user_id, body_hash, received_at)
  where body_hash is not null;
