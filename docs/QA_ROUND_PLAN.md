# Buddget — Full-App QA Round Plan

Status: PLAN ONLY. No fixes applied. Bug list below is a seed from a read-only code scan (race behaviour reasoned from code, not run). The skill runs in Part 2 will confirm, extend, and re-rank it.

## Part 1 — Skills installed (project-local, `.claude/skills/`, gitignored)

Source: `petrkindlmann/qa-skills` (MIT, plain SKILL.md folders, copied via git clone, no npm CLI executed). 21 of 50 chosen; the rest (Cypress, Selenium-style, BrowserStack, Pact, TestRail, payments, email, analytics, chaos, k6-infra, dashboards) don't fit this stack.
Rejected: `PramodDutta/qaskills` (20 generic stubs, needs an npm CLI), `awesome-claude-skills` (an index; `webapp-testing` is already installed), `agentskills/agentskills` (no QA pack there).

| # | Skill | Covers in Buddget |
|---|---|---|
| 1 | qa-project-context | Writes the stack/risk context file all others read |
| 2 | risk-based-testing | Ranks areas (money math, SMS ingest, sync) |
| 3 | test-strategy | Pyramid + exit criteria |
| 4 | test-planning | Release test plan |
| 5 | coverage-analysis | Untested modules (mappers, native, auth, debt) |
| 6 | unit-testing | Vitest gaps in lib/ |
| 7 | database-testing | Supabase migrations, RLS, mapper drift |
| 8 | api-testing | `src/app/api/*` incl. SMS, cron |
| 9 | security-testing | Auth, tokens, rate limits, cron secrets |
| 10 | ai-system-testing | Buddgy / SMS AI funnel / prompt injection |
| 11 | test-data-management | Seed via `__finance`/`__settings` hooks |
| 12 | exploratory-testing | Charter-based manual sessions |
| 13 | playwright-automation (+ installed `webapp-testing`) | Web E2E flows |
| 14 | visual-testing | Design-system regressions, dark mode |
| 15 | accessibility-testing | 44px targets, contrast, focus |
| 16 | performance-testing | Boot, large tables, sync |
| 17 | mobile-testing | Capacitor iOS/Android, safe-area, offline |
| 18 | compliance-testing | Privacy/consent, SMS permissions |
| 19 | bug-reproduction | Minimal repro + failing test per bug |
| 20 | ai-bug-triage | Dedupe + severity |
| 21 | release-readiness | Final go/no-go |

## Part 2 — Run order

Prereq: `npm i` in this worktree (`@sentry/*` and `pg` missing, causing 19 tsc errors and 6 failing `*.pg.test.ts`: environmental, not code bugs).

1. **Context** — qa-project-context, risk-based-testing, test-strategy, test-planning. Output: risk map and `.agents/qa-project-context.md`.
2. **Static/automated baseline** — lint, tsc, vitest, coverage-analysis, unit-testing (gap list only).
3. **Data layer** — database-testing: live schema (project `ydihurtbcnoflhormgzi`) vs `database.types.ts`, RLS, mapper round-trips, migrations 0080+.
4. **Server** — api-testing, then security-testing: every `src/app/api` route (auth style, validation, idempotency, rate limit, cron).
5. **AI** — ai-system-testing: Buddgy, SMS funnel tiers, injection.
6. **Web UI** — test-data-management (seed), webapp-testing + playwright-automation smoke, exploratory-testing charters per route (flow, paydays, savings, goals, debts, wealth, reports, budget, settings, onboarding), visual-testing, accessibility-testing, performance-testing.
7. **Native** — mobile-testing on the iOS Simulator only (offline, safe-area, back button, deep links), using an already-built app; no native build is started without an explicit request. **Android is tested manually by the owner** (checklist: permissions, SMS ingest, FCM push, biometrics, doc scanner, back button, safe-area). Real-device-only paths (SMS, push, biometrics, scanner) stay manual on both platforms.
8. **Close** — compliance-testing, bug-reproduction (failing test per P0/P1), ai-bug-triage (dedupe and re-rank), release-readiness.

