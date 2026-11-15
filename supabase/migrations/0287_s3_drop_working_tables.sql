-- S3b is closed: the repair list and the starting-totals snapshot were working tables for the repair run
-- (docs/launch/S3b-apply.md). The audit table sms_repair_audit and the functions of 0283 stay, so every repair
-- can still be reverted. The list is reproducible from scripts/qa/s3-apply-input.json (scripts/qa/sql/0283_s3_load_input.sql).
-- Row counts before the drop: sms_s3_input 104, sms_s3_totals_before 36. Neither is read by the app or any function.
drop table if exists public.sms_s3_input;
drop table if exists public.sms_s3_totals_before;
