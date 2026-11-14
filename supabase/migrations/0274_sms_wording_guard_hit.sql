-- S2c step 8e: count-only wording guard. A learned or curated template matched a message that carries a guard word
-- (declined, reversed, refund, rejected, "will be", due, and the Arabic equivalents) which the template's own sample
-- did not. Recorded per message so the hit rate can be read before anything is diverted. Additive, nullable, no default:
-- null = the guard did not fire (or the row predates it).
alter table public.sms_parse_log add column if not exists wording_guard_hit boolean;
comment on column public.sms_parse_log.wording_guard_hit is 'True when a template matched this message although it carries a wording-guard word the template sample did not. Count only; nothing is diverted on it.';
