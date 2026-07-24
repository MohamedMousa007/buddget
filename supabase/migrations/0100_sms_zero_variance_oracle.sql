-- 0100 — R2 zero-variance amount oracle.
--
-- The strongest evidence that a capture group is locked onto a CONSTANT (a fee, a hotline
-- number, a fixed limit) rather than the transaction amount: a template that has served many
-- DISTINCT message bodies and produced the SAME amount every time is not parsing an amount at
-- all.
--
-- Requires distinct bodies, not just distinct matches — a genuinely repeated charge (a daily
-- subscription of the same value) would otherwise look identical and be falsely accused.
--
-- Consumed by runZeroVarianceCheck, which runs in the parse route's background pass and reports
-- each hit as a HARD failure (one hit quarantines; shadow mode then confirms against live AI
-- parses before anything is retired).
create or replace function public.detect_zero_variance_templates(p_min_matches int default 4)
returns table (template_id uuid, distinct_bodies int, amount numeric)
language sql
stable
security definer
as $function$
  select l.matched_template_id as template_id,
         count(distinct l.raw_body)::int as distinct_bodies,
         min(l.amount) as amount
    from sms_parse_log l
    join sms_tracking_templates_ai t on t.id = l.matched_template_id
   where l.matched_template_id is not null
     and l.amount is not null
     and t.status = 'active'
     and t.hard_fail = false
   group by l.matched_template_id
  having count(distinct l.raw_body) >= p_min_matches
     and count(distinct l.amount) = 1;
$function$;
