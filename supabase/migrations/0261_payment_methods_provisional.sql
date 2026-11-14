-- S2 slice 1 (docs/launch/S1-sms-audit.md 6a.1): an account the server created from a bank message. Additive.
-- A provisional account is attributed to at once but stays out of balances and net worth until the user confirms,
-- renames or merges it. The index is the dedupe on bank + digits (both in the composed name) + currency, so two
-- messages arriving together cannot create the same account twice.
alter table public.payment_methods add column if not exists provisional boolean not null default false;
comment on column public.payment_methods.provisional is 'Created by the server from a bank message (bank + digits + currency). Stays out of balances and net worth until the user confirms it.';
create unique index if not exists payment_methods_provisional_identity
  on public.payment_methods (user_id, lower(name), currency) where provisional and deleted_at is null;
