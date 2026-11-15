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

## Phase 2: Sparks ledger (items 8 to 11)

**Migration 0291** (`0291_s6_sparks_ledger.sql`, applied as `s6_sparks_ledger`). Types regenerated from the live project (the diff against the old file was only these additions).

- Tables: `spark_prices` (seeded with the S5a prices; `goals_grounded` 10, `sms` 0), `spark_allowances` (`plan`/`trial`/`bonus`, `used <= granted`, unique per user, kind and period start), `spark_purchases` (created empty; no write path exists but the future webhook), `spark_spend` (append-only; check `spark_spend_one_ledger`: exactly one of `allowance_id` and `purchase_id`). Row security on all four: a user reads only their own rows, writes are service role only.
- `ai_reservations.sparks` holds the price on the reservation. `ai_quota_reserve_v2` and `ai_quota_settle` keep their names and callers; the phase 1 bodies became `*_core` (callable only by the wrappers) and the wrappers add the Sparks step under the same per-user advisory lock. A null `sparks_per_month` (an override) means nothing is priced.
- Item 8: charged when a call settles `ok`, or `aborted` with output tokens above zero. `error`, release and an abort with no output are free. A reservation settles once, so a double settle charges once.
- Item 9, 10, 11: `spark_open_plan_period` (idempotent per user and period start; closes the free calendar-month row so a subscriber does not hold both), `spark_end_plan_period` (expiry, or a refund: sets the open store period's end to now and remembers its real end), `spark_restore_plan_period` (a reversed refund). These three are for the webhook only (service role). A free or promo account's month row is made on first use.
- Spend order: allowance first (soonest expiry first), then purchased packs oldest first. Never overdraws.
- **Denial is off while billing is off.** The `sparks` layer (HTTP 429, with the refill date) is returned only when `billing_enabled()` is true; the spend is recorded either way so "Sparks used" can be measured (item 27).
- Client: the `sparks` layer has its own copy with the refill date; `quotaDeniedOffersUpgrade` is true for that layer only.

**Proof (live database, one rolled-back transaction, synthetic data on an account with no AI usage):** reserve allowed with billing off and 1 Spark held on the reservation; lazy month row of 100 (the Plus limit the promo grant carries); error settle 0 charged; abort with no output 0; abort with 7 output tokens 1; budget `ok` settled twice charged 2 once (2 spend rows in total); release 0; spend row with neither or both ledger ids refused; with billing on and 1 Spark left, a 2-Spark call denied `sparks` with refill 2026-12-01 and a 1-Spark call allowed, after which a live reservation holds the last Spark (the next call denied); a 3-Spark charge took 1 from the allowance and 2 from a purchased pack (8 left); `spark_open_plan_period` true then false for the same period, one row, the free row closed; end then restore reopened the period.

**Not verified:** no concurrent two-connection test (the lock is the per-user advisory lock the reserve already used). Live-price (grounded) estimates still reserve under `proxy` (1 Spark); the `goals_grounded` price (10) is seeded but the route does not yet reserve under it, so that call is cheaper than designed until it is wired. The `ai_quota_status` balance line for Settings is added with the client in phase 4.

## Phase 3: trial and SMS account cap (items 2, 17, 18)

Phases 2 and 3 were pushed together: the regenerated `database.types.ts` carries both migrations and a verify run that overlapped my own edits had to be repeated.

**Migration 0292** (`0292_s6_trial_and_sms_cap.sql`, applied as `s6_trial_and_sms_cap`).

- **Trial (items 2, 17).** `trial_claims` (`email_key` primary key, `user_id`, `claimed_at`; no device key). `trial_claim(user, email_key)` (service role only): refuses while billing is off, for an account that already has a plan from another source, past `platform_settings.trial_limits.dailyCap` (200 a day, editable), and for a second claim of the same key; otherwise writes `plus_trial / trialing` with the plan's `trial_days` and opens a 60-Spark `trial` allowance (closing the free month row). `admin_trial_grants_daily(days)` is the admin count of trials granted per day (the function exists; no admin screen reads it yet).
- **Route** `POST /api/entitlements/trial`: refuses an unconfirmed email or an anonymous session (Google and Apple sign-in set the confirmed flag), builds the key with `normalizeEmailKey` (`src/lib/entitlements/trial.ts`: lower case; Gmail and googlemail.com with dots and `+tag` removed; other domains unchanged), and passes the database's refusal back as a status. Nothing calls it yet; the client call is in phase 4, behind the switch.
- **SMS account cap (item 18).** `payment_methods.track_sms` default is now false. Trigger `payment_methods_sms_cap` (before insert or update): when a row becomes tracked and the user is at `sms_accounts_max`, it stores false; it never raises and never touches a row that is already tracked. One tracked account = `track_sms`, type not cash, not deleted or closed, `parent_id` null. Only active while billing is on. The client always sends `track_sms: true` on a save (`paymentMethodMapper.ts`), so the trigger is what decides; accounts created by an SMS (`ensureProvisionalAccount`) now send `true` explicitly because the default changed.
- **Over-cap messages.** `namesUntrackedAccount` (in `createSmsExpense.ts`): when billing is on and the message names an untracked non-cash account (a card follows its account), the parse route holds the message (`failure_code sms_account_cap`, awaiting confirmation) and books nothing. The held-review sheet shows a reason line for `sms_account_cap` and for `ai_quota_held` (English and Arabic; the Arabic is unreviewed), and both rows sit in the "needs a look" group, never in "Select all ready".
- **First turned SMS on (items 18, 27).** `user_settings.sms_first_enabled_at`, set by a trigger the client cannot override; backfilled from the first ingest token (or the settings update time) for accounts that already have SMS on. Zero accounts with SMS on are left without it.
- `billing_enabled()` is read from the app through `billingEnabled()` (`src/lib/entitlements/billingSwitch.ts`, 30-second cache, a failed read counts as off).

**Who is affected:** nobody today. Billing is off, so the trial is not granted and the cap trigger does nothing. 6 of 47 accounts track more than 2 accounts by SMS (the most is 5); when billing is switched on the trigger does not touch their existing rows, and all 47 hold the promo Plus entitlement (`sms_accounts_max` unlimited) until it ends.

**Proof (live, rolled back):** billing off returns `billing_off`; billing on, a promo account returns `already_entitled`; an account with no plan is `granted` (`plus_trial`, `trialing`, ends in 14 days, a 60-Spark `trial` allowance); the same email key again or from a second account is `already_claimed`; a cap of 1 a day returns `daily_cap`; the admin function counts the grant. Cap: an account with 4 tracked accounts on the free plan, all set false then back to true one at a time, ends with 2 tracked and no error; an unrelated update leaves the 2; with billing off all 4 stay tracked.

**Not verified:** the held-message route path (`namesUntrackedAccount` is unit-tested; the full parse route is not run past the quota step in its tests, which stop at a mocked booking); concurrent claims or concurrent inserts (the per-user advisory locks are untested under load); a held `ai_quota_held` message has no amount, so the confirm route refuses it (422) and it can only be dismissed from the sheet: the design says "hold for review" and nothing re-parses it later. **Recommended follow-up:** re-parse held `ai_quota_held` rows when the SMS allowance reopens.

