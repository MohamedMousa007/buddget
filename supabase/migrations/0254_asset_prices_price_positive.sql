-- RPW-4: a cached price of 0, negative or NaN would be served as a live price (gold valued at 0, "priced").
-- All 21 live rows are > 0; every writer already guards > 0, this makes the table enforce it.
alter table public.asset_prices
  add constraint asset_prices_price_positive check (price > 0 and price <> 'NaN'::numeric);
