# Database and backend audit: DB-load phases A-C (2026-11-16)

Independent review of commits `f895d926` (phase A), `67e8e03d` (phase B) and `e11cd9b9` (phase C), migrations `0300` and `0301`, by Claude Opus with a four-voice council (Architect, Skeptic, Pragmatist, Critic). Read-only: no production writes, no code changes, nothing committed. Users are cited by nothing; no user data appears here.

**Production stopped answering during this audit.** At 07:58 UTC, after about 14 small read-only queries spread over 20 minutes, the `execute_sql` connector timed out on `select 1`. I stopped querying at that point. The owner should check the Supabase dashboard (section F, check F1) and decide whether the instance needs a restart. That hang came about an hour after phase A cut cron to 6 runs an hour, and it is the most important single fact in this report.

---

## Remediation status (2026-11-16, after the owner's restart and approval)

| Item | Status |
|---|---|
| Backups (P0) | `postgresql@17` installed; `scripts/db-backup.sh` now uses the 17 binaries. The full path (dump, encrypt, decrypt, `pg_restore --clean --if-exists`) was proven on a local Postgres 17 scratch cluster with synthetic data. Row counts matched: 47 / 738 / 12 / 1 rows, the same amount total, and all 738 foreign-key joins. **The production run is the owner's step:** it needs the database password in `~/.config/buddget/backup.env`. |
| 2FA cookie (S-1) | Reverted. `apiSecondFactor.ts` and `proxy.ts` match their pre-`67e8e03d` versions, and `secondFactorProof.ts` is deleted. New test: turning 2FA on while a session is open refuses that session once the 60 s cache lapses, even if it carries a `b2f` cookie. |
| Credit counters (B3) | Migration `0302_ai_credits_plain_sums.sql` applied. `ai_credit_windows` and `ai_quota_settle_core` are the 0298 bodies again (production md5 = file = 0298). `ai_credit_counters` (0 rows, no dependents), `ai_credit_bump` and `ai_credit_cuts` are dropped. A test pins both functions to 0298. |
| Sync (B2) | `RESUME_THROTTLE_MS` is back to 30 s. A parity test asserts that `sync_changed_since` watches exactly `sync_pull`'s tables. |
| Guardrail (C-1) | A reason now covers only the statement directly under it. Interval strings, minute ranges and minute lists need a reason. Calls the parser can't read fail the test; 0215, which re-timed `admin-metrics` before that job was removed, is the only allowlisted file. The early-exit check needs `IF [NOT] EXISTS (`. |
| Still open | Everything else in section G stays as listed, including the host and compute decision (P0, needs F1). |

## A. Executive verdict

**Rating: 5/10.** The code is careful, and most changes keep the old behaviour exactly. The problem is the premise and what was left unfinished.

- **Is it sound?** Mostly, yes. I found no data-loss path, no cross-user exposure and no change that corrupts financial records. The sync probe cannot miss a change that the full pull would have seen. The AI credit counters match the old sums by construction.
- **Did it fix the problem it was built for?** The evidence says no. Before the change, each cron run took 0-4 s and there were about 93 an hour. The failures (`job startup timeout`, `server restarted`) came in bursts: 18:00-19:59 on 11-15, then 02:00-06:59 on 11-16 (02:00-05:59 had 39 runs and 33 failures, and one run lasted 52 minutes). Since the 05:49 restart, a single-row cron bookkeeping `UPDATE` averages 1.3 s and peaks at 15 s, `SET client_encoding` averages 48 ms, and the PostgREST schema reload takes 1-2 s. A host doing almost no work answers those in microseconds, so these are signs of a starved host: CPU, disk-IO burst budget, or memory on Nano's 0.5 GB. The database then hung again at 07:58, after the change. Cutting cron from about 2,240 to 155 runs a day removes an amplifier (each pg_cron run opens a new backend, and runs pile up during a stall). It does not remove the cause.
- **Is it architecturally justified?** Partly. Phase A is good hygiene. Several phase B items (credit counters, the second-factor cookie, the two-layer settings cache) add moving parts to save a few cheap queries on a 34 MB database. Their risk is small but their benefit is close to zero, and the cookie weakens a security guarantee.
- **Hidden risks:**
  - The second-factor cookie caches "the gate said yes", not "a factor was completed" (S-1).
  - The cron guardrail can be bypassed in ways I demonstrated (C-1).
  - Backups cannot run at all (O-1).
  - The type definitions are already behind the database, and migrations were applied outside the migration runner (D-1).
