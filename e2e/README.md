# QA automation suites

Built during the November 2026 QA campaign. Findings are tracked in Linear (QA Team, QA-10 to QA-124).

Where tests run: always in a cloud session (the `qa-runner`), never on the owner's Mac. Reuse a case below before writing a new one; a new case goes into the matching folder and gets a row here (CLAUDE.md, "Tests run in the cloud").

**Warning:** every suite except `sms` (offline mode) talks to the live Supabase project from `.env.local` (`buddget - eu`), which also holds beta users. Suites create and delete their own synthetic users (`qa-*@buddget-qa.test`) and must never touch other rows. None run in `npm test` or `npm run verify`.

Needs `.env.local` in the repo root with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SECRET_KEY` (plus `GEMINI_API_KEY` for SMS end to end). Values are never printed.

| Suite | What it covers | Run |
|---|---|---|
| `journeys/` | Playwright user journeys A-G, navigation, persistence; checks UI, local store and server rows. Known bugs are `test.fail()` with their ticket id. | Start `next dev -p 3100` (with `NEXT_PUBLIC_DEV_AUTH_BYPASS=0`), then `npx playwright test -c e2e/journeys/playwright.config.ts` |
| `sms/` | SMS corpus (35 messages + 15 pipeline cases) through the pure parser stages; `run-e2e.mjs` posts them to `/api/sms/parse` | Offline: `npx vitest run --config e2e/sms/vitest.config.ts`. End to end: `node e2e/sms/setup.mjs`, `node e2e/sms/run-e2e.mjs`, `node e2e/sms/teardown.mjs` |
| `sync/` | Live sync repros: Cash debt payment (SYNC-001/002), Cash sentinel scope, multi-device conflicts | `QA_SYNC_PW=<synthetic password> npx vitest run --config e2e/sync/vitest.config.ts` |
| `api/` | Auth matrix, bad input, cross-user, concurrency, lifecycle, money RPCs, NaN probe, query scan, type drift | `node e2e/api/<script>.mjs` against the 3100 server; `python e2e/api/<script>.py` |
| `security/` | API probe for auth and headers | `node e2e/security/api-probe.mjs` |
| `api/round2/pro-rewards/` | S8g: Pro, Sparks packs, trial, stay offer, RevenueCat webhook (signed with local test secrets), loyalty week check, tiers, gifts, points shop, invites, admin RPCs, grants and RLS. Invite anti-abuse (0332, `docs/launch/INVITE_ANTI_ABUSE.md`): F7 native gate, F13/F16 mailbox, F15 network review, F17 redeem rate limit; redeem goes through `POST /api/referrals/redeem`. `unit/` checks selling OFF with the switch mocked | `QA_ENV_FILE=<file with QA_PW and local test secrets> npx playwright test -c e2e/api/round2/pro-rewards/playwright.config.ts --reporter=line --trace off`; `npx vitest run --config e2e/api/round2/pro-rewards/unit/vitest.config.ts`; leftovers: `node e2e/api/round2/pro-rewards/teardown.mjs` |
| `journeys/specs/round2/pro-rewards/` | S8g browser journeys for those screens (states, tier badge, shop double tap, invite copy/share and `/i/` link, errors) | `npx playwright test -c e2e/journeys/specs/round2/pro-rewards/playwright.config.ts` |
| `ui/pro-rewards-sweep.mjs` | S8g: the six Pro/Rewards/Invite/Founders/Settings screens in en/ar x light/dark x 375/1440, axe and the 44 px hit test | `node e2e/ui/pro-rewards-sweep.mjs` |
| `ui/` | Viewport x theme x locale sweep with axe, sheets, focus checks | `node e2e/ui/sweep.mjs` (and `sheets.mjs`, `focus.mjs`, `misc.mjs`) against the 3100 server |

Generated output (traces, responses, evidence, sweep JSON) is git-ignored; see `e2e/.gitignore`.
