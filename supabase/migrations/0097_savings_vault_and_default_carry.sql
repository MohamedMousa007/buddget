-- The Buddget vault ("Monthly Savings") + the user's default carry destination.
--
-- `vault` is a system-created, undeletable, base-currency savings pocket — the fallback
-- destination for the automatic month-end carry when the user has set no default and has no
-- linked active savings goal. It is a distinct savings_type so the UI can render it apart
-- from a real bank pocket and block deletion.
--
-- default_carry_pocket_id is where the month-end carry lands; nullable, and constrained at
-- the app layer to fiat savings-category pockets only (carrying into gold/crypto would
-- silently buy an asset at spot). Left as a bare uuid — no FK — so deleting the pocket
-- doesn't block on this column; the store nulls it and falls back down the resolution chain.
ALTER TYPE savings_type ADD VALUE IF NOT EXISTS 'vault';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS default_carry_pocket_id uuid;

COMMENT ON COLUMN public.profiles.default_carry_pocket_id IS
  'Savings pocket that receives the automatic month-end carry. App restricts to fiat savings-category pockets.';
