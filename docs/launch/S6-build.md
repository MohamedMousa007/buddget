# S6 build report: billing, Sparks and loyalty

Follows `S5c-review.md` section 14 (items 1 to 27). One section per phase, appended as each phase is pushed. Users are cited by the first 8 characters of their id; no names, message text or account digits appear here.

## Phase 1: limits and quota (items 4 to 7, 12)

**Migration 0290** (`0290_s6_limits_and_sms_quota.sql`, applied to `ydihurtbcnoflhormgzi` as `s6_limits_and_sms_quota`).

| Item | What was built |
|---|---|
| 4 | `platform_settings.ai_spend_guard = {"dailyCapUsd": 5}` |
| 5 | `ai_default_limits()` carries every new key (`grounded_per_day`, `sparks_per_month`, `sms_ai_calls_per_day`, `sms_ai_calls_per_month`, `sms_accounts_max`, `budget_plans_max`, `seats`). `free` limits updated; `plus` and `plus_trial` rows inserted with the S5c table. `LIMIT_CATALOG` has the same keys; `limits.test.ts` now reads the newest migration, so a key added to one side and not the other fails |
| 6 | `ai_quota_reserve_v2`: the three unit windows exclude `sms` (events and live reservations); an `sms` reservation skips the window loop and is checked against `sms_ai_calls_per_day` (24 h) and `sms_ai_calls_per_month` (30 d), counting every `sms` usage event plus live `sms` reservations. New layers `sms_day`, `sms_month` |
| 7 | SMS parse route: `aiCallsToday`, `RATE_LIMIT_PER_DAY` and the 429 are gone (the `aiUsage.ts` helper, now unused, is deleted). A quota denial writes `status logged / parsed_ok / awaiting_confirmation / failure_code ai_quota_held` and answers 200 `{ held: true }`; only a broken quota store answers 503 (`quota_unavailable`), so the phone keeps the message. `rate_limited` is never written for a quota denial. SMS calls settle the token counts the provider returns (`usageMetadata`), the flat estimate only when the provider sends none |
| 12 | Unit-window denials already show the reset time and no upgrade offer; pinned by a test. The Sparks layer is Phase 2 |

Also added: `platform_settings.billing = {"enabled": false}` and `billing_enabled()`: the one server-side switch for selling. Everything that enforces a paid gate (Sparks denial, the SMS account cap, paywall, purchase entry points) reads it and does nothing while it is false.

### Who is affected (checked with SELECTs before writing)

- 47 accounts, no `user_entitlements` rows. Every one was on `free` with unit limits of the platform defaults (600k / 1.5M / 6M units).
- Lowering the free limits (40k / 60k / 200k, 10 requests a minute) would have reduced what testers get. So the same migration grants every existing account a `plus` entitlement, source `promo`, active, period end `2027-02-01` (a safety net: the launch migration moves it to launch day). The Plus limits (120k / 200k / 450k units, 20 a minute, SMS 60 a day and 450 a month) are still lower than the old defaults.
- Whether anyone would notice: 12 accounts have used AI since 2026-10-19. Highest rolling usage with SMS excluded: 46,650 units in 5 hours, 54,277 in 24 hours, 54,633 in 7 days. **0 accounts** have ever exceeded the Plus limits; 1 exceeded the free 5-hour limit (the reason the preview grant matters). Highest SMS model calls: 18 in a day, 48 in 30 days, against Plus 60 and 450.
- New accounts created after the migration start on `free` (S5a's design); they are not "accounts that have something today".

### Proof

The quota function was proven on the live database in a transaction that was rolled back (a `DO` block that raised its result, so nothing persisted). With synthetic `ai_usage_events` for an account with no usage:

- Plus (promo): 30 SMS calls in a day and 5,000,000 SMS units each: an SMS call is allowed, and a `budget` call is allowed (SMS units do not touch the unit windows).
- Free: 30 SMS calls in the day: denied `sms_day`, with a reset time 24 h after the oldest call. A `budget` call is allowed.
- Free: 150 calls spread over 3 to 20 days, none today: denied `sms_month`, reset 30 days after the oldest.
- Free: 149 calls: allowed; the allowed reservation then counts as live, and the next call is denied `sms_month`.
- Route tests (`route.test.ts`): a spent allowance holds the message and answers 200 with no `rate_limited` write and no model call; a broken quota store answers 503; settled usage carries the provider's token counts.

### Not verified

- Not run against a real phone or the deployed route; the route is proven by unit tests with a mocked database.
- A burst of more than 20 AI-tier messages in one minute (Plus) or 10 (free) now holds the surplus for review through the per-minute request limit, which still counts SMS. The held messages are not lost. A phone draining a long offline queue of unmatched messages is the case to watch.
- Shadow-mode quarantine fallback (C4) used to read "user at the daily cap" from a count; it now reads "AI configured", and an exhausted allowance holds the message at the reserve step instead of using the quarantined template's reading. The message is held, not lost.
