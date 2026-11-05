-- A debt's payoff goal and emoji lived only on the device: the next delta pull replaced the row with the
-- server copy and erased both. Additive, nullable; applied live 2026-11-05.
alter table public.debts add column if not exists goal jsonb, add column if not exists emoji text;
