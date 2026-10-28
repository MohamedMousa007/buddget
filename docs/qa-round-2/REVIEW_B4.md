# Adversarial review: batch B4 (SMS pipeline, learning funnel, lifecycle)

Scope: uncommitted B4 diff + migrations 0209, 0210, 0211 (unapplied; 0208 and 0221 are the last applied). Live DB was SELECT-only. No raw SMS text, names, numbers or amounts appear here (masked shapes and counts only). Probe test was deleted. Existing suites for sms/auth/native/admin/cron: 749 tests pass.

## Verdicts

| Migration | Verdict | Why |
|---|---|---|
| 0209 retention lifecycle | OK | Inert while `sms_retention_enabled` is false (verified in code and by its own in-transaction assertion). Live: raw_body NOT NULL, 873 rows, 0 NULL, no sms_* settings yet. |
| 0210 atomic booking | OK (apply only AFTER the code is deployed) | Live duplicate SELECTs all 0 (expenses per sms_log_id/fee flag: 0, income_events: 0, 'Transfer fee' rows: 0, 508 expenses carry an sms_log_id). All columns the RPC touches exist live. |
| 0211 function fixes + pattern review | OK-after-fix | Applies cleanly against live definitions, but the review pack join and the view cost need a one-line fix each (F8, F9); edit before applying, the file is unapplied. |

Apply order and code dependencies:
1. Deploy the code first. It already tolerates every missing object: harvest falls back on 42703/PGRST204, `bumpTemplateFailure` falls back on PGRST202, `postSmsDebtPayment` falls back on PGRST202, the pattern-review route returns `available:false`.
2. Apply 0209 (additive + function rewrite, inert). Regenerate types.
3. Apply 0211 (needs 0209: uses `private.sms_setting_num`, `learned_at`, `masked_version`, `skeleton_key`; the SQL functions fail validation at CREATE if 0209 is missing). After F8/F9 edits.
4. Apply 0210 only after the deployed code is verified (it adds unique indexes; the code handles 23505 and the missing RPC). Native builds never write these tables, so no native dependency.
5. Run the harvest cron / backfill, then the LF6 leak scan, then set `sms_leak_scan_passed_at`, run `select private.sms_retention_preflight()`, and only then flip the flag (see F1, F2, F3 first).

Counts: 0 blockers, 4 high, 13 medium, 9 low (26 findings).

## PRIORITY 1: raw_body destruction audit

Is `sms_retention()` a no-op while disabled: yes. First statement returns 0 unless `platform_settings.sms_retention_enabled` equals jsonb `true`; a missing row also returns 0 (coalesce false). The 0209 DO block asserts this inside the transaction and raises if the flag row exists as anything but `false`.

Anything else that nulls/deletes raw_body (live + repo): only `sms_retention()`. Live scan of every function in `public` and `private` for `raw_body`: only `sms_retention` and `sms_try_pair`. No view, no trigger (the only sms trigger is `trg_sms_template_users_recount`), no pg_cron job other than `sms-retention` (00:50) touches it; `housekeeping()` has no sms references. TS: the only write of raw_body is the parse route (claim insert and the OTP-masking update). The harvest code and the cron route only read. The cron route cannot purge. Nothing in code can flip the flag, and nothing writes `sms_leak_scan_passed_at`, so once the flag is flipped the function logs `blocked_leak_scan` and purges nothing until the owner stamps a scan time (safe default, but see F2).

Enabling requires the preflight: partly. Only the leak-scan-within-7-days check is enforced inside the function. `private.sms_retention_preflight()` is advisory; nothing blocks enabling when `parsed_due_unlearned` or `rows_masker_stale` is non-zero (the hard cap path then purges never-learned rows at 60 days by design).

Readers of raw_body and NULL safety:

