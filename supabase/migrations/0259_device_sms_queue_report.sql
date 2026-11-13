-- Each phone reports its on-device SMS queue (captured, not yet accepted by the server) so staff can see a stuck backlog.
-- Additive columns only; existing rows read as an empty queue.
-- ROLLBACK: alter table public.user_devices drop column sms_queue_pending, drop column sms_queue_oldest_at, drop column sms_last_result, drop column sms_queue_reported_at;
alter table public.user_devices
  add column if not exists sms_queue_pending integer not null default 0,
  add column if not exists sms_queue_oldest_at timestamptz,
  add column if not exists sms_last_result text,
  add column if not exists sms_queue_reported_at timestamptz;