- **Should it stay in production?** Yes, with the changes listed in section G. Nothing here needs an emergency rollback. The immediate work is operational: compute size and backups. Code changes come after that.

## B. Council report

The three external voices got a facts-only dossier and none of my conclusions. Their raw positions:

| Voice | Position | Strongest point |
|---|---|---|
| **Architect** (me, written first) | Keep most of it. The premise is weak. Fix the second-factor cookie, the guardrail parser and the backups. Return the resume throttle to 30 s. The counters are premature but safe. | The probe and the counters were checked and match the old behaviour. The value of the work is mostly hygiene. |
| **Skeptic** | The premise is falsified: the hang at 07:58 came after the cron cut. Revert the probe, the counters and the cookie. Replace discards-in-sync with a 5-minute cron that exits early. Treat backups as P0. | The changes move work from serial cron into bursts of client traffic, all hitting a starved host when phones open in the morning. |
| **Pragmatist** | A capacity problem was treated as a query-efficiency problem. Get off Nano (Pro plan plus Micro or Small compute, about $25-35 a month). Revert the probe, the counters and the cookie. Drop the second cache layer. | The cheapest reliable fix is the host. The clever app-side work saves almost nothing at 1,100 requests a day. |
| **Critic** | The changes are reasonable but don't fix the outage, and several turn loud failures into silent ones (notifications, discard errors, kill-switch lag). No backup. | Defined a list of silent failures, each with the cheapest signal that would catch it (section F). |

**Where they agree:**
- The root cause is host capacity or starvation, not cron volume.
- Backups are the top exposure.
- The second-factor cookie should not stay as it is.
- The guardrail test gives false confidence.
- The new zero-variance index is pointless on 990 rows.
- Retention must check the refund and balance-report links.

**Strongest dissent, and how it was resolved:**
1. **Sync probe (B2).** The Skeptic and Pragmatist want it reverted. Their argument is that a second definition of "what changed" can drift from `sync_pull`: a table added to the pull but not to the probe would be missed with no error. That argument is correct. I still keep the probe, for two reasons. A no-change pull is not free, because it returns every live budget plan, category and subcategory in full on each call, and I verified the probe matches the pull today. The condition is a test that fails when the two table lists differ. This is a disagreement I'm overriding, and it is recorded here.
2. **Credit counters (B3).** Two voices say revert, and the Critic says keep and test. Two against my initial position is a real signal. I changed my recommendation: switch back to plain sums over the new covering index before billing is switched on. The counters are correct today, but they are a second source of truth on a billing path, held up by one rolled-back proof and saving a sum over 277 rows.
3. **Second-factor cookie (B4).** The Skeptic and Pragmatist say revert, and the Critic says modify. I changed my recommendation from "modify" to "revert". Fixing it properly means binding the enforcement mode and enrolment state into the MAC, which is more security-sensitive code written to save one RPC per cold instance.
4. **Discards in sync (A1).** The Skeptic and Pragmatist want a 5-minute cron instead. I keep A1. It is scoped to the caller, bounded, and holds no lock it waits on (`SKIP LOCKED`). Moving it back to cron adds 288 runs a day and makes cleanup slower for the user who is active. I add the Critic's fix: count the failures instead of swallowing them silently.
5. **Resume throttle.** The Skeptic and Pragmatist keep 2 minutes. The Critic and I return it to 30 s. The throttle counts from the last resume, not the last sync, so someone switching between the banking app and Buddget every 90 s never reconciles on resume. With the probe in place, a resume costs one cheap query.

