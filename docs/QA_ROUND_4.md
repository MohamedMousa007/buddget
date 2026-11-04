# QA Round 4: app-wide deep pass (2026-11-04/05)

Method: Round 2's order (context, baseline, data layer, server, AI, web UI, native, close) with the project QA skills (database-, api-, security-, accessibility-, mobile-testing and coverage-analysis checklists), the design/accessibility skills and the ponytail audit. Run on `main` at `dce6c1f5` (includes the new budget builder from other sessions). Harness for the UI sweep: `scripts/qa/ui-sweep.js` (axe + overflow + tap-target + hit-test; copy `node_modules/axe-core/axe.min.js` into `public/` temporarily, never commit it).

## Baseline (measured)
| Check | Result |
|---|---|
| lint / tsc | 0 errors / 0 errors (48 lint warnings) |
| tests | 4,035 pass, 188 skipped (pg and live-AI suites), Cairo and New York |
| coverage, gated dirs (utils, savings, debt, sms, remote) | lines 83.6, branches 74.4 |
| coverage, whole `src/` | lines 41.7, branches 37.7. Untested: `components/features` 6.5%, `hooks` (useAddDebtSheet, useVoiceExpense, useBuddgyChat, useSmsTracking ~0-4%), `app/api/admin/*` 0-3%, `cron/month-carry` 5%, `cron/notifications` 8.5% |
| dependency audit | 18 advisories, none high/critical outside the allowlist |
| Supabase advisors | no new security finding. 11 SECURITY DEFINER RPCs: all use `auth.uid()`, pinned search_path, no anon execute. Leaked-password protection still off (owner) |
| live data invariants (37 SELECTs) | clean except known residuals: 12 ghost-confirmed SMS (deferred), 2 debt payments without expense (personal, intended), 1 future expense, 1 dangling debt link, 2 duplicate payment methods on the owner account (CIB ••6212 twice) |
| RLS impersonation, all 34 tables with `user_id` | 0 rows readable, 0 rows writable across tenants (4 tables deny UPDATE/DELETE at privilege level) |
| unreferenced code | 129 exports with no other reference (52 used only by tests); 9 files fully dead (~540 lines): RecurringIncomeCard, countryToCurrency, IosSmsSetupClient, savingsHoldingMapper, useDependencyStatus, useRangeLabel, calculateGoalPayment, readI18n, recurringSavingsDates |