Deliverable of each step: findings appended to the table below. Nothing fixed until you approve.

## Part 3 — Bugs found so far, prioritized

### P0 — data loss / wrong money / duplicates

**B1. A failed sync flush is silently dropped.** `src/components/sync/SupabaseFinanceSync.ts:~283-286`. After `runFullSync`, `prevSnap` is re-baselined even when `flush()` reported errors. The failed diff is never retried, so a row hit by an FK/RLS error or a flaky reconnect stays local-only forever.
Fix: re-baseline only on a successful flush; otherwise keep the old snapshot or re-flush.

**B2. Pull treats query errors as "no rows" and has no pagination.** `src/lib/supabase/remote/sync.ts:~268-390`. No `.error` check, so `data ?? []` means a failed query looks like deleted data. Large tables may also truncate at PostgREST's default 1000-row cap (unverified). Later re-baselines then treat missing rows as server truth.
Fix: throw on any error; page with `.range()`.

**B3. SMS parse failure then retry is reported as a duplicate, so the transaction is never created.** `src/app/api/sms/parse/route.ts:~636-660, ~1364-1372`, `src/lib/native/smsTracker.ts:~255`, migration 0083. The log row is inserted first. On a parse exception it is marked failed but stays `is_duplicate=false`. The retry hits the unique index (23505) and gets 200 `duplicate:true`, and the native queue deletes the item. A function killed mid-flight leaves a stuck `processing` row with the same result.
Fix: on 23505, take over and reprocess rows that are failed, processing or stale and have no expense/income, or mark failed rows duplicate.

**B4. SMS confirm is not atomic, so a double tap makes duplicate transactions.** `src/app/api/sms/confirm/route.ts:~45-60, ~106`. It does SELECT, then create, then UPDATE. A push-tap plus the sheet, or a double tap, runs `createSmsTransaction` twice. `row.amount!` and `row.currency!` are unchecked non-null assertions.
Fix: claim the row first with `UPDATE … SET awaiting_confirmation=false WHERE id AND awaiting_confirmation RETURNING *`, and revert on failure.

### P1 — broken or wrong flows

**B5. FK race in flush.** `sync.ts:~190-215`. Only receipts are drained first. Other tables upsert in parallel, so a new parent and child created together (debt + payment, savings account + transaction, payment method + expense) can fail FK checks. Combined with B1 the loser is lost.
Fix: drain in dependency order.

**B6. Confirm route trusts currency and ignores update errors.** `sms/confirm/route.ts:~25, ~66-92`. `currency` is any string of length 1-8 cast to the enum. A bad value makes the UPDATE fail, but the log is still marked confirmed and the response is `ok:true`.
Fix: `z.enum` of the currency list; check each update's `.error`.

**B7. Month-carry cron deposits with wrong rates.** `src/app/api/cron/month-carry/route.ts:~28-38, ~107-120`. If `fetchRates()` fails, `convertCurrency` falls back to hard-coded rates, or returns the unconverted amount for KWD/QAR/BTC. Carry is then computed and posted wrong. The cron is not yet in `vercel.json`.
Fix: skip the run, or that user, when rates are empty; use `tryConvertCurrency`.

**B8. Month-carry cron aborts for all users on one failure.** Same file, `~90, ~128, ~140`. `created!.id` throws if a pocket insert fails, a settings query error is swallowed by `break`, and the summary-insert error is unchecked.
Fix: per-user try/catch and error checks.

**B9. Cash outflow counts an unconvertible foreign payment as base currency.** `src/lib/utils/calculations.ts:~644`. `inBase ?? p.amountPaid` makes net worth wrong whenever rates lack a path.
Fix: exclude it and flag the result incomplete, as `computeNetWorth` does.

**B10. `convertCurrency` fails open.** `src/lib/utils/currency.ts:~60-72`. It returns the original amount and only logs. It is used for persisted and server-side sums.
Fix: audit callers that persist or aggregate money and move them to `tryConvertCurrency`.

