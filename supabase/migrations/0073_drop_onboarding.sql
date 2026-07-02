-- Removes the pre-launch onboarding flow's database footprint entirely.
-- Onboarding is being rebuilt from scratch later; no backward-compat shim.

drop table if exists public.onboarding_state;
drop table if exists public.onboarding_feedback;
drop type if exists public.onboarding_phase;

alter table public.profiles
  drop column if exists onboarding_completed,
  drop column if exists lite_mode,
  drop column if exists no_debts_declared,
  drop column if exists no_goals_declared;

alter table public.user_settings
  drop column if exists onboarding_checklist_hidden,
  drop column if exists dismiss_onboarding_banner,
  drop column if exists onboarding_banner_remind_at;
