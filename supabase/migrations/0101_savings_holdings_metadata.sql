-- Per-asset-type extras for the v3 investment position model, in one jsonb rather than a dozen
-- sparse columns: gold unit (grams/pounds/ounces) + location, crypto venue, stock market,
-- property size/share%/rented/area-price. The typed columns (quantity, karat, unit_cost, …) still
-- carry the structured, queryable fields; metadata holds the rest.
ALTER TABLE public.savings_holdings
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
