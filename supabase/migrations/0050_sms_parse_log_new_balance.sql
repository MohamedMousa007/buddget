-- Store the account balance stated in the SMS after the transaction.
-- Enables future payment-method balance display when account_last4 is linked.
ALTER TABLE public.sms_parse_log
  ADD COLUMN IF NOT EXISTS new_balance numeric(14,2);

COMMENT ON COLUMN public.sms_parse_log.new_balance IS
  'Account balance after transaction as explicitly stated in the SMS (e.g. "Available Balance: EGP 12,450.00"). Null if not present.';
