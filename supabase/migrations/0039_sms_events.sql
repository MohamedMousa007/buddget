-- Raw SMS ingestion log + parsed transaction result.
-- Every SMS received by the ingest webhook is recorded here, whether or not
-- it parsed successfully, for auditability and duplicate detection.

create table if not exists public.sms_events (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  token_id          uuid references public.sms_ingest_tokens (id) on delete set null,

  -- Raw inbound data
  sender            text not null,
  raw_body          text not null,
  received_at       timestamptz not null,

  -- Parse outcome
  parsed_at         timestamptz,
  parse_ok          boolean not null default false,
  is_duplicate      boolean not null default false,

  -- Parsed transaction fields (null when parse_ok = false)
  transaction_type  text,   -- see SmsTransactionType union
  amount            numeric(18, 4),
  currency          text,
  merchant          text,
  bank_name         text,
  badge_key         text,   -- matches SmsTransactionType for badge lookup
  auto_category     text,   -- suggested ExpenseCategory written to expense

  -- Link to auto-created expense (null until created, null again after undo)
  expense_id        uuid references public.expenses (id) on delete set null,

  -- Undo window: non-null for 5 minutes after expense creation, then cleared
  undo_expires_at   timestamptz,

  created_at        timestamptz not null default now()
);

alter table public.sms_events enable row level security;

-- Owners can read their own events (Settings → Recent auto-transactions).
create policy "sms_events_select_own"
  on public.sms_events for select
  using (auth.uid() = user_id);

-- All writes (insert/update) are service-role only (from /api/sms/ingest + /api/sms/undo).

-- Query patterns: recent events per user, expense linkup, duplicate detection.
create index if not exists sms_events_user_received_idx
  on public.sms_events (user_id, received_at desc);

create index if not exists sms_events_user_expense_idx
  on public.sms_events (user_id, expense_id)
  where expense_id is not null;

create index if not exists sms_events_token_idx
  on public.sms_events (token_id);

-- Duplicate detection: (user_id, amount, bank_name, transaction_type, received_at window).
create index if not exists sms_events_dedup_idx
  on public.sms_events (user_id, amount, bank_name, transaction_type, received_at);
