# QA Round 6 (2026-11-06)

Scope: a very deep, adversarial pass over the whole app and business: live database and tenant isolation, data integrity and cron, every API route, supply chain and CI, the code written in Round 5, money-engine fuzzing, debts and recurring, reports and wealth, forms, Buddgy AI, native and notifications, state/offline/performance, time zones and locale, admin/site/legal, accessibility and design. Shared brief: `docs/qa-round-6/BRIEF.md`. Per-area reports and repro tests: `docs/qa-round-6/*.md`, `docs/qa-round-6/repro/`.

Method: 18 read-only finder agents in waves (usage limit hit twice, resumed). Third-party security skills installed and vetted (trailofbits/skills: semgrep, sharp-edges, variant-analysis, fp-check, entry-point-analyzer, spec-to-code-compliance, supply-chain-risk-auditor, audit-context-building, property-based-testing; getsentry/skills: security-review, find-bugs, gha-security-review, skill-scanner). Semgrep ran through `uvx` with 14 registry rulesets plus 11 custom rules (no true positives).

## Verdict on P0 and P1
- **P0: none found.** Tenant isolation held on every table, policy and route group probed (RLS on all tables, all 97 routes refuse anonymous callers, forged JWTs, user A vs user B, mass assignment, SSRF, redirects, CORS, cron and webhook checks all clean). Data integrity held (no orphans, no duplicates, no money-sign problems, savings drift 0, all 92 tables match `database.types.ts`). No secrets in 1,658 commits or in the built bundles.
- **P1: 7 (6 real, 1 known and parked).** Every one is listed below; none was a data-leak between users except DBS-1, which needs the victim's random row id.
- All six real P1s are now fixed and gated (see Fix pass). AUT-1 stays parked.

| ID | What | Area |
|---|---|---|
| REG-1 | my SYN6 fix stamps the device's old edit time on inserts; rows created offline never reach other devices' delta pulls (3-device simulation diverges on 200 of 200 seeds; converges on all once inserts are stamped now()) | sync |
| DBS-1 | a user can link their own subscription to another user's `recurring_expenses` id, then edit that row through unguarded DEFINER RPCs (proved in a rolled-back probe). The app never calls those RPCs | database |
| DBI-1 | my Round 5 date guard only catches future dates: "26/10/24" (yy/mm/dd) is read as 2024-10-26. 5 live rows are in the wrong year | SMS |
| DEB-1 | in Africa/Cairo a weekly subscription crossing the DST-start Friday is never seen as paid; log mode writes a new expense on every visit (619 rows vs 105 expected in two years) | subscriptions |
| FRM-1 | the subscription amount and "my share" boxes swallow the decimal point (typing 9.99 gives 999); same bug in the voice recap editor and the expense min/max filter | forms |
| FRM-4 | no form has a submit guard and the exiting sheet stays clickable: a pay-debt double submit paid 200 on a 100 debt and wrote 2 expenses (needs one live check) | forms |
| AUT-1 | the email second factor is enforced only by the client; the server gate is in report mode. Known; the platform flag stays in report mode by the owner's earlier decision | auth |

