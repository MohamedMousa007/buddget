# S8a: cross-module adversarial review of the QA fixes

Date 2026-11-20. Reviewed on `eed68a89` (equal to `origin/main` at the start). Read-only: no app code changed. The only edits are two new `test.fail` cases in `e2e/api/round2/pro-rewards/30-billing.spec.ts` (H8, X6), their line in `e2e/README.md`, and this note.

Scope:
- QA round 1, commits `a065400e` to `e3fefe97`, migrations 0318 to 0329.
- QA round 2 on main: S8g rewards, invites and billing (70e5cced, migrations 0332 and 0333), the email hook (fe7e7d71, 327a144a, 4c9fd292) and the UI commit 5cfa70f1.
- The red closing SMS replay.

Method:
- Four parallel reviewers covered billing and invites, sync and net worth, SMS, and security and DB.
- Every P1 below was re-read at its lines by the coordinating session.
- Three read-only live queries returned metadata only, run one at a time.

The sync branch `claude/ecstatic-shamir-e2f695` was not reviewed. Only its cross-module risks are listed (section 6).

Severity:
- P0: money or data loss for real users.
- P1: wrong behaviour real users will hit, or abuse that pays.
- P2: edge case.
- P3: hygiene.

"Verified" means the coordinating session re-read the lines. "Live" means it was checked on the live database.

## 1. Fix before launch (P1, plus the open P0 that sits on the sync branch)

| ID | Sev | Where | Failure scenario | Suggested fix | Status |
|---|---|---|---|---|---|
| S-1 | P1 (P0 when chained) | `src/components/sync/SupabaseFinanceSync.ts:456`, `src/components/sync/flushBaseline.ts:11`, `SupabaseFinanceSync.ts:317` | After a successful flush, the baseline becomes the **live** store snapshot taken *after* `runFullSync`. An expense added while the pull is in flight (resume, reconnect or pull-to-refresh) is recorded as sent and never reaches the server. A later full pull after a stale cursor (QA-107) then deletes it on the device. `flushOnce` also returns `true` while `!isOnline()`, so offline edits are marked sent whenever the pull still succeeds. | Build the baseline from what the flush actually sent plus the rows the pull returned, not from the live store; report "not flushed" when offline. | Verified |
| S-2 | P1 | `src/lib/accounts/balance.ts:83`, `:112-122` | Since QA-13 a pocket is an earmark inside its account, and held pockets are left out of the net-worth total. A pocket-funded expense is skipped for the account (`fundedFromSavingsTxId`), and the pocket withdrawal with no `paymentMethodId` is skipped too. Buying something from the pocket therefore leaves net worth unchanged. Paying a debt from it lowers the debt only, so net worth **rises**. | For withdrawals from a pocket with `heldInPaymentMethodId`, apply `-amount` to the holding account. | Verified (mechanism) |
| S-3 | P1 | `src/lib/store/useFinanceStore.ts:985-1003` | Undo of a debt payment funded from a pocket restores the pocket withdrawal and the schedule with their **old** edit times. Under 0319 the withdrawal stays deleted on the server and the restored schedule is rejected as stale. `savings_balance_delta_enabled` is **true on live**, so the server pocket balance and the device disagree (money created on one side). | Stamp restored rows with a fresh `edited_at`, as the plain-delete undo already does. | Live flag checked |
| B-1 | P1 | `src/lib/billing/revenuecat.ts:101-129`, `src/app/api/billing/revenuecat/route.ts`; `docs/launch/STORE_SETUP.md:13` | `event.environment` is never read, and the dashboard sends all events. A TestFlight, App Review or Play license tester's free sandbox purchase gives real Plus and permanent Sparks. It also turns that user's invite rewards into Pro-level Sparks and burns their real trial. | Ignore `environment: 'SANDBOX'` unless a QA flag is set; set the RevenueCat webhook to production events. Test: H8. | Verified |
| B-17 | P1 | `supabase/migrations/0333_trial_cap_real_users_network_review.sql:65-108` | Once a trial ends, the entitlement row is `source='default'`, so the "already entitled" check passes. The store and `billing_events` checks do not apply, and `trial_claims` is keyed only on the mailbox. An email change (enabled) gives a fresh 30 days with all data kept, repeatable forever. The app claims automatically on first open. | Refuse when this `user_id` already has a `trial_claims` row or any past `plus_trial` grant; add a unique partial index on `trial_claims(user_id)`. Test: X6. | Verified |
| M-1 | P1 | `src/app/api/sms/parse/route.ts:1147-1252`, `src/lib/sms/ingestGuards.ts:247-253` | QA-14 holds an AI-read credit from a new sender. The hold returns outcome `awaiting_confirmation`, which `debtAwaitingUser` turns into `success`. The stats insert then records the sender's currency, and the drain writes `sms_sender_currency`, exactly what `senderKnownForUser` reads. Forged credit #1 is held; #2 from the same sender books on its own, even if #1 was dismissed. The same holds for `senderHeld`. | Pass `currency: null` to `recordSmsStats` when `senderHeld`, `capHeld` or `aiCreditHeld`, or define "known" as a sender with a booked, unflagged row. | Verified |
| M-2 | P1 | `src/lib/sms/maskForModel.ts:20`, `src/app/api/sms/parse/route.ts:984`, `:1110-1113` | QA-36 masks phone-like numbers whole, keeping no last four. On the `ai_new` tier the account and counterparty tails come from the model's reading of that masked text. A transfer to the user's own wallet named by its mobile number gets a fake tail, misses the own-account check and books as Remittance spending. A 10-11 digit account number starting with 0 loses its tail the same way. | Keep the last four of masked numbers, or re-derive the tails from the real message after the parse. | Reviewer-verified mechanism; frequency not measured |
| SYNC-P0 | P0 (open on main, fixed on the sync branch) | sign-out path on main | Sign-out ignores the flush result, and the flush says "ok" while offline. Signing out offline, or after a failed flush, wipes unsent edits without asking. | Land the `ecstatic-shamir` fix before the next build. | Reviewer, cross-branch |

