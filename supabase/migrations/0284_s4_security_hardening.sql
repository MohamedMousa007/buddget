-- S4 closing batch (docs/launch/S4-security.md section 8). Three independent changes, each idempotent.

-- 1. Ingest tokens: hash column, phase 1 (additive). Lookup moves to token_hash; the plain `token` column is dropped
--    by a later migration once the code that reads the hash is deployed. Existing tokens keep working: their hash is
--    backfilled here. The trigger covers rows inserted by the code still deployed while this lands.
alter table public.sms_ingest_tokens add column if not exists token_hash text;
update public.sms_ingest_tokens
   set token_hash = encode(sha256(convert_to(token::text, 'utf8')), 'hex')
 where token_hash is null;
create unique index if not exists sms_ingest_tokens_token_hash_key on public.sms_ingest_tokens (token_hash);

create or replace function public.sms_ingest_token_fill_hash()
 returns trigger
 language plpgsql
 set search_path to 'public', 'pg_temp'
as $function$
begin
  if new.token_hash is null then
    new.token_hash := encode(sha256(convert_to(new.token::text, 'utf8')), 'hex');
  end if;
  return new;
end $function$;
drop trigger if exists sms_ingest_token_fill_hash on public.sms_ingest_tokens;
create trigger sms_ingest_token_fill_hash before insert on public.sms_ingest_tokens
  for each row execute function public.sms_ingest_token_fill_hash();

-- 2. Shared merchant categories: a single AI answer never replaces a seed row (it already never replaced a 'user'
--    row). Readers only trust 'seed' and 'user' rows, so an AI overwrite silently removed the seed for every user.
create or replace function public.upsert_merchant_category(p_key text, p_category expense_category, p_source text, p_sample text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
begin
  if p_category::text in ('Savings','ATM Cash Withdrawal','Transfer','Currency Exchange','CC Payoff','Top up','Installment') then
    return;
  end if;
  insert into merchant_categories (merchant_key, category, source, sample_merchant, hit_count, updated_at)
  values (p_key, p_category, p_source, p_sample, 1, now())
  on conflict (merchant_key) do update set
    category = case when merchant_categories.source in ('user', 'seed') and excluded.source not in ('user', 'seed')
                    then merchant_categories.category else excluded.category end,
    source   = case when merchant_categories.source in ('user', 'seed') and excluded.source not in ('user', 'seed')
                    then merchant_categories.source else excluded.source end,
    sample_merchant = case when merchant_categories.source in ('user', 'seed') and excluded.source not in ('user', 'seed')
                    then merchant_categories.sample_merchant else excluded.sample_merchant end,
    hit_count = merchant_categories.hit_count + 1,
    updated_at = now();
end $function$;

-- 3. Rate-limit counters: the cleanup removed every window older than an hour, so a daily window (86400 s) was
--    reset every ten minutes after its first hour. Keep counters for a day and an hour.
select cron.alter_job(
  (select jobid from cron.job where jobname = 'api-rate-cleanup'),
  command := $cmd$DELETE FROM public.api_rate_limits WHERE window_start < now() - interval '25 hours'$cmd$
);