**Premise check.** The Skeptic challenged the question itself, and the evidence supports the challenge.

## C. Change-by-change audit

Verdicts: Keep, Keep with improvements, Modify, Replace, Revert, Cannot verify yet.

| ID | Change | Verdict | Evidence |
|---|---|---|---|
| A1 | Discards run per user inside `sync_pull_v2` and the probe, plus a 15-minute fallback | **Keep with improvements** | The function is scoped to `auth.uid()`, uses `FOR UPDATE SKIP LOCKED` with `LIMIT 200`, and matches the repo exactly. The per-row exception handler, which clears a failed request without retrying, is the same as before (0273). `sms_run_my_pending_discards` swallows every error. Fix: record the failures (SQLSTATE and a count) somewhere visible. |
| A2 | `sms-tick` every 15 minutes (heal, drain, discards) | **Keep** | All three steps exit early, using the partial indexes `processing_idx` and `discard_requested_idx` and an outbox probe. A row stuck in "processing" now heals after up to about 17 minutes instead of about 7. The five runs observed so far each took 157-176 ms. Coupling is low: each step is independent and one failing doesn't stop the others. |
| A3 | `api-rate-cleanup` hourly | **Keep** | `api_rate_limits_cleanup_idx (window_start)` exists in production and matches the predicate. The table holds 71 rows. Rows older than 25 hours can't affect an active window. |
| A4 | Admin metrics refreshed on demand under an advisory lock | **Keep with improvements** | `pg_try_advisory_xact_lock` is released at transaction end, so it cannot leak. The `retention_10` key is now written and read consistently, which is a real bug fix. Production still holds `retention_8` and `funnel_all` from 01:07, because no admin has opened the page since. Gap: when the refresh RPC errors or hits the statement timeout, the result is ignored and every key is computed live, so the database does the work twice on the page you'd use during an incident. Fix: on a failed refresh, serve the stale cache with its age. |
| A5 | `sms-zero-variance` daily, plus a new index | **Keep the schedule, revert the index** | `sms_parse_log` has 990 rows and now carries 29 indexes. The new partial covering index only adds write cost on the busiest insert table. Drop it until the table reaches about 100k rows. |
| A6 | `notifications_tick()` with a due-users prefilter | **Cannot verify yet** | The prefilter is a superset of the route's own rules: 09:00-20:59 local time, candidates, or within 6 days of the budget-month end, where the route uses 3. The timezone fallback is Cairo on both sides. At 07:00 UTC a request returned HTTP 200 (`net._http_response`), but delivery has not been shown. pg_net is fire-and-forget, so cron "succeeded" only means the request was queued. The URL `https://my.buddget.app` is hard-coded in SQL, which the region move must keep in mind. |
| A7 | Docs and run counts | **Keep** | Production has exactly the 15 documented jobs, schedules match, and every referenced function exists. Runs per day: 96 + 24 + 24 + 11 daily + 1/7 weekly = **about 155**, down from about 2,240 (-93%). The arithmetic is correct. |
| B1 | Heartbeat flushes every 10 minutes | **Keep** | Flush on `visibilitychange`, `pagehide` and the Capacitor `appStateChange` is unchanged. If iOS kills the app without firing `pagehide`, up to 10 minutes of activity counts can be lost. That is analytics only, but expect "active minutes" to drop a little. |
| B2 | Sync probe `sync_changed_since` | **Keep with improvements** | It checks the same 21 tables as the pull, plus profile and settings, with the same `updated_at > cursor - 2 min` rule. All 23 tables have `set_updated_at` triggers and use soft-delete tombstones (checked in production). The client flushes before probing, treats any error or null as "changed", and does not move the cursor forward on "false". **It cannot report "nothing changed" when the pull would have returned something.** It inherits the pull's existing limit: a transaction that commits more than 2 minutes after it stamped `updated_at` is missed by both. Fixes: add a test that the probe's table list equals the pull's, and change `RESUME_THROTTLE_MS` back to 30 s. |
| B3 | AI credit counters | **Revert before billing is enabled** | Equivalent by construction: the same per-user advisory lock as reserve, the counter is trusted only while its cut is current, otherwise it falls back to the sum, and `settle_core` is the only path that inserts. There are 0 counter rows today. It is still a second source of truth on the billing path for no measurable gain (277 events). Keep the covering index. |
| B4 | Signed `b2f` second-factor cookie | **Revert** | See S-1. |
| B5 | Tagged platform-settings cache | **Modify** | Two layers: the Next data cache (300 s, 30 s for billing) under per-instance memory caches. `revalidateTag` doesn't clear the other instances' memory caches, so the comment "every instance sees the new value at once" is wrong. A billing flip done in SQL can take up to about 60 s. Maintenance mode and minimum version can take about 5 minutes or more. Only the fallback path is tested. Fix: kill switches (billing, maintenance, minimum app version, AI throttle) use one layer with a TTL of 30 s or less. Low-risk values such as pricing can keep 5 minutes. |
| B6 | Deep health cached for 60 s | **Keep** | It removes a database write per call, and the light `/api/health` exists. Caveats: `ok=false` is cached for 60 s too, there is no single-flight across instances, and a missing data cache shows as `database_unavailable`. All acceptable. |
| B7 | `db_retention` | **Keep with improvements** | It deletes nothing today. It never touches rows with ledger links. Gap: `expenses.refund_sms_log_id` and `account_balance_reports.sms_parse_log_id` are `ON DELETE SET NULL` and aren't checked, so a deletion would quietly erase where a refund or a balance report came from. Add `NOT EXISTS` checks for both. |
| C | Cron guardrail test | **Modify** | Verified by running its own parser: `'10 seconds'` computes as a daily job, `'1-59 * * * *'` and `'0-59/2 * * * *'` compute as hourly, and one `-- cron-frequency-reason:` comment exempts every job in its file. Calls using named arguments, commands that aren't string literals, and jobs created through `execute_sql` or the dashboard are invisible to it. The early-exit check is a regex that `CREATE TABLE IF NOT EXISTS` satisfies. See C-1. |
| D | Hand-edited types; migrations applied through `execute_sql` | **Modify** | The `ai_credit_counters` table is missing from `database.types.ts`. The new entries sit out of generated order, so the next regeneration will produce a confusing diff. Every function body in production matches the repo md5 except `ai_quota_settle_core`, whose production copy lost one comment line: the apply path does not run the exact file. |
| E | `db-backup.sh`, `dev-db.sh` | **Modify (backup is P0)** | See O-1. `dev-db.sh` is safe: local only, and `reset` never uses `--linked`. It can't run here because Docker isn't installed. |

