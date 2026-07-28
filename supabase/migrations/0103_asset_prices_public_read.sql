-- asset_prices is public market data (gold/crypto/fx), not user data — let anyone read it, so
-- prices can load before sign-in and on public surfaces. Writes are still service-role only.
DROP POLICY IF EXISTS asset_prices_select ON public.asset_prices;
CREATE POLICY asset_prices_select ON public.asset_prices
  FOR SELECT TO anon, authenticated USING (true);
