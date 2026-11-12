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

## P3 pass ("Fix P3s")
Closing reports: `docs/qa-round-6/closing-p3-{server,money,ui,supply}.md`. Gate: `npm run verify` passed (4,915 tests). Migrations applied live: 0250, 0251 (grants, link guards, profile email pin, purge guards, 2FA gate fails closed in enforce mode, default function privileges), 0254 (asset price > 0), 0256 (AI hop cap), 0257 (`ai_assistant=false` also disables proxy). DBI-2 and DBI-3 data hygiene applied live (3 rows).

Closed: the large majority of the ~134 P3s (Fixed with tests; Already fixed; Won't fix with reasons recorded per ID in the closing reports).

## Owner decisions taken ("go with recommended for all", 2026-11-11)
- SUP-1: `scripts/linear-bot.sh` and `scripts/trigger-bot.sh` deleted (the bot used `--dangerously-skip-permissions`; the LaunchAgent was already disabled).
- AUT-6: the one legacy trusted-device row deleted live.
- ADS-8: Play Data safety doc now declares the sender address as SMS-derived data and lists the receipt-image and RECEIVE_SMS steps as submission checks.
- DBI-5 NOT applied and the unique index NOT added: same-name payment methods are legitimately separate wallets (different currencies) and several were created this week by live users. DBI-4 NOT applied: the 4 legacy rows are already category Debt; clearing the flag changes nothing visible and the Buddgy edit guard reads it.
- NAT-11 NOT changed: silently flipping the push-masking default would change every user's notifications; recommended instead is an onboarding choice (product work).
- Release: iOS build 137 on TestFlight, Android vc171 debug-signed APK on Drive (private link by default since SUP-5; set `APK_PUBLIC_LINK=1` for a public one).

## Still open (needs you or a device)
- **P1 AUT-1** (email second factor client-only): report mode by the owner's decision.
- **Console/env actions:** SST-9 leaked-password protection (Supabase Auth dashboard), SST-5 `SMS_REQUIRE_DEVICE_HEADER=1` on Vercel, SUP-4 Firebase key restriction and rotation, SUP-2 `.claude/settings.json` allow-list, ADS-8 receipt-retention and RECEIVE_SMS submission checks.
- **Product/native:** NAT-11 push masking, BAI-8 shared AI-category trust, A11-14 bar patterns, A11-20 per-fragment `lang`, AUT-12, REG-13, DEB-9 weekly reminders, SST-4 R8, SUP-5 release signing, SUP-9 next-pwa replacement, SUP-11 dependency bumps, pre-GA native pins.
- **Limits:** field builds send no `edited_at` until updated; legacy phones have no recorded session until next heartbeat; Kotlin/Swift unverified on device; live double-tap through the pay-debt sheet and light/tablet/desktop sweeps not run; `.design-sync/compiled.css` stale after the A11-12 token shifts.

## Closing pass (2026-11-12)
- DBI-5: `addPaymentMethod` returns the existing method for the same name, type, currency and last four (the cash sentinel is excluded). Existing duplicate rows are not merged. Test in `paymentMethodActions.test.ts`.
- ADS-3: admin Leads view has a Load more button (offset paging).
- `.design-sync/compiled.css` regenerated.
- Dropped as not needed: SST-9 (no Pro plan), DBS-6, DBI-7, AUT-11, SLG-11, REG-5, REG-12, DBI-4, AUT-12, A11-15/18 remainder, DEB-9 weekly.
- Tried `next` 16.4.5 + eslint-config-next 16.4.5: the newer React lint rules raise 34 errors in untouched files, so the bump was reverted; it needs its own pass. `@supabase/ssr` 0.12 and the next-pwa replacement are auth/service-worker changes that need a device test, so they wait.
- Round 2 of the closing pass: `next` 16.4.5 (eslint-config-next left at 16.2.1: its 16.4.5 adds rules that flag 34 untouched files). `@supabase/ssr` 0.12.7 and `supabase-js` 2.119 (tsc, auth and sync suites green; one stale `admin_access_grants` Update type fixed). next-pwa removed: `public/sw.js` is now a hand-written 80-line worker (offline page, hashed assets cache-first, pages network-first, `/api/` never touched); `npm audit` high advisories 3 -> 0 and the audit-gate waivers are gone. Android release: R8 + resource shrinking on with keep rules, release signing read from `ANDROID_RELEASE_KEYSTORE` env (not built or run; the shipped build is still the debug-signed one). REG-13: PostgREST returns a count for `Prefer: count=exact` on a minimal-return upsert per its docs; the guard fails safe if not.
- Live UI sweep (dev app, empty-state data): 8 routes at 375 px, 3 at 768 px and 2 at 1440 px, no horizontal overflow or error screens; the app has no separate dark theme (it follows one light palette). The pay-debt double-tap was not re-driven in the browser (store-level guard and tests cover it).

## AUT-1 closed (2026-11-12)
The server 2FA gate is in `enforce` for all users (grandfather cut-off stamped at arming, so existing sessions keep working). The client already routed the 403 to the OTP challenge and resumed sync; this pass closed the trusted-device race (the challenge now closes once `device/check` marks the session). Rollback: `select private.set_2fa_gate('off', null);`. Rolled-back SQL test: password-only new session blocked, OTP-amr allowed, trusted-device mark allowed, `second_factor_status` exempt.
Residual (not gated): service-role `/api/*` routes (devices, notifications, support, push, sms confirm/undo, AI) trust any valid session; only PostgREST is gated. Email OTP is a weaker second factor than TOTP/passkey (the inbox is also the password-reset channel). Both are recorded as hardening options.
