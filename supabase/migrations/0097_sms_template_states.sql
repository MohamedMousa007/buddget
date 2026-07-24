-- 0097 — SMS template lifecycle: trust tier + health status.
--
-- The promotion funnel has never done anything: a learned template is inserted
-- ai_enabled=true, GLOBAL, tried before the AI tier, at confidence 1.0 — fully trusted from
-- birth. `tier` is read by nothing (tryStaticParse filters on ai_enabled only), so promotion
-- relabels a template that already holds every privilege.
--
-- This splits the two questions that were conflated into one flag:
--   tier   = how WIDELY it applies      (template = author-scoped | curated_db = global)
--   status = whether it is TRUSTWORTHY  (active | quarantined | retired | exported)
--
-- Naming mirrors the product vocabulary: Fully Curated (code) -> Curated DB (global) ->
-- Template (supervised) -> AI - new SMS (no match).

-- ---------------------------------------------------------------------------
-- B1 — link a parse log row to the template that produced it.
--
-- `learn_template_id` is the template LEARNED FROM this SMS; `pattern_id` is set only for
-- code-pattern matches. Nothing recorded which DB template actually matched — the route
-- computed `matchedTemplateId`, used it for recordTemplateUser, then discarded it. Every
-- failure signal attributes through this column, so it must exist and be backfilled before
-- any signal work lands.
-- ---------------------------------------------------------------------------
alter table sms_parse_log
  add column if not exists matched_template_id uuid references sms_tracking_templates_ai(id) on delete set null;

create index if not exists sms_parse_log_matched_template_idx
  on sms_parse_log (matched_template_id) where matched_template_id is not null;

comment on column sms_parse_log.matched_template_id is
  'The DB template whose regex parsed this SMS (parse_method=template|curated_db). Distinct from learn_template_id, which is the template LEARNED FROM this SMS. Failure signals attribute through this column.';

-- Backfill: a template-parsed row can only have come from a template whose regex matches its
-- body. Where exactly one template matches, the attribution is unambiguous.
--
-- The patterns were authored for the JavaScript engine, so a construct Postgres ARE rejects
-- would raise and abort the whole migration. Each comparison is therefore guarded: an
-- unparseable pattern is skipped, leaving that row unattributed (which is the pre-migration
-- state anyway). Historical attribution is a convenience; new rows are stamped by the route.
do $$
declare
  log_row record;
  tpl record;
  hits uuid[];
begin
  for log_row in
    select id, raw_body from sms_parse_log
     where parse_method in ('template', 'promoted', 'static') and matched_template_id is null
  loop
    hits := '{}';
    for tpl in select id, regex_pattern from sms_tracking_templates_ai loop
      begin
        if log_row.raw_body ~ tpl.regex_pattern then
          hits := hits || tpl.id;
        end if;
      exception when others then
        -- JS-only regex construct; skip this pattern rather than fail the migration.
        null;
      end;
    end loop;
    if array_length(hits, 1) = 1 then
      update sms_parse_log set matched_template_id = hits[1] where id = log_row.id;
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Template tier + health
-- ---------------------------------------------------------------------------
alter table sms_tracking_templates_ai
  add column if not exists status text not null default 'active',
  -- Soft signal accumulation. Rate-based against match_count, never absolute: a template with
  -- 1000 matches and 3 failures is not the same as one with 5 matches and 3.
  add column if not exists failure_count integer not null default 0,
  -- Set by a hard oracle (directionGuard override, zero-variance amount). One hit is enough to
  -- quarantine regardless of volume, because these are near-certain.
  add column if not exists hard_fail boolean not null default false,
  -- D5: a curated_db template that quarantines and is later exonerated must return to
  -- curated_db, not drop to template.
  add column if not exists prev_tier text,
  -- Q5: behavioural merging must be SOFT. matched_template_id and sms_template_users reference
  -- these rows; a hard delete would orphan them.
  add column if not exists merged_into uuid references sms_tracking_templates_ai(id) on delete set null,
  add column if not exists quarantined_at timestamptz,
  add column if not exists retired_at timestamptz,
  add column if not exists exported_at timestamptz;

alter table sms_tracking_templates_ai
  drop constraint if exists sms_templates_status_check;
alter table sms_tracking_templates_ai
  add constraint sms_templates_status_check
  check (status in ('active', 'quarantined', 'retired', 'exported'));

-- ---------------------------------------------------------------------------
-- tier: learned|promoted -> template|curated_db
--
-- `tier` is plain text with a default (not a Postgres enum), so this is a value rename.
--
-- B3 — the 9 existing templates are GRANDFATHERED to curated_db. They each have only 1-2
-- contributors, and 11 log rows currently parse through them GLOBALLY. Mapping them to the new
-- author-scoped `template` tier would strand every non-contributor on the AI tier the moment
-- this deploys. Grandfathering grants reach, not immunity: they remain fully subject to failure
-- signals, quarantine and retirement.
-- ---------------------------------------------------------------------------
-- The original constraint is named `sms_tracking_templates_ai_tier_check` (auto-generated) and
-- pins tier to learned|promoted — it must be dropped BEFORE the value rename or the UPDATE
-- fails. Dropping the default too, so the rename isn't fighting `'learned'::text`.
alter table sms_tracking_templates_ai drop constraint if exists sms_tracking_templates_ai_tier_check;
alter table sms_tracking_templates_ai alter column tier drop default;