**B11. `/api/feedback` and `/api/push/send` are cookie-only.** They use `createClient().auth.getUser()`, unlike other routes, which accept a Bearer JWT. Native clients may get 401 (client call sites not found, unverified).
Fix: use `resolveApiUserId`.

### P2 — edge cases, hardening

**B12. Cycle-end date bug for `monthStartDay` of 2 or more.** `calculations.ts:~67-86, ~118`. `subDays(nextCycleStart, 1)` ends at local midnight, so income created on the last cycle day after 00:00 is excluded. Recurring sources also ignore `effectiveStart/End`. Fix: `endOfDay` plus `recurringActiveForWindow`.

**B13. UTC date slicing on the client (Cairo 00:00-03:00 files entries under the wrong day).** `PlanEditorSheet.tsx:38`, `GoalDetailSheet.tsx:57`, `ZakatSheet.tsx:75`, `AssetFormSheet.tsx:70`, `WithdrawSheetV3.tsx:132`, `useAddExpenseSheet.ts:21`. Fix: `localTodayISO`.

**B14. Month-carry cron uses UTC dates and has no catch-up.** `month-carry/route.ts:~58, 73-74, 113`, `carryDateLogic.ts:11-31`. A missed day skips the cycle permanently. Fix: also process any closed cycle with no summary row.

**B15. SMS native errors swallowed.** `smsTracker.ts:~89-216`. Many `catch {}` blocks, so the UI can show tracking on or off when native differs. Drain treats 400/422 as done.

**B16. No rate limit on `/api/feedback` (creates a Linear issue) or `/api/push/send`.** Fix: `api_rate_hit`.

**B17. Middleware rate limiter is per-isolate memory.** `middleware.ts:~15-35`. Fix: back it with the `api_rate_hit` RPC.

**B18. FCM token registration on iOS fails silently, with no retry.** `pushNotifications.ts:~110-125`.

**B19. Sentry statically imported on web.** `src/lib/crash/init.ts:1-2`. Heavy bundle; breaks tsc/tests when `node_modules` is stale. Fix: dynamic import after the guards.

**B20. Welcome-claim edge.** `api/auth/welcome/route.ts:~28`. A missing profile row or failed rollback means the user is never welcomed.

**B21. Cron secret compared with `!==`.** `api/cron/*`. Use a timing-safe compare (low risk).

**B22. SMS ingest tokens stored in plaintext in `sms_ingest_tokens`.** Unverified whether hashed elsewhere; confirm in the security step.

### P3 — polish / hygiene

- B23. `useNetworkStatus.ts:~16`: initial `navigator.onLine` is unreliable in Capacitor webviews, so a false "online" can raise a failure banner.
- B24. 21 lint warnings (unused vars and eslint-disable directives), e.g. `useFinanceStore.ts:31`, `pushNotifications.ts:117`, `exclusion.ts:34`.
- B25. Test gaps: `supabase/remote/mappers` (23 files, 1 test), `native` (15 files, 2 tests), `auth` (9, 3), `debt` (7, 1), `email` (7, 1), `buddgy` (68, 21), `i18n` (20, 0), no direct tests for any `api` route handler.

### Not yet verified
`sms/parse` (1556 lines) only sampled; admin routes not individually audited; mapper column-by-column drift unchecked; no UI-level checks done; all races reasoned, not reproduced.

## Part 3b — QA run results (2026-10-27)

Baseline after `npm i`: lint 0 errors / 21 warnings, tsc clean, vitest 2921 passed (pg suites skipped without DB). Web (375px, 11 routes): all 200; /flow has 24 controls under 44px (36px chips, 32px month arrows) and 2 buttons/links with no accessible name (P3, verify against DESIGN_SYSTEM hit-area rules). iOS Simulator: blocked, no simulator runtime installed (download needed). Android: manual by owner.

