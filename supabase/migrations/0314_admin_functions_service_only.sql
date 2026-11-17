-- Every public.admin_* function and usage_reset is called only from server code with the service client (checked by grep, 2026-11-17).
-- After the region move they were executable by anon and authenticated; several are SECURITY DEFINER with no check inside
-- (admin_user_directory lists every user). Lock them to the service role. Set-based: one pass over the catalog.
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and (p.proname like 'admin\_%' or p.proname = 'usage_reset')
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
    execute format('grant execute on function %s to service_role', f.sig);
  end loop;
end $$;