## D. Security assessment

| Area | Verdict | Detail |
|---|---|---|
| Second-factor cookie (S-1) | **Weakened. Revert.** | HMAC-SHA256 over session, user and expiry, compared in constant time, `HttpOnly; Secure; SameSite=Lax; Path=/api`, 5 minutes. It can't be forged or moved to another session. The flaw is in what it asserts. `second_factor_verified` returns `true` without checking the session when the user has no 2FA enabled, is outside `only_users`, or the mode is not `enforce`. The cookie therefore records "the gate let this session through" and is minted for every session. When a user turns 2FA on, or the owner turns enforcement on, existing sessions keep passing for up to 5 minutes; before this change it was 60 s per instance. The key is the raw `SUPABASE_SECRET_KEY`; the phase B doc says it is derived, which is untrue. Mitigation: it still needs a stolen, valid JWT, and the JWT itself lives about an hour. Production mode is `enforce` for all users. Severity **P2**. Fix: delete the proof path and keep the 60 s memory cache. If cold-instance calls ever matter, mint only when `session_second_factor_ok` itself returned true, and include the user's 2FA flag and the gate's `updated_at` in the MAC. |
| Platform settings cache | **Acceptable now, modify before launch** | Billing is off. The worst case for the billing kill switch is about 60 s. Maintenance mode and minimum version can lag about 5 minutes or more after a direct SQL change, and admin writes don't clear other instances' memory caches. |
| Auth and session consistency | **No regression apart from S-1** | Bearer callers (native) never get the cookie. The cookie is bound to one session, so switching accounts can't reuse it. |
| RLS and user isolation | **Pass** | `sync_changed_since` runs with the caller's rights (RLS applies, `auth.uid()` only). Discard helpers are `SECURITY DEFINER` and accept no user id from the client. New tables have RLS enabled and are revoked from `anon` and `authenticated`. |
| Scheduled jobs and the service role | **Pass, with a note** | The new functions revoke `PUBLIC`, `anon` and `authenticated`. `notifications_tick` reads the cron secret from vault, which is unchanged. The production URL is hard-coded in SQL. |
| AI credits and billing integrity | **Pass (by construction); revert recommended** | See B3. Same lock key as `ai_quota_reserve_v2`. A counter failure deletes the row, which falls back to the exact sum. |
| Backup and restore safety | **Fail** | See O-1. |

