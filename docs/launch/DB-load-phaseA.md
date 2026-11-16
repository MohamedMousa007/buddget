# Database load, phase A (2026-11-16)

Spec: the Database load plan artifact (claude.ai/artifact/2jGQD3VBdheNSgnVxKmNco). Migration: `supabase/migrations/0300_db_load_phase_a.sql` (applied to production with `execute_sql`).

## Measured before (live, read-only, 3 small queries)

`cron.job` held 17 jobs. Runs and durations, last 3 days (`cron.job_run_details`):

| Job | Schedule | Runs / 3 d | Avg s | Max s | Failed |
|---|---|---|---|---|---|
| sms-pending-discards | every minute | 1,987 | 10.1 | 2,583 | 205 |
| sms-heal-stuck | */5 | 817 | 16.5 | 3,129 | 55 |
| sms-stats-drain | */5 | 816 | 14.9 | 2,817 | 55 |
| api-rate-cleanup | */10 | 407 | 13.1 | 2,462 | 23 |
| admin-metrics | hourly | 69 | 14.6 | 688 | 5 |
| notifications-hourly (job 15, live only) | hourly | 68 | 2.0 | 55 | 3 |
| sms-zero-variance | hourly | 66 | 1.4 | 49 | 2 |
| 11 daily jobs | daily | 3 each | under 1 (cleanup-trusted-devices 640 avg, one hang) | | 1 |

Reading the numbers: the work itself is tiny (these functions do milliseconds of work on a 990-row `sms_parse_log`), but runs during the hangs took thousands of seconds, so per-run overhead is what saturates the 0.5 GB instance. Even pg_cron's own bookkeeping statements averaged about 1 s (`pg_stat_statements`: `insert/update cron.job_run_details`, 66 calls, 179 s total), the top entry by total time. Recorded run counts are lower than the schedule implies (1,987 of 4,320 minute runs) because runs were skipped while the database was hung. The `pg_stat_statements` counters were recently reset, so the other top entries are tooling catalog queries (migration listing, type generation, schema introspection), 3-9 s each, which supports the "development against production" finding.

Scheduled runs a day at the schedule rate: about 2,240 (1,440 discards, 288 heal, 288 drain, 144 rate cleanup, 24 each for metrics, zero-variance, notifications, plus 10 daily).

## Changes

| Item | Before | After |
|---|---|---|
| admin-metrics | hourly, 9 aggregates | job removed; `adminMetrics()` calls `admin_refresh_metrics_if_stale()` when the cache is older than 15 min; one refresh at a time (`pg_try_advisory_xact_lock`); a 15-45 min old value is served while another admin refreshes; older is computed live. The refresh now writes the keys the code reads (`retention_10`; the old `retention_8` never matched, so that aggregate was always computed live) and no longer computes the unread `funnel_all`. |
| deep health | 503 if the metrics cache was over 6 h old | cache age is reported only; with no schedule an old cache is normal |
| sms-zero-variance | hourly | daily 04:17 UTC; index `sms_parse_log_zero_variance_idx (matched_template_id, received_at) INCLUDE (sms_hash, amount)`; early exit when no active template |
| notifications-hourly | live-only `net.http_post` | in the migration as `notifications_tick()`: asks `notification_due_users()` first, no HTTP call when nobody is due. The route fetches due users in one RPC (09:00-21:00 local window, alertable or within 6 days of the budget-month end; TypeScript still decides per user), prefetches debts, recurring payments and subscriptions per chunk of 96 users instead of per user, and skips the cursor write when unchanged. Secret stays in vault. |
| sms-pending-discards | every minute | `sync_pull_v2` runs the caller's overdue discards (`sms_run_my_pending_discards()`, never raises); the 15-minute `sms-tick` is the fallback. Still 30 s minimum before a discard runs (the undo window); a revive still clears the flag. `sync_pull_v2` is now volatile. |
| sms-heal-stuck + sms-stats-drain | */5 each | one `sms-tick` every 15 min: heal (early exit on the `status='processing'` partial index), drain (early exit when the outbox is empty), discards fallback (early exit when none requested) |
| api-rate-cleanup | */10 | hourly. The `window_start` index already existed (`api_rate_limits_cleanup_idx`, 0215), so no new index. |

After: 14 jobs, about 154 runs a day (96 sms-tick, 24 rate cleanup, 24 notifications, 10 daily, 1 weekly share), down from about 2,240 (-93%). Verified live after applying: `cron.job` lists the 14 jobs; `sms_tick()` returns 0; `notification_due_users()` returns all 48 users near a month end and 0 at a night hour; `sync_pull_v2` still answers.

Not verified: a full authenticated sync with a pending discard (needs a user session; the work is the same function the cron ran, with a user filter), and a real hour of `notifications_tick()` delivery (the next top of the hour shows in `cron.job_run_details` and `notification_cron_last_run`). The owner checks idle CPU on the Supabase observability page.

## Nightly backup (not installed; needs the owner)

1. Choose the folder (default `~/Backups/buddget`) and make a passphrase: `mkdir -p ~/.config/buddget && openssl rand -base64 48 > ~/.config/buddget/backup.key && chmod 600 ~/.config/buddget/backup.key`. Keep a copy of the key somewhere safe outside this Mac; without it the backups cannot be opened.
2. Create `~/.config/buddget/backup.env` (chmod 600) with `BACKUP_DB_URL='postgresql://...'` (the Supabase session pooler URI, which holds the database password) and optionally `BACKUP_DIR`.
3. Test once: `bash scripts/db-backup.sh` (needs `pg_dump`, at `/opt/homebrew/opt/postgresql@16/bin`).
4. Install: `sed -e "s|__REPO__|$PWD|" -e "s|__HOME__|$HOME|" scripts/launchd/app.buddget.db-backup.plist > ~/Library/LaunchAgents/app.buddget.db-backup.plist && launchctl load ~/Library/LaunchAgents/app.buddget.db-backup.plist`. It runs at 03:30 local time; the Mac must be awake. Stop with `launchctl unload` of the same file.
5. Restore: see the last line of `scripts/db-backup.sh`.

Without `BACKUP_DB_URL` the script falls back to `supabase db dump --linked` (schema, data and roles), which needs Docker and `supabase link`. Roles are not part of the `pg_dump` path (the managed database does not allow it). Not run yet: the script is syntax-checked only.

## Development off production

- `scripts/dev-db.sh up|reset|types|down` runs a local Supabase (`supabase start`) and regenerates `database.types.ts` from it. It needs Docker, which is not installed on this Mac; the alternative is a second free Supabase project used only for migrations, type generation and proof runs (the free plan allows two).
- Not verified: that all 300 migrations replay on a fresh local database (some use vault and pg_net).
- The repo already has a Postgres-only harness for admin SQL (`npm run test:pg`, `scripts/qa`).
- Proposed `CLAUDE.md` line (not added; waiting for the owner), under "Database & migrations": `- No development, type generation or proof runs against production. Use scripts/dev-db.sh (local Supabase) or the second free project; production receives finished migrations only, applied once.`
- This phase hand-edited `database.types.ts` for the seven new function signatures instead of regenerating, to avoid a heavy catalog query on the fragile production database.