### Database / RLS audit (live project, read-only)
Clean: 10 core tables match types, 84/84 tables RLS on, zero orphans/negatives.
- D1 P2 — 10 `sms_parse_log` rows stuck `processing` (oldest ~80 days). Add a stale-row sweeper; ties to B3.
- D2 P2 — ~15 repo migrations (0126-0128, 0150-0157, 0163, 0170, 0172, 0173, 0176) have no entry in the live ledger. Reconcile with `supabase migration repair`.
- D3 P2 — 0163 (policies authenticated-only) says applied, but advisors still show anon policies on receipts, sms_parse_log, push_tokens, biometric_devices, sms_ingest_tokens, sms_template_signals. No leak (auth.uid() null), re-apply.
- D4 P2 — `database.types.ts` lacks `ai_usage_daily`, `fx_rates`. Regenerate.
- D5 P2 — `app_client_gate()` SECURITY DEFINER executable by anon. Revoke unless needed pre-login.
- D6 P2 — Leaked-password protection disabled in Supabase Auth.
- D7 P3 — 11 SECURITY DEFINER RPCs callable by authenticated (deposit_to_savings, withdraw_from_savings, correct_savings_balance, add_debt_payment_with_expense, cancel_subscription...). Checked live: all 10 authenticated-callable ones reference `auth.uid()` and pin `search_path`; only `app_client_gate` (D5) is anon-executable. Downgrade to P3; per-argument ownership (e.g. `p_account_id`) still worth a unit test.
- D8 P3 — 39 RLS-no-policy tables; confirm no client reads of user_devices, user_milestones, user_entitlements, support_tickets.
- D9 P3 — ~35 policies use PUBLIC role instead of `TO authenticated`; 15 unindexed FKs (app_analytics_daily.user_id, ai_usage_events.chat_id first); 38 unused indexes (do not drop yet); 4 profiles without user_settings; stale `onboarding_completed` comment in profileMapper.ts:36.

### API / security audit (82 routes; only 2 have tests; IDOR, webhooks, secrets-in-logs all clean)
- A1 P1 — `auth/device/trust/route.ts:12-35`: any session can mark a client-supplied device trusted without OTP; email 2FA is client-side only. Gate 2FA server-side.
- A2 P1 — `admin/users/[id]/activity/route.ts:54`: SMS notification titles ("amount — merchant") shown to staff without financial grant. Gate on `granted`.
- A3 P2 — `admin/sms/templates/route.ts:35-38` + AI-learned patterns: regexes run on all users' SMS with no ReDoS guard.
- A4 P2 — `sms/parse:568-594`, `sms/setup-token`: revoked device can drop the device-id header and keep ingesting.
- A5 P2 — `account/delete/route.ts:14-18`: irreversible delete with no step-up auth or rate limit.
- A6 P2 — `cron/month-carry`: `.range()` paging without `.order()`; `cron/notifications:62-64` resets cursor to start on a query error.
- A7 P2 — `sms/undo`: Bearer-only (JWT gets 401), hard-DELETEs expenses/income (breaks sync tombstones), ignores final log update error.
- A8 P2 — `notifications/route.ts`: cookie-only (likely broken on native), PATCH returns ok on failure, GET returns empty on any error.
- A9 P2 — `support/tickets/[number]/route.ts:58-59`: message insert error ignored; reply reopens `closed` tickets.
- A10 P2 — `receipt/scan`: Gemini 401/403 forwarded to client (looks like sign-out), raw receipt text logged, output not validated, size check after base64.
- A11 P2 — `ai/route.ts`: generic Gemini relay (client controls contents/systemInstruction/grounded, no size cap, error echoed).
- A12 P2 — `prices/refresh`: unauthenticated service-role write, non-atomic debounce, raw error returned.
- A13 P2 — `admin/loyalty:67-75`: `adjust_points` read-then-upsert race, ledger error unchecked.
- A14 P3 — `admin/users/[id]:108-113`: rank check missing on send_password_reset, clear_trusted_devices, reset_sms_tokens, notify, set_limits, set_entitlement, verify_email.
- A15 P3 — rate-limit RPC fails open (support/submit, board/vote, tickets reply, check-email, health/deep); check-email doc says 10/min, code 30.
- A16 P3 — `biometric/signin` no rate limit and bypasses 2FA; `biometric/register` can rebind another user's device id.
- A17 P3 — `feedback`: no rate limit/size guard creating Linear issues (extends B11/B16).
- A18 P3 — `devices/[id]` makeMain non-atomic, errors unchecked.
- A19 P3 — `nativeApiCors.ts`: prod allows credentials from `http://localhost:3000` + X-Admin-Session.
- A20 P3 — CSP: `img-src https:`, no `object-src 'none'`; `Permissions-Policy` blocks web microphone (voice recorder).
- A21 P3 — middleware admin branches are no-ops; `/admin` shell loads for any signed-in user (API still guarded).
- A22 P3 — admin routes have no zod (500 on wrong types in support/tickets, staff, flags).
- A23 P3 — admin staffCache 20s TTL per isolate serves stale after suspension.
- A24 P3 — `admin/emails:123` HTML filter only blocks `<script`; on*=/javascript:/iframe pass (preview render unverified).
- A25 P3 — `rates`/`gold` public routes: no bounds validation, uncached errors multiply upstream load.