## E. Performance assessment

| Claim | Measured or estimated | Finding |
|---|---|---|
| Cron runs: about 2,240 → about 155 a day | **Measured** (cron.job plus the arithmetic) | Correct. |
| Lower load → no more hangs | **Contradicted** | The database hung at 07:58, about 70 minutes after the change, with 6 cron runs an hour. |
| Work per run | **Measured** | Before the change, 0-4 s each (often under 1 s) outside the stalls. `sms-tick` runs take 157-176 ms now. Run duration was never the cost; how often backends start was. |
| Index usefulness | **Verified present; plans not run** | The rate-limit, processing and discard indexes exist and match their predicates. The zero-variance index isn't needed at 990 rows. No `EXPLAIN` was run: the host was already failing. |
| Probe savings | **Estimated** | One 23-way EXISTS against a pull that returns the full budget tables. Real but small. |
| Heartbeat | **Estimated** | 30 → 6 calls an hour per open app. |
| Remaining bottlenecks | **Strongly supported** | Host starvation on Nano. The Vercel daily crons cluster at 03:00-07:20 UTC (month-carry loops over users), overlapping the worst failure window. Dashboard and tooling introspection queries take 2-7 s each. |
| Coupling | **Low** | `sms-tick`'s three steps are independent. The real coupling is discards running inside reads (A1), which is bounded. |

## F. Verification gaps

| # | Behaviour | Why it matters | Test | Where | Pass criterion | Blocks confidence? |
|---|---|---|---|---|---|---|
| F1 | The real cause of the hangs | Every other change rests on it | In Supabase Reports → Database, read CPU, **Disk IO budget %**, memory and swap, and connections. Compare 11-14 to 11-15 (before the change) with 11-16 to 11-18 (after), and mark 18:00-20:00 and 02:00-07:00 UTC | Supabase dashboard (owner) | Find which resource hits its ceiling when the `job startup timeout` bursts happen | **Yes** |
| F2 | Probe on real devices | Stale data across devices | Two devices. Change on A, then resume B: after 30 s, after 90 s, offline then online, and after a delete | iOS and Android test build | B shows every change after its next resume or nudge | Yes, for sync |
| F3 | Second-factor lifecycle | Security | If S-1 is reverted, nothing to test. Otherwise: enable 2FA on account X with session Y live, then call `/api` from Y within 5 minutes | Production web, test account | Y is refused straight away | Yes, if kept |
| F4 | `unstable_cache` on Vercel | Kill-switch lag | Flip `maintenance` with SQL, then poll `/api/app-config` from 3 regions or fresh requests | Production or preview | Visible within the documented bound everywhere | No (billing is off) |
| F5 | First notification delivery | Silent failure | Check `notification_cron_last_run`, a count of `notifications` rows created after 07:00 UTC, and push receipts | Production SQL (read-only) once the database is healthy | Rows exist with no duplicate `dedupe_key`, and the cursor is cleared | Yes, for notifications |
| F6 | Backup restores | Data-loss recovery | Install `postgresql@17`, run `db-backup.sh`, decrypt, `pg_restore` into a scratch Postgres 17, compare row counts | Local, with a scratch DB | Row counts match. Restore time recorded | **Yes** |
| F7 | Discard failures | Silent | `select count(*) from sms_parse_log where discard_requested_at < now() - interval '1 hour'` | Production SQL | 0 | No |
| F8 | `db_retention` on real data | Provenance | After the B7 fix, a dry run with `SELECT` in place of `DELETE` on a copy | Local or branch | No rows that still have a refund or balance-report link | No |

