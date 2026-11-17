-- Tables the account-deletion routine touches but no admin code reads: bare stubs so the routine runs end to end.
create table if not exists public.buddgy_memories (id uuid primary key default gen_random_uuid(), user_id uuid not null);
create table if not exists public.budget_categories (id uuid primary key default gen_random_uuid(), user_id uuid not null);
create table if not exists public.budget_feedback (id uuid primary key default gen_random_uuid(), user_id uuid not null);
create table if not exists public.budget_plan_activations (id uuid primary key default gen_random_uuid(), user_id uuid not null);
create table if not exists public.budget_subcategories (id uuid primary key default gen_random_uuid(), user_id uuid not null);
create table if not exists public.debt_payments (id uuid primary key default gen_random_uuid(), user_id uuid not null);
create table if not exists public.income_events (id uuid primary key default gen_random_uuid(), user_id uuid not null);
create table if not exists public.payment_methods (id uuid primary key default gen_random_uuid(), user_id uuid not null);
create table if not exists public.recurring_debt_payments (id uuid primary key default gen_random_uuid(), user_id uuid not null);
create table if not exists public.recurring_expenses (id uuid primary key default gen_random_uuid(), user_id uuid not null);
create table if not exists public.recurring_savings_deposits (id uuid primary key default gen_random_uuid(), user_id uuid not null);
create table if not exists public.savings_holdings (id uuid primary key default gen_random_uuid(), user_id uuid not null);
create table if not exists public.savings_transactions (id uuid primary key default gen_random_uuid(), user_id uuid not null);

-- Migration 0225: the sign-in endpoints find an invited address's account by email.
create or replace function public.user_id_by_email(p_email text) returns uuid
language sql stable security definer set search_path = auth, pg_temp as $$
  select id from auth.users where lower(email) = lower(p_email) limit 1;
$$;
