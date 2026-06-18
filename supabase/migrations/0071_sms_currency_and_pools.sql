-- Per-(user,sender) learned currency + global keyword/sender frequency pools.
-- Additive only; service-role written (no client RLS policies — only the parse/
-- confirm API routes touch these via the service role).

create table if not exists public.sms_sender_currency (
  user_id uuid not null references auth.users(id) on delete cascade,
  sender text not null,
  currency currency_code not null,
  confirmed boolean not null default false,
  hit_count integer not null default 1,
  updated_at timestamptz not null default now(),
  primary key (user_id, sender)
);

create table if not exists public.sms_keyword_pool (
  keyword text primary key,
  lang text,
  hit_count integer not null default 1,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now()
);

create table if not exists public.sms_sender_pool (
  sender text primary key,
  hit_count integer not null default 1,
  txn_count integer not null default 0,
  last_seen timestamptz not null default now()
);

alter table public.sms_sender_currency enable row level security;
alter table public.sms_keyword_pool enable row level security;
alter table public.sms_sender_pool enable row level security;
-- No policies = service role only (bypasses RLS); clients have no access.

-- Atomic upserts so concurrent parses can't lose a +1.
create or replace function public.bump_sms_keyword(p_keyword text, p_lang text)
returns void language sql as $$
  insert into public.sms_keyword_pool (keyword, lang)
  values (p_keyword, p_lang)
  on conflict (keyword) do update
    set hit_count = public.sms_keyword_pool.hit_count + 1,
        last_seen = now(),
        lang = coalesce(public.sms_keyword_pool.lang, excluded.lang);
$$;

create or replace function public.bump_sms_sender(p_sender text, p_is_txn boolean)
returns void language sql as $$
  insert into public.sms_sender_pool (sender, txn_count)
  values (p_sender, case when p_is_txn then 1 else 0 end)
  on conflict (sender) do update
    set hit_count = public.sms_sender_pool.hit_count + 1,
        txn_count = public.sms_sender_pool.txn_count + (case when p_is_txn then 1 else 0 end),
        last_seen = now();
$$;

create or replace function public.learn_sms_sender_currency(
  p_user uuid, p_sender text, p_currency currency_code, p_confirmed boolean
) returns void language sql as $$
  insert into public.sms_sender_currency (user_id, sender, currency, confirmed)
  values (p_user, p_sender, p_currency, p_confirmed)
  on conflict (user_id, sender) do update
    set hit_count = public.sms_sender_currency.hit_count + 1,
        updated_at = now(),
        -- A confirmed mapping is sticky; only overwrite currency when confirming,
        -- or while still unconfirmed (refine the guess).
        currency = case
          when p_confirmed then p_currency
          when public.sms_sender_currency.confirmed then public.sms_sender_currency.currency
          else p_currency end,
        confirmed = public.sms_sender_currency.confirmed or p_confirmed;
$$;

create or replace function public.get_sms_keyword_pool(top_n integer default 200)
returns table (keyword text, lang text, hit_count integer) language sql stable as $$
  select keyword, lang, hit_count
  from public.sms_keyword_pool
  order by hit_count desc
  limit greatest(1, top_n);
$$;
