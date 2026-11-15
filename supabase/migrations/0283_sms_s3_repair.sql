-- S3b: tooling to repair live rows booked by old SMS code (docs/launch/S3-dryrun.md part 7, S3b-apply.md).
-- Additive: one table and four functions, nothing the deployed app or server calls. No money row changes by itself;
-- the functions run only when someone calls them with the service role.
--
-- Rules that every repair follows:
--   * edited_at is never touched. reject_stale_write bumps server_rev for the columns it guards (migration 0278), which
--     is what stops a phone holding an older copy from pushing the old value back; stamps and flags are server-owned (I8).
--   * a soft delete sets deleted_at and retracted_by_sms_log_id in the same write (I4), and runs with sms.discarding = 1
--     so the delete trigger does not queue a discard of the message.
--   * the audit row is written before the change. A revert restores a column only if it still holds the value the repair
--     wrote (a later user edit survives), and soft-deletes an inserted row only if it is unchanged.

create table if not exists public.sms_repair_audit (
  id bigserial primary key,
  batch text not null,
  repair_type text not null,
  user_id uuid not null,
  sms_log_id uuid,
  table_name text not null check (table_name in ('expenses', 'income_events', 'sms_parse_log')),
  row_id uuid not null,
  action text not null check (action in ('update', 'soft_delete', 'insert', 'relink')),
  old_values jsonb,
  new_values jsonb,
  applied_at timestamptz not null default now(),
  reverted_at timestamptz,
  revert_note text,
  unique (batch, table_name, row_id, repair_type)
);
alter table public.sms_repair_audit enable row level security;
revoke all on public.sms_repair_audit from anon, authenticated;
revoke all on sequence public.sms_repair_audit_id_seq from anon, authenticated;

-- Sets the columns named in a jsonb patch (a JSON null clears the column) on one row.
create or replace function private.s3_set(p_table text, p_id uuid, p_patch jsonb) returns void
language plpgsql set search_path = public, pg_temp as $$
declare cols text;
begin
  select string_agg(format('%I', k), ', ') into cols from jsonb_object_keys(p_patch) k;
  if cols is null then return; end if;
  execute format('update public.%I t set (%s) = (select %s from jsonb_populate_record(null::public.%I, $2) x) where t.id = $1',
                 p_table, cols, (select string_agg(format('x.%I', k), ', ') from jsonb_object_keys(p_patch) k), p_table)
    using p_id, p_patch;
end $$;