| Reader | NULL-safe |
|---|---|
| SQL `sms_retention()` | yes (writer) |
| SQL `sms_try_pair` (IPN reference ILIKE) | live def is NOT null-safe in effect only because NULL ILIKE is NULL (no match); 0211 makes it explicit with coalesce |
| api/sms/parse (writer) | n/a |
| api/sms/confirm | yes, `?? ''`, but degrades (F10) |
| lib/sms/dispatch.ts | in-flight row only, safe |
| lib/sms/runAdjudication.ts | yes (`!log?.raw_body` => skipped/unclear) |
| lib/sms/matchSalary.ts:212 | yes (`?? ''`), loses counterparty |
| lib/sms/harvest.ts | yes (`.not('raw_body','is',null)`) |
| api/admin/sms/pattern-review | yes (not null filter) |
| api/admin/sms/logs (+ SmsLogPanel reveal) | yes (`has_body`, reveal returns null) |
| hooks/useSmsConfirmations + SmsReviewSheet | yes (renders nothing) |
| hooks/usePaymentMethodDetector | yes (`paymentTypeFromSms(null, ...)` handles null) |
| undo route | does not read it |

## Findings

### High

**F1 (high) 0209/0211 + pattern-review route: the review hold can never activate.** The admin route only inserts rows with status `reviewed` or `skipped`; nothing creates `pending`, and the hold trigger only sets `sms_review_hold` while a `pending` row exists. The binding decision says un-reviewed raw text is held up to the 60-day cap. As built, parsed raw text is masked at 30 days whether or not the monthly review happened. Fix: a `pending` row must be created (monthly cron, or the countdown opening one), or the purge job must check "last closed review covers the oldest due row" itself, before the flag is flipped.

**F2 (high) retention enabling, corpus and corrections masking.** The leak gate (`sms_leak_scan_passed_at`) is set by hand and nothing scans the existing 500+ `sms_corpus` rows or `sms_corrections.redacted_body`. Both were written by the OLD `redactBody` (ALL-CAPS names and 4+ digit runs only; Title-Case and Arabic names, emails, phones survive; `runAdjudication.ts` still calls `redactBody` for new corrections). The harvest only feeds the corpus for rows without `harvested_at`, and every live row has it, so legacy corpus shapes are never re-masked by the new masker. Raw text gets deleted while the "masked memory" that replaces it may still hold names. Fix: switch the corrections writer to `maskPii`, re-mask/scan the corpus with `scanForLeaks` (counts only) and stamp the scan from that job, not by hand.

**F3 (high) android SmsGate.kt:50-53, ios CatchBankSmsIntent.swift (SmsOtpGate): on-device gate drops real transactions.** A message is dropped when it carries OTP/marketing wording and no "strong" verb. "Never share/Do not share" boilerplate is on that list, and the strong list lacks "used for", "paid", "received", "refund", Arabic "تم الدفع", and "instapay" is not strong. The repo's own server test fixture (patterns.test.ts:312, a card purchase ending in "Never share your PIN or OTP") is a non-OTP transaction on the server but is dropped by the device gate; nothing is sent, no parse_log row exists, so it is silent loss. "discount"/"% off"/"coupon" in a merchant name has the same effect. Fix: on device drop only when an OTP code shape is present (OTP wording AND a 4-8 digit token not next to a currency) and keep forwarding anything with a currency amount; or make the gate fail-open and let the server pre-filter decide. Ships only with a native build, so it is not yet live.

**F4 (high) api/admin/sms/pattern-review/route.ts:19 (+ 0211 `public.sms_review_pack(period_start date, period_end date)`).** The route calls `db.rpc('sms_review_pack')` with no arguments, and the SQL function has no defaults, so PostgREST answers PGRST202 and the route returns `available:false`: the review pack download never works. The route test mocks `rpc` without checking args, which hides it. Fix: pass `{period_start, period_end}` (last closed review end to today) or give both params defaults in 0211, and make the test assert the args.

### Medium

**F5 (medium) parse route, hash change (route.ts:619-651, ingestGuards.ts).** A request carrying `eventId` hashes `text|evt:id` and skips the bucket-neighbour lookup (`computeNeighbourSmsHashes` returns [] when eventId is set), and `computeLegacySmsHashes` is empty for ASCII-digit bodies. So the same SMS arriving from a second device, a second forwarder, or a rebuilt queue item with a fresh eventId is no longer collapsed (before: same text in the same 2-minute bucket collapsed). Old-build copy plus new-build copy of one SMS also both book. Twins within minutes now both book correctly (intended), a retry from the same build collapses (same eventId). Mitigation to consider: when an eventId row is claimed, also check the plain bucket hash (`hashForBucket(raw, 0)` and its neighbours) against rows whose `received_at` is within the bucket AND whose body is equal AND whose device_id differs.

