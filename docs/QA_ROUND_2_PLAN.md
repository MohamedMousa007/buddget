# Buddget — QA Round 2 (deep run) — consolidated plan

Status: DISCOVERY ONLY. Nothing from this run is fixed. Round 1 fixes are shipped (see QA_ROUND_PLAN.md Parts 5-6).
Method: same skills and order as round 1 (context/risk, baseline, data layer, server/API/security, AI, web UI, native, close-out) plus the ponytail audit (component dedupe) and the design skills (system, critique, accessibility, UX copy), run as 15 area audits. Full reports with file:line, evidence and fixes: `docs/qa-round-2/<area>.md`.

## Totals

| Area | File | IDs | P0 | P1 | P2 | P3 |
|---|---|---|---|---|---|---|
| Ledger (flow, income, paydays) | ledger.md | L1-L25 | 0 | 3 | 14 | 8 |
| Wealth (savings, gold, goals, zakat) | wealth.md | W1-W29 | 2 | 10 | 10 | 7 |
| Debt (debts, BNPL, cards, subscriptions) | debt.md | D1-D28 | 1 | 8 | 12 | 7 |
| Budget + reports | budget.md | R1-R34 | 0 | 6 | 16 | 12 |
| Account + security | account.md | C1-C25 | 0 | 6 | 10 | 9 |
| AI (Buddgy, voice, receipts) | ai.md | I1-I24 | 0 | 3 | 11 | 10 |
| SMS pipeline | sms.md | N1-N31 | 0 | 6 | 13 | 12 |
| Backend ops (crons, admin, email) | ops.md | O1-O19 | 0 | 3 | 7 | 9 |
| Native + offline | native.md | V1-V29 | 0 | 5 | 10 | 14 |
| i18n + formatting | i18n.md | T1-T20 | 0 | 3 | 10 | 7 |
| Performance | perf.md | F1-F20 | 0 | 3 | 8 | 9 |
| Database (live) | db.md | Q1-Q20 | 0 | 1 | 8 | 11 |
| Design system + dedupe | design.md | U1-U50 | 0 | 4 | ~20 | ~26 |
| Live UI/UX (partial) | ui.md | X1-X20 | 0 | 0 | 6 | 14 |
| Test suite + supply chain | suite.md | Z1-Z21 | 0 | 2 | 9 | 10 |
| **Total** | | ~395 | **3** | **63** | ~164 | ~165 |

Round 1 claims corrected by this run: Buddgy `add_expense` is auto-apply (I2), so "write tools only propose" was wrong for it; round 1's trusted-device fix (A1) and the SMS-retention privacy claim are bypassed/failing (C2, Q3, C3/O3/Q1/N2).

## Same bug found by several audits (fix once)

| Root cause | Found as | Why it matters |
|---|---|---|
| Nightly `sms-retention` cron fails (`raw_body` NOT NULL): 859 raw SMS kept, 667 older than 30 days, rejected/OTP bodies kept | C3, O3, Q1, N2, N3, N19 | Contradicts the privacy policy; raw bank SMS stored indefinitely |
| `trusted_devices` insert/update policy lets any session trust its own device; 2FA is client-side and fails open | C1, C2, Q3 | Email 2FA can be skipped by calling the API |
| Global `merchant_categories` last-writer-wins from any user | I1, Q4 | One user can make a merchant "Savings" for everyone, dropping it from all spend totals |
| `sanitizeAmount` mangles "1,250" / "1.250,50", caps decimals at 2 (blocks KWD/BHD/OMR/JOD/TND); SMS parser has the same flaw | L2, T2, N6 | 1000x wrong amounts |
| Android `allowBackup="true"` with biometric secret + SMS ingest token + queue in plain prefs | C4, V3, V7 | Backup restore on another phone clones credentials |
| Users can UPDATE their own `sms_ingest_tokens` row | Q2, N7 | A removed phone can re-activate its revoked token |
| Recurring-income delete/end erases received events from actual income | L1, R3 | Past months' income shows 0 |
| Savings RPCs trust ids/currency, no overdraft/currency check, `balance_after` NULL, not idempotent | W8, W9, Q6 | Money mis-credit, double credit under concurrency |
| Prices/crons: `CRON_SECRET` possibly unset on Vercel, crons never completed | O1, W19 | Notifications, price refresh, month-end notices never ran |
| Account delete misses `email_log`, `sms_stats_outbox`, support tickets, 23 orphan `sms_template_users` | C6, Q5 | Incomplete erasure |
| CSV export: formula injection, no BOM, dead on native | C11, R14 | Spreadsheet injection |