update sms_tracking_templates_ai
   set tier = case
     when tier = 'promoted' then 'curated_db'
     when tier = 'learned'  then 'curated_db'  -- grandfathered; see B3 above
     else tier
   end
 where tier in ('learned', 'promoted');

-- New templates start supervised (author-scoped) and must earn global reach.
alter table sms_tracking_templates_ai alter column tier set default 'template';

alter table sms_tracking_templates_ai
  drop constraint if exists sms_templates_tier_check;
alter table sms_tracking_templates_ai
  add constraint sms_templates_tier_check
  check (tier in ('template', 'curated_db'));

comment on column sms_tracking_templates_ai.tier is
  'Reach: template = author-scoped (supervised, applies only to contributors) | curated_db = global (trusted, applies to everyone).';
comment on column sms_tracking_templates_ai.status is
  'Health: active | quarantined (shadow mode - matches but result unused, AI decides) | retired (never matched) | exported (now lives in code).';

create index if not exists sms_templates_tier_status_idx
  on sms_tracking_templates_ai (tier, status) where merged_into is null;

-- ---------------------------------------------------------------------------
-- parse_method: name the four stages of the journey on the log too.
--   fully_curated (code) | curated_db (global DB) | template (author-scoped DB) | ai_new
--
-- The existing constraint pins it to ai|static|curated|template. The new constraint accepts
-- BOTH vocabularies: the data migrates now, the route starts writing the new values in the
-- same release, and any in-flight request mid-deploy is still valid either way.
-- ---------------------------------------------------------------------------
alter table sms_parse_log drop constraint if exists sms_parse_log_parse_method_check;
alter table sms_parse_log
  add constraint sms_parse_log_parse_method_check
  check (parse_method in (
    'fully_curated', 'curated_db', 'template', 'ai_new',
    'ai', 'static', 'curated'  -- legacy, still accepted during rollout
  ));

update sms_parse_log
   set parse_method = case parse_method
     when 'curated' then 'fully_curated'
     when 'static'  then 'template'
     when 'ai'      then 'ai_new'
     else parse_method
   end
 where parse_method in ('curated', 'static', 'ai');

-- ---------------------------------------------------------------------------
-- B2 — rewrite the eligibility RPC.
--
-- The old failure_rate correlated sms_parse_log.sender = t.sender. Template senders are ROUTING
-- KEYS ('HOTLINE-19888', 'BODY-<hash>') while log senders are the raw transport sender, so the
-- subquery matched ZERO rows and COALESCE returned 0 every time. For 'HSBC' it matched but
-- counted every HSBC log regardless of which template parsed it. The gate has never measured
-- anything. Attribution now runs through matched_template_id.
-- ---------------------------------------------------------------------------
create or replace function public.check_sms_promotion_eligibility()
returns table (
  template_id uuid,
  sender text,
  match_count integer,
  unique_user_count integer,
  age_days integer,
  failure_rate numeric,
  avg_ai_confidence numeric
)
language plpgsql
stable
security definer
as $function$
begin
  return query
  select
    t.id as template_id,
    t.sender,
    t.match_count,
    t.unique_user_count,
    extract(day from now() - t.created_at)::int as age_days,
    -- Failures attributed to THIS template, over the matches THIS template actually served.
    case when t.match_count > 0
         then round(t.failure_count::numeric / t.match_count::numeric, 4)
         else 0 end as failure_rate,
    coalesce(t.avg_ai_confidence, 1.0) as avg_ai_confidence
  from sms_tracking_templates_ai t, sms_promotion_config c
  where t.tier = 'template'          -- only a supervised template can be promoted
    and t.status = 'active'          -- Q7: never promote a quarantined/retired/exported row
    and t.merged_into is null        -- Q5: a merged sibling is not its own candidate
    and t.ai_enabled = true
    and t.match_count >= c.min_match_count
    and t.unique_user_count >= c.min_unique_users
    and extract(day from now() - t.created_at) >= c.min_age_days
    and coalesce(t.avg_ai_confidence, 1.0) >= c.min_avg_confidence
    and t.hard_fail = false
    and (case when t.match_count > 0
              then t.failure_count::numeric / t.match_count::numeric
              else 0 end) <= c.max_failure_rate;
end;
$function$;

-- ---------------------------------------------------------------------------
-- Retirement / promotion criteria live in the same config row.
-- ---------------------------------------------------------------------------
alter table sms_promotion_config
  -- Soft signals are a RATE, but a rate over 2 matches is noise. Minimum sample before any
  -- soft-signal retirement can fire.
  add column if not exists min_matches_before_retire integer not null default 5,
  -- Consecutive shadow agreements needed to exonerate a quarantined template.
  add column if not exists quarantine_exonerate_after integer not null default 3,
  -- Raw user signals on one template before the AI adjudicator is spent on them.
  add column if not exists signals_before_adjudication integer not null default 2,
  -- Q4: a bulk delete must not cascade into mass quarantine.
  add column if not exists max_user_signals_per_day integer not null default 10;

-- Multi-user validation is the whole point of the funnel; 1 was effectively no gate at all.
update sms_promotion_config set min_unique_users = greatest(min_unique_users, 3) where id = 1;
