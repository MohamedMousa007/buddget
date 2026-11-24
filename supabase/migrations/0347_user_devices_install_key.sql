-- BUD-107: a reinstall made a second phone row. Each install now reports an install_key that survives reinstall
-- (iOS: a ThisDeviceOnly Keychain item; Android: SHA-256 of "buddget:" + ANDROID_ID, never the raw id). A new device_id
-- arriving with the install_key of a live row is the same phone: devices_supersede moves its roles onto the new row and
-- hard-deletes the old one (never revokes it: a revoked row trips the hasRevokedDevice gates and would lock the user out).
-- Revoked rows are never matched, so a removed phone that signs in again still registers as a new phone.

alter table public.user_devices add column if not exists install_key text
  check (install_key is null or install_key ~ '^[0-9a-f]{64}$');

create unique index if not exists user_devices_install_key_idx
  on public.user_devices (user_id, install_key)
  where revoked_at is null and install_key is not null;

create or replace function public.devices_supersede(p_user uuid, p_old text, p_new text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  o public.user_devices%rowtype;
begin
  if p_old = p_new then return false; end if;
  select * into o from public.user_devices where user_id = p_user and device_id = p_old and revoked_at is null for update;
  if not found then return false; end if;
  perform 1 from public.user_devices where user_id = p_user and device_id = p_new and revoked_at is null for update;
  if not found then return false; end if;

  -- One-main index: the old row lets go before the new one takes over.
  update public.user_devices set is_main = false where user_id = p_user and device_id = p_old;
  update public.user_devices
     set name = coalesce(o.name, name),
         notify = o.notify,
         collects_sms = o.collects_sms,
         is_main = is_main or o.is_main
   where user_id = p_user and device_id = p_new;

  delete from public.push_tokens where user_id = p_user and device_id = p_old;
  delete from public.trusted_devices where user_id = p_user and device_id::text = p_old;
  update public.sms_ingest_tokens set is_active = false where user_id = p_user and device_id = p_old and is_active;
  delete from public.user_devices where user_id = p_user and device_id = p_old;

  -- The key moves last: the unique index allows one live row per key.
  update public.user_devices set install_key = coalesce(install_key, o.install_key) where user_id = p_user and device_id = p_new;
  return true;
end;
$$;

revoke all on function public.devices_supersede(uuid, text, text) from public, anon, authenticated;
grant execute on function public.devices_supersede(uuid, text, text) to service_role;

-- One-off: the two reinstall duplicates measured on live 2026-11-24, named by id (model is the user agent, so grouping
-- by it could match two real phones). Each old row went silent before its replacement first appeared; the guard
-- re-checks that, and the RPC returns false once a row is gone, so a re-run changes nothing.
do $$
declare r record;
begin
  for r in
    select o.user_id, o.device_id as old_id, n.device_id as new_id
      from (values
        ('1f0b4fcb-70f6-430c-bb03-914db6a6244c'::uuid, 'dc8267f8-8067-459d-a45e-c1e792fa13cf', 'e16232b6-ae4a-4329-80e4-0606645af6cd'),
        ('6090c8e7-b162-4508-8c41-2d2985b3936c'::uuid, '87845af6-104f-42e3-8118-018e84882f4d', '8efdda72-d120-447d-9cf8-5e4df56aae32')
      ) as v(user_id, old_id, new_id)
      join public.user_devices o on o.user_id = v.user_id and o.device_id = v.old_id and o.revoked_at is null
      join public.user_devices n on n.user_id = v.user_id and n.device_id = v.new_id and n.revoked_at is null
     where o.last_seen_at < n.created_at
  loop
    perform public.devices_supersede(r.user_id, r.old_id, r.new_id);
  end loop;
end $$;
