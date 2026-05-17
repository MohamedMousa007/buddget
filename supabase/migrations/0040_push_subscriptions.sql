-- Web Push (VAPID) subscriptions.
-- Stores the browser-generated PushSubscription object per device so the
-- server can fan out background push notifications (SMS alerts, debt reminders, etc.)
-- without requiring the app to be open.

create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  endpoint    text not null,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  created_at  timestamptz not null default now(),
  -- Allow a user to have at most one subscription per endpoint (browser/device).
  constraint push_subscriptions_user_endpoint_uq unique (user_id, endpoint)
);

alter table public.push_subscriptions enable row level security;

-- Owner can read their own subscriptions.
create policy "push_subscriptions_select_own"
  on public.push_subscriptions for select
  using (auth.uid() = user_id);

-- Owner can insert their own subscription (from the browser via /api/push/subscribe).
create policy "push_subscriptions_insert_own"
  on public.push_subscriptions for insert
  with check (auth.uid() = user_id);

-- Owner can delete their own subscription (via /api/push/unsubscribe).
create policy "push_subscriptions_delete_own"
  on public.push_subscriptions for delete
  using (auth.uid() = user_id);

-- Fast fan-out: all active subscriptions for a given user.
create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions (user_id);

-- Endpoint uniqueness across the whole table (endpoint URLs are globally unique).
create unique index if not exists push_subscriptions_endpoint_uq
  on public.push_subscriptions (endpoint);
