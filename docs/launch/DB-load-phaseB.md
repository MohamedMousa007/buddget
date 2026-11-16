# Database load, phase B (2026-11-16)

Spec: the Database load plan artifact. Migration: `supabase/migrations/0301_db_load_phase_b.sql` (applied to production with `execute_sql`). Phase A: [DB-load-phaseA.md](DB-load-phaseA.md).

| Item | Before | After |
|---|---|---|
| Analytics heartbeat | flush every 2 min while visible | every 10 min while visible, plus on hide and page hide (unchanged). 30 calls an hour per open app become 6. |
| Return-to-app sync | full `sync_pull_v2` at most every 30 s | throttle 2 min (`RESUME_THROTTLE_MS`); before any pull with a cursor the client calls `sync_changed_since(cursor)` and skips the pull when it answers `false`. Error, `null`, no cursor, no profile or a cursor older than 60 days all mean "pull". The probe covers the same 21 tables and `updated_at` column the pull reads, plus profile and settings. The realtime nudge is untouched. |
| AI credit sums | session and week windows summed `ai_usage_events` on every check | `ai_credit_counters` (one row per user) kept by `ai_quota_settle_core`; `ai_credit_windows` reads it while its window cut equals the current cut, else it sums exactly as before. Resets, week rollover, session expiry and timezone changes move the cut, so they invalidate a counter by themselves. A counter failure drops the row (never fails a settle). Billing stays switched off; behaviour is unchanged. |
| Remaining sums | index `(user_id, created_at)` | covering index `(user_id, created_at DESC) INCLUDE (feature, units, cost_usd_micro, credits_exempt)`; the plain index is dropped as redundant. |
| Second-factor check | in-memory map per instance, 60 s | plus a signed `b2f` cookie (HMAC over session id, user id and expiry; key derived from the server secret; http-only, `/api` only, 5 min). A cold instance trusts a valid cookie instead of calling `second_factor_verified`. Bearer (native) callers keep the in-memory path. Only a verified answer ever mints it. Deviation to note: the verified state can now be trusted for up to 5 minutes (was 60 s per instance); it cannot be forged or moved to another session or user. |
| Platform settings | per-instance memory caches | `cachedSetting()` (Next data cache, tag `platform-settings`) under the existing memory caches for: AI pricing, client gate (min versions), AI throttle, app config (maintenance, announcement) and the billing switch (30 s). Admin writes (`/api/admin/platform`, AI throttle) call `revalidateTag`. Direct SQL edits (for example flipping billing) reach every instance within the revalidate time (30 s to 5 min). |
| Deep health | 7 queries and a rate-limit write on every call | whole answer cached 60 s for all callers; no rate-limit write (the cache is the limiter). `/api/health` (no database) already exists as the light liveness endpoint; point uptime monitors at it. |
| Retention | none for `app_analytics_daily`; `sms_parse_log` pruned only for failed rows | daily `db-retention` (02:10 UTC, exits when nothing is due): analytics rows older than 400 days; `sms_parse_log` rows with status `rejected`, older than 365 days and with no ledger link (expense, income, debt payment, savings transaction, pairing, or an `expenses`/`income_events` row pointing at them). Booked rows are kept. Today both deletes find 0 rows (533 analytics rows, 990 SMS rows). |

## Proofs run on production (rolled back, small)

- Credits match the old computation: for one real user with a session row, four settles (one `sms`, excluded) through the real `ai_quota_settle_core`. After each step, counter week/session values equaled the raw sums: 5.873/1.05, 7.973/3.15, 7.973/3.15 (sms step unchanged), 12.173/7.35. The first settle rebuilt the counter, the next three incremented it.
- `sync_changed_since`: for the same kind of user with the JWT claim set, `now()` and 3 hours old cursors answered `false`, a 400-day cursor answered `true`; `sync_pull_v2` returned the profile; `sms_run_my_pending_discards()` returned 0.

## Not verified

- A real client resuming with the probe (needs a device or session); the cursor handling is unit-tested with `hasChangesSince`.
- `unstable_cache` behaviour on Vercel (tests exercise the fallback path only); a failed read is never cached by design.
- The deployed `b2f` cookie on a real 2-step account; unit tests cover mint and verify, including another session and a forged value.
- `db-retention` deleting anything (nothing is old enough yet).
- Vercel Observability numbers for request volume before and after; the estimates above are per-client arithmetic.
