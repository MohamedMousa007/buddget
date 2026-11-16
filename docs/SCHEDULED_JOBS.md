# Scheduled jobs

Every job the system runs on a schedule, with purpose, schedule and cost. `src/lib/server/__tests__/cronGuardrails.test.ts` fails when a pg_cron job (replayed from `supabase/migrations`) or a Vercel cron in `vercel.json` is missing here, when a job runs more often than every 15 minutes without a `-- cron-frequency-reason:` comment in its migration, or when a job that runs more than once a day lacks an early exit. Measurements: [launch/DB-load-phaseA.md](launch/DB-load-phaseA.md). Added a job? Add its row in the same change.

Rules: nothing runs more often than every 15 minutes unless the migration says why; anything sub-daily must exit on an index probe when idle; heavy aggregates are computed on demand, never on a timer.

## pg_cron (runs inside the database)

| Job | Schedule (UTC) | Purpose | Cost |
|---|---|---|---|
| `sms-tick` | every 15 min | Fails SMS rows stuck in "processing", drains the SMS stats outbox, sweeps overdue discards (fallback; sync runs them per user) | Low: three index probes when idle |
| `notifications-hourly` | hourly | `notifications_tick()` asks for due users (09:00-21:00 local, alertable or near month end) and calls `/api/cron/notifications` only when someone is due | Low when idle; one HTTP call with chunked reads when due |
| `api-rate-cleanup` | hourly | Deletes rate-limit windows older than 25 hours | Low: indexed delete |
| `analytics-rollup` | daily 00:20 | Rolls analytics events into `app_analytics_daily` | Low |
| `sms-retention` | daily 00:50 | Blanks raw SMS text after its retention window, prunes failed unlinked rows and stale corpus entries | Low |
| `cron-log-trim` | daily 00:40 | Trims `cron.job_run_details` older than 7 days | Low |
| `user-milestones` | daily 01:10 | Refreshes per-user milestone flags | Low |
| `housekeeping` | daily 01:30 | General table hygiene | Low |
| `crash_retention` | daily 01:40 | Deletes client crash rows older than 120 days | Low |
| `push-token-sweep` | daily 01:45 | Retires dead push tokens | Low |
| `site-leads-retention` | daily 01:55 | Deletes website leads older than 180 days | Low |
| `db-retention` | daily 02:10 | Deletes analytics rows older than 400 days and unlinked rejected SMS log rows older than 365 days | Low: exits when nothing is due |
| `cleanup-trusted-devices` | daily 03:20 | Deletes expired trusted devices | Low |
| `sms-zero-variance` | daily 04:17 | Quarantines SMS templates whose amount never varies (90-day scan, index `sms_parse_log_zero_variance_idx`) | Low, index-only |
| `cleanup-anon-users` | Sundays 03:15 | Removes abandoned anonymous users | Low |

Removed in database load phase A: `admin-metrics` (refreshed on admin view instead), `sms-pending-discards`, `sms-heal-stuck`, `sms-stats-drain` (merged into `sms-tick`).

## Vercel crons (`vercel.json`, all daily, region sin1)

| Path | Schedule (UTC) | Purpose | Cost |
|---|---|---|---|
| `/api/cron/prices` | 03:00 | Refreshes gold, FX and market prices | Provider calls; one write per symbol |
| `/api/cron/sms-harvest` | 04:10 | Harvests SMS knowledge into the corpus | Batched |
| `/api/cron/data-retention` | 04:40 | Application-level retention | Low |
| `/api/cron/month-carry` | 05:00 | Month-end carry and goal allocation, one user at a time (candidate for batching) | Medium, loops users |
| `/api/cron/loyalty` | 05:20 | Loyalty week roll-up | Low |
| `/api/cron/integrations` | 05:30 | Drains the integration outbox | Low |
| `/api/cron/sms-canary` | 06:50 | Daily SMS parsing canary | Low |
| `/api/cron/ios-crashes` | 07:20 | Pulls iOS crash reports from App Store Connect | Low |

`/api/cron/notifications` is called only by pg_cron (`notifications-hourly`); it is deliberately not a Vercel cron (a second scheduler only produced duplicate-key errors).
