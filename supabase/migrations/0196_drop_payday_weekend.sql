-- Per-employer weekend setting removed; paydays always shift Sat/Sun back to Friday.
alter table income_sources drop constraint if exists income_sources_payday_weekend_check;
alter table income_sources drop column if exists payday_weekend;
