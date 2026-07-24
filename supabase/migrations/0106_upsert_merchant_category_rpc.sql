-- Service-role writer for the merchant→category cache. Centralises the precedence rule so no
-- caller can clobber a human correction: an 'ai'/'seed' write never overwrites an existing
-- 'user' row's category, but always refreshes recency/hit_count.
create or replace function upsert_merchant_category(
  p_key text, p_category expense_category, p_source text, p_sample text
) returns void language plpgsql security definer set search_path = public as $$
begin
  insert into merchant_categories (merchant_key, category, source, sample_merchant, hit_count, updated_at)
  values (p_key, p_category, p_source, p_sample, 1, now())
  on conflict (merchant_key) do update set
    category = case when merchant_categories.source = 'user' and excluded.source <> 'user'
                    then merchant_categories.category else excluded.category end,
    source   = case when merchant_categories.source = 'user' and excluded.source <> 'user'
                    then 'user' else excluded.source end,
    sample_merchant = excluded.sample_merchant,
    hit_count = merchant_categories.hit_count + 1,
    updated_at = now();
end $$;
