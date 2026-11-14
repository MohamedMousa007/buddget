-- S2 follow-up part 2 (docs/launch/S1-sms-audit.md 6c). Replaces one function; no table change.
-- A manual category edit teaches the merchant memory only when the row is a PURCHASE. On a transfer, a cash
-- withdrawal or a wallet movement the description is a person, a machine or the user's own wallet: nothing is
-- learned from it, and no key derived from a person's name is stored. Sharing across users stays at 5+ distinct
-- users agreeing (unchanged).
create or replace function public.remember_merchant_category_on_edit()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  key text;
  v_cat text;
  v_top int;
  v_second int;
  v_non_spend text[] := array['Savings','ATM Cash Withdrawal','Transfer','Currency Exchange','CC Payoff','Top up','Installment'];
begin
  if auth.uid() is null then return new; end if;
  if new.sms_log_id is null then return new; end if;
  if new.category is not distinct from old.category then return new; end if;
  if new.category = 'Other' then return new; end if;
  if new.category::text = any (v_non_spend) then return new; end if;
  if not exists (select 1 from sms_parse_log l
                  where l.id = new.sms_log_id and l.user_id = auth.uid()
                    and l.kind in ('purchase', 'online_purchase')) then
    return new;
  end if;
  key := regexp_replace(lower(coalesce(new.description, '')), '[^a-z0-9]', '', 'g');
  if length(key) < 3 then return new; end if;

  insert into merchant_category_overrides (user_id, merchant_key, category, updated_at)
  values (auth.uid(), key, new.category, now())
  on conflict (user_id, merchant_key) do update set category = excluded.category, updated_at = now();

  insert into merchant_category_votes (merchant_key, user_id, category, voted_at)
  values (key, auth.uid(), new.category, now())
  on conflict (merchant_key, user_id) do update set category = excluded.category, voted_at = now();

  with tally as (
    select v.category::text as category, count(*)::int as n, row_number() over (order by count(*) desc, v.category::text) as rn
      from merchant_category_votes v
      join auth.users u on u.id = v.user_id and u.created_at < now() - interval '7 days'
     where v.merchant_key = key
     group by v.category
  )
  select max(category) filter (where rn = 1), coalesce(max(n) filter (where rn = 1), 0), coalesce(max(n) filter (where rn = 2), 0)
    into v_cat, v_top, v_second from tally;
  if v_cat is null or v_top < 5 or v_top <= v_second then return new; end if;

  insert into merchant_categories (merchant_key, category, source, sample_merchant, hit_count, updated_at)
  values (key, v_cat::expense_category, 'user', key, 1, now())
  on conflict (merchant_key) do update
    set category = excluded.category, source = 'user',
        sample_merchant = excluded.sample_merchant,
        hit_count = merchant_categories.hit_count + 1, updated_at = now()
    where merchant_categories.source <> 'seed';
  return new;
end $function$;
