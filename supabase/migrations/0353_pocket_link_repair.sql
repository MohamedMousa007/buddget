-- Pockets: retire savings_accounts.linked_payment_method_id (council round 4, 2026-11-27).
-- The column duplicated held_in_payment_method_id: written when a pocket was made "from an account you already have",
-- read only to grey that account out. Where the pocket had no holder its money counted twice (in the account and again
-- as outside savings).
--
-- Live audit before this migration: 49 live pockets, 4 with a link that disagreed with held_in.
--   * 1 linked to a debit card whose parent is its holder: correct, link cleared.
--   * 2 linked to debit cards with no parent account: no tracked balance holds the money, so standalone is right.
--   * 1 linked to a (since deleted) debit card whose parent is a tracked, open EGP bank account in the pocket's
--     currency: the pocket's opening money sits in that account, so it becomes an earmark there (held_in).
-- The app no longer reads or writes the column. It is nulled here and dropped in a later migration, once no native
-- build that still sends it is in use (build 156 and older write it on new pockets; the value is ignored).
-- edited_at moves to now() so a device holding the old row cannot write it back (reject_stale_write).

update public.savings_accounts s
set held_in_payment_method_id = c.parent_id,
    edited_at = now()
from public.payment_methods c
join public.payment_methods p on p.id = c.parent_id
where s.linked_payment_method_id = c.id
  and s.held_in_payment_method_id is null
  and s.deleted_at is null
  and p.type = 'bank_account'
  and p.deleted_at is null
  and p.closed_at is null
  and p.currency = s.currency;

update public.savings_accounts
set linked_payment_method_id = null,
    edited_at = now()
where linked_payment_method_id is not null;
