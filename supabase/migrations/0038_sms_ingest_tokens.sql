-- Per-user bearer tokens for the SMS ingest webhook.
-- The token authenticates requests from iOS Shortcuts / Android Bridge without
-- requiring a browser session cookie (external automations can't hold one).
-- Tokens are rotatable (set is_active = false, generate a new row).

create table if not exists public.sms_ingest_tokens (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  token       uuid not null unique default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  is_active   boolean not null default true
);

alter table public.sms_ingest_tokens enable row level security;

-- Owner can read their own tokens (to display "active" status in Settings).
create policy "sms_ingest_tokens_select_own"
  on public.sms_ingest_tokens for select
  using (auth.uid() = user_id);

-- Owner can deactivate a token.
create policy "sms_ingest_tokens_update_own"
  on public.sms_ingest_tokens for update
  using (auth.uid() = user_id);

-- Insert is service-role only (done from /api/sms/setup-token).
-- No anon/authenticated insert policy — ensures tokens come from the server.

-- Fast lookup for the ingest route (bearer token → user_id).
create index if not exists sms_ingest_tokens_token_idx
  on public.sms_ingest_tokens (token)
  where is_active = true;

create index if not exists sms_ingest_tokens_user_idx
  on public.sms_ingest_tokens (user_id);
