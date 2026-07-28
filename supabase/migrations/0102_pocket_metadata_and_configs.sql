-- v3 pocket metadata + the two per-user configs the Savings tab needs.
--
-- Pocket (savings_accounts): a display colour, an emergency-cover flag (cover is claimed before
-- any goal), an optional link to a real payment method, and a jsonb for the account-identity bits
-- shown on the card sub-line (institution, last 4, certificate maturity, yearly return) that don't
-- each warrant a column.
ALTER TABLE public.savings_accounts
  ADD COLUMN IF NOT EXISTS color text,
  ADD COLUMN IF NOT EXISTS is_emergency_cover boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS linked_payment_method_id uuid,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Emergency-fund + zakat settings are singular per user → jsonb on profiles (like base_currency).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS emergency_fund_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS zakat_config jsonb NOT NULL DEFAULT '{}'::jsonb;
