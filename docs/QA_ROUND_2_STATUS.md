# QA Round 2: final status (2026-10-29)

Batches B0 to B11 shipped to `dev` and `main` (last code commit `ec8f981b`). Per-batch reviews: `docs/qa-round-2/REVIEW_B1..B11.md`. Arabic copy for owner review: `docs/ARABIC_REVIEW.md`. Copy rules: `docs/COPY_GLOSSARY.md`.

## Database (all applied live, project ydihurtbcnoflhormgzi, ledger rows recorded)
0188-0199, 0201-0208, 0209-0213, 0215-0220, 0221. 0214 was never used. `sms_retention_enabled` is still **false** (see owner steps).
0218 was applied in reduced form (only `ai_tmp_probe` and `fx_rates` dropped). The six legacy RPC wrappers were kept for installed native builds.

## Final pass (2026-10-29): items closed since the first status
- Closed: Arabic dates/category labels/"Unknown" (useShortDate, useCategoryLabel), zod removed from the client bundle (hand-written AI row validator), Buddgy hop forgery check (tool messages must answer issued calls), neutral sign-in error (wrong password / no account / unconfirmed share one message, with a resend-code link into the OTP step), W7 pocket-balance guard (balance-less upserts for non-balance edits, 23502 retry), 2FA client handling (SecondFactorGate, fetch wrapper, resumed sync).
- F3 (CSP/static layout): investigated, NOT changed. A statically rendered page cannot carry the CSP nonce, so going static would need unsafe-inline or per-page hashes. Kept the strict CSP; added `src/lib/security/csp.ts` + test, `scripts/csp-check.mjs` (checks 12 routes against a running server) and `docs/CSP.md`.
- 2FA enforcement: client is ready, but the platform flag was left in report mode on purpose. Before enforcing: ship the new build to users first (older builds cannot handle the challenge), test the real email-OTP round trip once with `private.set_2fa_gate('report', <owner>)`, then enforce for the owner only, then everyone. Migration 0208 notes enforce is blocked until a shipped build awaits `device/check` before its first sync.
- 12 "ghost confirmed" SMS rows (N1): audited, NOT repaired. They belong to two non-owner users (b85f074d, f923c68b), the amounts are small and old (Jun to Sep 2026), and repairing means inserting income/expense records into their ledgers with a source/account/occurrence only they can choose. The defect itself is fixed for new SMS (B4). Row ids can be listed with: `select id from sms_parse_log where status='confirmed' and expense_id is null and income_id is null and debt_payment_id is null and savings_transaction_id is null and coalesce(failure_code,'')<>'duplicate'`.

## Still open (not done)
- U9/U15 partial: five bespoke empty states and the pills Badge cannot express stay as they are (variant limit rule). TrophyHero and the Reports/Income heroes are not merged into HeroBand.
- Other screens may still show raw English category names (only the sites found by grep were converted). Unknown top-level URLs show the default Next 404.
- `record_client_crash` still re-opens resolved crashes (needs a migration). I16 needs a rewrite of `ai_quota_reserve`. Hero masking for balance privacy exists only on /accounts. The OTP resend step can still hint at account existence through its own error.
- A hard-deleted server pocket row hit by a stale balance-less edit retries once with its balance (W7 edge covered); option A (trigger-derived balance) is still not built.

## Live verification done (B12, local QA config, mobile 375, Chrome pane)
Flow, Wealth, Debts, Reports, Goals load with no console errors; one visible h1 per page; no unnamed buttons/links; add sheet and expense sheet render; nested sheet shows two named dialogs, none inert; closing all sheets clears `inert` completely; Arabic mode keeps LTR layout with Latin digits and Arabic month/weekday names; Reports shows "Net cash flow", expected vs received income, Total out matching hero spend.
Not verified live: dark theme visuals, focus ring look, tap-area overlaps on dense rows, theme flash on cold load, offline lazy-sheet fallback, Settings in Arabic, receipt/voice flows, anything native.

## Owner steps (cannot be done in code)
1. Set `CRON_SECRET` on Vercel; provide an hourly caller (Supabase pg_cron + pg_net with the secret, or Vercel Pro) for per-user 09:00 notifications. `vercel.json` still has the daily 06:00 UTC job only.
2. SMS retention go-live (keep flag off until all done): run the legacy harvest (`/api/cron/sms-harvest`) until `private.sms_retention_preflight()` shows no unlearned rows, run the leak scan, set `platform_settings.sms_leak_scan_passed_at`, review pattern reports, then set `sms_retention_enabled = true`.
3. Native: next build must go through `cap:build` (Capacitor 8.6.0, new Keychain/EncryptedSharedPreferences storage, iOS target 16.4, build number from `CURRENT_PROJECT_VERSION`, `aps-environment` must be `production` in the exported build, PrivacyInfo.xcprivacy). Verify on device: SMS receive with app killed (Android), push token registration (iOS), Apple sign-in nonce, scanner/camera while app lock is on, Archive Validate. Confirm the last TestFlight build number. Native builds only on request.
4. Play Console SMS declaration (READ_SMS removed) and Data Safety; App Store privacy label; Firebase key restriction; Auth settings: anonymous sign-ins off, leaked-password protection.
5. Review Arabic: `docs/ARABIC_REVIEW.md` (about 400 new/changed strings).
6. Update branch protection to the new CI job names (an aggregate `lint-test-build` job exists); `pg-admin-tests` is non-blocking until it passes once on GitHub Actions. Run `npm run test:coverage` once and set real thresholds.
7. Migration folder has two `0209_*` and two `0210_*` files (site team versus B4); the CI check grandfathers them.
8. CLAUDE.md says "79 tests"; the suite is about 3,800.

## Round 3 backlog
Dark and Arabic visual sweeps on every route, keyboard focus sweep, add/edit flows for savings/goals/debts/BNPL/budget wizard, Budget Studio/engine, account detail sheets, investment page, deep links, real-device push/biometric/SMS, RLS impersonation tests, Gemini prompt-injection tests, rendered contrast and browser-measured performance, the deferred items above.
