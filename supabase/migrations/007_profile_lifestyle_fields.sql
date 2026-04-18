-- Progressive onboarding: persist lifestyle, household, rent + opt-out flags
-- on the profiles table. Drives the expanded first-run checklist (goals,
-- lifestyle, household cards) + the single-shot AI Build-My-Budget action.
--
-- All new columns are nullable so existing rows keep rendering with the same
-- dashboard behaviour as before the rollout.

alter table public.profiles
  add column if not exists household text,
  add column if not exists lifestyle_tier text,
  add column if not exists food_frequency text,
  add column if not exists transport_mode text,
  add column if not exists monthly_rent numeric,
  add column if not exists rent_includes_utilities boolean not null default false,
  add column if not exists no_goals_declared boolean not null default false;
