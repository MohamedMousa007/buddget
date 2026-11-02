# QA round 3: validation of every finding and fix (2026-11-02)

Each finding from `.agents/qa-run3-report.md`, `docs/QA_ROUND_3_PLAN.md`, `docs/ACCOUNT_BALANCE_ACCURACY_PLAN.md` and `docs/ACCOUNT_DISCOVERY_AUDIT.md` was re-checked against the current code (`main` at `4db0cd1`) and live data (read-only). Verdicts: **Valid** (fix), **Fixed** (shipped), **Withdrawn** (not a bug), **Downgraded**, **Monitor**, **Decision** (needs the owner, answered below where known).

## Owner decisions recorded
- R16 touch targets: invisible hit areas, visuals unchanged.
- R15 contrast: adjust design tokens slightly; list before/after values.
- R26 header: show "Get the app" once on narrow screens; label the language toggle with text (EN / ع).
- R1 SMS retention: do **not** purge by hand. Confirm with the owner before any purge, and make sure messages are learned and analysed before raw text goes.

## Withdrawn or changed after re-check
| ID | Was | Verdict and evidence |
|---|---|---|
| R1 | P1: raw SMS bodies kept past policy | **Monitor (P2).** A retention system already exists: `sms_retention_enabled = true`, daily job at 00:50 UTC (`sms_retention_audit` runs on 31 Oct, 1 Nov, 2 Nov; the first run purged 143 rejected, 335 never-learned, blanked 66 and deleted 61 failed). Raw bodies fell from 908 to 345. Parsed rows are held until the leak scan passes (`parsed_held = true`); the scan passed today (`sms_leak_scan_passed_at = 2026-11-02T05:01Z`), so the **next run (3 Nov 00:50 UTC) should mask and purge parsed bodies older than 30 days**. Of the 345 bodies left, 344 already have a masked body and are marked learned; 1 confirmed row has neither. Action: check the 3 Nov audit row, review the one unlearned row, and let the owner confirm learning quality first. No manual purge. |
| R2 | 2FA flag writable | Withdrawn (guard trigger `guard_two_factor_flag` exists). |
| R11 | Biometric sign-in may skip 2FA | **Withdrawn.** `secondFactor.ts` lists `biometric` as an accepted second-factor method on purpose. |
| R8 | 2 debt payments with no expense | **Withdrawn.** Both are personal "I owe" payments with no account chosen; a payment without an account is not meant to move a balance. |
| R9 | Backfilled income dated by confirmation day | **Withdrawn as a bug.** `received_date` is when the user confirmed; `occurrence_date` keeps the scheduled month (all 9 rows are manual, created 8 and 18 Oct). Product behaviour, no change. |
| R17 | Reports net worth shows 0.00 | **Withdrawn / unverified.** Seen only on the dev demo seed with no tracked accounts. Re-test on real data before treating as a bug. |
| R7 | 12 confirmed logs with no link | **Withdrawn as a separate bug.** Now 23 rows (9 income, 9 purchase, 2 ATM, 3 transfers); they are individual attribution cases covered by the unplaced-messages fix and a data review. |
| R28 | Raw error echo | **Narrowed.** `push/register`/`push/send` return validation details of the caller's own input (not a leak). Only `voice/transcribe` returns upstream error text (`route.ts:135`): P3. |
| N4 | iOS `removePending` cast | **Withdrawn.** Queue items contain only strings, so the cast works. |
| R21 | Throttled-mobile performance | **Downgraded.** Measured against a dummy backend; re-measure on production before acting. |
| R25 | Overflow with extreme strings | **Downgraded to P3 low.** Seen with seeded extreme values only. |
| R20 | Coverage floor | **Enhancement**, not a defect. |

## Fixed already (shipped in `4db0cd1`)
A1 phantom accounts for short numbers; A3 setup sheets accept 2-6 digits; RC1/RC2 short-number matching; RC5 balance target (currency tie-break); RC6 balance reports could never be saved; RC4 visibility (unplaced-messages notice and review sheet); RC7 gap alert after one settled report; A2 bank accounts open the Add account sheet (with a masked account number read as an account); A4 partial (foreign-currency balance no longer set as opening balance). Production repair of the owner's account done and verified (ledger 2,075.43 equals the bank).

