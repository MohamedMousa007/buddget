-- Migrate payment_method_type to the 8-value model (design handoff §5).
-- Renames preserve existing rows automatically; two new values are added.
-- Applied to remote 2026-07-10.
ALTER TYPE payment_method_type RENAME VALUE 'bank_transfer' TO 'bank_account';
ALTER TYPE payment_method_type RENAME VALUE 'card_debit'    TO 'debit_card';
ALTER TYPE payment_method_type RENAME VALUE 'card_credit'   TO 'credit_card';
ALTER TYPE payment_method_type RENAME VALUE 'nol'           TO 'prepaid_card';
ALTER TYPE payment_method_type ADD VALUE IF NOT EXISTS 'wallet';
ALTER TYPE payment_method_type ADD VALUE IF NOT EXISTS 'bnpl';
