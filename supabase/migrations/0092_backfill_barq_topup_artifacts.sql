-- Retract the artifacts of Barq wallet top-ups booked before the pipeline understood
-- wallets (fa202f6 / a14020b).
--
-- Loading your own Barq wallet emits two SMS and both were believed: the funding card's
-- bank posted an expense in a SPEND category, and Barq posted income. Moving your own
-- money between your own methods therefore invented income AND invented spend, and the
-- purchase later made from the wallet counted the same money a third time.
--
-- For the reporting user this is 111.55 SAR of income that never arrived and 31.41 SAR
-- of spend that never happened.
--
-- Scoped to Barq deliberately: it is the only wallet we have real SMS for. Every
-- statement is guarded so this is idempotent and a no-op for users with no Barq rows.
-- Soft-delete only — nothing is destroyed, and deleted_at can be nulled to undo.

-- 1. The Barq credit leg is not income. It is the user's own money arriving from their
--    own card, which nets to zero. Must run before step 2 nulls the income_id it joins on.
UPDATE income_events ie
SET deleted_at = now()
FROM sms_parse_log s
WHERE s.income_id = ie.id
  AND s.raw_body ILIKE '%added to your barq wallet%'
  AND ie.deleted_at IS NULL;

-- 2. Detach the retracted event, mirroring what reconcileSibling now does live.
UPDATE sms_parse_log s
SET income_id = NULL
WHERE s.raw_body ILIKE '%added to your barq wallet%'
  AND s.income_id IS NOT NULL;

-- 3. The funding leg is a transfer INTO the wallet, not a purchase — nobody buys goods
--    from their own wallet. It sat in 'Other', which counts toward spend; 'Transfer' is
--    in NON_SPEND_CATEGORIES. Matched on the exact merchant for the same reason the live
--    matcher is exact: a substring would catch shops that merely contain the name.
UPDATE expenses e
SET category = 'Transfer'
FROM sms_parse_log s
WHERE s.expense_id = e.id
  AND s.kind = 'online_purchase'
  AND lower(trim(s.merchant)) = 'barq'
  AND e.deleted_at IS NULL
  AND e.category <> 'Transfer';