## Confirmed, still to fix
| ID | P | Evidence re-checked | Fix | UI change? |
|---|---|---|---|---|
| R3 | P2 | `aiActionHandlers.ts:532` calls plain `ctx.deleteExpense`; reachable from voice and the AI command path; store `deleteExpense` (`useFinanceStore.ts:320`) is plain removal | Cascade or refuse for debt-linked expenses, like Buddgy does | No |
| R5 | P2 | 185 bare `z.string()` fields in `financeImportSchema.ts`; subscription dates unvalidated | Date-validate known date fields; guard render | No |
| V1+R6 | P2 | `parse/route.ts:404-409` runs `re.test` before the safety gate; `safeRegex` misses adjacent overlapping quantifiers | Gate first; stricter check; test on every stored template | No |
| R14 | P2 | `delta.ts:164` `??`, `:163` `\|\|`; `merge.ts:41-42` | Treat explicit clear as a value | No |
| N1 | P2 | `SmsForwardWorker.doWork` ignores the queue entry's `userId`; reads the current token | Pass `userId` in the job, compare with `token_user_id` | No |
| R10 | P2 | `deleteAccount.ts` has no ticket handling; FK is `ON DELETE SET NULL`, so subject, bodies and `requester_email` survive | Delete or anonymise tickets and messages on account delete | No |
| R18 | P2 | 5 live tables missing from `database.types.ts`, dropped `fx_rates` still listed | Regenerate types, remove the untyped cast | No |
| R19 | P2 | Cairo-pinned fixtures; order-dependent tests | Pin zone per test; reset shared state | No |
| R4 | P1 process | CI jobs fail without running (billing) | Owner choice: restore Actions or make the local gate (`lint`, `test`, `build`) the required check | No |
| R15 | P2 | axe: 8 light, 17 dark nodes | Adjust tokens (approved) | Colour only |
| R16 | P2 | many targets under 44px | Invisible hit areas (approved) | Hit area only |
| R26 | P3 | crowded header at 375px | Dedupe button, text toggle (approved) | Yes, approved |
| R24 | P3 | `/notifications` has no `h1` | Add a visually hidden heading | No visible change |
| R22/V2 | P3 | `FlowStickyStrip.tsx:36` `key={r}`; data-keyed lists in 4 more components | Key by index/stable id | No |
| R23/V6 | P3 | English-only formatters on 16 UI call sites; `formatDistanceToNow` without locale | Use localized formatters | Arabic text only |
| V3 | P3 | delete actions leave link ids; live 1 dangling `linked_debt_id` | Clear all referencing link fields in the same action | No |
| V4 | P3 | `createSmsExpense.ts` date math uses server time zone | UTC arithmetic | No |
| N6 | P3 | `convertVia` accepts negative/zero/non-numeric rates; `api/rates` first source is unchecked | Accept finite positive rates only | No |
| N2 | P3 | Android queue evicts by age only when over 200 entries | Evict by age on every enqueue | No |
| N5 | P3 | iOS has no marketing/business-sender gate | Add the same marketing gate with the money-movement exception | No |
| R28 | P3 | `transcribe/route.ts:135` echoes upstream `msg` | Return a generic message | No |
| R12 | P3 | `/api/ai` forwards client `systemInstruction`/`tier`/`grounded` | Server allow-list (quota-bounded, hardening) | No |
| R13 | P3 | `profiles.email` client-writable | Add to guard trigger | No |
| R29 | P3 | `site/lead` in-memory limiter | Shared limiter | No |
| R30 | P3 | Leaked-password protection off | Owner enables in Supabase dashboard | No |
| R31 | P3 | 3 high advisories, one build-time chain (`serialize-javascript` via workbox) | Override/update | No |
| R35 | P3 | Privacy manifest has empty `NSPrivacyCollectedDataTypes` | Align with the App Store privacy label | No |
| R36 | P3 | `middleware` convention deprecated | Move to `proxy` | No |
| R27 | P3 | hex fallbacks, duplicated gradient | Use tokens | No |
| R32/R33 | P3 | invitee emails kept; small data hygiene | Retention/cleanup | No |
| V5 | P3 | cross-account import keeps IDs; per-row fallback exists | Document or remap; low priority | No |
| N3 | P3 | double Keystore failure drops an SMS | Accept; monitor (very rare) | No |