## 2. P2

| ID | Where | Failure scenario | Suggested fix |
|---|---|---|---|
| S-4 | `src/lib/store/useFinanceStore.ts:1463` | Activation Undo restores with an old edit time, so it stays deleted under 0319. Plan history is lost silently, the case 6856ef0c says it fixed. | Fresh `edited_at` on restore. |
| S-5 | expense-delete undo, same file | Undo of an expense delete loses its receipt link (same old-edit-time pattern). | As S-4. |
| S-6 | `updateIncomeEvent`, same file | Editing the received date keeps the old exact time (QA-11), so the balance books the income at the wrong moment. The Buddgy income path never sets the time. | Recompute `occurredAt` when the date changes. |
| S-7 | system vault writers (QA-108) | The vault the app creates has no holding account; the one the month-carry cron creates has one. For app-created vaults the primary account falls by the carry each month. | Same `held_in_payment_method_id` in both writers. |
| S-8 | `src/lib/accounts/balance.ts:69-75` | QA-88 is half done: an entry in another currency with no rate is still counted 1:1 inside the account (`approx` only), and net worth is not flagged incomplete. | Skip the leg as XAU is skipped; surface `approx` as "incomplete". |
| B-2 | `src/lib/entitlements/trial.ts:6-15` | `+tag` is folded only for Gmail, so `x+1@outlook.com`, iCloud and Proton give unlimited trials from one inbox. The trial route has no disposable check and no rate limit. | Fold `+tag` for all domains; add the disposable check and a per-IP limit. |
| B-3 | 0333:74, 91-95 | The 200-a-day cap is global: one actor can use it up and lock out real sign-ups. The lock is per user, so parallel claims overshoot. | Cap per IP or network first; take a global advisory lock around the count and insert. |
| B-4 | 0332:164-176 | Invite activation ("3 days, 5 records") counts client-written `created_at`. A fake friend passes in a minute; only the caps limit rewards. | Use a server-stamped time. |
| B-5 | `src/components/billing/BillingHost.tsx:39-52` | The trial claim and the invite redeem fire together and lock different keys, so the invited friend can lose the +7 days. | Redeem, then claim; or lock both on `trial:<user>`. |
| B-6 | 0306:207-213, `src/app/api/billing/revenuecat/route.ts:38-46` | TRANSFER expires the sender with no ordering check, so a late retry can expire a newer paid plan. It also copies promo or staff grants. | Stale check on TRANSFER; copy store rows only. |
| B-7 | 0293:14 | A RENEWAL before its TRANSFER hits the unique `store_original_txn` index and returns a 500, which RevenueCat retries for days. It heals once the TRANSFER lands. | Map 23505 to a 2xx "pending" and reconcile. |
| M-3 | `src/lib/sms/routingKey.ts:149-153` | The "known sender" key prefers a hotline printed in the body, then the AI-read bank name. iOS has no sender, so a forgery naming the user's bank counts as known. | On iOS, require a booked row of the same body shape. |
| M-4 | `src/app/api/sms/parse/route.ts:1269` (456f0244) | The QA-39 gate dropped `!provisionalConfirm`, so a row with a guessed currency (held for confirmation) schedules template learning again. | Add `&& !provisionalConfirm` to `bookedNoHold`. |
| M-5 | `src/lib/sms/dispatch.ts:850`, `src/lib/sms/fxEvent.ts:34` | With no live `OFFICIAL_USD` row, FX pairing judges legs at the built-in USD/EGP 53.1 with no staleness check (EUR and GBP always use bridges). A move of more than 3% refuses every real exchange, and each leg books its own row. | Keep the rate date; when stale, widen the tolerance or ask. |
| M-6 | `supabase/migrations/0321_repair_sms_credits_to_provisional_accounts.sql` | Selected by condition, not by the 94 ids. A re-run after a restore or region move would reassign credits booked since 2026-11-19. | Pin to the ids, as 0320 does. |
| X-1 | 0332:367-370 vs 0325:20; `src/lib/supabase/resolveRouteUser.ts:85-93` | `session_is_live` ignores the `app.session_gate` off switch, so turning the gate off leaves about 60 routes answering 401 until a deploy. Both gates swallow errors without logging. | Honour the switch; log the error branch. |
| X-2 | `src/lib/supabase/resolveRouteUser.ts:95,108,113` | One extra uncached service RPC on every authenticated API call, then the same check again in PostgREST (0325). A DB-load hot spot on the small instance. | TTL cache by `session_id` (30-60 s live, until `exp` when dead), as `isAccountActive` does. |
| X-3 | `src/app/api/auth/check-email/route.ts:56-62` | The QA-99 caps are keyed on the full IP. IPv6 rotation inside a /64 gets around them, so email enumeration stays open. | Key IPv6 on its /64. |
| X-4 | 0323, 0332 | NaN and overflow checks cover only some money tables. **Live:** 30 numeric columns that `authenticated` can write have no upper bound, among them `account_adjustments.delta`, `budget_categories.amount`, `budget_subcategories.amount`, the `goals` amounts, `income_sources.amount`, `recurring_{expenses,debt_payments,savings_deposits}.amount`, `savings_holdings.*`, `subscriptions.{amount,my_share,pending_amount}`, `receipts.amount`, `profiles.monthly_rent` and `budget_plans.income_override`. | One migration adding the same `< 1e16` and not-NaN checks (count offending rows first). |

