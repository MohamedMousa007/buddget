-- Every new expense on an excluded payment method (or a card under an excluded account) starts out left out of
-- spending, whoever inserts it: the app, or the SMS pipeline on the server.
CREATE OR REPLACE FUNCTION public.expense_inherit_exclusion() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.spend_exclusion IS NULL AND NEW.payment_method_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM payment_methods m
    WHERE m.id = NEW.payment_method_id
      AND (m.excluded OR EXISTS (SELECT 1 FROM payment_methods p WHERE p.id = m.parent_id AND p.excluded))
  ) THEN
    NEW.spend_exclusion := 'method';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS expenses_inherit_exclusion ON public.expenses;
CREATE TRIGGER expenses_inherit_exclusion BEFORE INSERT ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.expense_inherit_exclusion();
