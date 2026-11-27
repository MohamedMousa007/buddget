-- 0361_card_plans.sql  (LOGIC_SPEC v2 §3.2 P3, §4.10, OQ-3 verdict §8)
-- PURPOSE
--   A card plan (installment_provider = 'credit_card') is owed once, inside its card: the purchase is one full-price
--   charge on the card, the plan row is its schedule (linked_credit_card_debt_id). Net worth leaves out plans linked to a
--   card, so a plan must be linked to count inside the card.
--   1. Single-card linking: a card plan with no linked_credit_card_debt_id, whose user has exactly one live credit-card
--      debt, is linked to it. Bumps updated_at only, never edited_at (reject_stale_write, 0241, would otherwise drop
--      users' pending offline edits). Re-runnable: it only touches plans still unlinked.
--   2. OQ-3 count, no insert code: after step 1, live plans linked to a card with no purchase charge on that card
--      (no non-instalment expense with linked_debt_id = plan, and none of the plan's amount within 3 days of its start
--      or creation on the card) raise a NOTICE with the count. Expected 0 (council, 2026-11-27); any found are fixed by
--      hand with an idempotent key.
--   Historical instalment rows are not recategorised. Nothing raises. debts is already in every sync list.
--
-- BEFORE-COUNTS (_checks/p3_counts.sql, section 0361; expected in brackets)
--   live card plans [small]; those with no linked card [?]; of those, whose user has exactly one live card [= the rows
--   step 1 touches, ids saved for rollback]; linked plans with no purchase charge before and after step 1 [0].
--
-- EXPECTED ROWS TOUCHED
--   debts.linked_credit_card_debt_id = query 0361.3 (unlinked card plans of single-card users). Nothing else.
--
-- ROLLBACK
--   Step 1 keeps no record it could be undone from. Save the ids from query 0361.3 before applying; to roll back:
--   update public.debts set linked_credit_card_debt_id = null, updated_at = now() where id = any ('{<saved ids>}'::uuid[]);

-- 1. Single-card linking --------------------------------------------------------------------------------------------
with single_card as (
  select user_id, min(id::text)::uuid as card_id
  from public.debts
  where debt_type = 'credit_card' and deleted_at is null
  group by user_id
  having count(*) = 1
)
update public.debts p
set linked_credit_card_debt_id = c.card_id,
    updated_at = now()
from single_card c
where p.user_id = c.user_id
  and p.installment_provider = 'credit_card'
  and p.debt_type = 'installment'
  and p.linked_credit_card_debt_id is null
  and p.deleted_at is null;

-- 2. OQ-3: linked card plans with no purchase charge on the card (count only) ----------------------------------------
do $$
declare
  n bigint;
begin
  select count(*) into n
  from public.debts p
  join public.debts c on c.id = p.linked_credit_card_debt_id and c.deleted_at is null
  where p.debt_type = 'installment'
    and p.deleted_at is null
    and not exists (
      select 1 from public.expenses e
      where e.user_id = p.user_id
        and e.deleted_at is null
        and e.payment_method_id = c.linked_payment_method_id
        and not e.is_debt_payment
        and (e.linked_debt_id = p.id
          or (e.amount = p.starting_balance
              and (abs(e.expense_date::date - coalesce(p.installment_start_date::date, p.created_at::date)) <= 3
                or abs(e.expense_date::date - p.created_at::date) <= 3))));
  if n > 0 then
    raise notice '0361: % card plan(s) linked to a card with no purchase charge on it; fix by hand (OQ-3)', n;
  end if;
end $$;
