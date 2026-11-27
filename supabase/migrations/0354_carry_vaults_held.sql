-- Month-end carry: the leftover is set aside inside an account, never moved (council rounds 4-5, 2026-11-27).
-- Before this fix the carry and goal funding posted a leg out of the primary account into pockets with no holder, so
-- the account showed less than the bank while the pocket counted the same money as outside savings.
-- Live audit: 3 carry deposits with a leg, into 2 vault pockets with no holder; every leg on each pocket came from one
-- open bank account in the pocket's own currency. Holding each pocket in that account turns those deposits into
-- set-asides (balance.ts rule 1 skips a leg into the holder), so the account matches the bank again and net worth
-- counts the money once. Pockets whose legs come from several accounts, or another currency, are left alone.
-- edited_at moves to now() so a device holding the old row cannot write it back (reject_stale_write).

with carry_legs as (
  select t.account_id as pocket_id, min(t.payment_method_id::text)::uuid as leg_pm
  from public.savings_transactions t
  where t.source = 'carry' and t.deleted_at is null and t.payment_method_id is not null
  group by t.account_id
),
single_source as (
  select c.pocket_id, c.leg_pm
  from carry_legs c
  join public.savings_accounts s on s.id = c.pocket_id
  join public.payment_methods pm on pm.id = c.leg_pm
  where s.held_in_payment_method_id is null and s.deleted_at is null
    and pm.type in ('bank_account', 'wallet') and pm.deleted_at is null and pm.closed_at is null
    and pm.currency = s.currency
    and not exists (
      select 1 from public.savings_transactions x
      where x.account_id = c.pocket_id and x.deleted_at is null and x.payment_method_id is not null and x.payment_method_id <> c.leg_pm
    )
)
update public.savings_accounts s
set held_in_payment_method_id = ss.leg_pm,
    edited_at = now()
from single_source ss
where s.id = ss.pocket_id;
