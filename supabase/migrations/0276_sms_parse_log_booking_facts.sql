alter table public.sms_parse_log
  add column if not exists booked_day date,
  add column if not exists sms_flags text[],
  add column if not exists kind_source text;

comment on column public.sms_parse_log.booked_day is 'The day the parse resolved for the booking; /confirm books a held row on it.';
comment on column public.sms_parse_log.sms_flags is 'Server flags computed at parse time (possible_duplicate, date_unsure); /confirm stamps them on the row it books.';
comment on column public.sms_parse_log.kind_source is 'Where kind came from: code or model.';