## G. Remediation roadmap

**Immediate production concerns**

| Priority | Issue | Recommended action | Risk of leaving it | Dependencies |
|---|---|---|---|---|
| P0 | O-1: no working backup (`pg_dump` 16 vs server 17.6; no Docker; launchd job not loaded; no restore tested) | `brew install postgresql@17`, put `@17` first in `PATH` in `db-backup.sh`, run it once, do the restore drill F6, then load the launchd job. Switch encryption to `age` (authenticated), or add a SHA-256 file. | A bad restart or the region move loses financial data with nothing to fall back on | Independent |
| P0 | P-1: the host is starving and hung again after the change | Read F1. If the disk-IO budget or memory hits its ceiling, enable billing and move to Micro or Small compute (about $25-35 a month). Stop pointing the dashboard, MCP or other dev tooling at production. Spread the Vercel daily crons across the day | More hangs while testers are active | F1 first, then decide |

**High-priority corrections**

| Priority | Issue | Recommended action | Risk of leaving it | Dependencies |
|---|---|---|---|---|
| P1 | S-1: second-factor cookie | Remove the `proof` argument in `proxy.ts` and delete `secondFactorProof.ts` | A 5-minute window that bypasses 2FA after enrolment or a policy change | Independent; web deploy only |
| P1 | C-1: guardrail bypasses | In `minIntervalMinutes`, reject any field that isn't `*`, a number, a list or `*/n`, and reject 2-field `N seconds` schedules. Make the reason apply to the next statement only. Add `scripts/check-cron.sql`, a read-only diff of `cron.job` against the replay, run after each migration | Per-minute jobs come back unnoticed | Independent |
| P1 | D-1: drift | Regenerate `database.types.ts` from a non-production source (second free project or local) once one exists; add `ai_credit_counters`; apply future migrations through the migration runner so history matches files | Region move or branch replay misses objects | Needs a non-production DB |

**Important improvements**

| Priority | Issue | Recommended action | Risk of leaving it | Dependencies |
|---|---|---|---|---|
| P2 | Resume throttle | `RESUME_THROTTLE_MS = 30_000` | Changes made elsewhere show up to 2 minutes late on quick app switches | Independent |
| P2 | Probe drift | Add a test that parses the latest `sync_pull` and `sync_changed_since` bodies and asserts the same table set | A table added to the pull and not the probe is never synced on quiet resumes | Independent |
| P2 | B5: kill-switch lag | Kill switches get one layer with a TTL of 30 s or less. Fix the misleading comment | An incident switch looks applied but isn't | Independent |
| P2 | A6: notification observability | Write `notification_cron_last_run` from `notifications_tick` even when nobody is due. Add a daily check on non-200 responses in `net._http_response`. Lower the stale threshold to about 26 h. Move the URL into vault or `platform_settings` before the region move | Notifications stop with nobody noticing | Region-move plan |
| P2 | A4: failed refresh means double work | Serve the stale cache and show its age when `admin_refresh_metrics_if_stale` errors | The admin page adds load while the database is struggling | Independent |

**Optional optimizations**

