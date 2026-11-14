-- S2 slice 5 (docs/launch/S1-sms-audit.md RC-E). Additive.
-- shape_key: a coarse shape of the message (sender key, leading wording, number of numeric slots), hashed. It groups
--   the messages of one template whatever merchant or amount they carry (the fine skeleton key varies with both).
-- The hash index on masked_body serves the negative cache: an exact masked shape the AI already rejected twice, and
--   never parsed, is rejected without another AI call.
alter table public.sms_parse_log add column if not exists shape_key text;
comment on column public.sms_parse_log.shape_key is 'Coarse shape of the message (sender key, leading wording, number of numeric slots), hashed. Groups messages of one template whatever merchant or amount they carry.';
create index if not exists sms_parse_log_shape_key on public.sms_parse_log (shape_key) where shape_key is not null;
create index if not exists sms_parse_log_masked_body_hash on public.sms_parse_log using hash (masked_body) where masked_body is not null;
