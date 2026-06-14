-- Receipt scan: store the itemized breakdown + tax/service charges for a scanned
-- receipt as ONE receipts row, linked to the single total expense via expenses.receipt_id.
-- The expense remains the source of truth for totals/reports (no double-counting);
-- receipts is display-only data surfaced behind "View receipt".

create table public.receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  merchant text,
  amount numeric(18,4) not null,
  currency public.currency_code not null,
  receipt_date date not null,
  category public.expense_category not null default 'Other',
  payment_method_id uuid references public.payment_methods(id) on delete set null,
  confidence numeric(4,3),
  -- items: [{ name: string, price: number, qty?: number }]
  items jsonb not null default '[]'::jsonb,
  -- charges: [{ type: 'tax'|'service'|'tip'|'discount'|'other', label: string, amount: number }]
  charges jsonb not null default '[]'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index receipts_user_id_idx on public.receipts (user_id) where deleted_at is null;

alter table public.receipts enable row level security;

create policy "receipts_select_own"
  on public.receipts for select
  using (auth.uid() = user_id);

create policy "receipts_insert_own"
  on public.receipts for insert
  with check (auth.uid() = user_id);

create policy "receipts_update_own"
  on public.receipts for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "receipts_delete_own"
  on public.receipts for delete
  using (auth.uid() = user_id);

alter table public.expenses
  add column receipt_id uuid references public.receipts(id) on delete set null;
