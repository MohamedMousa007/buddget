# API, database and security regression (S8c, QA round 2)

Playwright in API mode (no browser) against the shared dev server on :3100 and the live Supabase project in `.env.local`. Writes only to the synthetic users `qa-api-1..3@buddget-qa.test`. Report: `docs/qa/round2/S8c-api-security.md`.

```bash
QA_PW_FILE=<file holding a generated password> node e2e/api/round2/setup.mjs
QA_PW_FILE=<same file> npx playwright test -c e2e/api/round2/playwright.config.ts --reporter=line --trace off
QA_PW_FILE=<same file> node e2e/api/round2/teardown.mjs   # lib.mjs reads the password file on import, so teardown needs it too
```

- `qa-regressions.spec.ts`: one test per QA fix (QA-17, 30, 51 to 62, 98 to 102).
- `adversarial.spec.ts`: RLS and RPC IDOR with B's seed rows, API-route IDOR, admin routes with a user token, sessions and SMS ingest tokens, money-RPC concurrency, NaN/Infinity/boundary dates, rate limits (a couple past each limit), billing and entitlements.
- `zz-lifecycle.spec.ts` runs last: it deletes C (QA-53). Run `setup.mjs` again before the next run.
- Known open bugs are `test.fail` with their S8C id, so the run stays green and the test flips to "unexpectedly passed" once fixed.
- `setup.mjs --legacy-sec` also creates the `qa-sec-1..3` users that `e2e/security/api-probe.mjs` hard-codes. Do not run that probe's `revoke-1`/`revoke-2` steps unless `QA_PW_FILE` is named `qa_pw.txt`.
- Never sends email or push, never calls a cron, never runs heavy SQL.
