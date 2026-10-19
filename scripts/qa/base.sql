-- QA-only scaffolding: just enough of Supabase's auth schema and roles for the admin migrations to run locally.
do $$ begin
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
exception when duplicate_object then null; end $$;
create schema if not exists auth;
-- Supabase grants every API role access to new public objects by default; the admin migrations then revoke what they must.
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  phone text,
  created_at timestamptz not null default now(),
  last_sign_in_at timestamptz,
  email_confirmed_at timestamptz,
  banned_until timestamptz,
  raw_app_meta_data jsonb not null default '{}'
);
create table if not exists auth.identities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null
);
grant usage on schema auth to service_role;
create or replace function public.api_rate_hit(p_key text, p_window_seconds integer, p_max_hits integer) returns boolean
language plpgsql security definer set search_path to 'public' as $function$
declare
  v_bucket timestamptz := date_trunc('second', now()) - make_interval(secs => mod(extract(epoch from now())::int, p_window_seconds));
  v_hits int;
begin
  insert into public.api_rate_limits(key, window_start, hits) values (p_key, v_bucket, 1)
  on conflict (key, window_start) do update set hits = api_rate_limits.hits + 1 returning hits into v_hits;
  delete from public.api_rate_limits where window_start < now() - interval '1 hour';
  return v_hits <= p_max_hits;
end; $function$;
create or replace function public.check_sms_promotion_eligibility()
returns table(template_id uuid, sender text, match_count integer, unique_user_count integer, age_days integer, failure_rate numeric, avg_ai_confidence numeric)
language plpgsql stable as $f$
begin return query select t.id, t.sender, t.match_count, t.unique_user_count, 0, 0::numeric, 1::numeric from sms_tracking_templates_ai t where t.tier = 'learned'; end $f$;
