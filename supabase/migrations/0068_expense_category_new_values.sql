-- Add new expense_category enum values (spend + non-spend movement categories).
-- ALTER TYPE ADD VALUE cannot be used in the same transaction it is added,
-- so this migration ONLY adds the values; columns/usage live in 0069/0070.
ALTER TYPE expense_category ADD VALUE IF NOT EXISTS 'Groceries';
ALTER TYPE expense_category ADD VALUE IF NOT EXISTS 'Fuel';
ALTER TYPE expense_category ADD VALUE IF NOT EXISTS 'Health';
ALTER TYPE expense_category ADD VALUE IF NOT EXISTS 'Shopping';
ALTER TYPE expense_category ADD VALUE IF NOT EXISTS 'Education';
ALTER TYPE expense_category ADD VALUE IF NOT EXISTS 'Utilities';
ALTER TYPE expense_category ADD VALUE IF NOT EXISTS 'Subscription';
ALTER TYPE expense_category ADD VALUE IF NOT EXISTS 'ATM Cash Withdrawal';
ALTER TYPE expense_category ADD VALUE IF NOT EXISTS 'Transfer';
ALTER TYPE expense_category ADD VALUE IF NOT EXISTS 'Currency Exchange';
ALTER TYPE expense_category ADD VALUE IF NOT EXISTS 'CC Payoff';
