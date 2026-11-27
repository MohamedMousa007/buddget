-- 0356_savings_labels.sql  (LOGIC_SPEC v2 §3.1, §3.2 P2, §3.3)
-- PURPOSE
--   Labels: savings_transactions rows that change a part and never an account (payment_method_id NULL,
--   transfer_group_id NULL, is_cash_flow = false, idempotency_key set). Adds:
--     idempotency_key uuid    one key per (user, part) for retry-safe writes (unique while live)
--     pair_id         uuid    ties move_out to move_in (indexed)
--     account_amount  numeric booked amount in the holder's currency (I-10); readers fall back to the live rate
--   Carry backfill: legacy source='carry' rows stored their idempotency key in transfer_group_id; it moves to
--   idempotency_key and transfer_group_id becomes NULL. balance.ts rule 5 skips 'carry' by source before rule 3, so
--   balances do not change. Tombstones included (a deleted carry row keeps blocking a re-post of its key).
--   label_part(...): server-only RPC. Copies adjust_pocket_balance's delta-ON branch (0227): advisory lock, tombstone-
--   inclusive key lookup, part locked FOR UPDATE, then it inserts the ledger row ONLY; trg_savings_tx_delta moves
--   current_balance exactly once. An existing key returns the stored balance_after.
--   Soft guard: BEFORE INSERT on savings_transactions clamps a label withdrawal to the part's balance and appends
--   " (clamped)" to notes. It never raises (a client sync batch is never blocked). Balance used = the larger of
--   current_balance and the ledger sum (sees earlier rows of the same batch statement); a re-sent row is measured
--   against the balance before it. KNOWN LIMIT: where ledger and current_balance disagree (savings_balance_drift rows,
--   'correct' rows, a new pocket whose opening_balance was also sent), the larger value wins, so the guard can miss a
--   negative there; it never clamps a release the part could cover. Only INSERT/upsert is guarded, not a plain UPDATE.
--   Label rows written by the client must use an id derived from their key (upsert by id), or a retry with a new id
--   raises on uq_savings_tx_idempotency inside the sync upsert (TypeScript step).
--   Backfill bumps updated_at only, never edited_at. No new table: sync and a0 trigger lists unchanged.
--
-- !! month-carry: carryAdjust.ts / pocketLedger.ts look up their idempotency key by transfer_group_id. After this
--    backfill a re-run of a closed month would post again. MONTH_CARRY_WRITES must stay OFF from P2 (LOGIC_SPEC §5 P2)
--    until /api/cron/month-end replaces the route.
--
-- BEFORE-COUNTS (_checks/p2_counts.sql, section 0356; expected in brackets)
--   source='carry' rows, live and deleted [6 live]; carry rows with a transfer_group_id [6]; rows per
--   (user_id, account_id, transfer_group_id) > 1 including tombstones [0]; non-carry rows sharing a group with a carry
--   row [0] (nulling the carry side would leave them as orphan moves, rule 3); rows with a label source already [0];
--   indexes on savings_transactions; savings_balance_drift() rows (where the clamp's two balances disagree);
--   private.savings_delta_enabled() [true]; amount check is >= 0 (0323), so a clamp to 0 is accepted.
--
-- EXPECTED ROWS TOUCHED
--   savings_transactions: = carry rows with transfer_group_id (query 0356.2), about 6. No balance changes
--   (the delta trigger fires only on amount, kind, account_id, deleted_at).
--
-- ROLLBACK
--   update public.savings_transactions set transfer_group_id = idempotency_key, updated_at = now()
--     where source = 'carry' and transfer_group_id is null and idempotency_key is not null;
--   drop trigger if exists label_withdrawal_clamp on public.savings_transactions;
--   drop function if exists private.clamp_label_withdrawal();
--   drop function if exists public.label_part(uuid, uuid, numeric, public.savings_transaction_kind, text, uuid, uuid, date, text);
--   drop index if exists public.uq_savings_tx_idempotency, public.savings_transactions_pair_id_idx,
--     public.savings_transactions_account_id_idx;  -- the last one only if this migration created it
--   alter table public.savings_transactions drop column if exists idempotency_key, drop column if exists pair_id,
--     drop column if exists account_amount;

-- 1. Columns ------------------------------------------------------------------------------------------------------
alter table public.savings_transactions
  add column if not exists idempotency_key uuid,
  add column if not exists pair_id uuid,
  add column if not exists account_amount numeric;

-- 2. Carry backfill (before the unique index; out/in legs share a key but sit on different parts) -------------------
update public.savings_transactions
set idempotency_key = transfer_group_id,
    transfer_group_id = null,
    updated_at = now()
where source = 'carry'
  and transfer_group_id is not null
  and idempotency_key is null;

-- 3. Indexes ------------------------------------------------------------------------------------------------------
-- Created only when no live duplicates exist (a NOTICE otherwise), so the migration never aborts on legacy rows.
do $$
begin
  if exists (select 1 from public.savings_transactions where idempotency_key is not null and deleted_at is null
             group by user_id, account_id, idempotency_key having count(*) > 1) then
    raise notice 'uq_savings_tx_idempotency skipped: duplicate live keys exist';
  else
    create unique index if not exists uq_savings_tx_idempotency
      on public.savings_transactions (user_id, account_id, idempotency_key)
      where idempotency_key is not null and deleted_at is null;
  end if;
end $$;

create index if not exists savings_transactions_pair_id_idx
  on public.savings_transactions (pair_id) where pair_id is not null;

-- label_part's key lookup includes tombstones (so the partial unique index cannot serve it) and the clamp sums a part's
-- rows: both filter on account_id. Created only when no index on savings_transactions leads with account_id yet
-- (the migration files show none; the live DB may have one from the dashboard era: no duplicate indexes).
do $$
begin
  if not exists (
    select 1 from pg_index i join pg_attribute a on a.attrelid = i.indrelid and a.attnum = i.indkey[0]
    where i.indrelid = 'public.savings_transactions'::regclass and a.attname = 'account_id'
  ) then
    create index savings_transactions_account_id_idx on public.savings_transactions (account_id);
  end if;
end $$;

-- 4. label_part (server only) -------------------------------------------------------------------------------------
create or replace function public.label_part(
  p_user uuid, p_part uuid, p_amount numeric, p_kind public.savings_transaction_kind, p_source text, p_key uuid,
  p_pair uuid default null, p_date date default current_date, p_note text default null)
 returns numeric
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare bal numeric; cur public.currency_code;
begin
  if p_user is null or p_part is null or p_key is null then raise exception 'label_part: user, part and key are required'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'label_part: amount must be positive'; end if;
  if not (
    (p_kind = 'deposit' and p_source in ('set_aside', 'opening', 'move_in', 'month_end'))
    or (p_kind = 'withdrawal' and p_source in ('move_out', 'month_end_undo', 'release', 'spent', 'close'))
  ) then raise exception 'label_part: source % does not match kind %', p_source, p_kind; end if;
  -- Delta mode off would leave the balance unmoved (this function never updates current_balance itself).
  if not private.savings_delta_enabled() then raise exception 'label_part: savings delta mode is off'; end if;

  -- Serialise concurrent runs of the same (part, key); the unique index is the backstop.
  perform pg_advisory_xact_lock(hashtextextended(p_part::text || ':' || p_key::text, 0));
  -- Tombstones count: a label the user deleted is not re-posted by a retry.
  select balance_after into bal from public.savings_transactions
    where user_id = p_user and account_id = p_part and idempotency_key = p_key
    order by (deleted_at is not null), created_at limit 1;
  if found then return bal; end if;

  select current_balance, currency into bal, cur from public.savings_accounts
    where id = p_part and user_id = p_user and deleted_at is null for update;
  if not found then raise exception 'label_part: part not found'; end if;
  bal := coalesce(bal, 0) + case when p_kind = 'deposit' then p_amount else -p_amount end;

  -- Ledger row only: trg_savings_tx_delta moves current_balance. A withdrawal over the balance is clamped by
  -- label_withdrawal_clamp, which also rewrites balance_after; the stored value is returned.
  insert into public.savings_transactions (
    user_id, account_id, kind, amount, currency, balance_after, transaction_date, notes,
    transfer_group_id, payment_method_id, is_cash_flow, idempotency_key, pair_id, occurred_at, source)
  values (
    p_user, p_part, p_kind, p_amount, cur, bal, coalesce(p_date, current_date), p_note,
    null, null, false, p_key, p_pair, now(), p_source)
  returning balance_after into bal;
  return bal;
end $function$;

revoke all on function public.label_part(uuid, uuid, numeric, public.savings_transaction_kind, text, uuid, uuid, date, text)
  from public, anon, authenticated;
grant execute on function public.label_part(uuid, uuid, numeric, public.savings_transaction_kind, text, uuid, uuid, date, text)
  to service_role;

-- 5. Soft negative guard (never raises) --------------------------------------------------------------------------
create or replace function private.clamp_label_withdrawal()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare bal numeric; cur_bal numeric; open_bal numeric; net numeric; prior public.savings_transactions;
begin
  if new.kind not in ('withdraw', 'withdrawal') or new.deleted_at is not null
     or new.source is null or new.source not in ('move_out', 'month_end_undo', 'release', 'spent', 'close')
     or new.payment_method_id is not null or coalesce(new.is_cash_flow, true) then -- only label rows are clamped
    return new;
  end if;
  -- Same row lock the delta trigger takes next, so concurrent withdrawals clamp one after the other.
  select current_balance, opening_balance into cur_bal, open_bal from public.savings_accounts
    where id = new.account_id and user_id = new.user_id for update;
  if not found then return new; end if;

  -- The client pushes a batch in ONE upsert statement and trg_savings_tx_delta is AFTER ROW (fires at statement end),
  -- so current_balance does not yet include earlier rows of this batch. Queries here do see those rows, so the ledger
  -- (opening + signed rows, as savings_balance_drift computes it) is read too, and the larger of the two is used:
  -- a false clamp would rewrite the user's own release, a missed one only leaves a negative part to repair.
  select coalesce(sum(private.savings_tx_signed(t.kind, t.amount, t.deleted_at)), 0) into net
    from public.savings_transactions t where t.account_id = new.account_id;
  bal := greatest(coalesce(cur_bal, 0), coalesce(open_bal, 0) + net);

  -- A re-sent or edited row takes the upsert's ON CONFLICT path, and EXCLUDED carries this trigger's NEW: the room is
  -- the balance before that row (its stored effect added back), so a re-send of a clamped row stays clamped and never
  -- hands money back.
  select * into prior from public.savings_transactions where id = new.id;
  if found and prior.account_id = new.account_id then
    bal := bal - private.savings_tx_signed(prior.kind, prior.amount, prior.deleted_at);
  end if;

  if new.amount > greatest(bal, 0) then
    new.amount := greatest(bal, 0);
    new.notes := coalesce(new.notes, '') || ' (clamped)';
    new.balance_after := bal - new.amount;
  end if;
  return new;
end $function$;

revoke all on function private.clamp_label_withdrawal() from public, anon, authenticated;

drop trigger if exists label_withdrawal_clamp on public.savings_transactions;
create trigger label_withdrawal_clamp
  before insert on public.savings_transactions
  for each row execute function private.clamp_label_withdrawal();
