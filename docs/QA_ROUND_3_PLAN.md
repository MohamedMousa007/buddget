# Buddget QA round 3: bug register and fix plan

Date: 2026-11-02. Branch `claude/relaxed-allen-hixdfp` (source identical to `main` at `ca96bd8`). **No fixes are applied.** This document only records what was found, why, how bad it is and how to fix and verify it.

Evidence tags: **[live]** read-only SELECT on the live Supabase project, **[probe]** executed test or script, **[measured]** browser/CI measurement, **[code]** read in source, **[schema]** live grants/policies, **[reasoned]** inferred, not exercised.
Priority: **P1** fix before the next release, **P2** fix this cycle, **P3** backlog. Effort: S under half a day, M 1-2 days, L more.
Detail for R-items (evidence numbers, repro commands) is in `.agents/qa-run3-report.md`; this plan adds the new findings (V, N) and consolidates the whole set.

## 1. Summary

| Priority | Count | Meaning |
|---|---|---|
| P1 | 2 | R1 (retention vs published policy), R4 (CI not gating) |
| P2 | 20 | data integrity, security hardening, compliance, accessibility, tests |
| P3 | 25 | hygiene, localization, minor hardening, latent issues |
| Retracted | 1 | R2 (a guard trigger exists) |
| **Total live** | **47** | |

Changes since the first report: R3 moved P1 to P2 (only the legacy AI action path is affected); R13 moved P2 to P3; R2 retracted; 12 findings added (V1-V6, N1-N6) from variant analysis, native review and property probes. R22 now has a located cause (V2/F-key, see below).

Checked and clean in this deeper pass: month-cycle partition and tiling (`getMonthRange`, `budgetMonthKeyFor`; 20,000 + 5,000 generated cases, month start day 1-31, 4 time zones incl. UTC+14: no failures); currency round trip over EGP/USD/EUR/SAR/AED/GBP/KWD (relative error under 1e-6). Temporary test files were removed.

## 2. Register by area

### 2.1 Money, data integrity and sync
| ID | P | Finding | Cause | Impact | Fix | Effort | Verify |
|---|---|---|---|---|---|---|---|
| R3 | P2 | Legacy AI action `delete_expense` removes a debt-linked expense and leaves the payment, debt stays "cleared" | `ai/aiActionHandlers.ts:534` calls a plain removal; the store's linked-delete is bypassed | Wrong balances for voice/legacy AI users. Live: R8 shows 2 orphan payments | Route the handler through the store delete that cascades, or refuse like Buddgy's `lockedReason` | S | Regression test: delete linked expense, payment removed, debt reopens |
| R5 | P2 | Import accepts invalid dates (48 bare `z.string()` fields); a bad subscription date crashes `/subscriptions` (`RangeError: Invalid time value`) and persists | `financeImportSchema.ts` has no date validation; render path trusts stored dates | Importing a hand-edited or old file can brick a page permanently | Validate dates in the schema (`YYYY-MM-DD` plus real-date check); guard `format()` calls | M | Probe test red to green; import garbage, page renders |
| R7 | P2 | 12 `sms_parse_log` rows `confirmed` with no linked expense/income/debt/savings | Confirm path marks the log before/without the link write succeeding [code]; no constraint | Silent lost transactions | Confirm and link in one RPC; backfill review | M | Query returns 0 rows after fix |
| R8 | P2 | 2 debt payments with no paired expense and no savings funding | Likely R3 path or older flow | Debt totals disagree with spending | Owner review of the 2 rows; add integrity check | S | Live SELECT returns 0 |
| R9 | P2 | Backfilled income events dated by confirmation day (Sept income dated Oct 18) | Backfill uses confirmation date as `received_date` | Income lands in the wrong cycle | Product decision, then use occurrence date | M | Per-cycle income totals match occurrences |
| R14 | P2 | Clearing the active budget plan does not sync to other devices | `delta.ts:164` and `merge.ts:41` use `??` so null falls back to the stale value | Device B keeps old plan forever | Treat explicit null as a value (carry a "cleared" marker or compare timestamps) | S | Unit test: clear on A, pull on B |
| V3 | P3 | Deleting a debt/savings account/recurring expense leaves dangling link ids on expenses, income events, subscriptions | `deleteDebt`, `deleteSavingsAccount`, `deleteRecurringExpense` clean some links only. Live: 1 dangling `linked_debt_id` (R33) | Ghost links, wrong "linked" badges | Clear all referencing link fields in the same store action | M | Property test: after delete, no id references a missing row |
| V5 | P3 | Importing another account's export keeps its UUIDs | `importData` replaces arrays wholesale (`...state, ...data`), no id remap or referential check | Cross-account id reuse; mitigated by per-row upsert fallback in `sync.ts:116` | Remap ids or validate on import | M | Import into second account, no conflicts |
| V4 | P3 | SMS expense date math depends on server time zone | `createSmsExpense.ts:617-655` does `new Date(row.day)` then `setDate`/`toISOString().slice(0,10)` | Off-by-one day if the server TZ is not UTC (latent, Vercel is UTC today) | Use UTC arithmetic like `quickAddDate.ts` | S | Run the unit test with `TZ=Pacific/Kiritimati` |
| N6 | P3 | Exchange rates are not validated; a negative, zero or non-numeric rate converts money wrongly | `currency.ts` `convertVia` accepts any truthy rate; `api/rates` returns `open.er-api.com` data unchecked (the v2 path checks `typeof number`). Probe: rate -50 turns 100 USD into -5,000; rate 0 or NaN silently falls back to defaults | Wrong totals if the upstream returns garbage | Accept only finite positive numbers at ingestion and in `convertVia` | S | Probe test over bad rates |
| R34 | P3 | Two recurring income templates with equal amounts created seconds apart produce duplicate events | No duplicate guard | Double income | Warn on near-duplicate template | S | Unit test |
| R33 | P3 | Data hygiene: 3 stale awaiting-confirmation SMS, 1 profile without settings, 1 dangling debt link, 1 future-dated expense | Mixed | Minor | Cleanup script after owner review | S | Live SELECTs return 0 |