**F6 (medium) N18 sender check (ingestGuards.ts checkCreditSender, route.ts:942).** (a) Only the curated tier is checked; a credit parsed by a learned template or the AI tier from a spoofed sender is auto-booked, contrary to the decision "incoming credits must match the bank's known senders". (b) Matching is exact after trim/upper; a legitimate suffix/prefix variant of a bank sender ("CIB-xx", "HSBC EG") would hold every real salary credit for confirmation. Live check: all 23 credit rows for the two banks present carry no sender (iOS), 0 mismatches, so no impact today; Android senders are unverified. Fix: normalise (strip spaces/hyphens, accept `startsWith` known id with a boundary), and apply the same check to the template and AI tiers.

**F7 (medium) migration 0211 sms_try_pair last4 ambiguity.** The registered-sibling check now requires exactly one registered method to match the sibling tail. Users who legitimately hold two methods ending the same 4 digits (debit + credit of one bank) lose own-transfer pairing silently. Live: 0 collisions today, so no current impact; the code side (`findUniqueByLast4`) returns null for ambiguous tails too, which routes such rows to "no method". Acceptable per N22 but should be visible to users (a prompt to pick) rather than a silent unpaired transfer.

**F8 (medium) 0211 sms_review_pack: `corrected_count` is always 0.** It joins `sms_corrections.body_shape_key = corpus.skeleton_key`. `body_shape_key` is `bodyShapeKey()` (BODY-fnv of the leading words); `skeleton_key` is a sha256 prefix over sender + masked text. The key spaces never match. Fix: count corrections by `redacted_body` text equality or store the skeleton key in `sms_corrections` going forward.

**F9 (medium) 0211 `sms_parse_today` view performance and meaning.** `sms_safe_tz(us.timezone)` is a plpgsql function with an EXCEPTION block, evaluated per `sms_parse_log` row (a subtransaction each), and the `received_at >=` bound depends on the join so it cannot be a constant index bound. The parse route reads this view on every AI-eligible SMS. Fine at 873 rows, poor at scale. Also `useSmsTracking` displays this count, so rejected ai_new rows now inflate the "parsed today" number shown to users. Fix: compute the user's day start once in a scalar subquery/LATERAL (`select date_trunc(...) from user_settings where user_id = l.user_id`), and keep a separate counter for the UI.

**F10 (medium) retention class and confirm path: unconfirmed rows are purged like parsed ones.** The "parsed" class is `status NOT IN ('rejected','failed','processing')`, which includes `add_failed`, `notified` and `logged` rows that are still `awaiting_confirmation` (held salary, held sender-mismatch credit, add_failed). After 30 days the raw text goes; `/api/sms/confirm` then runs with `rawBody = ''` and books the credit with degraded category/instrument/counterparty instead of refusing. Fix: exclude `awaiting_confirmation = true` rows from the purge (or purge them only at the hard cap), and make confirm fail loudly with a clear reason when `raw_body` is NULL and the kind needs it.

**F11 (medium) createSmsExpense.ts debt payment, non-confirmable fallbacks.** A foreign-currency, gold, or overpaying SMS payment now returns `needsConfirm`, and the dispatcher books a plain expense with no debt reduction. Before, a same-number payment was recorded in the debt unit regardless of currency. This is safer, but the debt stays unreduced, and there is no pending marker tying the plain expense to the debt, so the user cannot tell why. Also the CC-payoff early return skips `postTransferFee` (pre-existing, now more reachable). Fix: set a review flag/`failure_code` on the log row so the app can offer "assign to debt".

**F12 (medium) 0210 RPC vs the CC payoff expense shape.** The RPC always sets `expenses.linked_debt_id` (the old CC-payoff insert set only `linked_debt_payment_id`). Anything that treats `linked_debt_id` as "payment to a specific debt" (balance, outstanding, net-worth code) now also sees CC payoffs. Verify the consumers (`src/lib/accounts/balance.ts`, debt summaries) against a CC payoff row before apply; the RPC could leave it null for `credit_card` to preserve current behaviour.

