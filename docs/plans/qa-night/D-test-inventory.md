# D. Test inventory: what shipped since 2026-11-14 and what covers it (read-only, 2026-11-24)

Source: `git log --since=2026-11-14 --oneline origin/main` = 486 commits. The last cloud runner result on record is job 14 (2026-11-21, commit 58a0b538, `docs/quality/buddget-remediation/09-playwright-results.md`, logged by 225d0519). Everything after 225d0519 (66 commits, 2026-11-21 to 2026-11-24) has had only the authors' own unit tests; no cloud journey run, no `npm run verify` on record. Nothing below was run for this inventory.

Legend: U = Vitest unit/route test next to the code. E = Playwright/e2e suite. "Reuse" = existing spec to run as is or adjust. "New" = a case to write.

## 1. Commits after the last runner job, by area

### 1.1 Plan and billing page, BDG-020 cancel flow (PR #34, 830fce82)
- Changed: `src/components/features/billing/ProStateView.tsx` (Manage bar, receipts, history, steps removed; Change plan and Cancel subscription rows at page end, :239-243; stay-offer sheet :125-150; `canCancel` :152), `src/lib/i18n/membershipCopy.ts`, mockup `docs/mockups/subscription-manage-v2.html`.
- Coverage: U `src/lib/billing/stayOffer.test.ts`, `subscriptionView.test.ts`, `purchases.test.ts`, `purchaseFlow.test.ts`, `billingStore.test.ts`, `src/components/features/billing/billingGate.test.tsx`, `planBilling.test.ts`, `src/app/api/billing/{revenuecat,sync}/route.test.ts`, `src/app/api/entitlements/trial/route.test.ts`, `membershipCopy.test.ts`. No test imports `ProStateView` (grep: only the page, RewardsView, MembershipGallery use it). E `e2e/api/round2/pro-rewards/30-billing.spec.ts` (RevenueCat webhook, trial, stay offer API); `e2e/journeys/specs/round2/pro-rewards/10-screens.spec.ts` J2/J6/J8/J9 render Pro states. `e2e/journeys/specs/e-subscription.spec.ts:65-71` "Cancel subscription" is the subscription TRACKER (user's own Netflix etc.), a different feature; do not confuse.
- Gap and plan: Reuse 30-billing (stay offer eligibility, once-only) and J2 (Pro state renders; adjust any text that named the removed Manage bar). New (journey, uses `forceFlags`/`__qa.plan` seed or the pro-rewards `fixture.ts` entitlement helpers): Pro active shows Change plan and Cancel subscription, no Manage bar or receipts; Cancel opens the retention sheet on iOS-store members with stay offer, goes straight to store link for others; trial and canceled states hide Cancel (`canCancel`). Component test with mocked `apiFetchAuth` is cheaper than Playwright for the sheet branches. Native check (Blocked on Mac): store deep link, `purchaseWithOffer` on a real device.

### 1.2 System theme removal (830fce82)
- Changed: `src/hooks/useThemeSync.ts` (no `prefers-color-scheme` listener), `PreferencesCard.tsx` (toggle light<->dark), `SettingsSearch.tsx`, `src/lib/buddgy/tools/exec/settings.ts`, `settingsMapper.ts` (saved `system` falls back to the current value), `sync.ts`, `snapshot.ts`, `useFinanceStore.ts` default theme `dark` -> `light`, `financeImportSchema.ts`, `types.ts`.
- Coverage: U `src/lib/buddgy/tools/__tests__/settings.test.ts` (updated). No unit for `useThemeSync`, the mapper fallback, or the new default. E: `e2e/ui/sweep.mjs` and `pro-rewards-sweep.mjs` sweep light and dark (they set theme via localStorage, `__qa.theme('system')` in `docs/QA_CLOUD.md` is now stale).
- Plan: New unit (jsdom): `useThemeSync` toggles `dark` class for light/dark and ignores OS changes; mapper maps remote `system` to the local value and keeps `light`/`dark`; import schema rejects or maps `system`; new-account default is light. Reuse the UI sweep for visual. Fix the stale `__qa.theme` doc line.

### 1.3 Free-failure cap (0344, 830fce82)
- Changed: `supabase/migrations/0344_ai_free_failure_cap.sql` (`ai_quota_settle_core`, free failure that cost money is charged once 5 such events exist in the last hour).
- Coverage: U only a string contract, `src/lib/server/__tests__/sqlContracts.test.ts` (checks the SQL text). The previous behaviour is covered by `e2e/api/buddgy-turns.mjs` (BDG-011 one charge per turn, free re-run) and `src/lib/server/ai/quota.test.ts`, `units.test.ts`, `src/app/api/buddgy/turn/route.test.ts`, `src/app/api/ai/route.test.ts`. There is a Postgres harness (`npm run test:pg`, `scripts/qa/setup.sh`, `src/lib/server/admin/__tests__/*.pg.test.ts`), but no pg test for settle.
- Plan: New (mandatory per CLAUDE.md, deep technical): a `.pg.test.ts` that calls `ai_quota_settle_core` for one synthetic user: 5 costly failures (cost_usd_micro > 0) stay free (`units=0`, `credits_exempt`), the 6th is charged; zero-cost failures never count and never get charged; a window older than 1 hour does not count; other users unaffected. Alternatively extend `e2e/api/buddgy-turns.mjs`, but forcing costly failures through the route needs a provider fault, so SQL-level is the practical test. Run EXPLAIN on the count query (bounded by `ai_usage_events_user_cover_idx`).

### 1.4 Insights page (782a1e18, 1c424595, a124da1e, 119380b0, 9f5fc945, 61afc924) and wealth snapshot (e2de3176)
- Changed: Reports becomes Insights: `src/lib/insights/*` (detectors, rank, recap, debtWhatIf, netWorthPath, reminder, access), `src/components/features/insights/*`, Buddgy `get_insights` tool, evening reminder (`src/lib/native/insightsReminder.ts`), Arabic plurals (`arPlural.ts`), one net worth snapshot a day.
- Coverage: U `src/lib/insights/{insights,phase3,buildInput,access,reminder}.test.ts`, `src/lib/i18n/arPluralCoverage.test.ts`. No component test for the page, no E. `e2e/ui/*` sweeps do not list `/reports` as Insights (grep of e2e for "insights" only matches generic sweep scripts).
- Plan: New journey (one, light): seeded user with expenses opens Insights, sees daily answer and at least one finding, taps a finding, Free user sees locked-finding sheet beyond the 6-month limit (`access.ts`), share recap button. Needs seed rows via `rows()`/service role. The what-if and net worth path math are already unit-tested (reuse). Wealth snapshot: New U for "only when the figure is complete, once a day" (commit touched 1 test file; check it asserts the second-save-same-day case).

### 1.5 Buddgy (BDG-009..018, 3 slices)
- Changed after job 14: usage sheet (c3d250b2 is before; later) chat panel above keyboard (68376fa5), orb drag (0e35780b), per-place ask before navigating (c69c423d), Claude-style chats (4bd0c2a3, mig 0340), action cards (a8516525), budget in chat (88eec81d), per-turn charging (b04cd4f9, mig 0338), cost fixes, `dcd41f47` daily error-rate alert (mig 0342).
- Coverage: U `src/lib/buddgy/tools/__tests__/*` (20 files), `src/lib/server/ai/buddgy/__tests__/gateway.test.ts`, `src/app/api/buddgy/turn/route.test.ts`, `src/hooks` and `src/lib/buddgy/client` tests, `src/lib/i18n/buddgyChatCopy.test.ts`. E `e2e/journeys/specs/g-buddgy.spec.ts`, `e2e/api/buddgy-turns.mjs`. Jobs 6 to 14 (2026-11-20/21) verified most of this; the later fixes (ai usage errors, alert 0342, card fixes) have unit tests only.
- Plan: Reuse g-buddgy and buddgy-turns as the regression run (needs `GEMINI_API_KEY`). No new case unless a failure shows.

### 1.6 Subscriptions, Keep Pro, billing sync (BDG-019, afe4a6b7, 91c28c00, 461ef1aa, 6292215a)
- Changed: `src/lib/billing/{purchases,revenuecat,revenuecatSync}.ts`, `/api/billing/sync` (RevenueCat REST v2, read-only key), store call timeouts.
- Coverage: U `purchases.test.ts`, `revenuecat.test.ts`, `src/app/api/billing/sync/route.test.ts` (75 tests per job 6). E `30-billing.spec.ts`. Job 6 verified step 1.4; commit afe4a6b7 (store SDK never settled, Keep Pro spun) came later with 1 test.
- Plan: Reuse `30-billing` and billing unit dir. Native verification required: Keep Pro on a real iOS and Android device.

### 1.7 Rewards, invites, founders (BDG-004/005/006, e3683566, a3108436)
- Changed: signed guest pass, invite landing `/i/<code>` for signed-out visitors, held reasons, `referral_inviter_first_name` (0343), streak counts from join week, Founders page.
- Coverage: U `rewardsState.test.ts`, `src/lib/loyalty/weekCheck.test.ts`, invite page test (e3683566 added 7 test files), `selling-off.test.tsx`. E `e2e/api/round2/pro-rewards/{10-access,20-loyalty,30-billing,40-referrals,50-admin}.spec.ts` (I1, I2 for 0343), `e2e/journeys/specs/round2/pro-rewards/10-screens.spec.ts` J1-J9, `r1-core.spec.ts` R11, `e2e/ui/pro-rewards-sweep.mjs`.
- Plan: Reuse the whole pro-rewards set as one batch; check J5 (invite) and 40-referrals after the guest-pass change; no new case expected.

### 1.8 SMS setup, iOS Shortcut (BDG-002/008, 770ba2a3, 8f43d299, 3e604ae8, 9add140b, d64d0e7e)
- Coverage: U `SmsCard.test.tsx`, `src/lib/sms/setupState.test.ts`; E `ios-sms-settings.spec.ts` (needs `next build && next start`, not dev), `e2e/sms/first-sms.mjs`, `corpus.qa.test.ts`. The iOS-version guide (770ba2a3) and small-phone layout (8f43d299, 0 tests) are native-only: Native verification required.

### 1.9 Other Linear-ticket work since 11-14
- BDG-003 flipped cards (`membershipComponents.test.tsx`), BDG-017 edge swipe back (new tests; real iOS gesture is native), BDG-023 Privacy and lock screen settings, BDG-024 bank logos (U catalogue tests), BDG-026-028 pocket picker (`d-pockets.spec.ts` D4, `pickPocket` helper), BDG-015 navigation asks, BDG-014 keyboard chat panel (native keyboard: Native verification required).
- Sync, auth: fa2f7252 offline sign-out guard, 6f3869b9 device-check retry, a3108436: each has a unit test; r1-core R13 and the sync suite are the E reuse (`e2e/sync/`, needs `QA_SYNC_PW`).
- Dependency commits (a5a4b293 Vitest 5, 6995d094, GitHub Actions bumps): a full `npm test` and `npm run verify` are the only check. Run them first: a Vitest major bump can silently change mocks.

## 2. Existing suites at a glance (all talk to the LIVE Frankfurt Supabase project; see warning in `e2e/README.md`)
- `e2e/journeys/specs/`: a-onboarding, b-bank-expense, c-debt, d-pockets, e-subscription (tracker), f-goal, g-buddgy, n-navigation, q-quick-add, q-voice-hold, s-system-cash; `round2/r1-core.spec.ts`, `round2/ios-sms-settings.spec.ts`, `round2/pro-rewards/10-screens.spec.ts`.
- `e2e/api/`: auth-matrix, buddgy-turns, concurrency, cross-user, input-matrix, latency, lifecycle, money-rpc, nan-probe (.mjs); `round2/{adversarial,qa-regressions,zz-lifecycle}.spec.ts`; `round2/pro-rewards/*.spec.ts`; pro-rewards `unit/`.
- `e2e/ui/`: sweep, sheets, focus, misc, states, tap, tapSheets, pro-rewards-sweep (.mjs, axe and 44px).
- `e2e/sync/`: cash-sentinel-scope, multidevice, qa030-debt-payment (live vitest), `round2/adversarial.live.test.ts`. `e2e/sms/`: corpus, run-e2e, first-sms. `e2e/perf/`, `e2e/security/api-probe.mjs`.
- Latest reports: `docs/qa/round2/{S7a-ui,S7b-native-layout,S8a-review,S8b-journeys,S8c-api-security,S8d-performance,S8g-pro-rewards}.md`; later runs in `docs/quality/buddget-remediation/09-playwright-results.md`.

## 3. Running Playwright locally (this Mac, this worktree)

Facts from the repo:
- Config: `e2e/journeys/playwright.config.ts` (testDir `./specs`, baseURL `http://localhost:3100`, projects `mobile` 390x844 and `desktop` @desktop-tagged 1280x860, workers `QA_WORKERS` default 2, retries `QA_RETRIES` default 1, locale en-US, tz Africa/Cairo). Variants: `e2e/journeys/specs/round2/pro-rewards/playwright.config.ts` (workers 1, 375x812 and 1440x900), `e2e/api/round2/pro-rewards/playwright.config.ts` (API mode, `QA_BASE` default 3100, needs `QA_PW`), `e2e/api/round2/playwright.config.ts`.
- The suites never start the server ("SHARED dev server on :3100"). Start it yourself.
- Env: tests read `.env.local` at the repo root (`e2e/journeys/lib/env.ts:9` resolves `../../../.env.local`; the pro-rewards lib resolves its own). Needs `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` (service role), plus `GEMINI_API_KEY` for Buddgy and SMS e2e, `QA_PW` (via `QA_ENV_FILE`) for pro-rewards, `QA_SYNC_PW` for sync. Browser: `QA_CHROME` overrides the executable; otherwise Playwright's own (installed here: `~/Library/Caches/ms-playwright/chromium-1255`, headless shell 1255).
- This worktree has `node_modules` but NO `.env.local`; the main checkout's `/Users/mohamedmousa/Desktop/Budget Manager/buddget/.env.local` has all three Supabase keys, `GEMINI_API_KEY`, `LINEAR_API_KEY` and `NEXT_PUBLIC_DEV_AUTH_BYPASS`. Symlink or copy it into the worktree root first (git-ignored). Do not print it.
- Danger: the only project is the live Frankfurt DB with real beta users. Suites create and delete only `qa-e2e-*@buddget-qa.test`; guard in `e2e/journeys/lib/admin.ts:15-17` refuses other emails. Everything in the pro-rewards API lib also throws unless the URL holds `tzioppxwsljhlglyducm`.
- Sign-in: real UI sign-in with email + password (`signIn` in `e2e/journeys/lib/fixtures.ts:43-53`: /flow, Email, Continue, Password, "Sign me in"). The `user` fixture creates a confirmed user through the admin API (`createConfirmedUser`, password `PASSWORD` = fixed in `lib/admin.ts:13`), no email sent, and deletes it after the test (closes the context first, retries 4 times, throws with the id if it fails).
- Cleanup helpers: `npx tsx e2e/journeys/lib/cleanup.ts --all` (every `qa-e2e-*@buddget-qa.test`) or by email; `node e2e/api/round2/pro-rewards/teardown.mjs [--check]` (users plus non-cascading rows); `QA_KEEP_USERS=1` keeps users for debugging; `node e2e/sms/teardown.mjs`. Check 0 left at the end (CLAUDE.md).

Local recipe adapted from `docs/QA_CLOUD.md` and the CLAUDE.md "Cloud QA method" (only when the owner asks for tests; the rule says browser suites go to the cloud runner, so this is for a local override the owner approves):
```bash
cd "/Users/mohamedmousa/Desktop/Budget Manager/buddget/.claude/worktrees/subscription-ui-changes-review-607ad4"
ln -s "/Users/mohamedmousa/Desktop/Budget Manager/buddget/.env.local" .env.local   # once, not committed
# dev server (webpack, as in the QA method); override the two env values that would break sign-in
NEXT_PUBLIC_DEV_AUTH_BYPASS=0 NEXT_PUBLIC_API_BASE_URL= TZ=Africa/Cairo npx next dev -p 3100 --webpack
# second terminal, specs in groups of about 6, one worker, terse reporter
QA_WORKERS=1 QA_RETRIES=0 npx playwright test -c e2e/journeys/playwright.config.ts d-pockets g-buddgy --reporter=line --trace off
QA_ENV_FILE=<file with QA_PW> npx playwright test -c e2e/journeys/specs/round2/pro-rewards/playwright.config.ts --reporter=line --trace off
QA_ENV_FILE=<file with QA_PW> npx playwright test -c e2e/api/round2/pro-rewards/playwright.config.ts --reporter=line --trace off
node e2e/api/buddgy-turns.mjs        # needs GEMINI_API_KEY
npx tsx e2e/journeys/lib/cleanup.ts --all && node e2e/api/round2/pro-rewards/teardown.mjs --check
```
- `ios-sms-settings` needs `npx next build --webpack && npx next start -p 3100` instead of dev (README row). Unit tests need no server or env: `npm test` (Vitest, `TZ=Africa/Cairo`, repeat with `TZ=America/New_York`). `npm run test:pg` runs the Postgres-in-docker harness (`scripts/qa/setup.sh`, port 54329) for SQL like 0344.
- `NEXT_PUBLIC_DEV_AUTH_BYPASS=1` (the `docs/QA_CLOUD.md` mode) is for screenshots only; every journey needs it at 0 plus the live Supabase env. Seed hooks in that mode: `__qa.plan('free'|'active'|'trial'|'trialEnding'|'issue'|'ended')`, `__qa.lang`, `__qa.name`, `localStorage.qa_staff='1'`; `__qa.theme('system')` is now invalid.
- Network note from a runner job: `NODE_USE_ENV_PROXY=1` was needed inside the cloud container, not expected on the Mac.

## 4. Suggested night order (what to reuse, what to write)
1. `npm test` in Cairo and New York (covers dependency bump, all units). 2. Reuse as regression: pro-rewards API + journeys (billing, invite, rewards), g-buddgy, buddgy-turns, d-pockets, n-navigation, r1-core, UI sweep for light/dark. 3. Write: 0344 pg test (mandatory), ProStateView cancel/change-plan component or journey case, useThemeSync and mapper unit, one Insights journey. 4. Support loop journey: see `C-support-current.md` section 6. 5. Report with the four labels; native-only items stay "Native verification required".
