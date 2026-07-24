-- 0102 — extend the correction loop to AI-only parses (no template yet).
--
-- The signal trigger returned early when matched_template_id was null, so an SMS parsed by the
-- AI tier — before any template exists for its shape — never produced a signal, never got
-- adjudicated, and never left a correction exemplar. The AI kept repeating the same mistake for
-- that shape, which is exactly the "AI has no memory" problem exemplars were meant to solve.
--
-- A null-template signal blames no template (there is none) — its only product is a correction
-- exemplar keyed by body shape, which then guides future AI parses of that shape.

-- template_id becomes nullable: an AI-only signal has no template to attribute to.
alter table sms_template_signals alter column template_id drop not null;

-- The existing dedup index keys on (template_id, sms_log_id, signal_kind). Postgres treats NULLs
-- as distinct in a unique index, so it does not dedup null-template rows. A companion partial
-- index dedups them on (sms_log_id, signal_kind).
create unique index if not exists sms_template_signals_null_tpl_dedupe_idx
  on sms_template_signals (sms_log_id, signal_kind)
  where template_id is null and sms_log_id is not null;

-- ---------------------------------------------------------------------------
-- Trigger: record a null-template signal for AI-only rows instead of bailing.
-- ---------------------------------------------------------------------------
create or replace function public.record_sms_template_signal()
returns trigger language plpgsql security definer as $function$
declare
  v_uid uuid := auth.uid();
  v_template uuid; v_cfg record; v_today_count int;
  v_field text; v_old text; v_new text;
  v_old_date text; v_new_date text;
begin
  if v_uid is null then return NEW; end if;
  if NEW.sms_log_id is null then return NEW; end if;

  -- v_template may be NULL — an AI-parsed row with no template. That is no longer an early exit;
  -- the signal is still recorded (with a null template_id) so the correction loop can build an
  -- exemplar for this message shape.
  select matched_template_id into v_template from sms_parse_log where id = NEW.sms_log_id;

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
