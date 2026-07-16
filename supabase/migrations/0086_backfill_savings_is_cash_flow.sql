-- Backfill is_cash_flow for rows written before 0085.
--
-- Every non-cash savings movement is already marked by the note the store stamps on it,
-- which is a far better discriminator than any date heuristic:
--   * addSavingsAccount        -> 'Opening balance'
--   * savings-holding import   -> 'Balance from previous savings record'
--   * correctSavingsBalance    -> 'Manual balance correction'  (its default note only)
--
-- Idempotent and re-runnable. A correction where the user typed their own note is not
-- recoverable and stays is_cash_flow = true; that is a small, accepted residue.
UPDATE public.savings_transactions
SET is_cash_flow = false
WHERE is_cash_flow = true
  AND notes IN (
    'Opening balance',
    'Balance from previous savings record',
    'Manual balance correction'
  );
