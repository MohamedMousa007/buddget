-- QA-120 data repair (owner approved all rows, 2026-11-19): SMS credits booked before their provisional account
-- existed stayed unassigned. 94 income events (4 users: 64, 23, 4, 3) listed by a SELECT on 2026-11-19: live, no
-- account, the log names 3+ digits, and exactly one live account of the user has those trailing digits and the same
-- currency (a provisional one). History only: balances start at each account's opening balance, after these credits.
-- Safe to run again: only rows still without an account are touched.
UPDATE public.income_events i
SET payment_method_id = pm.id, updated_at = now()
FROM public.sms_parse_log l, public.payment_methods pm
WHERE l.id = i.sms_log_id
  AND i.deleted_at IS NULL AND i.payment_method_id IS NULL
  AND l.account_last4 IS NOT NULL AND length(l.account_last4) >= 3
  AND pm.user_id = i.user_id AND pm.provisional AND pm.deleted_at IS NULL AND pm.currency = i.currency
  AND right(regexp_replace(coalesce(pm.last4, ''), '\D', '', 'g'), length(l.account_last4)) = l.account_last4
  AND (
    SELECT count(*) FROM public.payment_methods p2
    WHERE p2.user_id = i.user_id AND p2.deleted_at IS NULL AND p2.currency = i.currency
      AND right(regexp_replace(coalesce(p2.last4, ''), '\D', '', 'g'), length(l.account_last4)) = l.account_last4
  ) = 1;