## P2 (about 46) by theme
- **Sync design (from my Round 5 work):** the 0232 guard compares edit time with arrival time, so with two offline devices the first to reconnect wins (SLG-2, 67 of 400 seeds lose the newest edit); server-side writers bump `updated_at` and make later user edits look stale (REG-4); a future-dated client time on insert is trusted (OFS-1); one poison row blocks its whole table (OFS-3); no cross-tab coordination, a stale tab overwrites (OFS-7); the persisted store passes 5 MB at about 15k expenses (OFS-8).
- **Dates and DST:** card cycle start (DEB-2), BNPL first due date (DEB-3), log mode only runs on the Subscriptions page and never back-fills (DEB-4), card "All due" ignores payments (DEB-5), server vs device weekend for 33 of 39 users with no stored time zone (REG-2, TZL-1), forecast dates (TZL-2).
- **Forms:** same decimal bug in two more places (FRM-2, FRM-3), goal double submit (FRM-5), 20 money fields reject the third decimal of KWD/BHD/OMR/JOD/TND (FRM-6), 24 amount fields with no accessible name (FRM-7), Escape/backdrop/back skip the unsaved-changes confirm (FRM-8), installment dust leaves 1 to 56 cents unpaid on plans of 12 or more (FUZ-4).
- **Security and privacy:** SMS ingest token survives a password change (DBS-3) and sign-out (NAT-2); removed phone keeps its session (AUT-8) and can still get tokens by omitting the device id (SST-1); suspended accounts keep AI routes (AUT-2); global merchant-category poisoning (DBS-4); admin search matches unmasked emails (ADS-1); account deletion skips website leads (ADS-7); trusted-device secret in plain Preferences (NAT-3); native SMS plugin accepts any `apiUrl` (SST-2); service worker caches authenticated `/api` GETs for 24 h (SUP-3); Arabic legal pages unreachable (ADS-9); Play Data safety table contradicts the manifest (ADS-8).
- **Buddgy AI:** only `add_expense` bounds the amount, ~20 other write tools accept 1e300 (BAI-2); quota fix patched v1 not v2 (BAI-1); Hide-balances leaks through `get_summary` (BAI-3).
- **SMS:** the Dismiss button is dead after my 0231 revoke (REG-3); template auto-promotion has never fired because of a removed tier name (SLG-3); the "held, tap to add" push books a spoofed-sender credit with no review (SLG-4); Android expedited work lacks `getForegroundInfo` on API 24 to 30 (NAT-1).
- **Month-carry cron (live money, scheduled daily):** funded-goal pockets treated as unowned (RPW-1), gold pocket blocks the carry silently (RPW-2), duplicate unlinked goal pocket every month (SLG-1). All latent today (0 live users match).
- **Supply chain:** disabled Linear bot still in the repo with `--dangerously-skip-permissions` (SUP-1), tracked `.claude/settings.json` auto-allows prod `execute_sql` and unpinned plugin marketplaces (SUP-2), Firebase key in the Gemini project (SUP-4). `npm audit`: 25 advisories (3 high), none reachable at runtime.

## P3
About 134 across all areas; see each area report.

## Not covered
Live browser sweep (to run last on a quiet machine), CodeQL and Semgrep Pro cross-file taint, real-device native paths, Buddgy against the live model, light theme/tablet/desktop widths.

## Fix pass (owner: "Fix P1+P2, DB ok")
Closing reports: `docs/qa-round-6/closing-*.md`. Gate: `npm run verify` passed (4,646 tests). Migrations applied live: 0240, 0241 (sync "newest edit wins": `edited_at`, insert stamp, new guard), 0243 (repair of 5 mis-dated SMS rows, exactly 5 rows changed), 0244 to 0247 (cross-tenant link guards and revoked dead RPCs, per-device session revoke, merchant-category poisoning, admin search masking, SMS promotion repair, chat quota v2).

| Cluster | Fixed |
|---|---|
| Sync | REG-1 (P1), REG-4, OFS-1, SLG-2, OFS-3 (poison row set aside), OFS-7 (cross-tab), OFS-8 (graceful quota path only). 3-device seeded test: 300 of 300 seeds converge and the newest edit wins |
| Security and DB | DBS-1 (P1), DBS-3, DBS-4, AUT-2, AUT-8 (new phones), SST-1/5, ADS-1, ADS-7, REG-3, SLG-3, BAI-1/2/3, NAT-2 |
| Dates and SMS | DEB-1 (P1), DEB-2/3/4/5, TZL-1/2/3, REG-2, FUZ-1/2, DBI-1 (P1, parser + 5-row repair) |
| Forms | FRM-1 (P1), FRM-4 (P1, guard + inert exiting sheet + overpay refusal), FRM-2/3/5/6/7/8, FRM-9 to 13, FUZ-4/5/6 |
| Month-carry, native, PWA | RPW-1/2, SLG-1, SLG-4, NAT-1, NAT-3, SST-2, SUP-3 |
| Accessibility, legal, docs | A11-1 to A11-8, ADS-8, ADS-9 |

## Still open
- **P1 AUT-1** (email second factor client-only): left in report mode by the owner's decision.
- **Owner actions:** SUP-1 (disabled Linear bot with `--dangerously-skip-permissions`), SUP-2 (tracked `.claude/settings.json` auto-allows prod `execute_sql` and unpinned plugin marketplaces), SUP-4 (Firebase key restriction in the Google console), the three ADS-8 questions (sender number in the SMS row, Gemini retention for receipts, Play RECEIVE_SMS declaration).
- **Limits of the fixes:** field builds send no `edited_at` until updated; legacy phones have no recorded session until their next heartbeat; Kotlin/Swift changes (including iOS Dynamic Type root font, A11-8) are uncompiled and not run on a device; FRM-4 double tap and FRM-8 not exercised live.
- **P3s:** about 130 remain, one report per area.
- **Not run:** the live browser sweep.