### 2.2 SMS pipeline, regex and native
| ID | P | Finding | Cause | Impact | Fix | Effort | Verify |
|---|---|---|---|---|---|---|---|
| R6 | P2 | `safeRegex` approves adjacent overlapping quantifiers (`\d+\d+\d+x`): 3 s at 300 chars, 99 s at 1,000 | Only nested quantifiers are rejected; input cap 2,000 | Server CPU stall from a learned or admin-edited template | Stronger check (reject adjacent overlapping quantifiers), lower input cap, or a timeout-bounded engine | M | Probe test red to green; real templates still accepted |
| V1 | P2 | AI-learned regex is executed before it is checked | `api/sms/parse/route.ts:400-408` builds `new RegExp(...)` and runs `re.test(message)` before `runLearnGates`, which calls `isSafeRegexPattern` | Same ReDoS reachable on the live ingest route, before any guard | Check safety first, then execute | S | Unit test: unsafe learned pattern is never run |
| N1 | P2 | Android: a delayed forward job can post account A's SMS into account B | `SmsForwardWorker.doWork` reads the current `access_token` and ignores the SMS's `userId` stamp; jobs retry up to 8 times with backoff and survive reboot; `SmsReceiver` stamps the queue entry but not the job | After an account switch, a retried job delivers the old user's bank SMS under the new user's token. The "can't drain into the wrong user" guarantee holds only for the JS drain | Pass `userId` in the job data and compare with `token_user_id`; on mismatch fail without sending | S | Android unit test with a fake store; manual two-account test |
| R1 | P1 | SMS raw bodies kept far beyond the published policy | See report: 908 bodies, 703 older than 30 d, 457 older than 60 d, 118 rejected/OTP older than 7 d, oldest 136 d; policy also says "Not stored" | Compliance exposure, wrong public statement | Owner decision on purge (do not purge without confirmation); scheduled retention job; fix policy text | M | `sms_retention_audit` shows 0 past limit |
| N2 | P3 | Android queue keeps SMS older than 30 days when the queue holds 200 or fewer | `PendingSmsQueue.trim` returns early when `items.length <= CAP`, so age eviction only happens over the cap (class comment says otherwise) | Raw bank text stays on the device indefinitely | Evict by age on every enqueue | S | Unit test with an old item at length 1 |
| N3 | P3 | Android: SMS silently lost if encrypted prefs fail twice | `SmsStore.open` rethrows for non-key-loss errors; `SmsReceiver` catches Throwable and only logs | A transient Keystore failure (early boot) drops the message | Fall back to a plain in-memory/disk spool or retry via WorkManager | M | Fault-injection test |
| N4 | P3 | iOS: `removePending` may remove nothing | `call.getArray("items") as? [[String: String]]` fails if any value is not a string | Delivered items remain queued, re-sent each drain (server dedups) | Cast per field, tolerate non-strings | S | Unit test |
| N5 | P3 | iOS Shortcut forwards every message the user's automation matches; only the OTP gate runs on device | iOS has no marketing/business-sender gate (Android has both) | More non-bank text reaches the server than on Android | Product decision; add marketing gate | S | Parity test against Android cases |
| R35 | P3 | iOS privacy manifest declares no collected data | Manifest vs actual data flows | App Store label risk | Compare with the privacy label before submit | S | Manual review |

