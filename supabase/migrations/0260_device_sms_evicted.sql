-- Phones report how many queued SMS the on-device cap evicted, so staff see loss the moment it happens.
-- Additive column; existing rows read 0.
-- ROLLBACK: alter table public.user_devices drop column sms_evicted_count;
alter table public.user_devices add column if not exists sms_evicted_count integer not null default 0;
