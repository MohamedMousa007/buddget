-- One account is named by more than one number in bank messages: the account number's tail ("***-001"), a linked debit
-- card ("ending 5950"), the form a user typed. `last4` stays the primary, displayed number; `last4_aliases` holds the
-- others so SMS matching can recognise all of them. Linking a detected number to an existing account adds an alias
-- instead of overwriting the one that already matches.
ALTER TABLE public.payment_methods
  ADD COLUMN IF NOT EXISTS last4_aliases text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.payment_methods
  DROP CONSTRAINT IF EXISTS payment_methods_last4_aliases_check;
ALTER TABLE public.payment_methods
  ADD CONSTRAINT payment_methods_last4_aliases_check
  CHECK (cardinality(last4_aliases) <= 8);
