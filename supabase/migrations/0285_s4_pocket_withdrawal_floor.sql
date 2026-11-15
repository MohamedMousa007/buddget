-- S4 closing batch, U-2 (docs/launch/S4-security.md section 4). adjust_pocket_balance applied a withdrawal with no
-- floor; the only check was in the caller, on a balance read earlier, so two month-carry adjustments landing on one
-- pocket at the same time could take it below zero. The floor is now inside the function, under its row lock.
-- Patched in place so the rest of the body stays byte-identical; a withdrawal is the only negative delta it accepts.
do $do$
declare
  v_def text := pg_get_functiondef('public.adjust_pocket_balance(uuid, uuid, numeric, savings_transaction_kind, uuid, uuid, date, text, text)'::regprocedure);
  v_guard text := E'    IF p_delta < 0 AND bal < 0 THEN RAISE EXCEPTION ''insufficient pocket balance''; END IF;\n';
  v_delta_anchor text := E'    bal := COALESCE(bal, 0) + p_delta;\n';
  v_legacy_anchor text := E'    RETURNING current_balance, currency INTO bal, cur;\n  IF NOT FOUND THEN RAISE EXCEPTION ''pocket not found''; END IF;\n';
begin
  if position('insufficient pocket balance' in v_def) > 0 then return; end if;
  if position(v_delta_anchor in v_def) = 0 or position(v_legacy_anchor in v_def) = 0 then
    raise exception 'adjust_pocket_balance: anchor not found';
  end if;
  v_def := replace(v_def, v_delta_anchor, v_delta_anchor || v_guard);
  v_def := replace(v_def, v_legacy_anchor, v_legacy_anchor || substr(v_guard, 3));
  execute v_def;
end $do$;