**F13 (medium) harvest idempotency (harvest.ts:100-125).** The outbox insert and the stamp update are not atomic. If stamping fails (the `stampFailed` branch only warns), the same oldest rows are selected again; rows whose `harvested_at` is NULL are fed to the corpus a second time, and the cron loop (up to 5 batches) repeats the same 200 rows each time. Fix: stamp first (or both in one RPC), and break the loop when a batch stamped nothing.

**F14 (medium) replay coverage is blind for large amounts.** `maskPii` replaces any number of 4+ integer digits (with its decimals) by `#####`, so `materializeShape` yields no decimals. Templates that need `\d+\.\d{2}` cannot match amounts of 1000 and over in replay, and `replayCandidate` ignores non-matches, so the LF5 regression check passes without testing the common large-amount shape. The same masking splits one template into several skeleton keys by amount magnitude, fragmenting `seen_count` (and the `seen_count < 3` corpus prune at 180 days drops real shapes). Fix: mask amounts to a stable placeholder that keeps the `ddd.dd` structure, or materialize `#####` as `99999.99` when adjacent to a currency token.

**F15 (medium) cache owner fix, residual risk.** Normal flows are safe: `profile.id` is set to the user id by the server pull, so token refresh, biometric unlock, app resume and offline cold start (user resolved from the stored session, same id) never mismatch, and `'local'`/null owners are exempt. The wipe is correct for a real account switch. Residual: (1) unflushed offline edits of account A are lost when the SDK session is replaced by B without SIGNED_OUT (intended, but there is no user-facing warning or backup); (2) `ownedByAnother` is evaluated on every flush from `serverSyncedFor`, which `reset()` sets to null, so after a wipe a flush-before-hydrate race sees 'local' and returns early (safe); (3) AuthProvider calls `reconcileCacheOwner` before `setUser` but the `SupabaseFinanceSync` instance of the OLD user can still be mounted; `suspendFinanceSync()` blocks its flush, and the new mount un-suspends it. No data-loss path found for legitimate users.

**F16 (medium) 0209 failed-row delete re-opens the dedup window.** Failed rows with no links older than 30 days are deleted; the `(user_id, sms_hash)` unique index then no longer protects against a very late replay of the same SMS from a stuck queue (Android queue now keeps items up to 30 days, cap 200), which would book it as new. Fix: keep failed rows at least as long as the longest queue age, or tombstone the hash.

**F17 (medium) bump_sms_template_failure_v2 semantics.** `hard_fail` is now set only when a template is actually quarantined (the live function set it on every hard signal). Single-user hard signals on a global template raise `failure_count` and add an evidence row but do not set the flag the admin UI and the promotion/zero-variance queries (`hard_fail = false`) read, so a template with one user's direction-guard override stays eligible for promotion. Fix: `hard_fail = hard_fail or p_hard` on every hard signal (keep quarantine gated on distinct users).

### Low

**F18 (low) parseSmsDay.ts inferYear.** Year inference uses the UTC year of the receive time and only corrects forward-dated candidates. A year-less "01/01" received 2026-12-31T23:00Z (already Jan 1 in Cairo) resolves to 2026-01-01, a full year in the past, and the plausibility guard (400 days) lets it through. Probe: 26 shapes checked; every other year-boundary case (31/12 read on Jan 1 or Jan 3, 10 Dec read in Jan, 29/02 in leap and non-leap years, Arabic digits/months, dd.mm.yy, month names, US-style 06/13 rejected) resolved correctly. Fix: if the candidate is more than ~180 days in the past of the receive time, try year+1 when that lands within 2 days after it.

**F19 (low) parse route OTP window (route.ts:632 vs 714).** The claim row is inserted with the unmasked body, and the masking update's result is not checked. If the update fails or the function dies between the two writes, an OTP's digits stay in `raw_body`. Fix: mask before insert when the pre-filter says `otp` (the filter is pure and cheap) and check the update error.

