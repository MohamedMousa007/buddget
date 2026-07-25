-- Turn savings_holdings into the market-position model for multi-holding investment pockets.
--
-- An investment pocket (gold, crypto, stocks) becomes a container of holdings, each valued at
-- quantity × live price. These columns add the cost basis (for P&L) and gold karat handling.
--
-- karat_adjustment defaults 1.0: today every Egyptian karat is exactly purity × 24k spot
-- (verified against live market data), so the knob is inert — but if a karat ever carries its
-- own premium we tune the column instead of shipping a schema change.
--
-- karat_unconfirmed is set on rows created by the backfill of legacy single-value gold pockets:
-- we cannot know whether the stored grams were 24k or 21k, so we assume 24k and flag the row
-- for the user to confirm rather than silently bake in a wrong valuation.
ALTER TABLE public.savings_holdings
  ADD COLUMN IF NOT EXISTS unit_cost numeric,
  ADD COLUMN IF NOT EXISTS cost_basis_currency currency_code,
  ADD COLUMN IF NOT EXISTS karat int
    CONSTRAINT savings_holdings_karat_range CHECK (karat IS NULL OR karat IN (24, 22, 21, 18, 14, 12)),
  ADD COLUMN IF NOT EXISTS karat_adjustment numeric NOT NULL DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS karat_unconfirmed boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.savings_holdings.karat_unconfirmed IS
  'True on backfilled gold rows assumed 24k; prompts the user to confirm the real karat.';
