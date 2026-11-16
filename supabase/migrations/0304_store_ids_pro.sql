-- Store product ids are named for the plan users see, Buddget Pro: pro_monthly / pro_annual (were plus_*; nothing was
-- ever sold under the old ids). The internal plan key stays 'plus'.
update public.plans
set store_products = '{"app_store": {"monthly": "pro_monthly", "annual": "pro_annual"}, "play_store": {"monthly": "pro_monthly", "annual": "pro_annual"}}'::jsonb
where key = 'plus';

-- spark_ensure_allowance spots an annual store plan by its id prefix.
do $$
declare d text := pg_get_functiondef('public.spark_ensure_allowance(uuid, timestamptz, integer)'::regprocedure);
begin
  execute replace(d, 'plus_annual', 'pro_annual');
end $$;
