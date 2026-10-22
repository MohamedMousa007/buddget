-- Accounts refactor 1/5: bank accounts / wallets / cash become real accounts; cards hang under them.
-- Account types = cash | bank_account | wallet (existing payment_method_type enum). Everything is additive.
-- opening_balance NULL = "balance not set yet": the app excludes the account from totals until the user sets it.
ALTER TABLE public.payment_methods
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.payment_methods(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS opening_balance numeric(14,2),
  ADD COLUMN IF NOT EXISTS opening_at timestamptz,
  ADD COLUMN IF NOT EXISTS closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS track_sms boolean NOT NULL DEFAULT true;

DO $$ BEGIN
  ALTER TABLE public.payment_methods ADD CONSTRAINT payment_methods_parent_not_self CHECK (parent_id IS NULL OR parent_id <> id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_payment_methods_parent ON public.payment_methods (parent_id) WHERE parent_id IS NOT NULL;

-- Never raises (a raise would wedge a client sync batch): a bad parent is dropped, and soft-deleting an
-- account that still has history becomes "closed" instead, so null payment_method_id (= Cash) never inherits its rows.
CREATE OR REPLACE FUNCTION public.payment_methods_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.parent_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.payment_methods p
    WHERE p.id = NEW.parent_id AND p.user_id = NEW.user_id AND p.type IN ('cash', 'bank_account', 'wallet')
  ) THEN
    NEW.parent_id := NULL;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL
     AND NEW.type IN ('cash', 'bank_account', 'wallet')
     AND (EXISTS (SELECT 1 FROM public.expenses e WHERE e.payment_method_id = NEW.id AND e.deleted_at IS NULL)
       OR EXISTS (SELECT 1 FROM public.expenses e WHERE e.to_payment_method_id = NEW.id AND e.deleted_at IS NULL)
       OR EXISTS (SELECT 1 FROM public.income_events i WHERE i.payment_method_id = NEW.id AND i.deleted_at IS NULL)
       OR EXISTS (SELECT 1 FROM public.debt_payments d WHERE d.payment_method_id = NEW.id AND d.deleted_at IS NULL)) THEN
    NEW.deleted_at := NULL;
    NEW.closed_at := COALESCE(NEW.closed_at, now());
  END IF;
  RETURN NEW;
END $$;