## P0 (money wrong / data loss)

1. **W1** EGP<->XAU conversion treats troy ounces as grams: 100,000 EGP into a gold pocket credits 0.5 g (31x loss); the reverse mints money. (`/api/rates` XAU is per ounce; `tryConvertCurrency` used in deposit/withdraw/transfer and Buddgy `inPocketCurrency`.) Proven.
2. **W2** With tracked accounts, "Add money from this month's budget" raises net worth (1000 -> 1300): the deposit has no account leg; withdraw-as-income loses money the other way; recurring deposits, goal add-money and the Buddgy deposit tool share the gap. Proven.
3. **D1** Manual, recurring or Buddgy debt payments debit the account twice (`linkedDebtPaymentId` never set): 400 paid from 1000 leaves 200. 21 such rows live. Proven.

## P1 (broken flow), grouped

**Money / ledger**
- D2 payment amount stored in debt units but labelled with paying currency (4700 EGP shows 94). D3 gold-debt payment in grams books grams as EGP. D4 swipe-deleting a debt payment leaves its expense. D5 "Confirm paid" double-posts. D6 card due/statement day and minimum % accept values the DB rejects (card never syncs). D7 installment progress counts rows not amounts. D8 SMS installment/card payoff writes not atomic, retry double-posts, no overpay guard. D9 pay-debt flow prefills debt currency but pays base.
- W5/W6 deleting a withdrawal leaves its income event / deleting a deposit clamps balance. W7 client upserts absolute `current_balance` over server deltas (stale device erases month-carry). W3/W4 withdraw sheet currency ignored; "Pay debt" can debit pocket with no payment when gold price missing. W10/W11 zakat Save marks paid, hawl never advances, focus freezes live value.
- L1 recurring income delete erases events. L2 amount parser 1000x. L3 duplicate payday event kills the whole `income_events` upsert batch.
- R1/R2 month-close/insight/buffer patches force plan-line currency to base (USD line 7,536 -> 150). R3 deleted income source zeroes history. R4 Reports ignores `monthStartDay` and counts transfers/ATM/top-up/savings as "Total out". R5 two different "Left to spend" figures. R6 month-nav Next opens a future cycle.

**SMS**
- N1 weak-match salary marked confirmed but posts nothing (round 1 confirm path): 12 confirmed rows with no transaction live. N4 Android forwards any SMS containing "sar"/"aed"/"egp". N5 learner fails on bidi marks/date formats: ~half of SMS pay for AI. N6 `1.250,00` parses as 1.25. N2/N3 retention (above).

**Security / privacy / account**
- C1/C2 2FA bypass. C3 retention. C4 backup. C5 password change needs no current password, revokes no sessions, keeps biometric/trusted devices. C6 incomplete delete/export. O2 anyone with `emails.manage` can publish auth email templates with no step-up and no host allow-list (OTP/reset link exfiltration). O1 crons never ran. I1 shared merchant categories. I2 `add_expense` auto-apply. I3 offline voice queue blocked by one failing job.

**Native**
- V1 support/inbox/board/votes/reset-password use relative `/api` URLs: dead on native. V2 `useAssetPrices` refresh relative: price self-heal never runs in app. V3 backup. V4 iOS 16.0 target vs Safari 16.4 needs, lookbehind regex in quick-add/lexicon/text. V5 `Info.plist` build number literal "6" (verify last TestFlight build).

