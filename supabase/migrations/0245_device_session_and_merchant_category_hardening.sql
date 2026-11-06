-- QA6 AUT-8 + DBS-4.
--
-- AUT-8: "Remove this phone" must end that phone's Auth session. user_devices gets session_id (the Auth session the phone's
-- heartbeat arrived on, recorded from the JWT `session_id` claim going forward); revoke_auth_session deletes exactly that
-- auth.sessions row (auth.refresh_tokens cascade on delete), service role only. Devices registered before this migration have a
-- NULL session_id until their next heartbeat: removing one of those cannot end its session (the user must change the password,
-- which signs out every other session).
--
-- DBS-4: merchant_categories is the GLOBAL merchant->category memory. A category now becomes global only when >= 5 distinct accounts
-- that are at least 7 days old agree and the winner leads the runner-up; the free-text description is never copied (the normalised
-- key is stored as sample_merchant); the table is no longer readable by anon/authenticated (every reader uses the service role).
--
-- BEFORE (SELECT): select count(*) from merchant_categories where source = 'user';  -- 4
-- ROLLBACK: alter table user_devices drop column session_id; drop function public.revoke_auth_session(uuid, uuid);
--           grant select on merchant_categories to anon, authenticated; recreate remember_merchant_category_on_edit from 0138.

ALTER TABLE public.user_devices ADD COLUMN IF NOT EXISTS session_id uuid;

CREATE OR REPLACE FUNCTION public.revoke_auth_session(p_user uuid, p_session uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE n integer;
BEGIN
  DELETE FROM auth.sessions WHERE id = p_session AND user_id = p_user;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $function$;
REVOKE ALL ON FUNCTION public.revoke_auth_session(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_auth_session(uuid, uuid) TO service_role;

REVOKE ALL ON public.merchant_categories FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.remember_merchant_category_on_edit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
                  where l.id = new.sms_log_id and l.user_id = auth.uid()) then
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

  -- One vote per account (primary key), only from accounts at least 7 days old; the leading category needs 5 voters and a strict lead.
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

UPDATE public.merchant_categories SET sample_merchant = merchant_key WHERE source = 'user';
