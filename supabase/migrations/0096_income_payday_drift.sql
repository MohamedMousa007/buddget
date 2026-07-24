-- 0096 — per-source payday drift tolerance.
--
-- Not every employer pays on the same day. A payroll platform (Deel, Wise, Payoneer) credits
-- on schedule but the bank wire lands whenever the transfer clears; smaller employers simply
-- pay "around the 25th". One number covers both: how many days a paycheck may drift from its
-- scheduled payday and still be the same paycheck.
--
-- Two readers:
--   * matchSalary — how far to look for the payday an SMS credit fulfils (still bounded by
--     half the gap between paydays, so a weekly salary can never match ambiguously).
--   * incomeOccurrences.pendingStatus — how long an unpaid payday stays "late" before it
--     displays as "missed".
--
-- NULL = use the app default (7 days matching, 5 days before missed), which is every existing row.

alter table income_sources
  add column if not exists payday_drift_days integer;

alter table income_sources
  drop constraint if exists income_sources_payday_drift_days_check;

alter table income_sources
  add constraint income_sources_payday_drift_days_check
  check (payday_drift_days is null or (payday_drift_days >= 0 and payday_drift_days <= 31));

comment on column income_sources.payday_drift_days is
  'Days a paycheck may drift from its scheduled payday and still count as that payday. NULL = app default (7 match / 5 before missed). Read by matchSalary and pendingStatus.';
