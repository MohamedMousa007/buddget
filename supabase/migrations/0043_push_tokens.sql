-- Native (FCM / APNS) device tokens for the iOS + Android Capacitor app.
-- Distinct from `push_subscriptions` (browser Web Push / VAPID).
-- The native shells obtain a token via @capacitor-firebase/messaging and post
-- it to /api/push/register; the server fans out via firebase-admin.

create table if not exists public.push_tokens (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  token       text not null,
  platform    text not null check (platform in ('ios', 'android', 'web')),
  device_model text,
  app_version  text,
  locale       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- A single (user, token) is unique — re-registering refreshes the row.
  constraint push_tokens_user_token_uq unique (user_id, token)
);

alter table public.push_tokens enable row level security;

create policy "push_tokens_select_own"
  on public.push_tokens for select
  using (auth.uid() = user_id);

create policy "push_tokens_insert_own"
  on public.push_tokens for insert
  with check (auth.uid() = user_id);

create policy "push_tokens_update_own"
  on public.push_tokens for update
  using (auth.uid() = user_id);

create policy "push_tokens_delete_own"
  on public.push_tokens for delete
  using (auth.uid() = user_id);

create index if not exists push_tokens_user_idx
  on public.push_tokens (user_id);

create unique index if not exists push_tokens_token_uq
  on public.push_tokens (token);

create or replace function public.touch_push_tokens_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists push_tokens_touch on public.push_tokens;
create trigger push_tokens_touch
  before update on public.push_tokens
  for each row execute procedure public.touch_push_tokens_updated_at();
