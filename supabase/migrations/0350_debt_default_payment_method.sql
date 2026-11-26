-- 0350: the card or account an installment is usually paid with, preselected when a payment is recorded.
alter table public.debts
  add column if not exists default_payment_method_id uuid
    references public.payment_methods(id) on delete set null;
create index if not exists debts_default_payment_method_id_idx
  on public.debts (default_payment_method_id)
  where default_payment_method_id is not null;