## Fixed in this round
| ID | P | Finding | Fix |
|---|---|---|---|
| OPS1 | P1 | The hourly pg_cron job (id 15) calls `/api/cron/notifications` with `net.http_post`, but the route exported GET only: all 94 hourly runs returned 405, so per-user 09:00 notifications never ran (only Vercel's daily 06:00 UTC GET, which skips users still before 09:00, e.g. Cairo in winter) | route now also exports POST (same auth); test added. Deployed (`67b560b`) and verified: a POST from the job's own request ran the route (`notification_cron_last_run` updated). The job's pg_net timeout was the 5 s default, shorter than the route, so cron job 15 was altered live to `timeout_milliseconds := 55000` |
| NW1 | P2 | Net worth (no tracked accounts) added the whole month's expected income, including paydays not yet received: demo showed -3,037 instead of -57,037 | `useNetWorth` and Buddgy `get_net_worth` use `receivedIncome`; red/green test |
| A11Y1 | P2 | `/goals` card was a `role=button` div containing a button (nested interactive) | one stretched button for the card, footer action above it |
| A11Y2 | P2 | Debt cards and the emergency-fund sheet had unnamed progress bars | `aria-label` (required prop on `DebtBar`) |
| A11Y3 | P3 | Reports section headings jumped h1 to h3 | h2 |
| A11Y4 | P2 | Contrast below 4.5:1: 9.5px coloured captions in every transaction row (3.06:1), selected income-type chip, payment-type chip | shared `readable()` colour helper (moved to `lib/utils/color`) applied to those texts |
| A11Y5 | P2 | Single-choice chips in the budget builder, onboarding (country, currency, payday) and the "estimate" toggle did not announce which is chosen (`as="trigger"` inside a radiogroup) | default toggle (`aria-pressed`), plain `group`; render test |
| COPY1 | P3 | "We found 1 debts / 1 goals / 1 bills" (English), and fixed plural in Arabic | singular and dual variants for the three confirm cards, both languages; test |
| COPY2 | P3 | "Every dirham has a place" shown to every currency | "Every amount has a place" / Arabic equivalent |
| BF1 | P3 | Budget builder asked "how much do you invest each month" and ignored the answer | investing line capped at the stated amount; test |
| BF2 | P2 | Choosing "what my records show" for a rent conflict changed nothing | records rent used; test |
| WEB1 | P3 | Production web crashes `removeChild` / `insertBefore` (Sentry, same user, minutes apart): the signature of browser auto-translate rewriting React's text nodes | `translate="no"` on the app `<html>` (the app has its own EN/AR) |

## Open (known)
| ID | P | Finding | Needs |
|---|---|---|---|
| BF3 | P3 | Six budget-builder questions are asked and their answers used nowhere: `taxPlan`, `housingChange`, `deficitPlan` (+ `extraIncome`), `educationFor`, `mortgageYears`. `subsAmount` is read but no question sets it | product decision: wire each into the plan or stop asking (flow change, not done) |
| UI1 | P3 | Hit areas below 44px: "Set budget" (86x26), "Open filters", Flow category chips (36 tall), price-rise and goal-milestone switches. Adjacent small icon buttons share hit areas (Refresh prices next to a neighbour) | design call (rule says 44px) |
| D1 | P3 | Owner account has two identical payment methods (CIB ••6212); creation does not block a same-bank, same-tail duplicate | merge them; add a duplicate guard |
| DC1 | P3 | ~540 lines of dead files, 129 unused exports | delete (list above) |
| N2 | P3 | Bank-key precedence differs between `findUniqueByLast4` (sender first) and `resolveReportTarget` (bank name first) | align |
| ER1 | P3 | Pasted European-style "1.234" in an EGP field reads as 1.23 | decide the ambiguity rule |
| ACC | - | Brand logo tiles (YouTube red, Apple Music) fail contrast but logos are exempt | none |
| Round 2/3 deferred | - | see `QA_ROUND_2_STATUS.md` (ghost SMS, crash re-open, quota RPC, hero masking, 2FA enforcement, owner steps) | owner |

## Not covered (stated plainly)
Real-device native paths (SMS receive, push, biometric, scanner), voice and receipt flows, Buddgy model behaviour and prompt-injection, offline and reconnect, deep links, 2FA round trip, admin portal UI, measured performance, dark/Arabic on every sheet (only 11 sheets and 8 routes swept), keyboard-only sweep.

## How far from bug-free
Bug-free cannot be measured, only bounded. What the numbers say:
- Known open: 0 P0, 0 P1 (OPS1 fixed in code, live on deploy), 4 P2 closed, about 6 P3 open. Defects fixed this round: 12.
- Where the defects were: 5 of 12 in code written after Round 3 (budget builder, ~3,000 new lines, about 2 per 1,000 lines found), 4 in UI primitives that no unit test renders (coverage 6.5%), 1 live-ops integration, 1 production crash signature, 1 money display. Money maths and the data layer (83% covered, 37 invariants, RLS) produced one finding.
- Zero of this round's findings overlap Round 3's list. By capture-recapture that means discovery is not saturated: each round samples a different slice. Expect a long tail of P3/P2 in the layers listed under "Not covered".
- Assurance score (15 segments x depth 0-3 for this round): money/ledger 2, wealth 2, debts 2, budget 3, reports 2, accounts/security 2, AI 1, SMS 2, ops 3, native 1, i18n 2, performance 0, database 3, design/a11y 3, UI sweep 2, tests/supply chain 3, admin 1, offline 0 = 34 of 54, 63%. A release gate would want 80%+ with native, AI and offline at 2.
- Next rounds, by yield: (1) render tests for the top 20 untested UI/hook files, (2) a real-device checklist run, (3) Playwright smoke for the 9 journeys, (4) offline/reconnect and 2FA round trips, (5) Buddgy injection suite.