### 2.3 Auth, privacy and compliance
| ID | P | Finding | Cause | Impact | Fix | Effort | Verify |
|---|---|---|---|---|---|---|---|
| R10 | P2 | Account deletion leaves support ticket subjects and message bodies | `user_id` nulled, rows kept | Personal text outlives the account (no tickets today) | Delete or anonymise ticket text on account delete | S | Delete test account in a branch DB |
| R11 | P2 | Biometric sign-in mints a magic-link session from the device secret; unverified whether it skips email 2FA | [reasoned] | Possible 2FA bypass | Verify; require the 2FA step or document the trust | M | Manual flow test |
| R12 | P2 | `/api/ai` forwards client `systemInstruction`, `tier`, `grounded` to Gemini | No server allow-list | Cost and prompt abuse within quota | Ignore client values, derive server-side | S | API test |
| R13 | P3 | `profiles.email` is client-writable | Guard trigger covers two other columns only | A user can change their own support contact address | Add the column to `guard_profile_server_columns` | S | Update as client fails |
| R30 | P3 | Leaked-password protection off | Supabase Auth setting | Weak passwords allowed | Enable in dashboard | S | Advisor clear |
| R32 | P3 | `email_log` keeps invitee addresses indefinitely | No retention | Minor privacy | Add retention | S | Query |
| R28 | P3 | Raw upstream error text or zod issues returned (`voice/transcribe`, `push/send`, `push/register`, `sms/parse`) | Error echo | Info leak | Return generic messages | S | API tests |
| R29 | P3 | Per-process rate limiters (`site/lead`, `auth/check-email`, Buddgy auto-apply cap) | In-memory | Limits multiply across instances | Shared store | M | Load test |

### 2.4 UI, accessibility, localization
| ID | P | Finding | Cause | Impact | Fix | Effort | Verify |
|---|---|---|---|---|---|---|---|
| R15 | P2 | Contrast failures: 8 light nodes on 5 routes, 17 dark nodes (13 on `/reports`); heading order and landmark issues | Token choices | WCAG AA failures | Adjust tokens per `docs/DESIGN_SYSTEM.md` | M | axe run |
| R16 | P2 | Touch targets under 44 px widespread (Flow/Income 23-34 per page, Reports ~20, Savings 6-18) | Component sizes | Violates `CLAUDE.md`, hard to tap | Raise hit areas (padding), keep visuals | L | Measured count 0 |
| R17 | P2 | Reports: net worth shows 0.00 against its caption; net cash flow counts expected income | Definition mismatch | Misleading numbers | Define and align | M | Visual check |
| R21 | P2 | Throttled mobile: TBT 0.75-1.34 s (budget 0.2 s), `/start` LCP 7.1 s | Bundle and main-thread work; dummy backend may inflate `/start` | Slow on low-end phones | Split bundles, defer work | L | Lighthouse, signed-in routes too |
| R22 / V2 | P3 | React warns "two children with the same key `0`" on Flow, Income, Expenses | Cause located: `FlowStickyStrip.tsx:36-38` uses `key={r}` on figures, so two equal figures (for example "0") collide. Same pattern keyed by data in `SmsReviewSheet.tsx:117` (dates), `ReviewPage.tsx:68,78` (reasons), `GoalChat.tsx:129` (chips), `AdjustSheet.tsx:125` (proposals) | Wrong re-render/state on duplicate values | Key by index or by a stable id | S | Console clean on the 20 loads |
| R23 / V6 | P3 | Dates in English in Arabic mode | Notifications call `formatDistanceToNow` with no locale (`notifications/page.tsx:34,131`). `formatDate`, `formatDateShort`, `formatRelativeTime`, `formatMonth`, `formatMonthShort`, `groupByDate` in `utils/formatters.ts` are English only; used by 16 UI call sites; `toLocaleString(undefined)` in `CurrencyConverterGoldRow`, `CurrencyConverterCore`, `IncomeTemplatePicker` | Mixed-language UI | Use `useLocalizedFormatters` / pass the locale | M | Arabic screenshots |
| R24 | P3 | `/notifications` has no `h1` | Missing heading | A11y | Add heading | S | axe |
| R25 | P3 | Long names or huge amounts overflow (`/savings`, `/wealth` +1,867 px; `/reports` +134 px) | No truncation | Layout break | Truncate/wrap | S | Seeded long strings |
| R26 | P3 | Moon icon for the language toggle; duplicate "Get the app"; crowded 375 px header | Design | Confusing | Design pass | S | Visual |
| R27 | P3 | Hardcoded hex fallbacks in 4 feature files; auth gradient duplicated in 3 components | Design system drift | Inconsistent theming | Use tokens, extract | S | Grep clean |
| R36 | P3 | Next.js warns `middleware` convention is deprecated | Framework change | Future break | Migrate to `proxy` | S | Build clean |

