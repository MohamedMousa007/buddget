-- 0099 — capture user corrections as raw template signals.
--
-- ⚠️ The single most dangerous assumption in this whole feature is "a deleted SMS transaction
-- means the template got it wrong". It does not. `pairing.ts` soft-deletes the sibling expense
-- and income on EVERY successfully reconciled transfer, FX pair and CC payoff — that is correct
-- behaviour, and a naive trigger would fire on all of it, quarantining the templates that
-- worked perfectly. The same applies to its UPDATEs (`category = 'Transfer'`,
-- `payment_method_id = <funding>`).
--
-- The separator is `auth.uid()`: a service-role write (dispatch, running as the pipeline) has a
-- NULL uid, while a user's write through PostgREST carries their id. Every statement below is
-- gated on that, so the system's own bookkeeping can never accuse a template.

-- ---------------------------------------------------------------------------
-- Which fields count.
--
-- Only fields with ONE right answer, readable from the SMS itself. Category, description and
-- notes are deliberately absent: they are subjective, and a user renaming a merchant or
-- recategorising a coffee says nothing about whether the regex was correct. This is what stops
-- the signal set filling with preference noise.
--
-- `kind` and account last4 are not user-editable at all (the expense sheet exposes date,
-- description, amount, currency, category, payment method, notes) — `kind` is covered instead
-- by the direction-guard oracle, which is a system signal.
-- ---------------------------------------------------------------------------
create or replace function public.record_sms_template_signal()
returns trigger
language plpgsql
security definer
as $function$
declare
  v_uid uuid := auth.uid();
  v_template uuid;
  v_cfg record;
  v_today_count int;
  v_field text;
  v_old text;
  v_new text;
  v_old_date text;
  v_new_date text;
begin
  -- Q1/Q2 — the load-bearing guard. NULL uid = service role = the pipeline's own reconciliation
  -- (soft-deleting a paired sibling, retagging a transfer, back-filling a funding account).
  -- None of that is a user complaint.
  if v_uid is null then
    return NEW;
  end if;

  if NEW.sms_log_id is null then
    return NEW;
  end if;

  select matched_template_id into v_template from sms_parse_log where id = NEW.sms_log_id;
  -- Only a DB template can be blamed. A curated (code) or AI parse has no template row.
  if v_template is null then
    return NEW;
  end if;

  -- Q3 — undo. Restoring a soft-deleted row retracts the complaint: the user changed their
  -- mind, and an un-adjudicated delete signal must not outlive that.
  if OLD.deleted_at is not null and NEW.deleted_at is null then
    delete from sms_template_signals
     where template_id = v_template
       and sms_log_id = NEW.sms_log_id
       and signal_kind = 'delete'
       and verdict is null;
    return NEW;
  end if;

  -- Q4 — a bulk cleanup must not cascade into mass quarantine.
  select * into v_cfg from sms_promotion_config where id = 1;
  select count(*) into v_today_count
    from sms_template_signals
   where user_id = v_uid and created_at > now() - interval '1 day';
  if v_today_count >= coalesce(v_cfg.max_user_signals_per_day, 10) then
    return NEW;
  end if;

  if OLD.deleted_at is null and NEW.deleted_at is not null then
    insert into sms_template_signals (template_id, user_id, sms_log_id, signal_kind)
    values (v_template, v_uid, NEW.sms_log_id, 'delete')
    on conflict do nothing;
    return NEW;
  end if;

  -- The date column differs per table (expenses.expense_date / income_events.received_date).
  -- Read it via to_jsonb rather than NEW.<col>: plpgsql compiles the whole IF condition as a
  -- single SQL expression, so a direct reference to the OTHER table's column fails to resolve
  -- even when its TG_TABLE_NAME guard is false. With a direct reference every category rename
  -- raised "record NEW has no field received_date" and the user's edit failed outright.
  v_old_date := case TG_TABLE_NAME when 'expenses' then to_jsonb(OLD)->>'expense_date'
                                   else to_jsonb(OLD)->>'received_date' end;
  v_new_date := case TG_TABLE_NAME when 'expenses' then to_jsonb(NEW)->>'expense_date'
                                   else to_jsonb(NEW)->>'received_date' end;

  -- Objective-field edits. First difference wins — one edit is one complaint, however many
  -- fields moved in the same save.
  if NEW.amount is distinct from OLD.amount then
    v_field := 'amount'; v_old := OLD.amount::text; v_new := NEW.amount::text;
  elsif NEW.currency is distinct from OLD.currency then
    v_field := 'currency'; v_old := OLD.currency::text; v_new := NEW.currency::text;
  elsif v_new_date is distinct from v_old_date then
    v_field := 'date'; v_old := v_old_date; v_new := v_new_date;
  elsif NEW.payment_method_id is distinct from OLD.payment_method_id then
    v_field := 'payment_method'; v_old := OLD.payment_method_id::text; v_new := NEW.payment_method_id::text;
  else
    -- Category / description / notes only — subjective, never a signal.
    return NEW;
  end if;

  insert into sms_template_signals (template_id, user_id, sms_log_id, signal_kind, field, old_value, new_value)
  values (v_template, v_uid, NEW.sms_log_id, 'objective_edit', v_field, v_old, v_new)
  on conflict do nothing;

  return NEW;
end;
$function$;

drop trigger if exists sms_signal_on_expense_update on expenses;
create trigger sms_signal_on_expense_update
  after update on expenses
  for each row
  execute function record_sms_template_signal();

drop trigger if exists sms_signal_on_income_update on income_events;
create trigger sms_signal_on_income_update
  after update on income_events
  for each row
  execute function record_sms_template_signal();

-- ---------------------------------------------------------------------------
-- Signals ready for adjudication.
--
-- Two gates before an AI call is spent: enough raw signals on one template, and old enough that
-- an undo would already have retracted them (Q3). Returns whole templates, since the whole
-- point is to adjudicate a template's signals together rather than one at a time.
-- ---------------------------------------------------------------------------
create or replace function public.sms_templates_awaiting_adjudication(
  p_undo_grace_seconds int default 120
)
returns table (template_id uuid, pending int)
language sql
stable
security definer
as $function$
  select s.template_id, count(*)::int as pending
    from sms_template_signals s, sms_promotion_config c
   where s.verdict is null
     and s.created_at < now() - make_interval(secs => p_undo_grace_seconds)
   group by s.template_id, c.signals_before_adjudication
  having count(*) >= coalesce(c.signals_before_adjudication, 2);
$function$;
