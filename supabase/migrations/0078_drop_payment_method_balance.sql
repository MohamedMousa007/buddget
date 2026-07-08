-- Balances are never tracked (no bank integration planned). payment_methods.balance
-- was written only from bank-SMS "new balance" and never read/displayed; sms_parse_log.new_balance
-- was a transient parse artifact. Both are dead. Audited before drop: 0 payment methods with a
-- non-zero balance, no view/trigger dependencies. Removing the whole extraction→write pipeline.

ALTER TABLE public.payment_methods DROP COLUMN IF EXISTS balance;
ALTER TABLE public.sms_parse_log DROP COLUMN IF EXISTS new_balance;