### Money logic audit (17 temporary probes, TZ=Africa/Cairo, all deleted; repo unchanged)
P1
- M1 — `savings/zakat.ts`: price feed missing (nisab 0) makes any wealth "due" (cash 5 -> due 0.125).
- M2 — `zakatInputs.ts`: investment-category pockets omitted (100 g gold ≈ 600k missed); `debtsDueThisYear` = installment*12 regardless of frequency, cleared and owed-to-user debts still deducted.
- M3 — `goals/debtPaidInCurrency.ts`: gold progress treats base-currency price as AED (10 g at 6000 EGP: 820,793 vs 60,000).
- M4 — `goals/computeGoalProgress.ts`: XAU pocket 40 g counted as 40 EGP; spending_control goal counts Savings/CC Payoff rows (900 vs 100).
- M5 — `cron/month-carry`: spend/income maths differs from client (non-spend rows counted, refunds not excluded, no projected income fallback, empty rates = 1:1). Extends B7.
- M6 — `carryDateLogic.ts`: start day 28-31 never carries the January cycle in non-leap years; missed runs never retried. Extends B14.
P2
- M7 — `paydaySchedule.ts`: payday on cycle-start day shifted off a weekend lands in previous cycle (projected income 0).
- M8 — `isIncomeOccurrencePending`: wrong for custom cycles and day 31.
- M9 — `calculateDaysLeftInMonth`: one too low on custom cycles, so suggestedDaily too high.
- M10 — `spendingPace.ts`: past months divide by days elapsed since month start (March viewed in Oct = 241), pace always on_track.
- M11 — `monthlyStats.ts:225`: `monthClosed` uses calendar month, wrong for monthStartDay > 1.
- M12 — `getNextCreditCardDueDate`: due day 31 overflows into next month (Feb 10 -> Mar 3).
- M13 — `getCurrentBillingCycleExpenses`: cycles overlap one day for due day 31.
- M14 — `advanceRecurringDebtDueDate`: due date drifts permanently (Jan 31 -> 28th forever).
- M15 — `budget/lineSpend.ts`: debt-linked budget line double counts the payment (Loans 500 + Other 500).
- M16 — gold debts: price 0 yields ok:true with 0 progress; unavailable price makes gold liability 0 (net worth overstated).
- M17 — `tryConvertCurrency`: stale DEFAULT_RATES beat live rates on two-hop conversions (18.18 vs 15.15). Extends B10.
- M18 — `goals/fundingBasis.ts` usualKeep: stale entry-time amounts, partial non-spend filter, calendar months, paydaysPerMonth vs paydayDays.length.
- M19 — base-currency switch leaves `goldPricePerGram` and goal `monthlyContribution` unconverted.
P3
- M20 — installment rounding strands/overshoots cents (100/3 = 99.99; 200/3 = 200.01); `Math.ceil(1.1*100)` gives 1.11.
- Notes (unverified): `computeCreditCardOutstanding` has no date bound; more fail-open `?? raw` fallbacks (effectivePlanCategoryAmountInBase, sumExpensesInDebtCurrency, subscriptionsExtras, computeNetWorth holdings); `shiftToBusinessDay` uses Sat/Sun weekend, Egypt is Fri/Sat; `resolveCarryDestination` comparator non-transitive.

