-- Paste into the SQL console AFTER migration 0278 is applied (it lives here, not in supabase/migrations, because the migration check scans that folder). Inserts synthetic rows for an existing user, runs the
-- scenarios, and always ends with an exception ('ROLLBACK_OK <result>') so nothing persists. Read the text after
-- ROLLBACK_OK: every line is PASS or FAIL. A different error text means a scenario setup or the trigger itself failed.
do $$
declare
  u uuid;
  res text := '';
  e uuid := gen_random_uuid();
  i uuid := gen_random_uuid();
begin
  select id into u from auth.users order by created_at limit 1;
  if u is null then raise exception 'no user to borrow'; end if;

  insert into expenses (id, user_id, amount, currency, category, expense_date, description)
    values (e, u, 100, 'EGP', 'Other', current_date, 'rev test');

  ---------------------------------------------------------------- (i) a server retag to Transfer bumps server_rev
  update expenses set category = 'Transfer' where id = e;
  res := res || E'\n' || case when (select server_rev = 1 and category = 'Transfer' from expenses where id = e) then 'PASS' else 'FAIL' end || ' (i) server retag to Transfer bumps server_rev';

  ---------------------------------------------------------------- (ii) a client write echoing the old rev keeps the server's category
  update expenses set category = 'Other', description = 'edited', server_rev = 0, edited_at = clock_timestamp() where id = e;
  res := res || E'\n' || case when (select category = 'Transfer' and description = 'edited' and server_rev = 1 from expenses where id = e) then 'PASS' else 'FAIL' end || ' (ii) stale client keeps category, applies description';

  ---------------------------------------------------------------- (iii) a client write echoing the current rev wins
  update expenses set category = 'Food', server_rev = 1, edited_at = clock_timestamp() where id = e;
  res := res || E'\n' || case when (select category = 'Food' and server_rev = 1 from expenses where id = e) then 'PASS' else 'FAIL' end || ' (iii) client echoing the current rev changes category';

  ---------------------------------------------------------------- (iv) a client write that never mentions server_rev behaves as today
  update expenses set category = 'Other', edited_at = clock_timestamp() where id = e;
  res := res || E'\n' || case when (select category = 'Other' and server_rev = 1 from expenses where id = e) then 'PASS' else 'FAIL' end || ' (iv) client without server_rev changes category';

  ---------------------------------------------------------------- (v) a server change between two spending categories does not bump
  update expenses set category = 'Groceries' where id = e;
  res := res || E'\n' || case when (select category = 'Groceries' and server_rev = 1 from expenses where id = e) then 'PASS' else 'FAIL' end || ' (v) spending-to-spending retag does not bump';

  ---------------------------------------------------------------- (vi) a client write cannot change server_rev
  update expenses set server_rev = 99, edited_at = clock_timestamp() where id = e;
  update expenses set server_rev = 0, edited_at = clock_timestamp() where id = e;
  res := res || E'\n' || case when (select server_rev = 1 from expenses where id = e) then 'PASS' else 'FAIL' end || ' (vi) client cannot raise or lower server_rev';
  update expenses set server_rev = 50 where id = e;
  res := res || E'\n' || case when (select server_rev = 1 from expenses where id = e) then 'PASS' else 'FAIL' end || ' (vi) a server write cannot set server_rev directly';

  ---------------------------------------------------------------- (vii) income_events
  insert into income_events (id, user_id, name, amount, currency, source_type, received_date, status)
    values (i, u, 'rev test', 100, 'EGP', 'other', current_date, 'confirmed');
  update income_events set amount = 200 where id = i;
  res := res || E'\n' || case when (select server_rev = 1 and amount = 200 from income_events where id = i) then 'PASS' else 'FAIL' end || ' (vii) server amount change bumps';
  update income_events set amount = 50, name = 'edited', server_rev = 0, edited_at = clock_timestamp() where id = i;
  res := res || E'\n' || case when (select amount = 200 and name = 'edited' and server_rev = 1 from income_events where id = i) then 'PASS' else 'FAIL' end || ' (vii) stale client amount refused, other columns apply';
  update income_events set amount = 75, server_rev = 1, edited_at = clock_timestamp() where id = i;
  res := res || E'\n' || case when (select amount = 75 and server_rev = 1 from income_events where id = i) then 'PASS' else 'FAIL' end || ' (vii) fresh client amount wins';

  ---------------------------------------------------------------- (viii) NULL server_rev
  update expenses set category = 'Other', server_rev = null, edited_at = clock_timestamp() where id = e;
  res := res || E'\n' || case when (select category = 'Other' and server_rev = 1 from expenses where id = e) then 'PASS' else 'FAIL' end || ' (viii) client write with NULL server_rev behaves as fresh';
  e := gen_random_uuid();
  insert into expenses (id, user_id, amount, currency, category, expense_date, description, server_rev)
    values (e, u, 100, 'EGP', 'Other', current_date, 'null rev', null);
  update expenses set category = 'Transfer' where id = e;
  res := res || E'\n' || case when (select server_rev = 1 from expenses where id = e) then 'PASS' else 'FAIL' end || ' (viii) row inserted with NULL server_rev is bumped to 1 by a server retag';

  raise exception 'ROLLBACK_OK %', res;
end $$;
