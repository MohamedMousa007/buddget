# S8g: QA round 2, Pro, Rewards, Invite a friend and Founders Club (2026-11-19)

Cloud session, live Frankfurt project `tzioppxwsljhlglyducm`, local `next dev -p 3100 --webpack` with `NEXT_PUBLIC_DEV_AUTH_BYPASS=0`, an empty `NEXT_PUBLIC_API_BASE_URL`, `Africa/Cairo`. Synthetic users only (`qa-e2e-pr-*@buddget-qa.test`), created and deleted by each spec. Their state (points, tier, Pro, trial, founder, referral) was set with service-role writes to their own rows. At the end, 0 synthetic users were left (`teardown.mjs --check`), and so were their non-cascading rows: billing_events, trial_claims, founders, referrals, admin_staff and admin_audit_log.

What was not done: no real purchase; no RevenueCat or App Store change; no `platform_settings` or switch change; no real user's row touched; no app code or schema change.

The webhook was tested end to end by giving the **local** dev server its own random test secrets (`REVENUECAT_WEBHOOK_AUTH`, `REVENUECAT_WEBHOOK_HMAC_SECRET`, `CRON_SECRET`) and signing events for synthetic users. Production secrets were never used or seen.

**Which spec counts.** `docs/launch/PRO_REWARDS_SPEC.md` says it overrides `docs/PRO_REWARDS_BUILD_PLAN.md`. The code follows the spec. Expected results below come from the spec where the two agree or only the spec is specific. Every place the plan differs is listed once, in S8G-01, for the owner to settle.

Re-checks (not re-filed):
- **S8C-06, selling switch:** still ON (`billing`, `tiers`, `referrals` and `spark_gifts` all `enabled: true`).
- **D-7, slow first paint:** still present. On this dev server each of the four pages shows its skeleton for about 2 to 4 s after sign-in. The Founders page renders nothing (not even its title) until the plan state arrives (`founders/page.tsx`: `if (!me ...) return null`). It is never a dead end.

## 1. Counts

| Suite | Run | Passed | Failed | Notes |
|---|---|---|---|---|
| API `e2e/api/round2/pro-rewards/` (5 specs), final run | 77 | 77 | 0 | 10 of the passes are `test.fail` open bugs (S8G-01 to 06, 09, 10, 13, 14) that failed as expected. The first full run was 72 passed, 3 failed: A2 was a network blip (passed on re-run); F4 and F8 found S8G-14 and S8G-13 |
| Unit, selling OFF (`unit/`, switch mocked) | 8 | 8 | 0 | S8G-11 is recorded as found behaviour |
| Journeys `e2e/journeys/specs/round2/pro-rewards/`, mobile 375 | 9 | 8, then 9 | 1, then 0 | J1, J8 and J9 are `test.fail` (S8G-02, 07, 03). In the final run J2 timed out at sign-in (the dev server served a blank page); it passed when re-run alone |
| Journeys, desktop 1440 (`@desktop`: J2, J4, J5) | 3 | 3 | 0 | |
| UI sweep `e2e/ui/pro-rewards-sweep.mjs` (6 screens x en/ar x light/dark x 375/1440) | 48 pages, 472 controls | 48 rendered, 0 errors, 0 horizontal scroll, 0 wrong redirects | see S8G-12 | axe and the 44 px hit test |
| `EXPLAIN` (no ANALYZE) of the nightly job's queries | 4 | | | S8G-08 |

Final counted runs were done after all spec fixes. Earlier runs failed only on test-side mistakes (a check constraint, the founder-number range, a strict-mode selector, dev-server cold starts). Those were fixed in the specs.

## 2. Test cases added

API (`e2e/api/round2/pro-rewards/`):