### AI / SMS funnel audit (Buddgy tool authorization is sound: write tools only propose, user must tap, so injection cannot silently write)
P1
- S1 — `sms/patterns/preFilter.ts:86`: `OTP_RE` matches anti-fraud footers ("Never share your PIN or OTP"), so real purchases are dropped as `otp` with HTTP 200 and never retried.
- S2 — `sms/parse/route.ts:626-662, 768-775, 806-815, 1285-1296`: Gemini 502, 429, 503 and parse exceptions leave `is_duplicate=false`; the client retry hits the unique index and gets `duplicate:true`, and `SmsForwardWorker` clears the queue. The SMS is lost for good (same root as B3; fix together).
- S3 — `route.ts:98-101` `computeSmsHash` is body-only with a permanent unique index: the same "debited EGP 99.00 for NETFLIX" next month is dropped as a duplicate.
- S4 — `route.ts:888`, `confirm/route.ts:107`: SMS day taken from the UTC `receivedAt`; an SMS at 01:30 Cairo on the 1st lands on the 31st, previous budget month. Convert to profile timezone.
- S5 — `templateApply.ts:85-87`: learned template without `removeCommas` makes `parseFloat("1,250.00")` = 1. Always strip `,` and `٬`.
P2
- S6 — `dispatch.ts:144` + migration 0094: IPN reference regex captures the word "number", so unrelated IPN out/in legs pair into a Transfer and the spend vanishes.
- S7 — Arabic IPN legs never pair (`IPN_REFERENCE` is Latin-only; `generic-ipn-out-ar` has no last4): booked as 200 spend + 200 income.
- S8 — `pairing.ts:~104` / `sms_try_pair`: legs arriving together can both post because `parsed_ok`/`kind` are written at the end; double-counted Transfer/FX.
- S9 — Currency outside the DB enum (e.g. TRY) via `hsbc.ts:166,176`, `resolveCurrency`, `createSmsExpense.ts:32`: insert fails, `/confirm` loops 500. Validate against the enum; fall back to base with `provisional`.
- S10 — `fetchCorrectionExemplar` (`route.ts:1431-1458`, `runAdjudication.ts`): one user's manual correction can be injected unescaped into every user's AI prompt; no confidence filter or corroboration.
- S11 — `preFilter.ts:90`: `MARKETING_RE` rejects real purchases ("...used for EGP 150.00 at VODAFONE BUNDLE"); Arabic `عرض` substring-matches `معرض`. Run curated patterns first.
- S12 — Arabic-Indic digits are never normalised on SMS bodies: `[\d,]+` misses, `\D` strip turns last4 `١٢٣٤` into "" (wrong default payment method).
- S13 — Plausibility runs after booking (`after()`); AI amounts can be negative (`-250` posts as an expense). Reject `amount<=0`/absurd values/dates before dispatch.
- S14 — SMS-triggered Gemini cost un-metered: learning (up to 3 calls) and categorisation sit outside `reserveAiQuota`; spoofed SMS can drive ~4 calls each.
- S15 — Learned regexes run unguarded on the server (ReDoS risk, no nested-quantifier check); one bad template stalls the event loop for all users. Extends A3.
- S16 — `/api/ai`: client-controlled `thinkingConfig`/`candidateCount`/`grounded`/`tier` exceed the quota estimate; in-memory rate-limit Map never pruned. Extends A11.
- S17 — Buddgy privacy mask gaps: `savings_total`, `debt_remaining`, `total`, `value` not matched by `BALANCE_KEY`; `buildContext` sends income/spent/left/first name with no mask check.
P3
- S18 — Missing timeouts (`receipt/scan` Gemini, `voice/transcribe` Groq) leave quota reservations unsettled; `parseSmsDay` accepts 31-02; image mime/size checked after read; undo leaves `debt_payment_id` and sibling `paired_log_id` and skips `isRevokedDevice`; `جم` matches inside names; `matchSalary` auto-links a friend's ±2% IPN; curated-DB templates not sender-scoped; Android `SmsForwardWorker.buildBody` leaves control characters unescaped (invalid JSON, 400, stuck in queue forever).

