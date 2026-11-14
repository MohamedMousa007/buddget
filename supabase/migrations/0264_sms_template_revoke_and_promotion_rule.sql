-- S2 follow-up part 3 (docs/launch/S1-sms-audit.md 6c).
-- 1. template_revoked_at: set on the rows a learned template parsed when staff demote it or switch it off, so the
--    transactions it created can be looked at again. Additive.
-- 2. Promotion rule: the hard-coded floor of 5 distinct users becomes 2, and a template with any recorded failure is
--    never eligible. Auto-promotion still runs the replay gate in the application (promotionChecker.ts).
-- 3. sms_promotion_candidates(): a single-user template (15+ matches, zero failures, 14+ days) is never promoted
--    automatically. It is listed for staff, who approve it in the admin SMS views after the replay passes.
-- 4. The config row moves from 5 to 2 users to match.
alter table public.sms_parse_log add column if not exists template_revoked_at timestamptz;
comment on column public.sms_parse_log.template_revoked_at is 'Set when the learned template that parsed this row was demoted or switched off by staff: the transaction it created needs a second look.';
create index if not exists sms_parse_log_template_revoked on public.sms_parse_log (matched_template_id) where template_revoked_at is not null;

create or replace function public.check_sms_promotion_eligibility()
 returns table(template_id uuid, sender text, match_count integer, unique_user_count integer, age_days integer, failure_rate numeric, avg_ai_confidence numeric)
 language plpgsql stable security definer
 set search_path to 'public', 'extensions', 'pg_temp'
as $function$
begin
  return query
  select t.id, t.sender, t.match_count, t.unique_user_count,
    extract(day from now() - t.created_at)::int,
    coalesce((select count(case when l.parsed_ok = false then 1 end)::numeric / nullif(count(*)::numeric, 0)
              from sms_parse_log l where l.sender = t.sender and l.created_at > t.created_at), 0),
    coalesce(t.avg_ai_confidence, 1.0)
  from sms_tracking_templates_ai t, sms_promotion_config c
  where t.tier = 'template' and t.status = 'active' and t.merged_into is null and t.ai_enabled = true
    and coalesce(t.failure_count, 0) = 0 and coalesce(t.hard_fail, false) = false
    and t.match_count >= c.min_match_count
    -- Two distinct users is the floor for promotion without staff; a single-user template is a candidate (below).
    and t.unique_user_count >= greatest(c.min_unique_users, 2)
    and extract(day from now() - t.created_at) >= greatest(c.min_age_days, 7)
    and coalesce(t.avg_ai_confidence, 1.0) >= c.min_avg_confidence
    and coalesce((select count(case when l.parsed_ok = false then 1 end)::numeric / nullif(count(*)::numeric, 0)
                  from sms_parse_log l where l.sender = t.sender and l.created_at > t.created_at), 0) <= c.max_failure_rate;
end;
$function$;

create or replace function public.sms_promotion_candidates()
 returns table(template_id uuid, sender text, match_count integer, unique_user_count integer, age_days integer)
 language sql stable security definer
 set search_path to 'public', 'extensions', 'pg_temp'
as $function$
  select t.id, t.sender, t.match_count, t.unique_user_count, extract(day from now() - t.created_at)::int
  from sms_tracking_templates_ai t
  where t.tier = 'template' and t.status = 'active' and t.merged_into is null and t.ai_enabled = true
    and t.unique_user_count < 2 and t.match_count >= 15
    and coalesce(t.failure_count, 0) = 0 and coalesce(t.hard_fail, false) = false
    and extract(day from now() - t.created_at) >= 14
  order by t.match_count desc;
$function$;
revoke all on function public.sms_promotion_candidates() from public, anon, authenticated;
grant execute on function public.sms_promotion_candidates() to service_role;

update public.sms_promotion_config set min_unique_users = 2, updated_at = now() where id = 1 and min_unique_users = 5;
