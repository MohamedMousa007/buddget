# QA Round 2: final status (2026-10-29)

Batches B0 to B11 shipped to `dev` and `main` (last code commit `ec8f981b`). Per-batch reviews: `docs/qa-round-2/REVIEW_B1..B11.md`. Arabic copy for owner review: `docs/ARABIC_REVIEW.md`. Copy rules: `docs/COPY_GLOSSARY.md`.

## Database (all applied live, project ydihurtbcnoflhormgzi, ledger rows recorded)
0188-0199, 0201-0208, 0209-0213, 0215-0220, 0221. 0214 was never used. `sms_retention_enabled` is still **false** (see owner steps).
0218 was applied in reduced form (only `ai_tmp_probe` and `fx_rates` dropped). The six legacy RPC wrappers were kept for installed native builds.

## Deferred on purpose (not done)
- U4 step 2 (visible V3 sheet header restyle), U11 (money sheet blocks), U8/U36 (debt cards, FlowSummaryBand via HeroBand): need before/after screenshots, owner approval.
- U9/U15 partial: five bespoke empty states and the pills Badge cannot express stay as they are (variant limit rule).
- F2 partial: zod still in the main bundle through the voice/gemini path. F3 (CSP nonce / dynamic layout) deferred until a browser CSP test exists. F6 quota overflow / IndexedDB move not done (debounce + partialize done).
- shortDate.ts (52 callers) and row category labels (Food, Groceries), "Unknown" payment method are still English in Arabic mode.
- Unknown top-level URLs show the default Next 404 (the branded not-found only covers the app group).
- Buddgy `hop` flag can still be gamed with a fabricated tool message. `record_client_crash` still re-opens resolved crashes. I16 needs a function rewrite of `ai_quota_reserve`. The unconfirmed-email auth message still reveals account existence.
- U50 timing: validation already runs on submit; only Enter-to-submit was tried and reverted.
- Hero masking for balance privacy exists only on /accounts; the Widgets privacy option was hidden.
- 12 ghost salary rows (N1) repair needs owner approval. W7 sync decision, 2FA enforcement (client must handle `second_factor_required`), PR2 monthly Claude review scheduling.

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
