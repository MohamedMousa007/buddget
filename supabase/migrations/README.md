# Migrations: numbering and the live ledger

Project `ydihurtbcnoflhormgzi`. Files here are applied by hand (SQL editor / MCP `execute_sql` or `apply_migration`), not by `supabase db push`.

## Ledger (`supabase_migrations.schema_migrations`)
- Format: `version` is a 14-digit timestamp (`YYYYMMDDHHMMSS`), `name` is the file stem (`0150_accounts_core`) or, for the oldest rows, the bare description (`sms_v2_regex_first` for `0059_sms_v2_regex_first.sql`). `statements` and `created_by` stay NULL on rows written without the CLI.
- Backfill of 2026-11-05 (QA round 5, DBL-1): 35 files whose objects were verified to exist live but had no ledger row were recorded with `insert ... on conflict do nothing`. `version` is the timestamp the file was first committed (UTC), nudged by seconds to stay unique; files not yet committed got `20261105120000`+. It is bookkeeping only: the timestamps are approximate, the numeric prefix in the file name is the real order.
- Backfilled: 0038, 0041, 0047, 0048, 0049, 0051, 0052, 0053, 0054, 0063, 0064, 0066, 0080, 0126, 0127, 0128, 0150-0157, 0170, 0228, 0229, 0231-0236, 0238, 0239.
- NOT backfilled on purpose (cannot be proven by "the object exists live"): files whose objects were later dropped or renamed (001-007, 0035, 0036, 0039, 0040, 0042-0046, 0050, 0058, 0062, 0065 drop, 0077, 0078, 0097_savings_vault_and_default_carry), files that only change policies, grants or data and create nothing to look for (002, 003, 0163, 0172, 0173, 0176, 0230), and files already in the ledger under a different number or name (0108 is `0104_debt_payments_funded_from_savings`; most of 0055-0061, 0072-0075, 0081-0107, 0109-0125, 0129-0149, 0158-0181, 0209, 0210 are recorded by description).
- Ledger rows without a file (0001-0023 backup/backfill era, `housekeeping_fix`, `portal_roles_and_policies`, `0126a_ai_gateway_tables` ...) were applied from the dashboard and never had a repo file.
- Missing numbers 0193, 0200, 0214, 0222 were never used.

## Duplicate numbers
These prefixes are used more than once: 0065, 0079, 0092, 0093, 0096, 0097, 0098, 0099, 0100, 0101, 0102, 0103 (twice each), 0198 (three times), 0209, 0210 (twice each).
They were applied to production under those names and the ledger records them by name, and `scripts/check-migrations.mjs` grandfathers exactly these counts, so the files are left as they are (renaming would break the file-to-ledger name match). Any NEW reuse of a prefix, or a further file under a grandfathered one, fails `npm run verify`.
Numbers 0237 and 0240+ had no file when this note was written; check `ls` before taking one.

## New functions are private by default (migration 0250)
Since 0250 a function created by `postgres` has no EXECUTE for `PUBLIC`, `anon` or `authenticated` (only `postgres` and `service_role`). A client RPC must say so in its own migration: `GRANT EXECUTE ON FUNCTION public.name(args) TO authenticated;` (and make it check `auth.uid()` when it is SECURITY DEFINER). Triggers and service-role-only functions need nothing.
