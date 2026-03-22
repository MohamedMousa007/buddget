-- Buddget: user finance blob, profiles, analytics, onboarding survey
-- Run this in Supabase SQL Editor (or supabase db push) once per project.

-- ---------------------------------------------------------------------------
-- user_profiles (onboarding flag + optional display name)
-- ---------------------------------------------------------------------------
create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  onboarding_completed boolean not null default false,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_profiles enable row level security;

create policy "user_profiles_select_own"
  on public.user_profiles for select
  using (auth.uid() = user_id);

create policy "user_profiles_insert_own"
  on public.user_profiles for insert
  with check (auth.uid() = user_id);

create policy "user_profiles_update_own"
  on public.user_profiles for update
  using (auth.uid() = user_id);

-- Auto-create profile row for new auth users
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill profiles for users created before this migration
insert into public.user_profiles (user_id)
select id from auth.users
on conflict (user_id) do nothing;

-- ---------------------------------------------------------------------------
-- user_finance (JSON blob — same shape as Buddget export)
-- ---------------------------------------------------------------------------
create table if not exists public.user_finance (
  user_id uuid primary key references auth.users (id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_finance enable row level security;

create policy "user_finance_select_own"
  on public.user_finance for select
  using (auth.uid() = user_id);

create policy "user_finance_insert_own"
  on public.user_finance for insert
  with check (auth.uid() = user_id);

create policy "user_finance_update_own"
  on public.user_finance for update
  using (auth.uid() = user_id);

create policy "user_finance_delete_own"
  on public.user_finance for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- app_analytics_events (heartbeats, session, login — RLS insert own only)
-- ---------------------------------------------------------------------------
create table if not exists public.app_analytics_events (
  id bigserial primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists app_analytics_events_user_id_created_at_idx
  on public.app_analytics_events (user_id, created_at desc);

alter table public.app_analytics_events enable row level security;

-- Cap insert spam: max 60 rows per user per rolling minute (tunable)
create policy "analytics_insert_own_rate_limited"
  on public.app_analytics_events for insert
  with check (
    auth.uid() = user_id
    and (
      select count(*)::int
      from public.app_analytics_events e
      where e.user_id = auth.uid()
        and e.created_at > now() - interval '1 minute'
    ) < 60
  );

-- No select for end users — admin reads via service role

-- ---------------------------------------------------------------------------
-- onboarding_survey_config (published readable by authenticated users)
-- ---------------------------------------------------------------------------
create table if not exists public.onboarding_survey_config (
  id uuid primary key default gen_random_uuid(),
  version int not null default 1,
  published boolean not null default false,
  config jsonb not null default '{"steps":[]}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.onboarding_survey_config enable row level security;

create policy "onboarding_survey_select_published"
  on public.onboarding_survey_config for select
  to authenticated
  using (published = true);

-- Writes only via service role (no insert/update policies for authenticated)

-- Seed default published survey once (safe to re-run migration script)
insert into public.onboarding_survey_config (version, published, config)
select
  1,
  true,
  $json$
  {
    "steps": [
      {
        "id": "welcome",
        "type": "static",
        "title": "Welcome to Buddget",
        "body": "A quick setup so your dashboard matches how you earn and spend."
      },
      {
        "id": "display_name",
        "type": "text",
        "title": "What should we call you?",
        "placeholder": "Your name",
        "mapsTo": "profile.name",
        "maxLength": 80
      },
      {
        "id": "base_currency",
        "type": "single_select",
        "title": "Primary currency",
        "mapsTo": "settings.baseCurrency",
        "options": [
          { "value": "AED", "label": "AED — UAE Dirham" },
          { "value": "USD", "label": "USD — US Dollar" },
          { "value": "EGP", "label": "EGP — Egyptian Pound" },
          { "value": "EUR", "label": "EUR — Euro" },
          { "value": "GBP", "label": "GBP — British Pound" },
          { "value": "SAR", "label": "SAR — Saudi Riyal" }
        ]
      },
      {
        "id": "secondary_currency",
        "type": "single_select",
        "title": "Also track amounts in…",
        "mapsTo": "settings.secondaryCurrency",
        "options": [
          { "value": "none", "label": "No secondary currency" },
          { "value": "AED", "label": "AED" },
          { "value": "USD", "label": "USD" },
          { "value": "EGP", "label": "EGP" },
          { "value": "EUR", "label": "EUR" },
          { "value": "GBP", "label": "GBP" },
          { "value": "SAR", "label": "SAR" }
        ]
      },
      {
        "id": "income_quick",
        "type": "static",
        "title": "Income & budgets",
        "body": "You can add income sources and budget lines anytime from the app. Continue when you're ready."
      },
      {
        "id": "done",
        "type": "static",
        "title": "You're set",
        "body": "We'll open your dashboard. You can import a backup from Settings anytime."
      }
    ]
  }
  $json$::jsonb
where not exists (select 1 from public.onboarding_survey_config where published = true);

comment on table public.user_finance is 'Per-user finance state JSON (Buddget export shape)';
comment on table public.app_analytics_events is 'Client analytics; admin reads with service role';
comment on table public.onboarding_survey_config is 'Published survey visible to authenticated users';
