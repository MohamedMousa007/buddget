-- 0360_cards_and_savings_accounts.sql  (LOGIC_SPEC v2 §3.1, §3.2 P3, §4.1)
-- PURPOSE
--   payment_methods gains:
--     pays_from_payment_method_id uuid -> payment_methods(id) on delete set null
--       A credit card with no parent_id: the account that pays its bill. paysFrom(c) = parent_id ?? this ?? last payer
--       ?? primary account; the card's hold-back (owed - unbilled plan principal) is taken from that account's free money.
--     is_savings boolean not null default false
--       Marks a savings account (§3.1). No reader yet.
--   Partial FK index (covers ON DELETE SET NULL and "cards paid from A").
--   link_guard_payment_methods (0326: parent_id only) gains the new column: another user's account is refused (23503),
--   the same convention as parent_id and every other link column. A missing target is left to the FK.
--   Additive only: both columns are optional on write, so old builds' upserts never send or clear them. No new table:
--   sync_pull_v2 / sync_table_delta return whole rows, sync_changed_since reads updated_at, a0 lists unchanged (0241).
--   No backfill, no raising CHECK.
--   Ship order (§8 OQ-1): apply this file before the P3 web deploy; the new client sends both columns on every upsert.
--
-- BEFORE-COUNTS (_checks/p3_counts.sql, section 0360; expected in brackets)
--   live credit cards with parent_id IS NULL [small; each asks "pays this card from" in the app]; live
--   link_guard_payment_methods definition [assert_link_owner('parent_id', 'payment_methods'); if it differs, merge
--   its args into section 2 before applying]; neither new column exists yet [0 rows].
--
-- EXPECTED ROWS TOUCHED: 0 (columns and index only; a constant default adds is_savings without a table rewrite).
--
-- ROLLBACK
--   drop trigger if exists link_guard_payment_methods on public.payment_methods;
--   create trigger link_guard_payment_methods before insert or update on public.payment_methods
--     for each row execute function private.assert_link_owner('parent_id', 'payment_methods');
--   drop index if exists public.payment_methods_pays_from_idx;
--   alter table public.payment_methods drop column if exists pays_from_payment_method_id, drop column if exists is_savings;

-- 1. Columns ------------------------------------------------------------------------------------------------------
alter table public.payment_methods
  add column if not exists pays_from_payment_method_id uuid references public.payment_methods (id) on delete set null,
  add column if not exists is_savings boolean not null default false;

create index if not exists payment_methods_pays_from_idx
  on public.payment_methods (pays_from_payment_method_id) where pays_from_payment_method_id is not null;

-- 2. Cross-tenant link guard (0250 convention: a missing parent is allowed, another user's raises 23503) -------------
drop trigger if exists link_guard_payment_methods on public.payment_methods;
create trigger link_guard_payment_methods before insert or update on public.payment_methods
  for each row execute function private.assert_link_owner(
    'parent_id', 'payment_methods', 'pays_from_payment_method_id', 'payment_methods');
