-- 0101 — drop the legacy sms_events table.
--
-- sms_events was written only by /api/sms/ingest, the old parser that bypassed the entire
-- funnel (no direction guard, no dispatch, no dedup, no template health). That endpoint and its
-- parser (smsParser.ts / egyptianBankPatterns.ts) are removed in the same change.
--
-- The table has zero rows in its entire history — the funnel (/api/sms/parse → sms_parse_log)
-- has always been the sole production path for both Android and iOS — and nothing references it,
-- so this is a pure cleanup with no data loss and no behaviour change.
drop table if exists sms_events;
