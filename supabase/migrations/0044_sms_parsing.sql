-- AI-driven SMS / notification parser ledger.
-- Distinct from `sms_events` (regex-based ingest pipeline). This table tracks
-- per-user per-day usage so /api/sms/parse can rate-limit AI calls and
-- de-duplicate via a stable hash of (amount + merchant fragment + day).

create table if not exists public.sms_parse_log (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,

  source        text not null check (source in ('sms', 'notification', 'manual')),
  sender        text,
  raw_body      text not null,

  parsed_ok     boolean not null default false,
  amount        numeric(18, 4),
  currency      text,
  merchant      text,
  bank_name     text,
  category      text,
  confidence    numeric(4, 3),

  /** SHA-256 of `${amountToCents}:${merchantFragment}:${YYYY-MM-DD}` so reposts dedup. */
  sms_hash      text,

  /** Auto-created expense id (when confidence >= 0.8). */
  expense_id    uuid references public.expenses (id) on delete set null,

  /** Set when confidence is in the [0.6, 0.8) confirm-window (push-to-confirm). */
  awaiting_confirmation boolean not null default false,

  parsed_at     timestamptz not null default now(),
  received_at   timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

alter table public.sms_parse_log enable row level security;

create policy "sms_parse_log_select_own"
  on public.sms_parse_log for select
  using (auth.uid() = user_id);

create policy "sms_parse_log_update_own"
  on public.sms_parse_log for update
  using (auth.uid() = user_id);

-- Inserts are service-role only (from /api/sms/parse).

create index if not exists sms_parse_log_user_day_idx
  on public.sms_parse_log (user_id, parsed_at desc);

create unique index if not exists sms_parse_log_user_hash_uq
  on public.sms_parse_log (user_id, sms_hash)
  where sms_hash is not null;

-- Today's call counter for rate-limiting (100/day per user). Always-up-to-date
-- because it filters at query time.
create or replace view public.sms_parse_today as
select
  user_id,
  count(*)::int as parsed_count_today
from public.sms_parse_log
where parsed_at >= date_trunc('day', timezone('utc', now()))
group by user_id;

grant select on public.sms_parse_today to authenticated;
