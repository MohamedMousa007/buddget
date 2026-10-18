-- 0120 — goal_allocation_runs readable by signed-in owners only (was unscoped role).
drop policy if exists goal_allocation_runs_read on public.goal_allocation_runs;
create policy goal_allocation_runs_read on public.goal_allocation_runs
  for select to authenticated using ((select auth.uid()) = user_id);
