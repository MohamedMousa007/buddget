-- spark_pack_refund returned the balance after the update (always 0); it now returns the unspent Sparks it removed.
create or replace function public.spark_pack_refund(p_store_txn text)
returns integer language plpgsql security definer set search_path to 'public' as $$
declare v_left integer;
begin
  select remaining into v_left from public.spark_purchases where store_txn = p_store_txn and refunded_at is null for update;
  if not found then return 0; end if;
  update public.spark_purchases set refunded_at = now(), remaining = 0 where store_txn = p_store_txn;
  return v_left;
end;
$$;