**F20 (low) maskPii false positives (probe over 20 masked shapes).** Two or more consecutive Title-Case words are replaced as a name, so multi-word merchants ("Uber Eats Cairo", "Netflix Egypt", "Talabat Egypt", "Amazon Prime Video") become `<NAME>`, and a generic greeting ("Dear Valued Customer") does too. Single-word merchants and Arabic merchants stay. The weak Arabic cues "من/الى" mask a following merchant name (fine for privacy, costs wording). Misses: letter+digit references leave their letters ("#####ABC#"), lone first names are not masked. Impact: the learner sees `<NAME>` where a merchant was (acceptable, since merchant is a capture group anyway); the leak scan is consistent with the masker, but it is the same detector, so it cannot find what the detector misses.

**F21 (low) 0209 sms_retention in parsed class for 'processing' of other states** All good, but the hard cap runs even while the review hold is active, by design. Document it in the admin UI so a pending review is not assumed to protect raw text beyond 60 days.

**F22 (low) 0211 sms_heal_stuck now unbounded.** Drops the `received_at > now() - 2 days` bound and uses `coalesce(parsed_at, created_at)`. Live has 0 processing rows; fine. With no time bound it needs `sms_parse_log(status)` to be cheap; the table is small, but add a partial index `where status='processing'` before it grows.

**F23 (low) Kotlin/Swift read-through (not compiled).** No syntax errors found. Kotlin: `when` ordering handles 202 before the 2xx branch; `evictionIndexes` loop correct; retry cap `MAX_ATTEMPTS=8` unchanged logic; `SmsTime.parseMillis` parses only the second-precision UTC format (an unparseable stamp is never age-evicted, safe). Swift: multi-statement `firstIndex(where:)` closure compiles on Swift 5.7+; legacy queue items with empty `eventId` fall back to message+receivedAt matching; `send` treats 202 as not-delivered and 409 as non-2xx (queued), consistent with Android and the JS drain. Behavioural mismatch to note: the JS drain, Kotlin worker and Swift intent all keep the item on 409, and 409 also covers `reason:'in_progress'` only; any other 409 from the route would retry forever on Android up to 8 attempts, then stay queued (acceptable).

**F24 (low) cron sms-harvest route.** Auth (`isAuthorizedCron`), `maxDuration 60`, 40 s budget, at most 5 batches, counts-only response: all good. The budget check happens between batches only, so one slow batch can exceed 60 s; lower `BATCH` for the cron or check elapsed inside the stamp loop.

**F25 (low) admin pattern-review route guards.** GET needs `sms.view`, POST needs `sms.manage` plus `stepUp`, the pack download is audited, the pack carries masked shapes only (no user ids). One gap: GET `view=pack` is audited but `coverage` is not (it only has counts and masked top shapes). `period_start` accepts any date string past the regex (no upper/lower sanity beyond "not after today").

**F26 (low) financeImportSchema carries `smsLogId`.** Restoring or importing a backup into the same account while the original rows are live now hits 23505 on the new unique indexes (fee flag aside) and fails the sync batch. Strip `smsLogId` on import or catch 23505 per row.

## Points checked with no finding

- 0210 RPC: idempotent (keyed on sms_log_id, completes a half-posted pair, re-checks nothing twice), owner check is explicit (`sms_parse_log` row owned by `p_user_id`, debt owned, both payment methods asserted), locks the debt row, overpay returns `outcome:'overpay'` before any insert, settle rule matches the client's clear-when-paid rule, grants are service_role only, search_path pinned. The two autolink triggers on debt_payments/expenses behave correctly because the expense is inserted with `linked_debt_payment_id` already set. Fallback when the RPC is missing: PGRST202 handled; the legacy path reuses a prior expense, but a half-posted legacy attempt (payment written, expense failed) still double-pays on retry, which is only reachable before 0210 is applied.
- 0210 unique indexes vs live: no duplicate or fee rows exist; the 'Transfer fee' rule matches `dispatch.postTransferFee`; a second fee insert fails silently on 23505 as intended.
- 0211 live-definition diff: `sms_try_pair` changes are limited to the explicit coalesce and the exactly-one-method check; `bump_sms_template_failure` 3-arg keeps its signature and delegates; `sms_parse_today` keeps its two columns and `security_invoker`; new public wrappers and `sms_legacy_harvest_pending` are revoked from PUBLIC/anon/authenticated and granted to service_role; `sms_safe_tz` is granted to authenticated (needed by the invoker view). The hold trigger is a statement-level trigger writing `platform_settings` as SECURITY DEFINER. Cron: no new pg_cron entry; harvest runs from Vercel cron (`10 4 * * *`), consistent with the file comments.
- 409/202 contract: the route returns 409 `{retry:true}` only for an in-flight claim; the JS drain, Android worker and Swift intent all keep the item queued and never count the attempt.
- `salary awaiting_confirmation` + /confirm: a weak salary match now stays claimable (`awaiting_confirmation=true`, `income_matched` no longer counts as "intentionally no post"); `/confirm` re-runs the dispatcher with `userConfirmed:true`, which posts the linked income event, so the confirm path really posts.
- N3 OTP masking: `maskOtpDigits` removes every 4+ digit run from the stored row and the corpus skeleton; rejected OTP rows are never tagged `rejected_tx_like`.

