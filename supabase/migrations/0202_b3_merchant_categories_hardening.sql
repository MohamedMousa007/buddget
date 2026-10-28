-- 0202_b3_merchant_categories_hardening.sql  (QA round 2, B3/S1: I1/Q4, Q16)
--
-- DEPLOY ORDER: ADDITIVE tables + function rewrites that only TIGHTEN a write path nobody reads from the client.
-- Apply BEFORE or together with the code that reads merchant_category_overrides (src/lib/sms/merchantCategoryCache.ts
-- resolveMerchantCategory(service, merchant, userId)): the table must exist before that code runs, otherwise the
-- override lookup returns no row and falls back to the shared memory (it never throws). Safe for installed builds:
-- the trigger path is fired by their expense edits and keeps accepting them; it just stops publishing them globally.
-- Idempotent (IF NOT EXISTS / DROP POLICY IF EXISTS / CREATE OR REPLACE).
--
-- What changes:
--   * An expense category edit on an SMS-sourced row writes the editing user's own override (new table, RLS own rows).
--   * It reaches the shared merchant_categories only when >= 2 DISTINCT users currently vote the same category for the
--     merchant key (new votes table, no client access), never for a NON_SPEND category, never over a 'seed' row.
--   * The trigger and record_sms_template_signal() verify that new.sms_log_id belongs to auth.uid() (Q4/Q16): pointing
--     an expense at another user's parse log no longer poisons the shared table or that user's template signals.
--   * upsert_merchant_category() (AI/server path) refuses NON_SPEND categories as well.
-- Existing merchant_categories rows are NOT touched (no contributor data exists to corroborate them; they are grandfathered).
--
-- AUDIT BEFORE APPLY (SELECT only), measured 2026-10-28:
--   select count(*) from public.merchant_categories;                                  -- 124 (123 at plan time + 1 new)
--   select source, count(*) from public.merchant_categories group by 1;               -- seed/ai/user; user was 4
--   -- NON_SPEND rows already in the shared table (reported, NOT deleted by this file; owner decides):
--   select merchant_key, category, source, sample_merchant from public.merchant_categories
--    where category::text in ('Savings','ATM Cash Withdrawal','Transfer','Currency Exchange','CC Payoff','Top up','Installment'); -- 1 row: user/Transfer
--   select count(*) from pg_proc where proname in ('remember_merchant_category_on_edit','upsert_merchant_category','record_sms_template_signal'); -- 3 (one overload each)
-- Function bodies below start from pg_get_functiondef of the LIVE definitions (2026-10-28) plus the marked lines.

-- ---------------------------------------------------------------------------------------------------------------
-- 1. Per-user override (read first by the SMS category lookup) and the vote ledger used for corroboration.
-- ---------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.merchant_category_overrides (
  user_id      uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  merchant_key text NOT NULL,
  category     public.expense_category NOT NULL,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, merchant_key)
);
ALTER TABLE public.merchant_category_overrides ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS merchant_category_overrides_select_own ON public.merchant_category_overrides;
CREATE POLICY merchant_category_overrides_select_own ON public.merchant_category_overrides
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS merchant_category_overrides_delete_own ON public.merchant_category_overrides;
CREATE POLICY merchant_category_overrides_delete_own ON public.merchant_category_overrides
  FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);
-- Writes happen only in the definer trigger below. Default grants would expose a new public table to the anon key.
REVOKE ALL ON public.merchant_category_overrides FROM PUBLIC, anon, authenticated;
GRANT SELECT, DELETE ON public.merchant_category_overrides TO authenticated;

CREATE TABLE IF NOT EXISTS public.merchant_category_votes (
  merchant_key text NOT NULL,
  user_id      uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  category     public.expense_category NOT NULL,
  voted_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (merchant_key, user_id)
);
ALTER TABLE public.merchant_category_votes ENABLE ROW LEVEL SECURITY;  -- no policy: definer/service only
REVOKE ALL ON public.merchant_category_votes FROM PUBLIC, anon, authenticated;
CREATE INDEX IF NOT EXISTS merchant_category_votes_key_cat_idx ON public.merchant_category_votes (merchant_key, category);

-- ---------------------------------------------------------------------------------------------------------------
-- 2. I1 / Q4: the edit trigger.
-- ---------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.remember_merchant_category_on_edit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  key text;
  v_agree int;
  -- Mirrors src/lib/constants/categoryMeta.ts NON_SPEND_CATEGORIES: money movements are not merchant categories.
  v_non_spend text[] := array['Savings','ATM Cash Withdrawal','Transfer','Currency Exchange','CC Payoff','Top up','Installment'];
