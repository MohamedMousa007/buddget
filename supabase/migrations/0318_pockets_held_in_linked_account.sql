-- QA-13 / QA-122: a pocket created "from an account you already have" is an earmark inside that account.
-- The client only wrote linked_payment_method_id, so net worth counted the pocket on top of the account.
-- Backfill held_in_payment_method_id for live pockets linked to a tracked balance-holding account in the same
-- currency. One-off, set-based, safe to run again (it only touches rows where held_in is still NULL).
-- edited_at is left alone, so the newest-edit guard passes; updated_at moves, so every device pulls the row.
update public.savings_accounts s
   set held_in_payment_method_id = s.linked_payment_method_id
  from public.payment_methods pm
 where pm.id = s.linked_payment_method_id
   and pm.user_id = s.user_id
   and pm.deleted_at is null
   and pm.type in ('cash', 'bank_account', 'wallet', 'prepaid_card')
   and pm.opening_balance is not null
   and pm.opening_at is not null
   and coalesce(pm.provisional, false) = false
   and pm.currency::text = s.currency::text
   and s.deleted_at is null
   and s.held_in_payment_method_id is null
   and s.linked_payment_method_id is not null;
