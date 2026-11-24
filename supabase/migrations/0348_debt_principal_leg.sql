-- A debt's principal leg: the money that left an account when the user lent it (they_owe) or arrived in one when
-- they borrowed it (i_owe). Until now creating a debt moved no account while its payments did, so a repaid loan
-- minted money (WEALTH_LOGIC_REVIEW DR-6).
--
-- All four columns are NULL on every existing row and stay NULL unless the user answers "yes, it left/arrived in
-- this account" on create: no backfill, no past balance changes. The amount and currency are stored apart from
-- debts.amount so a later edit of the debt total never rewrites an account balance.
--
-- No all-or-none CHECK across the columns: ON DELETE SET NULL on the account must stay able to clear the FK alone
-- (the balance engine ignores a leg with no account).
alter table public.debts
  add column if not exists principal_payment_method_id uuid references public.payment_methods(id) on delete set null,
  add column if not exists principal_amount numeric check (principal_amount is null or principal_amount > 0),
  add column if not exists principal_currency public.currency_code,
  add column if not exists principal_at timestamptz;

create index if not exists idx_debts_principal_payment_method
  on public.debts (principal_payment_method_id)
  where principal_payment_method_id is not null;

comment on column public.debts.principal_payment_method_id is 'Account the principal left (they_owe) or arrived in (i_owe). NULL = no account leg.';
comment on column public.debts.principal_amount is 'Amount of the principal leg, in principal_currency. Independent of debts.amount.';
comment on column public.debts.principal_at is 'Instant the principal moved.';

-- Tenant-link guard (QA round 6): the new account link must point at the caller's own payment method, like the
-- two links already guarded. Same function, one more column pair.
drop trigger if exists link_guard_debts on public.debts;
create trigger link_guard_debts before insert or update on public.debts
  for each row execute function private.assert_link_owner(
    'linked_credit_card_debt_id', 'debts',
    'linked_payment_method_id', 'payment_methods',
    'principal_payment_method_id', 'payment_methods');