begin
  if auth.uid() is null then return new; end if;                 -- dispatch/service writes: skip
  if new.sms_log_id is null then return new; end if;             -- only SMS-sourced rows
  if new.category is not distinct from old.category then return new; end if;
  if new.category = 'Other' then return new; end if;             -- clearing to Other teaches nothing
  if new.category::text = any (v_non_spend) then return new; end if;                       -- I1: never a money movement
  if not exists (select 1 from sms_parse_log l                                             -- Q4: the log must be the caller's own
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

  select count(*) into v_agree from merchant_category_votes
   where merchant_key = key and category = new.category;
  if v_agree < 2 then return new; end if;                        -- I1: one user never rewrites the shared memory

  insert into merchant_categories (merchant_key, category, source, sample_merchant, hit_count, updated_at)
  values (key, new.category, 'user', new.description, 1, now())
  on conflict (merchant_key) do update
    set category = excluded.category, source = 'user',
        sample_merchant = excluded.sample_merchant,
        hit_count = merchant_categories.hit_count + 1, updated_at = now()
    where merchant_categories.source <> 'seed';                  -- curated seed rows are never overwritten by edits
  return new;
end $function$;
REVOKE ALL ON FUNCTION public.remember_merchant_category_on_edit() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- 3. upsert_merchant_category (AI / server path): same body as live plus the NON_SPEND refusal.
-- ---------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.upsert_merchant_category(p_key text, p_category expense_category, p_source text, p_sample text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if p_category::text in ('Savings','ATM Cash Withdrawal','Transfer','Currency Exchange','CC Payoff','Top up','Installment') then
    return;                                                       -- I1: never write a money movement to the shared table
  end if;
  insert into merchant_categories (merchant_key, category, source, sample_merchant, hit_count, updated_at)
  values (p_key, p_category, p_source, p_sample, 1, now())
  on conflict (merchant_key) do update set
    category = case when merchant_categories.source = 'user' and excluded.source <> 'user'
                    then merchant_categories.category else excluded.category end,
    source   = case when merchant_categories.source = 'user' and excluded.source <> 'user'
                    then 'user' else excluded.source end,
    sample_merchant = excluded.sample_merchant,
    hit_count = merchant_categories.hit_count + 1,
    updated_at = now();
end $function$;
REVOKE ALL ON FUNCTION public.upsert_merchant_category(text, expense_category, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_merchant_category(text, expense_category, text, text) TO service_role;

-- ---------------------------------------------------------------------------------------------------------------
-- 4. Q16: template signals only for the caller's own parse log. Live body + the marked ownership guard.
-- ---------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_sms_template_signal()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_template uuid; v_cfg record; v_today_count int;
  v_field text; v_old text; v_new text;
  v_old_date text; v_new_date text;
begin
  if v_uid is null then return NEW; end if;
  if NEW.sms_log_id is null then return NEW; end if;

  -- Q16: a client-settable sms_log_id must point at the caller's own parse log.
  select matched_template_id into v_template from sms_parse_log where id = NEW.sms_log_id and user_id = v_uid;
  if not found then return NEW; end if;

  if OLD.deleted_at is not null and NEW.deleted_at is null then
    delete from sms_template_signals
     where sms_log_id = NEW.sms_log_id
       and signal_kind = 'delete' and verdict is null
       and template_id is not distinct from v_template;
    return NEW;
  end if;

  select * into v_cfg from sms_promotion_config where id = 1;
  select count(*) into v_today_count from sms_template_signals
   where user_id = v_uid and created_at > now() - interval '1 day';
  if v_today_count >= coalesce(v_cfg.max_user_signals_per_day, 10) then return NEW; end if;

  if OLD.deleted_at is null and NEW.deleted_at is not null then
    insert into sms_template_signals (template_id, user_id, sms_log_id, signal_kind)
    values (v_template, v_uid, NEW.sms_log_id, 'delete') on conflict do nothing;
    return NEW;
  end if;

  v_old_date := case TG_TABLE_NAME when 'expenses' then to_jsonb(OLD)->>'expense_date'
                                   else to_jsonb(OLD)->>'received_date' end;
  v_new_date := case TG_TABLE_NAME when 'expenses' then to_jsonb(NEW)->>'expense_date'
                                   else to_jsonb(NEW)->>'received_date' end;

  if NEW.amount is distinct from OLD.amount then
    v_field := 'amount'; v_old := OLD.amount::text; v_new := NEW.amount::text;
  elsif NEW.currency is distinct from OLD.currency then
    v_field := 'currency'; v_old := OLD.currency::text; v_new := NEW.currency::text;
  elsif v_new_date is distinct from v_old_date then
    v_field := 'date'; v_old := v_old_date; v_new := v_new_date;
  elsif NEW.payment_method_id is distinct from OLD.payment_method_id then
    v_field := 'payment_method'; v_old := OLD.payment_method_id::text; v_new := NEW.payment_method_id::text;
  else
    return NEW;
  end if;

  insert into sms_template_signals (template_id, user_id, sms_log_id, signal_kind, field, old_value, new_value)
  values (v_template, v_uid, NEW.sms_log_id, 'objective_edit', v_field, v_old, v_new)
  on conflict do nothing;
  return NEW;
end;
$function$;
REVOKE ALL ON FUNCTION public.record_sms_template_signal() FROM PUBLIC, anon, authenticated;

-- POST-APPLY CHECKS (expect):
--   select count(*) from pg_proc where proname in ('remember_merchant_category_on_edit','upsert_merchant_category','record_sms_template_signal') group by proname having count(*) > 1; -- 0 rows
--   select relrowsecurity from pg_class where oid in ('public.merchant_category_overrides'::regclass,'public.merchant_category_votes'::regclass); -- t,t
--   select count(*) from public.merchant_categories; -- unchanged (124)
--   Behaviour: user A edits an SMS expense to Health -> 1 override row, 1 vote, merchant_categories unchanged;
--   user B same -> shared row written; edit to Transfer -> nothing written; sms_log_id of another user -> nothing written.