## 3. P3

- **B-8 to B-16 (billing):**
  - retired packs drop purchases and refunds;
  - `SUBSCRIPTION_EXTENDED` is ignored;
  - UNCANCELLATION with no expiry gives Plus forever;
  - the webhook's stay-offer stamp error is swallowed;
  - `trial_days = 0` burns every lifetime trial;
  - clawback keeps milestone points;
  - TRANSFER does not move the month's Sparks;
  - per-user loops in `rewards_daily` and `referral_evaluate` (N+1 against the DB rules);
  - stale comments.
- **M-7:** `src/lib/sms/pairing.ts:112`. The QA-38 24-hour reference search runs only when the 5-minute window is empty, even when the only leg there is then dropped by the amount filter.
- **M-8:** `src/lib/sms/fxEvent.ts:35`. The FX same-account check compares tails exactly (`001` vs `0001`), not by the SQL suffix rule.
- **M-9:** QA-34's remembered "both mine" is keyed on bare tails. It survives deleting the account, or a new account with the same tail.
- **M-10:** `src/lib/sms/ingestGuards.ts:125`. QA-47 compares the capture day in the user's time zone with the bank's Cairo day. Users west of Cairo, or with a lagging phone clock, get the wrong day.
- **S-9:** a multi-tab rehydrate brings back rows the other tab deleted.
- **S-10:** false "your Undo lost" notices.
- **S-11:** the Cash id is derived from the signed-out profile id `local`.
- **S-12:** the account-adjustment mapper sends the Cash placeholder id raw.
- **S-13:** knowing a user's id lets someone pre-claim that user's derived vault or Cash id (it blocks the row; no money moves).
- **X-5:** the email hook has no overall deadline, only Resend's 2.5 s. With a slow DB it can pass Supabase's 5 s: the user sees an error, the email arrives anyway, and a retry replaces the code. Errors are not cached. Fix: one 4 s `AbortSignal` per request.
- **X-6:** 0326 checks `budget_categories.link_ids` only for debts and goals.
- **X-7:** the 0327 `paywall_views` purge has no batch or timeout (harmless until late 2027).
- **X-8:** the admin leads cursor cuts timestamps to milliseconds, so ties at a page boundary are skipped, the very case QA-58 targeted.
- **X-9:** the biometric per-device limit is keyed on a client header (the per-IP limit still applies).
- **X-10:** `webhook.ts:18` accepts an empty signing key if the secret is set to just `v1,whsec_`. Refuse keys under 16 bytes.
- **X-11:** an unknown email action gets a 422, which fails the whole Auth action.
- **X-12:** 0323 and 0332 add each check NOT VALID and VALIDATE it in the same transaction, which buys nothing.
- **5cfa70f1 (UI):** correct. `HIT_AREA` is merged by `cn` and the default look is unchanged. Nothing to report.

