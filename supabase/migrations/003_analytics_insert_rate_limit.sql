-- Upgrade path: if you already ran 001 with the old "analytics_insert_own" policy, run this once.
-- Safe to re-run (drops and recreates the rate-limited policy).

drop policy if exists "analytics_insert_own" on public.app_analytics_events;
drop policy if exists "analytics_insert_own_rate_limited" on public.app_analytics_events;

create policy "analytics_insert_own_rate_limited"
  on public.app_analytics_events for insert
  with check (
    auth.uid() = user_id
    and (
      select count(*)::int
      from public.app_analytics_events e
      where e.user_id = auth.uid()
        and e.created_at > now() - interval '1 minute'
    ) < 60
  );
