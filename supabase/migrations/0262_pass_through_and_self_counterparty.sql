-- S2 slice 3 (docs/launch/S1-sms-audit.md 6a.2 and 6a.3). Additive.
-- income_events.exclusion: a received credit the user confirmed as pass-through money leaves income totals; the
-- account balance still counts it, and clearing the value counts it again (reversible per transaction).
-- sms_parse_log.counterparty_is_self: the result of comparing a transfer's counterparty with the user's own names,
-- done before masking. Only the boolean is stored.
alter table public.income_events add column if not exists exclusion text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'income_events_exclusion_check') then
    alter table public.income_events add constraint income_events_exclusion_check check (exclusion is null or exclusion in ('pass_through'));
  end if;
end $$;
comment on column public.income_events.exclusion is 'Why a received credit is left out of income totals. pass_through = the user confirmed the money only passed through them. The account balance still counts it.';
alter table public.sms_parse_log add column if not exists counterparty_is_self boolean;
comment on column public.sms_parse_log.counterparty_is_self is 'True when the transfer counterparty named in the message matched one of the user''s own names. Compared before masking; the name itself is not stored here.';