## 4. The red closing replay: root cause

What was red: the parent session's run of `src/lib/sms/gold/closingReplay.test.ts` failed with `Hook timed out in 180000ms` in `beforeAll`. No check failed. The same run also timed out `src/lib/budget/flow/flow.test.ts`.

Cause, by reading (the local run was refused, see below):
1. **The replay runs inside the full suite whenever the export exists.** `vitest.config.ts:11` includes `src/**/*.test.ts`, and the replay only skips when the export is missing. The `fable-5-prioritization-c5372d` worktree holds `.claude/sms-s2c-replay.json`, so `npm run verify` there (`scripts/verify.sh:13`, `vitest run --coverage`, every file in parallel) runs it under coverage instrumentation.
2. **One `beforeAll` holds seven full replays** (A, B, C, plus four `u10` order runs), about 960 messages each, all under a single 180 s hook budget. Each dispatch is driven in `tick(100)` steps of `advanceTimersByTimeAsync` (`src/lib/sms/gold/closingReplay.ts:483-491`).
3. **QA-37 (b315662f) added work per FX leg:**
   - an `asset_prices` read;
   - a sibling re-read;
   - on disagreement, an unpair, a window search and a second `claimSibling`, which can add another 400 ms pause (4 more ticks).

   QA-38 and QA-34 add reads on the pairing path too.

   Each is small, but with coverage and the parallel suite they push the hook past 180 s. This has happened before: S4 recorded `templateReplay.test.ts` timing out under load, and e24d06ed raised that file's timeout to 60 s.
4. **Not a logic regression, as far as reading can tell.** The QA-37 rate path was fixed in 0b6d7ac6 (`asset_prices` answered empty) and e24d06ed (`DEFAULT_MARKET_RATES`). Every new query method used (`neq`, `lte`, `limit`, `maybeSingle`) is implemented by the in-memory builder, so nothing can throw "not implemented".

What could still turn a check red once it runs to completion (from the SMS review):
- **Check i, column C:** the two HSBC FX pairs (`50641027+cafcae46`, `985f7ad6+b0854359`) pass only while `DEFAULT_MARKET_RATES.USD_EGP` stays within about 52.3 to 54.85 (M-5).
- **QA-34:** remembered answers can add replay-only pairs that take a leg paired differently live (check i).
- **Route-only holds (QA-14, QA-39):** these are invisible to the replay, so check j's "replay books income where live had no row" grows with every hold since 2026-11-19 (information only, not asserted).

Suggested fix:
- Take `closingReplay.test.ts` and `templateReplay.test.ts` out of the default vitest `include`, and run them only by name, e.g. a `replay:closing` script with its own config.
- Split the seven replays into separate `it` blocks, each with its own timeout (or raise the hook to 600 s).
- Keep `verify` green in any worktree that holds the export.

**Run still needed.** It must run on this Mac, because the export may not go to the cloud. The run was attempted here and refused by the auto-mode safety check, which applies the owner rule against test runners on the Mac. The owner has to allow one run:

```bash
SMS_S2C_REPLAY="../fable-5-prioritization-c5372d/.claude/sms-s2c-replay.json" TZ=Africa/Cairo npx vitest run src/lib/sms/gold/closingReplay.test.ts --reporter=verbose
```

Run alone, with no coverage, it should finish. If it then passes all twelve checks, the root cause above is confirmed. If check i fails in column C, the cause is M-5.

## 5. Live checks run (metadata only)

| Check | Result |
|---|---|
| SECURITY DEFINER functions in `public` that `authenticated` can execute (B-9) | 24, all user-facing RPCs (savings v1/v2, subscriptions, loyalty, `referral_my_summary`, `second_factor_status`, `sms_run_my_pending_discards`, …). No server-only function is open. |
| Numeric columns writable by `authenticated` with no `<` CHECK (X-4) | 30 columns, listed in X-4. |
| `platform_settings.savings_balance_delta_enabled` (S-3) | `true` |

