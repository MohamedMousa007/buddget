-- Biometric device-token sign-in.
-- One row per device (device_id PK) binds a device to a single account: enabling
-- biometric for a new account overwrites the old row (takeover). Only a SHA-256
-- hash of the device secret is stored; the plaintext secret lives in on-device
-- storage behind the OS biometric prompt. The signin route (service role) verifies
-- the hash and mints a fresh session via generateLink — no refresh token is ever
-- replayed, which is what previously tripped reuse detection (session_not_found).
create table if not exists public.biometric_devices (
  device_id   text primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  secret_hash text not null,
  created_at  timestamptz not null default now(),
  last_used_at timestamptz
);

create index if not exists biometric_devices_user_id_idx on public.biometric_devices(user_id);

alter table public.biometric_devices enable row level security;

-- Register/takeover and signin go through service-role routes (bypass RLS).
-- Clients may read/delete only their own device rows (e.g. to reflect state or
-- disable biometric).
drop policy if exists "own biometric device read" on public.biometric_devices;
create policy "own biometric device read"
  on public.biometric_devices for select
  using (auth.uid() = user_id);

drop policy if exists "own biometric device delete" on public.biometric_devices;
create policy "own biometric device delete"
  on public.biometric_devices for delete
  using (auth.uid() = user_id);