## Account-detection follow-ups (from the audit), still open
A5/A6 collisions across providers (use scoped keys); A7 one identifier per account (needs `payment_method_identifiers` table and migration); A8 add an "account unknown" confirmation reason; A9 auto re-attribution after confirming an account; A10 ask for an opening balance in every creation path; A11 7-day detection window; A12/A14 account vs card at parse time. These need the identifier table first, so they ship together.

## Proposed order
1. **Batch 1 (no UI, low risk):** R3, V1+R6, R14, R5, R18, N6, V4, R28, R12, R13, R10.
2. **Batch 2 (native):** N1, N2, N5 (Kotlin/Swift edited here, not built).
3. **Batch 3 (approved UI):** R15, R16, R26, R24, R22/V2, R23/V6.
4. **Batch 4:** R19 tests, R31, R36, R27, R29, V3.
5. **Batch 5:** identifier table, A5-A14.
6. **Owner actions:** R4 (CI choice), R30 (dashboard), R1 (check the 3 Nov audit row; confirm learning quality before any purge), R35 (compare with the App Store label).

## Resolution log (batches 1-3, 2026-11-02)

**Fixed in code (tests added; lint 0 errors, 3,961 tests, production build pass):**
R3 (legacy AI delete refuses debt-linked expenses); V1+R6 (learned regex is safety-checked first, input capped, and every template match runs under a 50 ms vm time limit in `boundedRegex.ts`); R14 (a changed server profile now clears the goals note and active plan); R5 (calendar dates and timestamps validated in the import schema); R18 (types: 5 missing tables/views added, dropped `fx_rates` removed); N6 (non-positive or non-finite rates are ignored); V4 (refund windows use UTC arithmetic); R28 (`voice/transcribe` returns a generic error); R13 (support requester email now comes from the verified sign-in, not the editable profile field); N1 (Android job is only sent for the account the SMS arrived under); N2 (Android queue evicts by age on every enqueue); N5 (iOS Shortcut drops marketing text unless it states a money movement); R22/V2 (index-safe keys in the 6 duplicate-prone lists); R23 (notification times follow the app language); R24 (notifications title is an `h1`, same look); R16 (chips and segmented controls get the shared invisible 44px hit area; re-measured 0 undersized targets on 11 routes, no new scroll overflow); R15 (muted text tokens: light `#687371` to `#646F6D`, dark `#748380` to `#7B8A87`; notifications link uses `--color-brand-primary-ink`; axe colour-contrast now clean apart from third-party brand tiles).

**Re-checked and withdrawn or narrowed during the work:**
- R26: the "moon icon" is the theme toggle (the language control is already text) and "Get the app" appears in the nav and again as a scroll-triggered sticky bar by design. No change made.
- V6: the UI already uses the localized formatters; only the notifications page was English-only (fixed above).
- R12: `/api/ai` is a prompt proxy by design (tier is allow-listed, quota applies). No change.
- N6 (route): `api/rates` already filters non-positive values (`validRates`); only the converter hardening was added.
- R16 (scope): most "small" targets already had the invisible overlay; only chips and segmented controls lacked it.

**Native (edited, not built or run here):** N1, N2, N5 are Kotlin/Swift edits without a compile in this environment; Android `SmsGateTest` gained two tests. They will compile when the apps are built.

