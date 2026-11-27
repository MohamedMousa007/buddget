-- 0357_goals_achieved_final.sql  (LOGIC_SPEC v2 §0 "Achieved goal", I-12, §3.2 P2)
-- PURPOSE
--   An achieved goal is final. A BEFORE UPDATE trigger keeps status and achieved_at when a write tries to move an
--   achieved, live goal to any other status. Exceptions: a delete (deleted_at set in the same write) and the
--   month-end Undo, which sets buddget.month_end_undo = '1' for its own transaction (P6, undo_month_end).
--   It never raises: an old build's upsert of 'active' is applied with the status silently kept (T17), and the rest
--   of that write still lands. Named to fire after a0_reject_stale_write and a_suppress_noop_updates (alphabetical),
--   so a stale write that 0241 skips never reaches it.
--   No columns, no backfill, no new table: sync and a0 trigger lists unchanged.
--
-- BEFORE-COUNTS (_checks/p2_counts.sql, section 0357)
--   achieved goals, live and deleted; achieved goals with achieved_at NULL (kept as they are).
--
-- EXPECTED ROWS TOUCHED: 0 (trigger only).
--
-- ROLLBACK
--   drop trigger if exists goal_achieved_final on public.goals;
--   drop function if exists private.keep_goal_achieved();

create or replace function private.keep_goal_achieved()
 returns trigger
 language plpgsql
 set search_path to 'public', 'pg_temp'
as $function$
begin
  if old.status = 'achieved' and new.status is distinct from 'achieved' and new.deleted_at is null
     and current_setting('buddget.month_end_undo', true) is distinct from '1' then
    new.status := old.status;
    new.achieved_at := old.achieved_at;
  end if;
  return new;
end $function$;

revoke all on function private.keep_goal_achieved() from public, anon, authenticated;

drop trigger if exists goal_achieved_final on public.goals;
create trigger goal_achieved_final
  before update on public.goals
  for each row execute function private.keep_goal_achieved();