-- p_expected maps a log id to what the dry-run report said about that message's live row:
--   table, amount, currency, day, category (expenses), refund_by (first 8 of the stamping log, or null), flags (live)
-- plus per type: new_day (T15), flags_add (T4 flag, T5), stamp_from_log (T2b), marker_log and pair_log (T9).
create or replace function public.sms_s3_apply(p_batch text, p_repair_type text, p_log_ids uuid[], p_expected jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  lid uuid; ex jsonb; tbl text; r jsonb; uid uuid; cnt int; aid bigint;
  patch jsonb; act text; reason text; src jsonb; marker uuid; pair uuid; ln jsonb;
  applied jsonb := '[]'; refused jsonb := '[]'; datecol text; newday text;
begin
  if p_repair_type not in ('T1', 'T2a', 'T2b', 'T3', 'T4', 'T5', 'T8', 'T9', 'T11', 'T15') then
    raise exception 's3: unknown repair type %', p_repair_type;
  end if;
  perform set_config('sms.discarding', '1', true);

  foreach lid in array p_log_ids loop
    reason := null; patch := null; aid := null;
    <<per_row>>
    begin
      ex := p_expected -> lid::text;
      if ex is null then reason := 'no_expected'; exit per_row; end if;
      tbl := ex ->> 'table';
      if tbl not in ('expenses', 'income_events') then reason := 'bad_table'; exit per_row; end if;
      datecol := case when tbl = 'expenses' then 'expense_date' else 'received_date' end;

      execute format('select count(*), (array_agg(to_jsonb(t)))[1] from public.%I t where t.sms_log_id = $1 and t.deleted_at is null', tbl)
        into cnt, r using lid;
      if cnt = 0 then reason := 'no_live_row'; exit per_row; end if;
      if cnt > 1 then reason := 'ambiguous_rows'; exit per_row; end if;
      uid := (r ->> 'user_id')::uuid;

      -- a user-touch signal: a note, an exclusion, an acknowledged flag, an answered held row
      if r ->> 'notes' is not null then reason := 'user_notes'; exit per_row; end if;
      if coalesce(r ->> 'spend_exclusion', r ->> 'exclusion') is not null then reason := 'user_exclusion'; exit per_row; end if;
      if jsonb_array_length(coalesce(nullif(r -> 'sms_flags_ack', 'null'::jsonb), '[]'::jsonb)) > 0 then reason := 'user_flag_answer'; exit per_row; end if;
      if r ->> 'category_source' is not null then reason := 'user_category'; exit per_row; end if;
      if exists (select 1 from sms_parse_log where id = lid and (user_id <> uid or status = 'tapped')) then reason := 'log_mismatch_or_tapped'; exit per_row; end if;

      -- the live row must still be what the report saw
      if (r ->> 'amount')::numeric is distinct from (ex ->> 'amount')::numeric then reason := 'amount_differs'; exit per_row; end if;
      if r ->> 'currency' is distinct from ex ->> 'currency' then reason := 'currency_differs'; exit per_row; end if;
      if r ->> datecol is distinct from ex ->> 'day' then reason := 'day_differs'; exit per_row; end if;
      if tbl = 'expenses' then
        if r ->> 'category' is distinct from ex ->> 'category' then reason := 'category_differs'; exit per_row; end if;
        if left(r ->> 'refund_sms_log_id', 8) is distinct from ex ->> 'refund_by'
           or (r ->> 'refund_kind' is null) is distinct from (ex ->> 'refund_by' is null) then reason := 'refund_stamp_differs'; exit per_row; end if;
      end if;
      if coalesce(nullif(r -> 'sms_flags', 'null'::jsonb), '[]'::jsonb) is distinct from coalesce(ex -> 'flags', '[]'::jsonb) then reason := 'flags_differ'; exit per_row; end if;

      act := 'update';
      case p_repair_type
        when 'T1', 'T2a' then
          if r ->> 'refunded_at' is null then reason := 'not_stamped'; exit per_row; end if;
          patch := jsonb_build_object('refunded_at', null, 'refund_kind', null, 'refund_sms_log_id', null);
        when 'T2b' then
          if r ->> 'refunded_at' is not null then reason := 'already_stamped'; exit per_row; end if;
          select old_values into src from sms_repair_audit
           where batch = p_batch and repair_type = 'T2a' and sms_log_id = (ex ->> 'stamp_from_log')::uuid and reverted_at is null;
          if src is null or src ->> 'refunded_at' is null then reason := 'stamp_source_missing'; exit per_row; end if;
          patch := jsonb_build_object('refunded_at', src -> 'refunded_at', 'refund_kind', src -> 'refund_kind', 'refund_sms_log_id', src -> 'refund_sms_log_id');
        when 'T3', 'T8', 'T4', 'T9' then
          if p_repair_type = 'T4' and tbl = 'expenses' then
            if jsonb_array_length(coalesce(ex -> 'flags_add', '[]'::jsonb)) = 0 then reason := 'no_flags_add'; exit per_row; end if;
            patch := jsonb_build_object('category', 'Transfer', 'sms_flags', coalesce(nullif(r -> 'sms_flags', 'null'::jsonb), '[]'::jsonb) || (ex -> 'flags_add'));
          else
            if tbl <> 'income_events' then reason := 'soft_delete_needs_income'; exit per_row; end if;
            marker := coalesce((ex ->> 'marker_log')::uuid, lid);
            patch := jsonb_build_object('deleted_at', now(), 'retracted_by_sms_log_id', marker);
            act := 'soft_delete';
          end if;
        when 'T5' then
          if jsonb_array_length(coalesce(ex -> 'flags_add', '[]'::jsonb)) = 0 then reason := 'no_flags_add'; exit per_row; end if;
          patch := jsonb_build_object('sms_flags', coalesce(nullif(r -> 'sms_flags', 'null'::jsonb), '[]'::jsonb) || (ex -> 'flags_add'));
        when 'T11' then
          if tbl <> 'expenses' or r ->> 'category' = 'Transfer' then reason := 'not_a_purchase'; exit per_row; end if;
          patch := jsonb_build_object('category', 'Transfer',
                     'sms_flags', coalesce(nullif(r -> 'sms_flags', 'null'::jsonb), '[]'::jsonb) || jsonb_build_array('topup_repaired', 'topup_prev:' || (r ->> 'category')));
        when 'T15' then
          newday := ex ->> 'new_day';
          if newday is null or left(newday, 7) <> left(ex ->> 'day', 7) then reason := 'day_shift_crosses_month'; exit per_row; end if;
          patch := jsonb_build_object(datecol, newday);
      end case;

      insert into sms_repair_audit (batch, repair_type, user_id, sms_log_id, table_name, row_id, action, old_values, new_values)
      values (p_batch, p_repair_type, uid, lid, tbl, (r ->> 'id')::uuid, act, r, patch)
      on conflict (batch, table_name, row_id, repair_type) do nothing
      returning id into aid;
      if aid is null then reason := 'already_applied'; exit per_row; end if;

      perform private.s3_set(tbl, (r ->> 'id')::uuid, patch);

      -- the write must have taken (a trigger may swallow it)
      execute format('select to_jsonb(t) from public.%I t where t.id = $1', tbl) into src using (r ->> 'id')::uuid;
      if exists (select 1 from jsonb_each(patch) p where src -> p.key is distinct from p.value and p.key <> 'deleted_at') then
        raise exception 's3: write did not take for %', left(lid::text, 8);
      end if;

      -- T9: the two logs are linked (the repair-flag contract)
      if p_repair_type = 'T9' and ex ->> 'pair_log' is not null then
        pair := (ex ->> 'pair_log')::uuid;
        for ln in select to_jsonb(l) from sms_parse_log l where l.id in (lid, pair) and l.user_id = uid and l.paired_log_id is null loop
          insert into sms_repair_audit (batch, repair_type, user_id, sms_log_id, table_name, row_id, action, old_values, new_values)
          values (p_batch, p_repair_type, uid, (ln ->> 'id')::uuid, 'sms_parse_log', (ln ->> 'id')::uuid, 'relink',
                  jsonb_build_object('paired_log_id', null), jsonb_build_object('paired_log_id', case when (ln ->> 'id')::uuid = lid then pair else lid end))
          on conflict do nothing;
          update sms_parse_log set paired_log_id = case when id = lid then pair else lid end where id = (ln ->> 'id')::uuid;
        end loop;
      end if;
    end;

    if reason is null then
      applied := applied || jsonb_build_object('log', left(lid::text, 8), 'type', p_repair_type);
    else
      refused := refused || jsonb_build_object('log', left(lid::text, 8), 'reason', reason);
    end if;
  end loop;
  return jsonb_build_object('applied', applied, 'refused', refused);
end $$;

-- An inserted row (booked by the real booking function from a one-off script) is audited here, and the message's
-- pointer to its row is filled when it has none.
create or replace function public.sms_s3_record_insert(p_batch text, p_repair_type text, p_log_id uuid, p_table text, p_row_id uuid)
returns bigint language plpgsql security definer set search_path = public, pg_temp as $$
declare r jsonb; aid bigint; l jsonb; ptr text;
begin
  if p_table not in ('expenses', 'income_events') then raise exception 's3: bad table'; end if;
  execute format('select to_jsonb(t) from public.%I t where t.id = $1 and t.sms_log_id = $2', p_table) into r using p_row_id, p_log_id;
  if r is null then raise exception 's3: inserted row not found'; end if;
  insert into sms_repair_audit (batch, repair_type, user_id, sms_log_id, table_name, row_id, action, old_values, new_values)
  values (p_batch, p_repair_type, (r ->> 'user_id')::uuid, p_log_id, p_table, p_row_id, 'insert', null, r)
  on conflict (batch, table_name, row_id, repair_type) do nothing returning id into aid;
  ptr := case p_table when 'expenses' then 'expense_id' else 'income_id' end;
  select to_jsonb(x) into l from sms_parse_log x where x.id = p_log_id;
  if aid is not null and l ->> ptr is null then
    insert into sms_repair_audit (batch, repair_type, user_id, sms_log_id, table_name, row_id, action, old_values, new_values)
    values (p_batch, p_repair_type, (r ->> 'user_id')::uuid, p_log_id, 'sms_parse_log', p_log_id, 'relink',
            jsonb_build_object(ptr, null), jsonb_build_object(ptr, p_row_id))
    on conflict do nothing;
    perform private.s3_set('sms_parse_log', p_log_id, jsonb_build_object(ptr, p_row_id));
  end if;
  return aid;
end $$;

create or replace function public.sms_s3_revert(p_batch text, p_repair_type text default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  a sms_repair_audit; live jsonb; restore jsonb; note text; reverted int := 0; skipped jsonb := '[]';
  snap_keys text[] := array['amount', 'currency', 'category', 'expense_date', 'received_date', 'payment_method_id', 'to_payment_method_id', 'notes', 'name'];
begin
  perform set_config('sms.discarding', '1', true);
  for a in select * from sms_repair_audit where batch = p_batch and reverted_at is null and (p_repair_type is null or repair_type = p_repair_type) order by id desc loop
    note := null;
    execute format('select to_jsonb(t) from public.%I t where t.id = $1', a.table_name) into live using a.row_id;
    if live is null then
      note := 'row_gone';
    elsif a.action = 'insert' then
      if live ->> 'deleted_at' is not null then note := 'already_deleted';
      elsif exists (select 1 from unnest(snap_keys) k where live -> k is distinct from a.new_values -> k) then note := 'edited_after_apply';
      else
        perform private.s3_set(a.table_name, a.row_id, jsonb_build_object('deleted_at', now(), 'retracted_by_sms_log_id', a.sms_log_id));
      end if;
    else
      -- compare-and-swap per column: restore only the columns that still hold what the repair wrote
      select coalesce(jsonb_object_agg(k, a.old_values -> k) filter (where live -> k is not distinct from a.new_values -> k), '{}'::jsonb)
        into restore from jsonb_object_keys(a.new_values) k;
      if restore = '{}'::jsonb then note := 'edited_after_apply';
      else
        perform private.s3_set(a.table_name, a.row_id, restore);
        if (select count(*) from jsonb_object_keys(restore)) < (select count(*) from jsonb_object_keys(a.new_values)) then note := 'partly_edited_after_apply'; end if;
      end if;
    end if;
    update sms_repair_audit set reverted_at = now(), revert_note = note where id = a.id;
    if note is null then reverted := reverted + 1;
    else skipped := skipped || jsonb_build_object('audit', a.id, 'log', left(a.sms_log_id::text, 8), 'type', a.repair_type, 'note', note); end if;
  end loop;
  return jsonb_build_object('reverted', reverted, 'skipped', skipped);
end $$;

revoke execute on function public.sms_s3_apply(text, text, uuid[], jsonb) from public, anon, authenticated;
revoke execute on function public.sms_s3_record_insert(text, text, uuid, text, uuid) from public, anon, authenticated;
revoke execute on function public.sms_s3_revert(text, text) from public, anon, authenticated;
revoke execute on function private.s3_set(text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.sms_s3_apply(text, text, uuid[], jsonb) to service_role;
grant execute on function public.sms_s3_record_insert(text, text, uuid, text, uuid) to service_role;
grant execute on function public.sms_s3_revert(text, text) to service_role;

-- The list the repair works from (scripts/qa/s3-apply-input.json, loaded by scripts/qa/sql/0283_s3_load_input.sql): one row per
-- message of the re-run, with what its live row must still look like (ex) and the row to book (ins).
create table if not exists public.sms_s3_input (
  prefix text primary key,
  usr text not null,
  rtype text not null,
  step int not null,
  ex jsonb,
  ins jsonb,
  eff jsonb
);
alter table public.sms_s3_input enable row level security;
revoke all on public.sms_s3_input from anon, authenticated;