### 2.5 Process, tests and dependencies
| ID | P | Finding | Cause | Impact | Fix | Effort | Verify |
|---|---|---|---|---|---|---|---|
| R4 | P1 | CI gates nothing: all 8 jobs of the latest `main` run fail in ~2 s with no steps; 3 tests also fail deterministically in UTC and New York | GitHub Actions unavailable (billing); time-zone-pinned fixtures | Regressions reach `main` unseen | Local gate script as the required check, or restore Actions; fix fixtures | M | Green run in Cairo and New York legs |
| R19 | P2 | Test defects: Cairo-pinned fixtures (`goalDate`, `hawl`, `updateExpenseDate`); order-dependent tests under shuffle (`useNetworkStatus` x3, buddgy auto-apply guardrail) | Shared state, fixed zone | False failures/passes | Pin zone per test, reset shared state | M | `--sequence.shuffle` with 3 seeds |
| R20 | P2 | Coverage gate 40%/30% over 5 directories; UI, routes, store unmeasured | Config | Low protection | Raise floor, add directories | M | Coverage report |
| R18 | P2 | `database.types.ts` stale: 5 live tables missing, dropped `fx_rates` still listed; untyped cast in `admin/sms/pattern-review` | Types not regenerated | Type holes | Regenerate, remove cast | S | `tsc` clean |
| R31 | P3 | `npm audit --omit=dev`: 0 critical, 3 high, 21 moderate, 2 low. The 3 high are one build-time chain: `serialize-javascript` <= 7.1.2 (RCE via crafted RegExp.flags/Date, XSS via `</script`), pulled in by `rollup-plugin-terser` and `workbox-build` | Transitive dependencies of the PWA build tooling | Not shipped to users; risk is limited to the build machine if it serialises attacker data | Update or override `serialize-javascript`; review `@capacitor/cli` and `firebase-admin` chains | S | `npm audit` |

## 3. Fix batches (suggested order)

1. **Batch A, before release (P1):** R1 (needs owner decision first), R4.
2. **Batch B, security and money (P2, small):** V1+R6, N1, R3, R14, R12, R5, R18, N6.
3. **Batch C, compliance:** R10, R11, R13, R30, R32.
4. **Batch D, integrity cleanup:** R7, R8, R9 (decision), V3, V5, R33.
5. **Batch E, tests:** R19, R20, then property tests for cycles and links.
6. **Batch F, UI:** R15, R16, R17, R21 and the P3 UI items together with an Arabic pass.

## 4. Decisions needed from the owner

- R1: approve purging old raw SMS bodies (I did not purge anything) and the retention windows; fix the policy text.
- R9: which date should a backfilled income event carry.
- R17: definitions of net worth and net cash flow.
- N5: should iOS get the marketing gate.
- R4: restore Actions billing or adopt the local gate as the required check.
- R11: confirm the intended 2FA behaviour for biometric sign-in.

## 5. Not covered (needs a session, device or key)

Signed-in forms (Add Expense and others; no account was created on production), real Android/iOS devices (static review only, including push, SMS and biometric), keyboard-only focus sweep and Escape/focus-return on dialogs, 200% reflow, Lighthouse on signed-in routes, visual baselines, the AI eval suite and red-team scan (need an API key), Postgres suites (need `QA_PG_URL`), most of the 455 components and the 219 migrations line by line. The R11 and R35 items remain unverified.

## 6. Risks to the plan

- R3/V3/V5 touch the same store actions as sync; fix them with tests first and run a two-device sync check.
- R6/V1: a stricter regex check can reject real templates (my earlier attempt did, before it was reverted); test it against every stored template.
- R1: purging is irreversible; take a counts report and owner sign-off first.
