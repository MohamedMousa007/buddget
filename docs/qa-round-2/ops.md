# QA Round 2: BACKEND OPS (read-only discovery)

Method: code read of admin/cron/webhook/push/email/support/flags routes, live Supabase SELECTs (project ydihurtbcnoflhormgzi), get_advisors, query_logs. No repo edits, no DB writes, no probes created by this agent (the 4 untracked qa2-*.probe.test.ts files in git status belong to other agents).
Already-known items (QA_ROUND_PLAN A1-A25, D1-D9, B*, S*) not repeated.

## RBAC matrix (route -> guard -> inner checks)

| Route | Guard | Inner / note |
|---|---|---|
| access GET | financial.approve | owner only, ok |
| ai/cost GET/POST | ai.cost.view / .manage | ok |
| analytics, analytics/onboarding | analytics.view | ok |
| audit GET | audit.view | ok |
| auth/* | any staff (+sessionOptional on login/code/setup/biometric/logout) | ok, all audited |
| crashes GET/POST | crashes.view / .manage | ok |
| emails GET/log/setup | emails.view | log masked via maskIf |
| emails POST | emails.manage | NO step-up, NO second approver (see O2) |
| flags GET/POST | flags.view / .manage | delete audit has no "before" |
| loyalty GET/POST | loyalty.view / .manage | adjust via RPC (needs 0188 applied; it exists live) |
| overview | overview.view | ok |
| plans GET/POST | billing.view / .manage | upsert default status bug (O11) |
| platform GET/PATCH/POST | platform.view / .manage | min_app_version no sanity bound (O8), PATCH writes local disk (O13) |
| sms/health, push-health | sms.view | ok |
| sms/logs GET | sms.view | POST: guard has no permission; reveal needs grant, create_ticket needs support.reply only (no sms.view) |
| sms/promotion, templates | sms.view + sms.manage for writes | ok |
| staff GET / POST | staff.view / staff.manage | role assignment checks rank only (O5) |
| support/macros | GET support.reply, POST support.manage | ok |
| support/tickets(+[id]) | support.view / reply / manage | ok |
| users GET list, users/[id] GET | users.view | unmasked PII reads not audited (O6) |
| users/[id] POST | any staff then REQUIRES[op] | notify/send_password_reset/clear_* all `users.tools`, held by lowest support_agent (O4); `note` not audited |
| users/[id]/activity | users.logs | ok after grant gate |
| users/[id]/export | dsr.manage + grant + step-up | ok |
| users/[id]/financial | users.view; request needs financial.request; approve/deny/exclude owner-only | ok |

No route found that checks a weaker permission than its action warrants except the users.tools bundling (O4) and the email publish path (O2). Self-escalation: `update` on own staff row is blocked by rank (equal rank), `heldBy` blocks granting unheld extras, OWNER_ONLY stripped at resolve time. Role grid today is safe only because `admin` holds every non-owner permission (O5 is latent).

## Findings

### O1 (P1) Vercel crons appear to have never completed in production
- Files: vercel.json (3 crons), src/lib/server/cronAuth.ts:7-10, src/app/api/cron/notifications/route.ts (final upsert of `notification_cron_cursor`), cron/prices.
- Evidence (live SELECT): `platform_settings` holds only `prices_refresh_attempt`; the notifications cron always ends with an upsert of `notification_cron_cursor`, so that row would exist after any completed run. `notifications` (90-day window) contains ONLY sms_expense / sms_income / sms_confirm: zero recurring_due, recurring_tomorrow, month_end, subscription or goal alerts, although every user_settings row should have received `month_end` on Sep 28-30 and there are 5 active subscriptions + 2 candidate users. `asset_prices` last updated 2026-10-26 21:16 (a /api/prices/refresh self-heal write) while the 03:00 UTC prices cron on 2026-10-27 left no write (checked at 06:21 UTC). `integration_outbox` has 0 rows (cannot judge).
- Cause hypothesis: `isAuthorizedCron` returns false when `CRON_SECRET` is unset, so every Vercel cron call gets 401; or crons not registered on the production project. Cannot see Vercel from here.
- Impact: no due/tomorrow/month-end/subscription/goal push or in-app alerts ever; price staleness; legacy SMS harvest never runs.
- Fix: set CRON_SECRET in Vercel production, check Vercel cron logs; add a deep-health check on `notification_cron_cursor` / last cron success (see O14).

### O2 (P1) Auth email templates can be edited by any `emails.manage` holder to exfiltrate reset links and OTP codes
- Files: src/app/api/admin/emails/route.ts:90-190 (saveDraft/publish), src/lib/email/safeHtml.ts:15-24, src/lib/email/validate.ts:13-32.
- Problem: allow-list blocks script/handlers/javascript: but not external hosts. `{{link}}` / `{{code}}` may be placed inside `<img src="https://evil.example/{{link}}">` or an `<a href>`. Publish is immediate, no step-up, no second reviewer, no extra permission for security-critical scenarios (password_reset, sign_in_code, confirm_signup, email_change, reauthentication). Role `engineer` (rank 20, no user permissions at all) holds emails.manage.
- Scenario: engineer publishes password_reset with a tracking image containing {{link}}; the next user who resets their password leaks a valid verify link to the attacker (account takeover). Test-send route also feeds unvalidated content (`readContent` size only).
- Fix: forbid variables `link`/`code` inside any URL whose host is not the app/Supabase origin, forbid external `src`/`href` in auth scenarios, require owner step-up for publishing auth scenarios, audit with a diff.

### O3 (P1) `sms_retention` pg_cron job fails every night; raw SMS bodies are never purged
- Evidence: cron.job_run_details jobid 7 `failed` on every run in the 3-day window (null value in column "raw_body" violates not-null). `public.sms_retention()` does `UPDATE sms_parse_log SET raw_body = NULL` but the column is NOT NULL. 679 rows older than 30 days still hold raw_body.
- Also the second statement (`DELETE FROM sms_corpus ...`) never runs because the function aborts.
- Impact: 30-day retention promise on bank SMS text is not enforced (privacy/compliance), sms_corpus grows.
- Fix: set `raw_body = ''` (or make column nullable) and wrap statements so one failure does not skip the other; alert on any failed cron.job_run_details row (log is trimmed to 3 days by job 3, which hides it).

### O4 (P2) `users.tools` bundles harassment-capable actions and is held by the lowest support role, with no rate limit
- Files: src/app/api/admin/users/[id]/route.ts:50-70 REQUIRES, case 'notify' (:~150), 'send_password_reset', 'clear_trusted_devices', 'remove_biometric', 'reset_sms_tokens'.
- `support_agent` (rank 30, users.view+users.tools) can push arbitrary title/body (80/400 chars) to any user's lock screen with no rate limit and no reviewer ("Your account is locked, visit ..."), trigger unlimited password-reset emails to any user, and clear another user's trusted devices/biometric (downgrades their 2FA). Audit rows exist but notify only logs the title.
- Fix: split `users.notify` and security-reset ops into separate permissions, add per-staff and per-target rate limits (`api_rate_hit`), store notify body in audit metadata, templates only for support_agent.

### O5 (P2, latent) Role assignment does not check that the assigned role's permissions are held by the actor
- File: src/app/api/admin/staff/route.ts:67-72 (invite), :140-146 (update roleKey).
- Only `outranks(actor.rank, target.rank)` is checked. A non-owner with staff.manage can assign any lower-ranked system role even if that role holds permissions the actor lacks (extra permissions get the `heldBy` check, roles do not). Safe today only because `admin` (rank 10) holds every non-owner permission; the first custom or trimmed admin role makes it an escalation (also: `set_role_permissions` is owner-only, but `upsert_role` re-saves permissions without revoking holders' sessions, unlike set_role_permissions).
- Fix: `heldBy(ctx, rolePermissions)` on invite and update; revoke sessions on upsert_role of an existing role.

### O6 (P2) Audit gaps: unmasked PII reads and several writes are not audited
- Unlogged: user list / detail GET with `users.pii` (full email, phone, city), users/[id]/activity, emails/log, crashes GET (user ids), admin_user_notes insert (`note` op), `verify_email` is logged but `note` and `GET` are not, user `notify` logs title only, platform PATCH logs but not actor IP of disk write, flags/plans edits log no before/after (plan upsert has no metadata at all, flag delete has no snapshot).
- Existing live audit actions (86 rows): only auth.*, staff.invite*, crash.status, so most mutation categories have never been exercised in prod.
- Fix: add `pii.user.view` audit (rate-collapsed per staff/user/10 min like the financial notice), audit notes, include before/after for plans/flags/settings.

### O7 (P2) Auth email hook is not idempotent and re-sends on retry; no suppression list
- Files: src/app/api/auth/email-hook/route.ts:34-38, src/lib/server/email/send.ts:62 (`Idempotency-Key: crypto.randomUUID()`), src/app/api/webhooks/resend/route.ts.
- Supabase hook retries (timeout/5xx) are re-sent as brand-new mails; the `webhook-id` header is verified but never used as the Resend idempotency key. With two planned emails (secure email change) one failure returns 502 and the retry duplicates the one that already went out. Replay of a signed request inside the 5-minute window re-sends an OTP mail.
- Resend webhook records `bounced`/`complained` but `sendTemplatedEmail` never consults email_log, so bounced/complaining addresses keep being mailed (reputation/compliance). No List-Unsubscribe needed for transactional auth mail, but staff invite and any future non-transactional scenario would need it.
- Fix: derive the Idempotency-Key from `webhook-id` (+ recipient), add a suppression check on bounced/complained within N days.

### O8 (P2) `min_app_version` can lock every user out with a typo
- File: src/app/api/admin/platform/route.ts:21-35 (sanitizeSetting), POST :103-115. Only `^\d+(\.\d+){0,2}$` is validated; no comparison with the newest shipped build, no step-up, no confirm, requires only platform.manage (role `engineer`). Takes effect within 60 s (clientGate TTL) on every API route and the DB gate.
- Fix: refuse a minimum above the latest known released version, require step-up, show blast radius (% of active devices below).

### O9 (P2) Notification spam and timing
- `evaluateAlerts` (src/lib/notifications/evaluateAlerts.ts:60-70): `recurring_due` fires for `nextDueDate <= today` with dedupe key per day, so an overdue recurring payment pushes the user every single day forever until paid. `month_end` dedupe key is per month, so the `daysLeft===0` "last day" warning can never fire after the 3-day notice.
- Cron runs once at 06:00 UTC for everyone (vercel.json) regardless of user timezone, so delivery is at 23:00-02:00 local for the Americas; no quiet-hours handling. `support_reply` push shows the first 300 chars of the staff reply on the lock screen.
- Also `notify` and support reply use `dedupeKey: ...Date.now()`, so a double click emits two pushes.

### O10 (P2) Admin analytics heartbeat RPC can be inflated without bound
- `public.analytics_touch` (client-callable, authenticated, no rate limit): each call adds up to 900 active_seconds and 5 sessions; a loop inflates `app_analytics_daily` far beyond 24 h/day and skews retention/engagement dashboards; `p_paths` keys are arbitrary length (40 keys kept, but each key unbounded) so a row can grow large. Also `api_rate_hit` DELETEs expired rows on every call (table scan per hit) and uses a fixed window (2x burst at boundaries).
- Fix: cap per-day active_seconds (86400) and sessions, limit key length, rate-limit via `api_rate_hit`.

### O11 (P3) Plan upsert silently resets status to `draft`
- src/app/api/admin/plans/route.ts:83 `status: p.status ?? 'draft'`, and the default-plan guard on :74 only runs when `p.status` is provided. A payload without `status` demotes an active (even the default) plan to draft. `set_default` does two non-atomic updates (no default plan between them: getUserEntitlements falls back to an empty-limit `free`). No before/after in the audit row.

### O12 (P3) Entitlement edge cases
- `past_due` keeps granting the paid plan indefinitely (resolve.ts:`grantsPlan`), no grace window. `trialing` with null trial_ends_at and `active` with null current_period_end never lapse (set_entitlement accepts any plan/status with no end date). Entitlements are consumed server-side only by /api/budget/ai; flags and plan limits are advisory client-side (a disabled flag does not block its API).

### O13 (P3) Admin AI-throttle control cannot work on a serverless host
- src/lib/server/aiRuntimeConfig.ts:131-158 writes JSON to local disk; on Vercel that fails (route already returns 507) or diverges per instance. `maintenance` setting is only returned by /api/app-config, no server route enforces it.

### O14 (P3) Health endpoints cannot see the failures above
- /api/health/deep checks one DB read and metrics-cache age only; it does not report pg_cron failures (sms-retention failing 4 nights), last notification cron cursor, outbox backlog/dead rows, Firebase config. `x-forwarded-for` first hop keys the rate limit.

### O15 (P3) Webhook idempotency/ordering
- Sentry webhook (`record_client_crash`): HMAC only, no timestamp or delivery id, so retries/replays increment `occurrences` and re-open `resolved` crashes (RPC sets status back to `new`). Linear webhook: out-of-order or delayed retries of a `started` event flip a `resolved` ticket back to `open` and null `resolved_at`; no event id dedupe (status check makes it mostly harmless). Resend handler is idempotent.

### O16 (P3) Outbox/Linear
- drainOutbox: Linear issue created then DB update to `sent` unchecked; a failure or the 60 s function limit leaves the row due again, producing a duplicate Linear issue (no dedupe key on the Linear side). Retries only happen on the once-daily cron (O1) or the single `after()` attempt. Linear issue title contains the user-written ticket subject (can contain PII) despite the header comment promising none.

### O17 (P3) Push token lifecycle
- Live: 27 tokens / 18 users, 15 tokens untouched >60 days, 24 with `device_id` NULL (legacy installs). No sweeper (housekeeping() skips push_tokens); stale tokens only deleted on an FCM error. One user has a null-device token plus registered devices: `pushTargets` silently drops it. /api/push/register claims a token for the caller and deletes other owners' rows (needs knowledge of the token, low risk).
- `/api/push/send` lets a user send arbitrary text/data to their own device (data payload feeds notification routing).

### O18 (P3) Admin session and lockout details
- Admin sessions are not bound to IP/UA; SSO mode (default) makes the app login the admin session, so a stolen app session = PII read access (writes still need step-up for destructive ops). `recordFailure` is read-modify-write, so parallel step-up guesses can exceed the 5-failure lock (bounded by 12/15 min).
- `suspend`/`restore` of staff ignore the update error and still return ok; `delete_role` has no step-up.

### O19 (P3) Notification route body limits
- PATCH /api/notifications `ids` array has no max length; notifications cron: if a run stops early at the time budget the remainder waits 24 h (daily schedule), so due-tomorrow alerts for late users arrive a day late; the prices cron also runs the unrelated SMS harvest after a possibly 60 s price refresh.

## Live log review
- Postgres logs (24 h): one error, `syntax error at or near "{"` (a malformed client query, not reproducible from logs). Auth logs: one 500 `context deadline exceeded` on refresh_token (10 s), one 409 concurrent refresh conflict, one id_token at_hash warning. Edge logs: 25 x 400 on `/rest/v1/sms_parse_log` (known SMS area), everything else 200/204. No 5xx on app routes visible from Supabase side. email_templates is read 156x per day (every email, no cache) and platform_settings 106x.
- Advisors (security): unchanged from D3/D5/D6/D7/D8 (anon-role policies, leaked-password protection off, 10 authenticated SECURITY DEFINER RPCs, 39 RLS-no-policy tables). Nothing new.
- pg_cron: all jobs succeed except `sms-retention` (O3). `crash_retention` created recently (1 run).

## Areas not reached
Vercel dashboard (cron logs, env vars, CRON_SECRET), FCM/APNs delivery tests, native push registration code paths (Capacitor), month-carry cron (not scheduled), /api/account and /api/devices, admin portal UI (client-side permission gating), Resend/Sentry/Linear live webhook replays, feature-flag client caching on the app side, loyalty accrual triggers, sms/health and admin sms/logs read paths in depth, Gemini-backed email translate.
