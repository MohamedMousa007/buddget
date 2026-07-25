-- Shared server-side price cache for live asset valuation (gold spot & karats, crypto, stocks,
-- the Egyptian Sagha dollar). NOT user-scoped: one row per (symbol, currency) serves every
-- user, written only by the pricing cron under the service role and read by all clients.
--
-- Clients NEVER call upstream providers (free-tier rate limits) — they read this table. A row
-- older than its asset-class staleness window is treated as unavailable by the client, never
-- served stale. `confidence` and `source` feed the "as of / how sure" stamp shown in the UI.
CREATE TABLE IF NOT EXISTS public.asset_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol text NOT NULL,                 -- XAU, XAU_21K, BTC, AAPL, SAGHA_USD, …
  asset_class text NOT NULL,            -- gold | crypto | stock | fx
  currency currency_code NOT NULL,      -- quote currency of `price`
  price numeric NOT NULL,
  as_of timestamptz NOT NULL,
  source text,                          -- winning source / cluster members
  upstream text,                        -- distinct upstream feed, for confidence de-duplication
  confidence text,                      -- exact | high | low | single | unavailable
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT asset_prices_symbol_currency_key UNIQUE (symbol, currency)
);

ALTER TABLE public.asset_prices ENABLE ROW LEVEL SECURITY;

-- Readable by every authenticated user; no write policy — only the service role (cron) writes,
-- and it bypasses RLS.
DROP POLICY IF EXISTS asset_prices_select ON public.asset_prices;
CREATE POLICY asset_prices_select ON public.asset_prices
  FOR SELECT TO authenticated USING (true);
