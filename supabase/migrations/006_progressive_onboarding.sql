-- Progressive-onboarding checklist: cross-device flags for "I have no debts"
-- and "hide the first-run checklist". Both are synced so the state follows the
-- user between devices.
--
-- Nullable-safe: both columns default to false so existing rows continue to
-- render the checklist with all four items unchecked, matching the pre-rollout
-- behaviour.

alter table public.user_settings
  add column if not exists onboarding_checklist_hidden boolean not null default false;

alter table public.profiles
  add column if not exists no_debts_declared boolean not null default false;
