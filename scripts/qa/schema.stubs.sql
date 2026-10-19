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
