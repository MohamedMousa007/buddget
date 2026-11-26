-- 0349: a fixed goal contribution can be yearly (council 2026-11-26). Share and manual goals stay monthly.
-- Period keys: 'YYYY-MM' monthly, 'YYYY-Qn' quarterly, 'YYYY' yearly.
alter table public.goals drop constraint if exists goals_frequency_check;
alter table public.goals add constraint goals_frequency_check
  check (frequency in ('monthly', 'quarterly', 'yearly'));
