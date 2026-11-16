-- Login brute-force limit, enforced inside Supabase Auth (the browser calls auth directly with the public anon key,
-- so an app-side limit could be skipped). Wired in the dashboard: Auth > Hooks > Password verification attempt >
-- Postgres function private.hook_password_verification_attempt.
--
-- 5 failed password attempts per account in a rolling minute lock that account's password sign-in for the rest of
-- the minute, valid password included. A correct password clears the count. Known limit: someone can keep a victim
-- locked by failing 5 times a minute; the email-code sign-in path stays open for them.
-- Table and function live in `private` (not exposed by the API), so database.types.ts does not change.

create table if not exists private.auth_password_failures (
  user_id uuid primary key,
  fail_count int not null,
  window_started_at timestamptz not null
);

create or replace function private.hook_password_verification_attempt(event jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (event ->> 'user_id')::uuid;
  max_fails constant int := 5;
  win constant interval := interval '1 minute';
  rec private.auth_password_failures;
begin
  select * into rec from private.auth_password_failures where user_id = uid;
  if found and rec.window_started_at > now() - win and rec.fail_count >= max_fails then
    return jsonb_build_object('decision', 'reject', 'message', 'Too many attempts. Try again in a minute.', 'should_logout_user', false);
  end if;

  if (event ->> 'valid')::boolean then
    delete from private.auth_password_failures where user_id = uid;
    return jsonb_build_object('decision', 'continue');
  end if;

  insert into private.auth_password_failures as f (user_id, fail_count, window_started_at)
  values (uid, 1, now())
  on conflict (user_id) do update set
    fail_count = case when f.window_started_at > now() - win then f.fail_count + 1 else 1 end,
    window_started_at = case when f.window_started_at > now() - win then f.window_started_at else now() end;
  return jsonb_build_object('decision', 'continue');
end $$;

grant usage on schema private to supabase_auth_admin;
revoke all on private.auth_password_failures from public, anon, authenticated;
revoke execute on function private.hook_password_verification_attempt(jsonb) from public, anon, authenticated;
grant execute on function private.hook_password_verification_attempt(jsonb) to supabase_auth_admin;