| Id | Expected result | Outcome |
|---|---|---|
| G1 anon on 30 user and service rewards RPCs | 401/403/404 on every one | pass |
| G2 user JWT on 22 service-only RPCs (spark_*, loyalty_award, referral_reward, billing_apply, trial_claim, admin_*, cron functions) | refused | pass |
| G3 anon on the rewards helpers | no EXECUTE (0315) | **fail as expected, S8G-10** |
| R1 B reads A's rows in 14 rewards and billing tables | 0 rows | pass |
| R2 A writes own points, tier, Sparks, entitlement, promo days, founder, owned items directly | refused, nothing changed | pass |
| R3 user RPCs take no user id (smuggled `p_user`) | refused; each user sees only their own code | pass |
| I1 `/i/<code>`: valid code (lower case), 7 junk or injection-shaped codes | 307 to `/flow` plus a 30-day Lax cookie with no-store and noindex; junk goes 307 to `/` with no cookie | pass |
| A1 six user routes with no token or a garbage token | 401 | pass |
| A2 admin loyalty, switches and user-rewards routes with a user JWT (with and without the CSRF header) and anonymously | 401/403, nothing written | pass |
| C1 `/api/cron/loyalty`: no secret, wrong secret, user JWT, secret without "Bearer" | 401 | pass |
| C2 per-user upkeep (`rewards_touch`) twice | second run changes nothing | pass |
| W1 kept week: 2 records, then 3 | `too_few_records`, then kept, +10, streak 1, x1 | pass |
| W2 6 parallel checks of one week | paid once | pass |
| W3 SMS waiting for review in the week | `unconfirmed_items` | pass |
| W4 two weeks ago, a future week, a mid-week date, "NaN", an injection string | `out_of_window` / `invalid_week` | pass |
| W5 week 4 and week 8 | x1.5 = 15 points, x2 = 20 points | pass |
| W6 one missed week, no freeze, from x2 | streak 1, x1.5 (one step down) | pass |
| W7 missed week with a banked freeze | streak carries on, x2, freeze spent | pass |
| W8 freezes | Silver 1 per 8, Emerald 1 per 4, max 2 | pass |
| W9 streak gift | 10 Sparks at 12 weeks, once; none at 4 weeks (spec) | pass |
| T1 299 / 300 / 800 / 1,500 without Pro | Silver / Emerald +10 / Diamond +20 / Diamond | pass |
| T2 Elite with Pro; Pro lapses; Pro back | Elite +30 once, then Diamond, then Elite with no second gift | pass |
| T3 trial counts for Elite, Free does not | Elite / Diamond | pass |
| T4 founder + 1,500 + Pro | Elite Founder; each tier gift once | pass |
| T5 missed weeks and shop spending | tier unchanged | pass |
| T6 6 parallel refreshes at 300; 6 identical awards | one Emerald gift; one award | pass |
| T7 award of 0, -50, NaN, 2^31-1 | 0 / 0 / error / error; account unchanged | pass |
| T8 gift life and spend order | 12-month reward bucket, spent before bought Sparks | pass |
| P1 the plan's numbers | gifts 30/60/150, Free Diamond pack bonus +10% | **fail as expected, S8G-01** |
| S1 shop statuses | unknown, insufficient, ok (-80), freezes_full, nothing_to_repair; ledger -80; lifetime kept | pass |
| S2 5 parallel buys | one charge | pass |
| S3 cosmetics | not_owned, invalid, already_owned at no cost, apply ok | pass |
| B1 pack bonus | Free 0, trial 0, Pro 15, Pro Diamond 20 (never 35), lapsed 0 | pass |
| B2 `/me` pack bonus | matches the database (15) | pass |
| H1 webhook auth: no headers, wrong secret, missing / bad / zeroed signature, stamp 10 min old or ahead, body changed after signing | 401, nothing written | pass |
| H2 bad bodies (not JSON, `{}`, `[]`, `null`, missing id/type/time); unknown user | 400; unknown user 200 `unknown_user` with no row | pass |
| H3 purchase, replay, 5 parallel replays | applied once, then `duplicate`; Pro active, country EG | pass |
| H4 older EXPIRATION after a newer RENEWAL | `stale`, Pro stays active | pass |
| H5 pack 650: Free buyer, Pro buyer, reused transaction | 650 / 747 (+97 = 15%); a reused transaction id adds nothing | pass |
| H6 pack refund after 100 spent | remaining 0, bonus included; spent Sparks not clawed back | pass (see S8G-01) |
| H7 signed event with price 1e30 or timestamp 1e20 | 4xx | **fail as expected, S8G-09** |
| X1 first trial | granted, 30 days; a second claim is refused (`already_claimed`); `/me` trialDays 30 | pass |
| X2 10 parallel claims | exactly one trial | pass |
| X3 delete the account, sign up again with the same email | `already_claimed` | pass |
| X4 Pro active, canceled in period | `already_entitled` | pass |
| X5 lapsed paid Pro claims the "new member" trial | refused | **fail as expected, S8G-03** |
| O1 stay offer | Free no, trial no, Apple monthly `stay30_2m`, annual `stay_annual_20`, promo no; 3 parallel stamps, then no | pass |
| O2 lapse in the last 30 days | no offer | pass |
| O3 stamp without a discounted purchase | offer kept | **fail as expected, S8G-04** |
| O4 paywall-view and seen-resets with odd bodies | recorded; never 500; source capped at 40 characters; seen-resets ok | pass |
| M0 brand-new account | tier Silver | **fail as expected, S8G-02** |
| M1 `/me` for Free, trial, Pro, lapsed, founder | 200 with packs (5 ids), code and link, member number, earn 10/10/40, tier thresholds, founder number | pass |
| F1 redeem: junk, injection, own code, lower case with spaces, a second code | invalid / invalid / self_invite / ok / already_redeemed; invited 1 | pass |
| F2 friend older than the code | `account_too_old` | pass |
| F3 A to B to C, B back to A, C to A | ok, ok, too old, already redeemed | pass |
| F4 6 parallel redeems | one referral, one count | pass |
| F4b up to 6 rounds of 10 parallel redeems | every call answers 200 | **fail as expected, S8G-14** (a 409 in about 1 round in 4) |
| F5 friend trial | 37 days whether redeemed before or after the claim; `/me` 37; bonus flag set once | pass |
| F6 device guards | inviter's own device `self_invite`; reused device `device_used` (rejected row) | pass |
| F7 web, no device id, two accounts from one person | not both rewarded | **fail as expected, S8G-05** |
| F8 activation | 4 records or 1 day stays pending; 5 records on 3 days, rewarded once (repeat evaluations plus the friend's `/me`); Free inviter gets 7 days of promo Pro now | pass |
| F8b 8 parallel activation checks for one friend | one grant, counts 1/1 | **fail as expected, S8G-13** (4 of 4 runs paid more than once; the first full run paid 3 weeks) |
| F9 trialing inviter; store-subscriber inviter | 7 days banked, start after the trial; 500 reward Sparks | pass |
| F10 4 rewards already this month | 5th `capped` (`month_cap`), nothing paid | pass |
| F11 3rd activated friend | +50 points once | pass |
| F12 friend deletes the account within 30 days | `clawed_back`, inviter loses the 7 days, grant revoked | pass |
| F13 the same mailbox re-joins after deleting a pending account | not counted again | **fail as expected, S8G-06** |
| F14 Invite list privacy | first name only, no id or email; another user sees nothing | pass |
| D1 admin writes with a non-staff actor (7 functions) | `not_staff`, nothing changed | pass |
| D2 Sparks adjust | 0, null, ±100,001, bad bucket, blank reason, NaN all invalid; +50 / +20 / -30 takes reward Sparks first; -5,000 never goes negative | pass |
| D3 set tier | unknown refused; lock pins it; unlock recomputes | pass |
| D4 streak and freezes | -1, 521, step 3, null invalid; 8 weeks gives x2; freezes clamp 0..2 | pass |
| D5 founder number | taken, 0 and 101 refused; set, remove, then `not_founder` | pass |
| D6 bank days and trial | 0, -3, 367, null invalid; 10 days start now; trial 1,000 days clamps to 90; end twice gives `not_trialing` | pass |
| D7 platform switch | unknown key or null refused, settings unchanged (a real key was never sent) | pass |
| D8 audit log | every write logged with the staff actor | pass |
| D9 loyalty reset | points, streak and tier back to Silver | pass |

Unit, selling OFF (`unit/selling-off*.test.tsx`):

| Id | Expected result | Outcome |
|---|---|---|
| OFF1 / OFF1b `/me` | off: billingEnabled false, no packs, no usage, no Sparks; on: packs listed | pass |
| OFF2 paywall-view | records nothing | pass |
| OFF3 trial | `billing_off`, no grant | pass |
| OFF4 stay-offer | no offer while off | found: offered (S8G-11) |
| OFF5 / OFF6 / OFF7 Rewards and Invite pages, Settings invite and membership cards | render nothing while off; the invite card shows when on | pass |

Journeys (`e2e/journeys/specs/round2/pro-rewards/10-screens.spec.ts`):

| Id | Expected result | Outcome |
|---|---|---|
| J1 new account on Rewards | Silver card | **fail as expected, S8G-02** ("Rewards are resting for now") |
| J2 Pro at Diamond (375 and 1440) | PRO tag on the avatar, "Diamond · tier 3 of 5" in Settings, Diamond card, 20% on Usage; lapsed at 1,600 shows the Elite card locked, Settings says Diamond; Pro back gives Elite | pass |
| J3 Founders | non-founder sent back to Settings; founder sees their number | pass |
| J4 points shop (375 and 1440) | double tap on "Use points" charges 80 once; next tap says "You need 80 more points" | pass |
| J5 invite (375 and 1440) | `/i/` link before sign-in is redeemed after sign-in; Copy link copies `https://buddget.app/i/<code>` and says Copied; Share (tapped twice) hands that link to the share sheet | pass |
| J6 "Get 650 Sparks" and "Keep Pro" tapped twice on the web | a "can't be bought on this device yet" note, no crash, no purchase row | pass |
| J7 invite list fails (500) | "Couldn't load your invites" with Try again, which recovers | pass |
| J8 `/me` answers 500 | a message and a retry | **fail as expected, S8G-07** |
| J9 lapsed Pro member opens the app | stays lapsed | **fail as expected, S8G-03** (put on a 30-day trial) |

## 3. Findings

Ranked by severity. S8G-13 is the only P1.

Severity: **P0** wrong money or entitlements for many users, or a security hole; **P1** wrong money or reward, or an auth bypass; **P2** wrong behaviour; **P3** minor or UI.

### S8G-13 · P1 · Parallel invite checks pay the inviter several Pro weeks for one friend
- **Summary:** When two activation checks run at the same moment, a referral that was just rewarded is set back to "activated" and paid again.
- **When it happens:** the friend's app open (`/api/entitlements/me` runs the check) at the same time as another device, another tab or the nightly job.
- **Repro:** a friend with 5 records on 3 days; run `referral_evaluate(p_invitee => friend)` 8 times in parallel (service role). The inviter gets 2 to 3 `pro_promo_grants` of 7 days and a higher `activated_count` and `rewards_count` (F8b: 4 of 4 runs). The first full suite run paid 3 weeks for one friend with only 3 parallel calls (F8).
- **Suspected cause:** in `referral_evaluate` (0308), the `UPDATE referrals ... FROM n WHERE r.id = n.id AND (n.next_status <> 'pending' ...)` does not re-check `r.status = 'pending'`. A second call waits on the row lock, then re-applies its stale plan to a row that is now `rewarded`, setting it back to `activated`, and calls `referral_reward` again. `referral_reward` sees `activated` and pays again (it also re-counts the friend toward the milestones).
- **Suggested fix:** add `AND r.status = 'pending'` to that UPDATE (and lock the pending rows with `FOR UPDATE SKIP LOCKED` in the first CTE), Live has 0 referrals today (checked after cleanup), so nothing was double-paid yet; fix it before invites are used.
- **Needs owner decision:** no.

### S8G-01 · P2 · The code follows PRO_REWARDS_SPEC, not the build plan, on eight reward rules
- **Summary:** The two docs disagree; the code does what the spec says. The owner should confirm the spec is right.
- **Where they differ** (plan, then code and spec):
  - Tier gifts: Emerald 30, Diamond 60, Elite 150 Sparks. Code: 10, 20, 30.
  - Streak gifts: 10/30/60/120 at 4/12/26/52 weeks. Code: 10/20/40 at 12/26/52.
  - Gift life: 60 days. Code: 12 months.
  - Pack bonus for Free members: +5% Emerald, +10% Diamond. Code: none.
  - Pack bonus for Pro: max +15%. Code: a Diamond Pro member gets +20%.
  - Weekly AI credits for Free members by tier (+3 / +5): not built.
  - Member price on Pro (EGP 399 first year, with the 50% holdout): not built.
  - Pack refund after use: the plan claws back spent Sparks (negative balance allowed). Code zeroes what is left only (H6).
  - Budget-set points "only with real categories": `loyalty_close_periods` checks only that a budget is active and was touched.
- **Repro:** test P1 (`20-loyalty.spec.ts`); live `loyalty_tiers.sparks_gift` and `platform_settings.sparks_bonus`.
- **Suspected cause:** the 2026-11-17 night spec replaced the plan. The spec says "this file wins", but the plan was not updated.
- **Suggested fix:** confirm the spec, then mark the plan superseded (or change the code where the plan is right).
- **Needs owner decision:** yes. These are product and money choices.

### S8G-02 · P2 · Every new account sees "Rewards are resting" and has no tier badge
- **Summary:** Accounts created after 0310 have no loyalty row, so they have no tier until they earn their first points.
- **Repro:** sign up (or create a confirmed user), sign in, open Rewards. The page shows "Rewards are resting for now. Your points are safe." `/api/entitlements/me` returns `rewards.tier: null`; the Settings badge and the profile tier badge are missing.
- **Evidence:** M0, J1. Live: `loyalty_accounts` has no row for a fresh user; `loyalty_refresh_tier` returns null when the row is missing.
- **Suspected cause:** 0310 created loyalty rows once for the 48 accounts that existed then. `handle_new_user` (0308) adds profile, settings and member number, but no loyalty row. `rewards_touch` calls `loyalty_refresh_tier`, which exits when there is no row.
- **Suggested fix:** insert the loyalty row in `handle_new_user` (and backfill accounts that have none), or have `loyalty_refresh_tier` create it.
- **Needs owner decision:** no.

### S8G-03 · P2 · A lapsed paying member gets a free 30-day trial just by opening the app
- **Summary:** The app claims the trial at every session start, and the database accepts an account whose paid Pro has expired.
- **Repro:** an account with an expired Apple Pro plan and no earlier trial claim signs in; within seconds it is `plus_trial`, 30 days (J9). The same happens via `POST /api/entitlements/trial` (X5).
- **Suspected cause:** `trial_claim` refuses only active, trialing, canceled, past_due and paused plans; `expired` falls through. It then checks the mailbox (`trial_claims`), which a store buyer who never trialed has not used.
- **Who it hits:** mainly members who bought before ever opening a build that claims the trial, which is few today.
- **Suggested fix:** refuse a trial when the account ever had a store or paid plan (for example any `billing_events` row, or `user_entitlements.source in ('apple','google')`).
- **Needs owner decision:** yes. A free month could be meant as a win-back; the plan's win-back is 30% off, not a trial.

### S8G-04 · P3 · Any member can burn their once-only stay offer without buying it
- **Repro:** as a store subscriber, `POST /api/billing/stay-offer` with no body. The offer is gone for good: `GET` then answers `eligible: false` (O3).
- **Suspected cause:** the POST stamps `stay_offer_redeemed_at` before the store confirms a discounted purchase. The webhook stamps it too.
- **Impact:** self-harm only: a member who taps "stay" but cancels the store sheet may lose the offer, depending on when the app calls POST. Today it calls POST after a successful purchase.
- **Suggested fix:** rely on the webhook stamp only, or have the POST require a recent `billing_events` row carrying a stay offer id.
- **Needs owner decision:** no.

### S8G-05 · P2 · On the web, "one invite reward per device" does nothing
- **Summary:** One person with several emails can earn the inviter up to 4 Pro weeks a month from the browser.
- **Repro:** two new accounts redeem the same code with no device id, each logs 5 records on 3 days. Both are `rewarded` (F7).
- **Suspected cause:** the device checks in `referral_redeem` and `referral_reward` read the client-sent device id and `user_devices`. A web sign-up has neither, so no check runs.
- **Suggested fix:** for web sign-ups, hold the reward until the friend signs in on a native device, or add a weak signal (IP or browser fingerprint) with manual review.
- **Needs owner decision:** yes. It trades growth against abuse; the caps (4 a month, 12 a year) bound the cost.

### S8G-06 · P3 · The same person can be counted again after deleting a pending friend account
- **Repro:** a friend redeems a code, deletes the account before activating, signs up again with the same email and redeems again: `ok` (F13). The trial is not given twice (the mailbox is remembered), but the inviter can still earn a reward for the second account.
- **Suspected cause:** referral guards look at account and device, not the mailbox hash that `trial_claims` already keeps.
- **Suggested fix:** refuse a redeem when the mailbox hash already has a referral (store the hash on `referrals`).
- **Needs owner decision:** yes, but small. Low value without device reuse.

### S8G-07 · P2 · If the plan read fails, Pro, Usage, Rewards, Invite and Founders stay on a skeleton forever
- **Repro:** make `/api/entitlements/me` answer 500 (or go offline), then open Rewards: the skeleton stays, with no message and no retry (J8). Founders shows nothing at all.
- **Suspected cause:** `billingStore.refresh` keeps `me = null` on a failed read and nothing retries; each page shows the skeleton while `me` is null.
- **Suggested fix:** keep an error flag in the store, and show "Couldn't load your plan" with Try again (the Invite page already does this for its friend list).
- **Needs owner decision:** no.

### S8G-08 · P2 · The nightly loyalty job reads the whole history of four growing tables and loops per user
- **Evidence:** `EXPLAIN` without ANALYZE, live:
  - `loyalty_founder_bar()` reads the `loyalty_action_days` view: sequential scans on `expenses`, `income_events`, `savings_transactions` and `sms_parse_log`, with no date bound. It runs every night (`loyalty_grant_founders`) while the founder window is open, until 2027-06-30.
  - `loyalty_close_periods()` runs several queries for each user with a budget, in a PL/pgSQL loop.
  - `loyalty_refresh_pro_tiers` and `referral_evaluate` use indexes (fine).
- **Suspected cause:** both were written before the "set-based, bounded" rule in CLAUDE.md.
- **Suggested fix:** bound the founder bar to activity since `founder_window_opens` (and stop it once the cap is reached), and rewrite `close_periods` as set-based `INSERT ... SELECT` statements with a cursor.
- **Test:** EXPLAIN evidence only. PostgREST cannot run EXPLAIN, and running the job would pay points to real users. C2 covers per-user idempotency.
- **Needs owner decision:** no.

### S8G-09 · P3 · A signed webhook with an overflowing price or timestamp answers 500
- **Repro:** a correctly signed event with `price_in_purchased_currency: 1e30` or `event_timestamp_ms: 1e20` returns 500 `apply_failed` (H7).
- **Impact:** RevenueCat retries a 500 for days. Only RevenueCat can sign events, so this is hardening.
- **Suggested fix:** in `parseEvent`, reject prices above about 1e9 and timestamps outside 2020 to 2100 with a 400.
- **Needs owner decision:** no.

### S8G-10 · P3 · anon can still execute three helper functions
- **Repro:** anon `rpc/entitlement_grants`, `rpc/loyalty_local_day` and `rpc/loyalty_week_start` return 200 (G3).
- **Impact:** they are pure SECURITY INVOKER helpers, so no data leaks, but CLAUDE.md and 0315 say anon holds nothing. The catalog shows 24 anon-executable public functions in all; the SMS and sync ones are S8c's area.
- **Suggested fix:** `revoke execute ... from anon` on these three (keep `authenticated`).
- **Needs owner decision:** no.

### S8G-11 · P3 · The stay offer ignores the selling switch
- **Repro:** with `billingEnabled` mocked false, `GET /api/billing/stay-offer` still answers `eligible: true` for a store subscriber (OFF4).
- **Suggested fix:** return `eligible: false` while billing is off, like the other billing routes.
- **Needs owner decision:** no.

### S8G-12 · P3 · Rewards page: low contrast on locked tier rows, and a skipped heading level
- **Evidence:** sweep, all 4 Rewards runs in each language. axe `color-contrast` is serious on `.opacity-60 > .membership_rowLabel` (en) and `.membership_rowValue` (ar, light), the tier ladder rows that are not reached. `heading-order` is moderate (`h4` in the streak card under an `h2`).
- **Suggested fix:** use a muted token colour instead of `opacity-60` on locked rows (or raise it), and make the streak title an `h3`.
- **Needs owner decision:** no.

### S8G-14 · P3 · A double-tapped invite redeem can answer 409
- **Repro:** 10 parallel `referral_redeem` calls for one new account. The winner answers `ok`; now and then (about 1 round in 4) a loser answers 409 from the unique `referrals_invitee_id_key` instead of `already_redeemed` (F4b). Only one referral is stored and the count is right.
- **Impact:** the app reads it as `error` and keeps the code for another try, which then answers `already_redeemed`. Harmless, but noisy.
- **Suggested fix:** take a per-user advisory lock at the top of `referral_redeem`, or catch `unique_violation` and return `already_redeemed`.
- **Needs owner decision:** no.

Seen in the sweep, not filed:
- Back button 38 x 44 on every settings sub-page: already fixed on the S7a branch (`SettingsSubPageShell`, `min-w-11`).
- Settings switches 44 x 24 and the EN chip: S7a's area.
- Flip cards (Pro, Rewards, Invite, Founders) "miss" the hit test: false positive. The card's own div handles the tap; the labelled button is an invisible overlay for screen readers.
- One Arabic Founders input corner miss: did not reproduce on re-run.

## 4. Not covered, and why

- **The loyalty cron with the real secret** (`/api/cron/loyalty` 200 path, re-run idempotency end to end): it runs over every user and would pay points and activate referrals for real accounts. Only the scoped pieces were tested (C2, F8 parallel evaluations, `rewards_touch`), plus EXPLAIN.
- **Budget-set and tracked-month points** (`loyalty_close_periods`): global, for the same reason. Code read only (see S8G-01, S8G-08).
- **Switch flips on live** (referrals off, gifts off, tiers off, billing off): not allowed. Selling OFF is covered by the mocked unit tests; the referrals and gifts switches were read in code only.
- **Admin portal routes with a real admin session:** an admin session needs staff credentials and 2FA. Refusal with user JWTs was tested (A2); the logic was tested at RPC level with a temporary synthetic staff row (D1 to D9).
- **Native purchase sheets, TestFlight, Play, App Store offer codes and RevenueCat dashboard:** out of scope by rule. The web shows the "not available yet" path (J6).
- **Points-shop repair inside the 48-hour window:** today's date was outside it for every timezone, so only `nothing_to_repair` was reachable. There is no clock control on live.
- **Trial daily cap (200 a day):** it cannot be reached without changing `trial_limits`.
- **Grace-window order case:** a user who keeps this week before keeping last week during the first 3 days of a week may lose last week (`too_soon`). Found in code; not reproducible today because the window was closed. Listed for the next round.
- **Offline for the whole page:** J8 covers the failed plan read (500). True offline (`context.setOffline`) shows the same path by code; it was not run separately.
- **Real phone tilt and motion, VoiceOver or TalkBack:** need devices.

## 5. How to re-run

- API: `QA_ENV_FILE=<file with QA_PW and the local test secrets> npx playwright test -c e2e/api/round2/pro-rewards/playwright.config.ts --reporter=line --trace off`. The dev server must have the same `REVENUECAT_WEBHOOK_*` and `CRON_SECRET` test values; without them the webhook specs skip.
- Unit: `npx vitest run --config e2e/api/round2/pro-rewards/unit/vitest.config.ts`
- Journeys: `npx playwright test -c e2e/journeys/specs/round2/pro-rewards/playwright.config.ts` (`--project=desktop` for the `@desktop` ones).
- Sweep: `node e2e/ui/pro-rewards-sweep.mjs`
- Leftovers: `node e2e/api/round2/pro-rewards/teardown.mjs` (`--check` only counts).

## 6. Close-out (fix pass, 2026-11-20)

Fixed in migrations `0332_s8g_rewards_billing_fixes.sql` and `0333_trial_cap_real_users_network_review.sql` (both applied live) and the server routes. Every fix flips its `test.fail` spec or adds one. Cloud runner job 8 on 2295189b: verify green (6553 tests), API and journeys green, 0 synthetic users left.

| Item | Fix | Test |
|---|---|---|
| S8G-13 | `referral_evaluate` and `rewards_touch` lock rows with `for update skip locked` and re-check `pending` in the update; bulk runs use a try-lock | F8b |
| S8G-02 | `handle_new_user` creates the Silver loyalty row; existing accounts backfilled | M0, J1 |
| S8G-03 | `trial_claim` answers `already_claimed` for a store plan (current or lapsed) or any Pro billing event | X5, x5b, x5c, J9 |
| S8G-04 | `stay_offer_claim` records the claim; the webhook spends the offer only for a purchase within an hour of it | O1, O3 |
| S8G-05/06 | Invite anti-abuse (design: `docs/launch/INVITE_ANTI_ABUSE.md`): redeem only through `POST /api/referrals/redeem`; one invite per mailbox (keyed hash); a web friend earns nothing until they sign in on a native device (30 days, then expired); one reward per device; rate limits per user and per IP; disposable and unverified emails refused; network signals hold for manual review (inviter's own network, or the third friend from one network in 30 days) | F4b, F7, F13, F15, F16, F17 |
| S8G-08 | Founder bar and period close are set-based and bounded (BRIN on `updated_at`, active users of the last 3 days) | loyalty specs |
| S8G-09 | `parseEvent` refuses out-of-range timestamps and prices (400, not a retried 500) | revenuecat.test.ts |
| S8G-10 | anon EXECUTE revoked (it came through PUBLIC) | G3 |
| S8G-11 | `GET /api/billing/stay-offer` answers `eligible:false` when selling is off | OFF4 |
| S8G-14 | Parallel redeems answer `already_redeemed`, not 409 | F4b |
| S8C-01, 03, 04 | CHECK constraints on money and dates (NaN, far-off years) | S8C-01, 03, 04 |
| S8C-02 | App routes refuse a revoked or signed-out session (`session_is_live`, fails open on error) | S8C-02 |
| S8C-05 | Support submit answers 401 for a deleted account | S8C-05 |
| S8C-07 | Notifications cron prefetches in bulk; the query count no longer grows with users | route.test.ts |
| S8C-08 | The API report redacts UUIDs | lib.mjs |
| Runner find | The trial daily cap counts only live, non-`.test` accounts (QA runs had used all 200 slots) | X1 to X5, J2 |

**Owner decision, 2026-11-19, quoted: "approve".** The stricter session rule: a revoked or signed-out session is refused on every app route. This replaces the QA-53 allowance for a deleted account's unexpired token.

Left, and why:
- **Closed by the owner:** S8G-01 and S8C-06.
- **UI session:** S8G-07 (fixed on main, J8) and S8G-12.
- **`select('*')` reads:** kept where they are bounded by user.
- **Device ids:** the client chooses them, so the native gate raises the cost of abuse but cannot prove a device.
- **Native apps:** shipped iOS and Android builds still call the dropped `referral_redeem(text,text)`, so invite redeem fails on them until they are rebuilt; the app keeps the code and retries.