**Open, waiting for the owner:** R10 (delete the text of a deleted user's support tickets, or keep it as anonymised staff history: current code already erases the requester email and context); R4 (CI choice); R30 (dashboard toggle); R35 (privacy label).

## Resolution log (batches 4-5, 2026-11-02, after the owner's decisions)

**Owner decisions applied:** R10 keep bug, feature and praise tickets as history and erase the rest; R4 local gate only; R35 update the manifest for store approval.

**Fixed (tests added):**
- **R10:** on account deletion the subject and messages of private tickets (support, billing, account, other) are blanked to `[deleted]` before the sign-in is deleted; bug, feature and praise tickets are kept. Requester email and context were already erased.
- **R4:** `npm run verify` (`scripts/verify.sh`) is the gate: lint, types, tests in Cairo with the coverage floor, tests in New York, migration check, dependency audit, production build. `CLAUDE.md` now names it. CI is not relied on.
- **R19:** zone-dependent fixtures rewritten (goal dates, hawl) and pass in Cairo, New York, UTC and UTC+14; order-dependent tests fixed (network status mock leak, Buddgy same-turn memory); a millisecond race in the sync tests removed at its source (`emptySnapshot` now has a fixed profile stamp). Shuffled runs with five seeds pass.
- **R20:** measured coverage (lines 83.6, statements 81.1, functions 84.5, branches 74.4) is now protected by a ratchet (75 / 73 / 75 / 65) inside the gate.
- **R35:** `PrivacyInfo.xcprivacy` declares the 12 collected data types (linked, no tracking); `docs/STORE_PRIVACY.md` has the App Store label, the Play data-safety answers and the approval risks (the Play SMS permission declaration is the main one).
- **R36:** `middleware.ts` is now `proxy.ts`; CSP, nonce and site routing headers compared before and after on a running server and are identical; the native build stash list and docs follow.
- **R27:** the dark auth floor gradient is one token (`--auth-floor`) used by the welcome, lock and landing screens. The remaining hex values are brand marks (Google logo, avatar share palette) or are parsed as hex by `rgba()`/`inkOn()`, so they stay.
- **R29:** the site lead form uses the shared database limiter; `check-email` already did, and the Buddgy per-minute auto-apply cap is correctly per session.
- **R32:** new daily `data-retention` cron erases the address of `email_log` rows with no user after 90 days.
- **V3:** deleting a debt, a savings account or a recurring expense clears the ids that pointed at it (expenses, income events and sources, subscriptions) and keeps the rows; Buddgy's undo for debt and pocket deletes restores the links.
- **R33 / A11:** messages waiting on the user and accounts seen in messages stay visible for 30 days (was 7), so an `add_failed` message no longer disappears from review. The profile without settings no longer exists.
- **Account detection (A5-A10, A14 in part), migration 0226 applied:** accounts can hold alias numbers (`payment_methods.last4_aliases`); linking a detected number adds an alias instead of overwriting; server and client matching, balance reports and detection are alias-aware; detection groups per bank and merges `001`/`0001`, with prompt keys widened only when two banks share digits; a detected debit card is suggested the single account at the same bank as its parent; adding or linking an account places earlier unplaced bank messages on it with Undo; the Accounts page lists anything still unplaced.

**Checked and closed without a change:**
- **R31:** the three high advisories are one build-time chain (`serialize-javascript` through `workbox-build`), already allow-listed with a reason in `scripts/audit-gate.mjs`; the gate stays green.
- **V5:** importing another account's export keeps its ids; the per-row upsert fallback contains the damage. Accepted, documented.
- **N3:** a double Keystore failure can drop one SMS on Android. Very rare, no safe fix without a second store. Accepted.
- **R7:** the 23 confirmed messages with no link are individual cases (9 income, 9 purchases, 2 ATM, 3 transfers); the unplaced-messages list and the new re-placement cover purchases and ATM; income and transfers need per-row review by the owner.
- **A8:** an "account unknown" confirmation reason was not added; the Accounts-page notice and review sheet give the same outcome without extra prompts.

**Waiting on the owner (cannot be done from here):** R30 enable leaked-password protection in Supabase Auth; R1 confirm the 3 Nov 00:50 UTC retention run masked and purged parsed text older than 30 days and that learning quality is acceptable before relying on it; R21 and R25 need a real-device and signed-in Lighthouse pass; first compile of the Kotlin and Swift edits happens in the next native build.

## Remaining items: validation and fixes (2026-11-02, last pass)

Each leftover was checked against live data (read-only) and the code before deciding.

| Item | Evidence | Verdict | Outcome |
|---|---|---|---|
| Missing-transaction detection | Bank balance chains from the stored messages: 8 consecutive pairs, 3 consistent, 2 broken (the rest not comparable). Drift alert needed a repeated identical gap, so a growing gap stayed silent. | **Real** | `detectGap` now also fires when the unexplained amount grew since the previous report (once the newest report is 15 minutes old); shrinking or sign-flipping gaps stay quiet. Tests added. |
| Safety net for rejected messages | 149 rejected messages system-wide; masked text is kept, so they are not lost. 43 carried money words, but nearly all are promos, balance notices or reminders. **One real class was wrongly rejected as marketing**: a completed Vodafone Cash transfer receipt that ends with "get a chance to win a gold coin". | **Premise wrong, real bug found** | Pre-filter no longer treats a completed-transfer statement with an amount as an ad; tests added. Two Saudi SADAD "Amount: x SR" messages are rejected by the AI tier; left as a judgement call. |
| Explain before adjusting | `FixGapSheet` offered only guesses (cash, spent, set aside). | **Real** | New first answer "Bank messages on no account" (same currency) places them on the account, then the gap recomputes. |
| Admin metric | No view of how many imported expenses sit on an account. | **Real** | SMS health tab shows "Placed on an account" (share and count) for the last 7 days. |
| Back-fill for other users | Of 401 unplaced SMS expenses, only 9 match an account their owner already has; 314 name a number the user never created an account for; 78 have no number. | **Concern invalid as stated** | No server back-fill and no change to other users' data. The real fix is discovery, which is shipped; the new dashboard prompt and Accounts notice cover the rest. |
| A4 currency | Detection ignored the currency printed next to the balance. | **Real** | Detected accounts carry the currency of their balance line (LE means EGP); the Add account and card sheets and Find my accounts use it. |
| A5 Find my accounts | Grouped by bank plus digits and offered cards as accounts. | **Real** | Uses the same per-bank grouping as the prompt, skips cards, sets the account currency. |
| A8 | Unplaced messages were only visible on the Accounts page. | **Real (UX)** | One prompt in the shared stack ("N bank messages are not on any account") opens Accounts. |
| A14 | Account versus card is already inferred from the message text at detection time. | **Not needed** | Closed. |
| R25 | Reproduced: unbroken 80-character names and 12-digit amounts widened `/savings`, `/wealth` and `/debts` by 490-630 px. | **Real, low** | Row subtitles truncate and prompt titles wrap; re-measured 0 px overflow on 11 routes. A 12-digit hero amount still overlaps its label; not realistic, left. |
| Keyboard sweep | 55 tab stops, none stuck, all with a visible focus ring. **The Quick add button and the Buddgy bubble opened only on pointer events, so keyboard and screen-reader users could not open them.** | **Real (WCAG 2.1.1)** | Both (and the on-screen number pad) now act on a pointer-less click; verified in a browser for Quick add (Enter and Space open it, Tab stays inside, Escape closes and returns focus). The bubble and number pad use the same pattern as `DateStepper` but could not be exercised here (no AI key). |
| Signed-in form check | Add account driven in a browser: a 6-digit field, `001` accepted, `1` disables Save, `0001` saved. | Works | None needed. |
| 21 moderate advisories | All sit in build-time tooling (next-pwa and workbox chain, Capacitor CLI) or in `firebase-admin`'s `uuid`; none is reachable from a user request. npm's suggested "fixes" are downgrades (`next-pwa@0.0.1`, `@capacitor/cli@4.8.2`). | **Not actionable** | Closed with this note; revisit when `next-pwa` or `firebase-admin` is upgraded. |
| Postgres suites, AI evals, Kotlin/Swift compile, device performance | Need Docker, an AI key, Xcode/Android SDK and a phone. | Cannot be run here | Remain with the owner. |