For the owner, in dashboards:
- the RevenueCat webhook's environment filter and HMAC header (B-1);
- Supabase Auth email OTP length = 6, and the hook secret being the full `v1,whsec_…` value (X-10);
- whether email change is meant to stay on (B-17).

## 6. Cross-module risks with the sync branch (`claude/ecstatic-shamir-e2f695`, not reviewed)

- **Sign-out wipe (SYNC-P0):** open on main and fixed there. It must land before the next native build.
- **S-1 is not fixed there**, and that branch's sign-out check relies on the same baseline, so it inherits the gap.
- **0331 and 0334 are full copies of the 0319 trigger.** Any later main migration copied from 0319 would silently drop their rules. Always copy from the newest live body (`pg_get_functiondef`).
- **D-9 runs before the 0319 undo check**, so a refused undo still writes its content onto the deleted row.
- **0334's 3-second tolerance** does not cover S-3, S-4 and S-5, whose restored edit times are days old.
- **D-3 vs QA-34 / QA-38:**
  - the QA-38 reference path marks every candidate same-reference, so D-3 gets that signal for free and can settle legs up to 24 hours apart;
  - for account pairs answered "both mine", QA-34 alone already settles.
  - Decide which rule owns two-phone pairs.
- **Migration numbers:** that branch's note once claimed 0332 for SMS pairing, but main uses 0332 for S8g. The branch now has 0331 and 0334, so there is no clash, but 0331 will apply out of order after 0332 and 0333.

## 7. Test cases added, and runs to ask the cloud qa-runner for

Added, as `test.fail` with the finding id:
- `e2e/api/round2/pro-rewards/30-billing.spec.ts`: **H8** (B-1, a sandbox purchase gives no Pro) and **X6** (B-17, no second trial after an email change).

Runs to ask for (branch `claude/s8a-qa-fix-review-2159fb`):
1. `npx playwright test -c e2e/api/round2/pro-rewards/playwright.config.ts --reporter=line --trace off -g "H8|X6"`. Expect both to report as expected failures, then run `node e2e/api/round2/pro-rewards/teardown.mjs` and check that 0 synthetic users are left.
2. Cases still to write in the fix sessions (no existing case covers them):
   - S-1: `e2e/sync/`, an edit made during a pull is on the server after the next flush.
   - S-2: `src/lib/accounts/balance.test.ts`, paying from a held pocket lowers net worth.
   - M-1: `e2e/sms/`, a second AI-read credit from the same new sender is still held.
   - M-4: the parse route unit test, a provisional-currency row is not learned.

## 8. Checked and found correct (one line each)

- **Webhook auth:** both the Authorization secret and HMAC are required, compared in constant time, and it fails closed when unset.
- **Billing state:** event-id idempotency, the per-user stale check, and pack grants idempotent on `store_txn`.
- **Grants:** service-only on redeem, trial, stay offer and `session_is_live`. `search_path` is set on every SECURITY DEFINER function in 0306-0333.
- **Invites:** self-invite, parallel redeem and double reward locking; `repeat_network` matches `INVITE_ANTI_ABUSE.md`; the disposable check handles case and subdomains.
- **Entitlements:** TypeScript and SQL resolve them the same way.
- **Migrations:**
  - 0319 trigger logic;
  - 0318, 0328 and 0329;
  - 0320 is pinned to ids and idempotent;
  - 0322 uses fixed windows and is service-only;
  - 0323 guards are replaced exactly once and grants are kept;
  - 0325's fail-open is scoped;
  - 0326 argument lists are supersets;
  - 0327 grants are kept and the purge is indexed.
- **Sync fixes:** QA-19, 20, 22, 42, 65, 58, 108, 12 and 23. QA-107's delete guard skips Cash and rows still to send. Derived ids do not clash between users.
- **SMS fixes:** QA-103, 104 and 105 patterns; the QA-37 re-claim (bounded, released before the re-claim); the QA-38 reference hash (salted per user, indexed, limit 5); QA-31, QA-35 and QA-49.
- **Routes:** QA-102 (405 for a cookie-only GET, no-store), QA-100 CSP, QA-56 (constant-time cron secret), QA-57, QA-53, QA-54, QA-51 and QA-79.
- **Email hook:** HMAC over `id.timestamp.body`, constant-time, ±300 s; the log is written in `after()` and holds no code or link; the template cache is per locale; variables are escaped; the idempotency key is the signed webhook id.

The reviewers' full notes, with every line reference, are in the shared notes folder for this session group as `S8a-review-{billing,sync,sms,security}.md`.
