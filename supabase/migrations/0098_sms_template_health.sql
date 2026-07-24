-- 0098 — template health: failure accounting, quarantine, raw signals, correction exemplars.
--
-- Quarantine is SHADOW MODE, not disablement: a quarantined template still matches, but its
-- result is not used — the SMS falls through to AI and the two are compared. Consecutive
-- agreements exonerate it; one disagreement retires it. That gives a wrongly-accused template a
-- way back with zero user friction, and costs a bounded number of AI calls.

-- Consecutive shadow-mode agreements while quarantined. Reset on exoneration; a single
-- disagreement retires the template instead of incrementing this.
alter table sms_tracking_templates_ai
  add column if not exists shadow_agreements integer not null default 0;

-- max_failure_rate shipped as 0.000, which made a SINGLE soft signal quarantine — collapsing
-- the hard/soft distinction the design depends on (hard = near-certain, acts immediately; soft
-- = a rate, needs a sample). 5% over a 5-match minimum gives soft signals real tolerance while
-- still reacting to a genuinely broken template.
update sms_promotion_config set max_failure_rate = 0.05 where id = 1 and max_failure_rate = 0;

-- ---------------------------------------------------------------------------
-- Raw user signals, recorded BEFORE adjudication.
--
-- A signal is not yet evidence. The AI adjudicator decides whether a user's edit meant "you
-- parsed this wrong" or merely "I prefer it this way", and only the former counts against the
-- template. Storing them unadjudicated lets us wait for the configured threshold before
-- spending an AI call on the question.
-- ---------------------------------------------------------------------------
create table if not exists sms_template_signals (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references sms_tracking_templates_ai(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  sms_log_id uuid references sms_parse_log(id) on delete set null,
  -- 'objective_edit' (amount/currency/date/payment method) | 'delete' | 'reported'
  signal_kind text not null,
  -- Which objective field changed, when the signal came from an edit.
  field text,
  old_value text,
  new_value text,
  -- Null until the adjudicator runs; then one of
  -- parse_error | not_transaction | user_preference | duplicate | unclear.
  verdict text,
  adjudicated_at timestamptz,
  created_at timestamptz not null default now(),
  constraint sms_template_signals_kind_check
    check (signal_kind in ('objective_edit', 'delete', 'reported')),
  constraint sms_template_signals_verdict_check
    check (verdict is null or verdict in ('parse_error', 'not_transaction', 'user_preference', 'duplicate', 'unclear'))
);

-- C6: one SMS edited twice must not look like two independent complaints.
create unique index if not exists sms_template_signals_dedupe_idx
  on sms_template_signals (template_id, sms_log_id, signal_kind)
  where sms_log_id is not null;

create index if not exists sms_template_signals_pending_idx
  on sms_template_signals (template_id) where verdict is null;

-- Q4: a bulk cleanup must not cascade into mass quarantine — the per-user daily cap is
-- enforced against this index.
create index if not exists sms_template_signals_user_day_idx
  on sms_template_signals (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Correction exemplars — the system's memory.
--
-- Retiring a template only disables the cached regex; the live AI has no memory and repeats the
-- same mistake on the next user's identical SMS. An exemplar is injected into future prompts for
-- the same body shape, so the error is not repeated.
--
-- Bodies are stored REDACTED: this table is read into prompts and surfaced in admin.
-- ---------------------------------------------------------------------------
create table if not exists sms_corrections (
  id uuid primary key default gen_random_uuid(),
  -- bodyShapeKey() from routingKey.ts — the same retrieval key the parse pipeline computes.
  body_shape_key text not null,
  redacted_body text not null,
  corrected_fields jsonb not null,
  source_template_id uuid references sms_tracking_templates_ai(id) on delete set null,
  -- C7: provenance + revocability, so a wrong "correction" cannot bias a shape forever.
  source_signal_id uuid references sms_template_signals(id) on delete set null,
  confidence numeric,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists sms_corrections_shape_idx
  on sms_corrections (body_shape_key) where revoked_at is null;

-- Service-role only, mirroring sms_parse_log: these are written by the pipeline, never by a
-- client, so there is deliberately no INSERT/UPDATE policy for authenticated users.
alter table sms_template_signals enable row level security;
alter table sms_corrections enable row level security;

drop policy if exists "own signals readable" on sms_template_signals;
create policy "own signals readable" on sms_template_signals
  for select using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Failure accounting + quarantine transition.
--
-- C5: absolute counters punish volume — a template with 1000 matches and 3 failures is not the
-- same as one with 5 matches and 3. Hard oracles (directionGuard override, zero-variance
-- amount) are near-certain and act on a single hit; soft signals are judged as a RATE and need
-- a minimum sample first.
-- ---------------------------------------------------------------------------
create or replace function public.bump_sms_template_failure(
  p_template_id uuid,
  p_hard boolean default false,
  p_reason text default null
)
returns text
language plpgsql
security definer
as $function$
declare
  t record;
  cfg record;
  rate numeric;
  should_quarantine boolean := false;
begin
  select * into t from sms_tracking_templates_ai where id = p_template_id;
  if not found then return 'not_found'; end if;

  -- Only an active template can degrade; retired/exported are terminal, and a quarantined one
  -- is already being adjudicated by the shadow comparison.
  if t.status <> 'active' then
    update sms_tracking_templates_ai
       set failure_count = failure_count + 1, updated_at = now()
     where id = p_template_id;
    return t.status;
  end if;

  update sms_tracking_templates_ai
     set failure_count = failure_count + 1,
         hard_fail = hard_fail or p_hard,
         updated_at = now()
   where id = p_template_id
  returning * into t;

  if p_hard then
    should_quarantine := true;
  else
    select * into cfg from sms_promotion_config where id = 1;
    if found and t.match_count >= cfg.min_matches_before_retire then
      rate := t.failure_count::numeric / greatest(t.match_count, 1)::numeric;
      should_quarantine := rate > cfg.max_failure_rate;
    end if;
  end if;

  if should_quarantine then
    update sms_tracking_templates_ai
       set status = 'quarantined',
           -- D5: remember the tier so exoneration restores reach rather than demoting.
           prev_tier = tier,
           quarantined_at = now(),
           updated_at = now()
     where id = p_template_id;
    return 'quarantined';
  end if;

  return 'active';
end;
$function$;

-- ---------------------------------------------------------------------------
-- Shadow-mode verdict for a quarantined template.
--
-- Called once per comparison against a live AI parse. N consecutive agreements restore the
-- template to its previous tier; a single disagreement retires it.
-- ---------------------------------------------------------------------------
create or replace function public.record_sms_template_shadow(
  p_template_id uuid,
  p_agreed boolean
)
returns text
language plpgsql
security definer
as $function$
declare
  t record;
  cfg record;
  agreements int;
begin
  select * into t from sms_tracking_templates_ai where id = p_template_id;
  if not found or t.status <> 'quarantined' then return 'skipped'; end if;

  if not p_agreed then
    update sms_tracking_templates_ai
       set status = 'retired', retired_at = now(), ai_enabled = false, updated_at = now()
     where id = p_template_id;
    return 'retired';
  end if;

  select * into cfg from sms_promotion_config where id = 1;
  agreements := coalesce(t.shadow_agreements, 0) + 1;
  update sms_tracking_templates_ai
     set shadow_agreements = agreements, updated_at = now()
   where id = p_template_id;

  if agreements >= coalesce(cfg.quarantine_exonerate_after, 3) then
    update sms_tracking_templates_ai
       set status = 'active',
           tier = coalesce(prev_tier, tier),
           prev_tier = null,
           shadow_agreements = 0,
           failure_count = 0,
           hard_fail = false,
           quarantined_at = null,
           updated_at = now()
     where id = p_template_id;
    return 'exonerated';
  end if;

  return 'quarantined';
end;
$function$;
