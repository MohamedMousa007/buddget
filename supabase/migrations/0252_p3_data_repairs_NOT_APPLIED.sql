-- QA6 P3 data repairs. STATUS: NOT APPLIED. These rewrite or delete real user rows; the owner decides and runs them.
-- Every block is independent. Counts measured live 2026-11-06 are in the comment above each block; re-run the SELECT first.

-- DBI-2: 1 live budget_plan_activations row points at a soft-deleted plan (new rows are handled by 0251's trigger).
-- SELECT count(*) FROM budget_plan_activations a JOIN budget_plans p ON p.id = a.plan_id WHERE p.deleted_at IS NOT NULL AND a.deleted_at IS NULL;  -- 1
UPDATE budget_plan_activations a SET deleted_at = p.deleted_at
  FROM budget_plans p WHERE p.id = a.plan_id AND p.deleted_at IS NOT NULL AND a.deleted_at IS NULL;

-- DBI-3: 1 expense and 1 income_event keep an sms_log_id whose parse-log row was purged (0251 stops new ones).
-- SELECT count(*) FROM expenses e WHERE sms_log_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sms_parse_log l WHERE l.id = e.sms_log_id);       -- 1
-- SELECT count(*) FROM income_events e WHERE sms_log_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sms_parse_log l WHERE l.id = e.sms_log_id);   -- 1
UPDATE expenses e SET sms_log_id = NULL WHERE sms_log_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sms_parse_log l WHERE l.id = e.sms_log_id);
UPDATE income_events e SET sms_log_id = NULL WHERE sms_log_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sms_parse_log l WHERE l.id = e.sms_log_id);

-- DBI-4: 3 legacy expenses flagged is_debt_payment with no debt link (Apr-Aug 2026, no sms). Clearing the flag makes them
-- plain Debt-category expenses; linking them to a debt needs the owner to say which debt, so the flag is what this clears.
-- SELECT count(*) FROM expenses WHERE is_debt_payment AND linked_debt_payment_id IS NULL AND linked_debt_id IS NULL AND deleted_at IS NULL;  -- 3
UPDATE expenses SET is_debt_payment = false
 WHERE is_debt_payment AND linked_debt_payment_id IS NULL AND linked_debt_id IS NULL AND deleted_at IS NULL;

-- DBI-5: 5 duplicate live payment methods (same user, lower(name), type). Keep the oldest, move every reference to it,
-- tombstone the rest, then forbid new duplicates. The index would also park a legitimate offline duplicate push
-- (sync parks the row and shows the set-aside banner), so apply only if the owner accepts that behaviour.
-- SELECT count(*) FROM (SELECT 1 FROM payment_methods WHERE deleted_at IS NULL GROUP BY user_id, lower(name), type HAVING count(*) > 1) x;  -- 5
CREATE TEMP TABLE pm_dupe_map ON COMMIT DROP AS
  SELECT id AS dupe_id, first_value(id) OVER (PARTITION BY user_id, lower(name), type ORDER BY created_at, id) AS keep_id
  FROM payment_methods WHERE deleted_at IS NULL;
DELETE FROM pm_dupe_map WHERE dupe_id = keep_id;
UPDATE expenses x SET payment_method_id = m.keep_id FROM pm_dupe_map m WHERE x.payment_method_id = m.dupe_id;
UPDATE expenses x SET to_payment_method_id = m.keep_id FROM pm_dupe_map m WHERE x.to_payment_method_id = m.dupe_id;
UPDATE income_events x SET payment_method_id = m.keep_id FROM pm_dupe_map m WHERE x.payment_method_id = m.dupe_id;
UPDATE income_sources x SET payment_method_id = m.keep_id FROM pm_dupe_map m WHERE x.payment_method_id = m.dupe_id;
UPDATE subscriptions x SET payment_method_id = m.keep_id FROM pm_dupe_map m WHERE x.payment_method_id = m.dupe_id;
UPDATE recurring_expenses x SET payment_method_id = m.keep_id FROM pm_dupe_map m WHERE x.payment_method_id = m.dupe_id;
UPDATE debt_payments x SET payment_method_id = m.keep_id FROM pm_dupe_map m WHERE x.payment_method_id = m.dupe_id;
UPDATE savings_transactions x SET payment_method_id = m.keep_id FROM pm_dupe_map m WHERE x.payment_method_id = m.dupe_id;
UPDATE payment_methods p SET deleted_at = now() FROM pm_dupe_map m WHERE p.id = m.dupe_id;
CREATE UNIQUE INDEX IF NOT EXISTS payment_methods_user_name_type_live_uq
  ON payment_methods (user_id, lower(name), type) WHERE deleted_at IS NULL;

-- AUT-6: 1 legacy trusted_devices row without secret_hash is still trusted by device id alone. The code now refuses to
-- upgrade it (the user does one OTP and is re-trusted with a secret), so deleting it is optional tidy-up.
-- SELECT count(*) FROM trusted_devices WHERE secret_hash IS NULL;  -- 1
DELETE FROM trusted_devices WHERE secret_hash IS NULL;
