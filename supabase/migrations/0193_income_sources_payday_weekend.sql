-- 0193 — per-source employer weekend for payday shifting.
-- Egyptian employers/banks: Fri+Sat off; US/remote employers: Sat+Sun. Default keeps today's behaviour.
alter table income_sources
  add column if not exists payday_weekend text default 'sat_sun';

alter table income_sources
  drop constraint if exists income_sources_payday_weekend_check;

alter table income_sources
  add constraint income_sources_payday_weekend_check
  check (payday_weekend is null or payday_weekend in ('sat_sun', 'fri_sat'));

comment on column income_sources.payday_weekend is
  'Employer weekend used to shift paydays back to a working day: sat_sun (default) or fri_sat (Egypt).';