| Priority | Issue | Recommended action | Risk of leaving it | Dependencies |
|---|---|---|---|---|
| P3 | B3: counters | Revert `ai_credit_windows` to plain sums and drop the bump call (forward migration) before billing goes live | A second source of truth on billing | Coordinated SQL and app deploy; billing off |
| P3 | B7: retention links | Add `NOT EXISTS` checks on `expenses.refund_sms_log_id` and `account_balance_reports.sms_parse_log_id` | Refund and balance-report provenance erased after a year | Independent; nothing is deletable for months |
| P3 | A5: index | `DROP INDEX sms_parse_log_zero_variance_idx` | Small write cost | Independent |
| P3 | A1: discard errors | Count errors in the helper, visible in admin health | Silent failures | Independent |

**Forward recovery, not reversal.** 0300 dropped the zero-argument `sms_run_pending_discards()`, and 0301 dropped `ai_usage_events_user_created_idx`. Don't replay their rollback comments. Write forward migrations for each item above. The S-1, throttle and cache items are app-only and deploy on their own. B3 needs the SQL change before, or together with, any app change, and must land while billing is off.

## H. Final architectural recommendation

For 47 testers growing to a few thousand users, on Supabase, Vercel, Next.js, Zustand and offline sync, with a one-person team:

1. **Size the host before tuning queries.** At 0.5 GB, the database fails at a load where every query is trivial. Micro or Small compute is the cheapest reliability purchase available. Revisit query tuning only after F1 shows real query cost.
2. **Keep:** the phase A cron consolidation and its documentation; the early-exit pattern; set-based notification prefiltering; the sync probe, with its drift test; on-demand admin metrics, with a stale-on-failure fallback; deep health caching; retention, with the link checks.
3. **Simplify:** settings use one cache layer per risk class; plain credit sums; no signed second-factor cookie; drop the unused index.
4. **Add:** a working, restore-tested backup; a non-production database for type generation and proofs, so no development touches production; a read-only check of cron state against the repo after each migration; one daily health signal for every silent path (notifications sent, discards pending, backup age, cron failures).
5. **Don't add:** external workers, partitioning, materialized aggregates or event-driven invalidation. None of them pays for itself at this scale.

---

### Method and evidence

- **Repo.** `HEAD`, `origin/main` and `origin/dev` are all at `e11cd9b9`, with nothing changed since. I read every changed file in the three commits, `sync_pull` (0233), `sync_table_delta`, `second_factor_verified` (0258), `ai_quota_reserve_v2` (0298), the earlier `sms_run_pending_discards` (0273), `notification_candidate_users` (0147) and the notifications route.
- **Production, read-only.** Queries were run one at a time: `cron.job`; `cron.job_run_details` for 24 and 30 hours; `net._http_response`; `admin_metrics_cache` keys and ages; triggers and defaults on the 23 synced tables; indexes; md5 of every new function body compared with the repo; row counts; `pg_stat_statements`, top 15; server settings; foreign keys into `sms_parse_log`; and the 2FA gate mode, reading only the mode field. The last query (notification delivery counts) and a following `select 1` timed out.
- **Local.** The guardrail parser was run on crafted inputs in a temporary test file, which was then removed.
  - `npm run verify` **failed (exit 1)** in the test step, so the type check and build were not reached. Lint passed. The 5 failing tests are all outside this changeset:
    - `templateReplay` and `flow` timed out at 15 s;
    - the supply-chain lockfile gate timed out at 60 s;
    - `crossTabSync` failed twice: one 15 s timeout, and one assertion that got 123 where it expected 11.
  - The machine's load average was 25 during the run. I did not investigate those failures.
  - The 8 test files covering the audited code pass on their own: 51/51 (`cronGuardrails`, `secondFactorProof`, `platformCache`, `delta`, `AnalyticsHeartbeat`, `financeSync`, `admin/metrics`, `userData`). Passing tests prove only what they cover, which here is mostly fallbacks and pure functions.
- **Not done.** No `EXPLAIN` plans (host unhealthy), no device tests, no Vercel cache tests, no backup or restore run.