## Fix status

Migrations 0209/0210/0211 stay UNAPPLIED and were edited in place. 0209 was exercised on a scratch Postgres with stub tables (hold, awaiting, cap, review-covers cases); the 0211 views and review pack ran on stubs too.

- F1 FIXED: 0209 now owns `sms_pattern_reviews` and `private.sms_review_covers(received)`; the purge masks parsed raw text only when a reviewed/skipped period_end covers the row's day, else it waits for the 60-day cap. The 0211 trigger and `sms_review_hold` setting are gone. Preflight reports `parsed_awaiting_review`.
- F2 FIXED: corrections writer uses `maskPii`; `sweepMaskedStores` re-masks corpus, corrections and masked log bodies (idempotent, keyset-paged, counts only); the harvest cron stamps `sms_leak_scan_passed_at` only after a complete zero-leak sweep and clears it on any leak.
- F3 FIXED: Android `SmsGate`, iOS `SmsOtpGate` and the TS mirror `deviceOtpGate.ts` drop OTP/marketing text only when it carries no money movement (amount + currency + verb); fixture forwards. Kotlin/Swift not compiled here.
- F4 FIXED: route passes `{period_start, period_end}`; test asserts args. F8 FIXED (join on `redacted_body`). F9 FIXED (tz computed once per user; `sms_parse_today` back to parsed_ok for the UI; new `sms_ai_today` for the quota via `aiCallsToday`, with fallback before apply).
- F10 FIXED: awaiting rows are not masked until the cap; `/confirm` answers 410 `raw_purged` for kinds that need the text.
- F11 FIXED: unresolvable debt/instalment SMS payments return `awaiting_confirmation` (failure_code `debt_unassigned`, push + review sheet); `/confirm` then books the plain fallback. Fee for a pre-paired funding leg is still skipped (pre-existing).
- F12 FALSE-POSITIVE: CC payoff expenses already carry `is_debt_payment = true`; the only `expense.linkedDebtId` readers (reports filter, instalment banner) already treat it as debt-linked. No balance/net-worth code reads it.
- F13 FIXED (stamp first, corpus feed only for stamped rows, loop ends on an empty batch). F16 FIXED (failed rows kept 35 days). F17 FIXED (`hard_fail = hard_fail or p_hard` on every hard signal). F19 FIXED (OTP masked before the claim insert; update retried once).
- F5 DEFERRED (documented): second-device copies with a fresh eventId are not collapsed; needs a product call on the bucket fallback.
- F6 FIXED: token-aware sender match; also applied to template/AI tiers via `parsed.bank_name`. F18 FIXED. F22 FIXED (partial index). F25 FIXED (coverage view audited). F26 FIXED (`smsLogId` stripped on import).
- F7 DEFERRED (acceptable per N22; needs a user prompt UI). F14 DEFERRED (masker amount shape change invalidates skeleton keys; needs a masker version bump and replay review). F15, F23 no change (no defect). F20 DEFERRED (accepted wording loss). F21 DEFERRED (admin UI copy). F24 DEFERRED (cron batch already time-budgeted between batches).
