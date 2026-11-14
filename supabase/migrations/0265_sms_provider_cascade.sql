-- S2 follow-up part 1 (docs/launch/S1-sms-audit.md 6c): naming the bank of a message that came with no sender. Additive.
-- bank_source     which stage named the bank (sender, pattern, body, history, format); null = no trusted source.
-- format_key      a sender-free coarse shape, the same on Android (sender known) and iPhone (no sender).
-- bank_suggestion a bank that was only suggested (format memory below its threshold, or the AI's guess); never applied.
alter table public.sms_parse_log add column if not exists bank_source text;
alter table public.sms_parse_log add column if not exists format_key text;
alter table public.sms_parse_log add column if not exists bank_suggestion text;
comment on column public.sms_parse_log.bank_source is 'Which stage named the bank: sender, pattern (code-shipped pattern), body (name or hotline printed in the message), history (same user, same digits, one bank), format (cross-user format memory). Null = no trusted source; an AI guess is never a source.';
comment on column public.sms_parse_log.format_key is 'Sender-free coarse shape of the message. The same for one bank format on Android (sender known) and iPhone (no sender), so formats can be mapped to banks.';
comment on column public.sms_parse_log.bank_suggestion is 'A bank that was only suggested (format memory below its threshold, or the AI''s guess). Never applied; it pre-fills the question put to the user.';
create index if not exists sms_parse_log_format_key on public.sms_parse_log (format_key) where format_key is not null;
create index if not exists sms_parse_log_user_tail on public.sms_parse_log (user_id, account_last4) where account_last4 is not null;
