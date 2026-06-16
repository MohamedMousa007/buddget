-- Persist credit-card linkage + lifecycle so CC payoff (SMS) can resolve the card debt
-- and computeCreditCardOutstanding works across devices/sync.
ALTER TABLE debts ADD COLUMN IF NOT EXISTS linked_payment_method_id uuid REFERENCES payment_methods(id) ON DELETE SET NULL;
ALTER TABLE debts ADD COLUMN IF NOT EXISTS credit_limit numeric;
ALTER TABLE debts ADD COLUMN IF NOT EXISTS cleared_at timestamptz;
ALTER TABLE debts ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

CREATE INDEX IF NOT EXISTS idx_debts_cc_lookup
  ON debts (user_id, debt_type, status)
  WHERE deleted_at IS NULL;
