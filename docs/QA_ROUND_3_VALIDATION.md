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