**Quality / dependencies / UI**
- Z1 35 vulns in prod deps (5 critical: next 16.3.5, Capacitor 8.3.4, tar, websocket-driver). Z2 238 pg tests never run in CI. F1 3.0 MB raw JS on every route. F4/F5 month filter + `computeMonthlyStats` recomputed 2-4x per route (0.65-1.0 s per write at 20k rows). T1 crypto/gold quantities rounded to whole numbers. T3 ~156 English-only strings in Arabic mode. Q1 retention. U24 pastel dark-theme text on light surfaces (confirm), U25 focus ring 1.6-2.7:1 and inputs no focus border, U30 ~22 sheets without accessible name.

## Component dedupe (ponytail audit)

~1,450 lines of dead code removable at low risk (11 unreferenced components ~795 lines, 7 unused shadcn primitives ~655 lines, ~80 lines dead exports), ~600 more by merging three sheet headers, currency sheets, date entry, settings rows, empty states, debt cards, auth fields. Details: design.md (U1-U17).

## Proposed fix order (nothing started)

1. **Money integrity:** W1, W2, D1, D2, D3, D9, W5-W9, L1-L3, R1-R3, Q6/W8 RPCs (migration, check-in with owner before any DB apply).
2. **Privacy/security:** retention cron fix + backfill purge, trusted_devices/ingest-token policies, 2FA server enforcement, password change hardening, allowBackup/data-extraction rules, email-template step-up, merchant_categories write path, delete/export completeness, CRON_SECRET check.
3. **SMS pipeline:** N1, N4-N6, N7-N12, parser/sanitizeAmount unification, learner bidi/date.
4. **Native reach:** V1/V2 relative URLs, V4 iOS 16 compatibility (raise target to 16.4 or remove lookbehind), V5 build number, WebView debug flag, AppDelegate APNs forwarding.
5. **Budget/reports consistency:** R4-R6, single "left to spend", cycle-aware nav.
6. **Dependencies and CI:** bump next/capacitor/tar, run pg tests in CI, PR-time CI, TZ-pinned tests.
7. **Perf:** lazy-load views/sheets, memoise monthly stats once per render tree, persist partialize/throttle, realtime publication cleanup.
8. **i18n/a11y/design:** plurals, locale in date-fns, Arabic digits in inputs, Saturday-first weeks, sheet names, focus ring, form error roles, dead-code removal and merges.

## Needs your decision before fixing

- iOS target: raise deployment target to 16.4 (drops 16.0-16.3) or keep and remove all lookbehind regex (client code).
- Retention policy: how long may raw SMS bodies be kept (privacy policy says not stored)? Purge existing rows older than N days now?
- Password change: require current password (re-auth) and revoke other sessions: confirm UX.
- Buddgy `add_expense` auto-apply: require a tap like other tools?
- Global merchant categories: stop user edits writing the shared table (keep per-user override only)?
- Reports "Total out": exclude transfers/ATM/CC payoff/top-up/savings, same as the hero?
- Arabic layout: DESIGN_SYSTEM says layout stays LTR; settings is half-mirrored (X14). Keep LTR everywhere?

## Not reached (round 3 backlog)

Live UI pass was partial (375 light on most routes; Arabic/dark only on a few; add/edit flows for savings, goals, debts, BNPL and the budget wizard not exercised; onboarding blank in bypass mode; no keyboard focus sweep). Also: Budget Studio/engine, account detail sheets, investment page, Buddgy tips/mood and most write-tool executors, admin SMS routes and adjudication loop, native plugin internals, deep links, real-device push/biometric/SMS, live Supabase Auth settings, RLS impersonation tests, Vercel env/cron logs, Gemini prompt-injection tests, rendered contrast, browser-measured performance.