### Manual device checklist (owner: Android + real-device paths; iOS Simulator skipped)
Cold start and splash; login via Google/email OTP; biometric lock and unlock; offline add expense then reconnect sync (verify B1/B2/B5); airplane mode banner (B23); SMS: send S1/S2/S3/S11 samples from the adversarial list (OTP footer, VODAFONE BUNDLE, same Netflix SMS twice, Arabic IPN), then check expense dates around 00:00-03:00 (S4, B13); confirm double tap (B4); undo; push notification receipt and tap routing; document scanner capture; hardware back button on every nested sheet; safe-area on notch and gesture-nav devices; touch targets on /flow chips; dark mode; locale/Arabic digits; background and resume within 10 s.

### Adversarial SMS set for the manual run
1 "Your card ending 1234 was used for EGP 450.00 at CARREFOUR on 12/10/2026. Never share your PIN or OTP." (expect 450 purchase) · 2 "Your Credit Card ending with *1234 has been used for EGP 150.00 on 05/10/2026 at VODAFONE BUNDLE. Your available limit is EGP 4,850.00" (expect 150) · 3 same "Your account was debited EGP 99.00 for NETFLIX" on two dates (expect 2 expenses) · 4 Arabic-digit debit "تم خصم مبلغ ١٢٥٠٫٥٠ جنيه من حسابك ****١٢٣٤" (expect 1250.50, card 1234) · 5 two unrelated IPN legs both with "reference number" (expect no pairing) · 6 Arabic IPN "رقم مرجعى BEC93BC" pair (expect one Transfer) · 7 purchase in TRY (expect booked or provisional, not stuck) · 8 comma amount "1,250.00" after a learned "250.00" template (expect 1250) · 9 template-tier SMS at 01:30 Cairo on the 1st (expect the 1st) · 10 parse failure then retry (expect parsed).

### Overall top priorities (all findings merged)
1. SMS pipeline losses/miscounts: B3+S2, S1, S3, S5, S4, B4, S11, S9 (silent money loss).
2. Sync integrity: B1, B2, B5.
3. Auth/privacy: A1, A2, A4, A5.
4. Money maths: M1-M6, B7, B9, B10, M16, M17 (fail-open currency).
5. Date/cycle maths: M7-M13, B12-B14.
6. DB hygiene: D1-D6; hardening A3-A25, S10, S13-S17.

### Still pending
Nothing from the automated audits. iOS Simulator pass SKIPPED by owner (no simulator runtime installed); Android and all real-device paths (SMS, push, biometrics, scanner, back button, safe-area) are manual by owner.

## Part 4 — Proposed fix order (after your approval)

Add after the batches below: A1+A2 (auth/privacy) right after batch 2; M1-M6 with batch 3; M7-M13 with batch 5; A3-A25 and D1-D9 in batch 4/7 and a DB-hygiene batch.

1. B1 + B2 + B5 (sync integrity: one change set; add failing tests first via bug-reproduction)
2. B3 + B4 + B6 (SMS ingest and confirm; migration only if the dedup index needs changing)
3. B7 + B8 + B9 + B10 (currency fail-closed; gate before scheduling month-carry cron)
4. B11 + B16 + B17 + B21 (API auth and rate-limit consistency)
5. B12 + B13 + B14 (date and timezone sweep)
6. B15 + B18 + B19 + B23 (native and boot hygiene)
7. B20 + B22, B24 + B25 (hardening, lint, coverage)
Each batch: failing test, fix, lint + tsc + vitest + build, then ship per CLAUDE.md.
