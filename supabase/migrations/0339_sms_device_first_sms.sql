-- BDG-008 (plan 1.5): "verified" is its own fact. user_devices.first_sms_at = when the first SMS from this phone reached
-- the server (a claimed sms_parse_log row). The parse route sets it once, next to last_sms_at, and never moves it.
-- Backfill: the earliest log row per (user_id, device_id), refusal rows excluded (ingestRefusal.ts writes them before any
-- claim, so they prove nothing). Keyset batches of 500 devices under a short statement timeout; each lookup is an index
-- scan on sms_parse_log_device_idx (EXPLAIN on live, 2026-11-20).
-- Re-runnable: only rows still null are touched. Run the DO block again after the route change deploys, for phones that
-- delivered between this apply and that deploy.
-- user_devices is service-role only (0179); the new column needs no policy or grant.

alter table public.user_devices add column if not exists first_sms_at timestamptz;

set statement_timeout = '15s';

do $$
declare
  cur_user uuid := '00000000-0000-0000-0000-000000000000';
  cur_device text := '';
  users uuid[];
  devices text[];
begin
  loop
    select array_agg(user_id order by user_id, device_id), array_agg(device_id order by user_id, device_id)
      into users, devices
    from (
      select user_id, device_id from public.user_devices
      where (user_id, device_id) > (cur_user, cur_device)
      order by user_id, device_id
      limit 500
    ) b;
    exit when users is null;

    update public.user_devices d set first_sms_at = (
      select min(l.received_at) from public.sms_parse_log l
      where l.user_id = d.user_id and l.device_id = d.device_id
        and coalesce(l.failure_code, '') not in ('device_blocked', 'invalid_body', 'invalid_json')
    )
    from unnest(users, devices) as k(user_id, device_id)
    where d.user_id = k.user_id and d.device_id = k.device_id and d.first_sms_at is null;

    cur_user := users[array_length(users, 1)];
    cur_device := devices[array_length(devices, 1)];
    exit when array_length(users, 1) < 500;
  end loop;
end $$;

reset statement_timeout;
