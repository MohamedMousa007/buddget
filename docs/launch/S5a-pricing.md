# S5a: pricing, free trial and AI credits

Date: 2026-11-15. Decision document, no code, no migrations, no database writes. Inputs: the live database (`ydihurtbcnoflhormgzi`, read-only), the billing scaffold in the repo, `docs/launch/S4-security.md` sections 5, 6 and 8, store pages read today (section 12), and one council round (Skeptic, Pragmatist, Critic as Sonnet subagents; Fable as architect).

**Revised 2026-11-15 by the business review** (`docs/launch/S5a-business-review.md`: competitors in three markets, a 60-buyer simulated panel, price curves, unit economics, an offer pass and a three-lens board). Changed lines are marked **[changed]**. Where this document and the review differ, the review's section 10 is the list of what moved and why.

**Revised 2026-11-15 by the S5c review** (`docs/launch/S5c-review.md`). Changed lines are marked **[S5c]**. Where this document and section 14 of the review differ, the review wins. In short: no founding price in v1, no device key for the trial, the SMS cap counts bank accounts with their cards, the SMS AI cap counts model calls and sits outside the unit windows, a `plus_trial` plan row, and tighter Sparks rules.

Readers: the owner picks the ladder and SKUs from section 10. S5b reads sections 5 and 8 (ledgers, what a loyalty reward may touch). S5c attacks sections 3 to 7. S6 implements section 8.

## 0. Summary

- **One paid plan, "Plus".** Free keeps the whole loop, including SMS auto-tracking on up to 2 accounts **[changed, was 3]**. Plus removes the caps and adds depth. A household plan is the likely second product, later, with a written trigger.
- **Price [changed]:** EGP 69 a month or EGP 499 a year in Egypt; AED 14.99 / 99.99; SAR 12.99 / 99.99; USD 4.99 / 39.99 elsewhere. A founding price on the annual plan (EGP 399, AED 79.99, SAR 79.99) for the first 60 days. **[S5c] The founding price is not built in v1** (Google Play cannot end an offer on a date; council 3 of 3).
- **Trial:** every new account gets Plus for 14 days with no card (the app's own `trialing` entitlement), then drops to free with nothing deleted. No store trial at launch. **[S5c]** Once per verified, normalised email; no device key in v1.
- **AI credits ("Sparks"):** flat price per action, monthly allowance of 20 on free and 100 on Plus **[changed, was 150]**, SMS parsing never costs the user. Top-up packs are designed here but **not shipped in v1** (council 3 of 3).
- **Rails:** Apple IAP and Play Billing through RevenueCat. Web checkout later. No paid manual pilot: validate with the survey plus a free Plus preview granted through the `promo` source.
- **From the business review:** the price is not the problem, the paid plan's content and buyers' trust are. Simulated buyers stayed on free in all three markets. Four measured gates now sit in front of promoting the paid plan (section 10, row 17).
- **The finding that matters most for cost:** today's hidden limits would let one abuser burn about $10 to $16 a month. The new plan limits fix that whether or not anything is ever sold.

## 1. Facts this design rests on

**Users (live, 2026-11-15).** 47 accounts. Base currency: 30 EGP, 14 AED, 3 SAR, 1 USD (48 profile rows against 47 accounts; the extra row was not chased). Push tokens: 9 users on iOS, 2 on Android. Nine users had SMS in the last 30 days; the busiest had 72 messages. Payment methods per user among the 22 who have any: 15 have 3 or fewer, 7 have 4 or more.

**AI cost (table `ai_usage_events`, 2026-10-19 to 2026-11-15, 259 calls, 12 users).** Total $0.197. Top user (`6090c8e7`) $0.052 over 58 calls. Worst single user-day $0.021.

| Action | Calls | Avg cost | Max seen | Avg units |
|---|---|---|---|---|
| SMS AI fallback (flat settle, an estimate) | 150 | $0.00045 | $0.00045 | 1,500 |
| Legacy AI proxy (insights, categorise) | 32 | $0.0009 | $0.0024 | 2,285 |
| Budget AI | 28 | $0.0029 | $0.0056 | 4,968 |
| Voice (logged as $0; list price $0.00185 a minute) | 8 | about $0.0007 | about $0.0015 | 2,132 |
| Chat turn | 4 | $0.0023 | $0.0036 | 6,156 |
| Chat tool hop | 4 | $0.0012 | $0.0015 | 3,407 |
| Receipt scan | 2 | $0.0031 | $0.0032 | 5,467 |
| Grounded estimate (web search) | not separated | list $0.035 a prompt past a shared 1,500 a day free quota | | |

A chat message with its tool hops averages about $0.0035. One quota unit costs at most $0.000000625 (pure output on `gemini-2.5-flash`), so 1 million units is at most $0.63.

**The worst user today.** Defaults in `ai_default_limits()` allow 6,000,000 units per rolling 7 days, about 26 million a month, which is $10 to $16 of model cost for one account. The SMS path allows 100 AI calls a day ($1.35 a month). Nothing in the data shows anyone near this; it is what the limits permit.

**Store and tax (section 12 has sources).** Apple Small Business Program 15%. Google Play 15% on auto-renewing subscriptions in Egypt and the UAE (the 2026 fee changes cover the EEA, UK, US, Australia and Japan only so far). Apple collects 14% VAT in Egypt inside the shelf price. USD is about 54.5 EGP (range 53.9 to 55.5 this month).

Net to buddget from a shelf price P: `P / (1 + VAT) x 0.85`. Egypt VAT 14%, UAE 5%, KSA 15%.

## 2. Fit-test of the existing scaffold

| Part | Verdict | Reason |
|---|---|---|
| `plans` table (one row, `free`) | **Keep, extend** | Shape is right: key, limits json, features array, `trial_days`. Add the `plus` row and new limit keys. The price columns hold one currency in cents; treat them as an admin display anchor only. The paywall must show the store's own localized price. |
| `user_entitlements` (one row per user, 0 rows today) | **Keep, extend** | Statuses and sources already cover store billing (`apple`, `google`, `promo`, `loyalty`, `admin`). Missing: product id, store transaction id, renew flag, last applied event time. One row per user means a promo and a paid subscription cannot stack; accepted, with the rule in section 8. |
| `resolveEntitlements` (TypeScript) and `ai_effective_limits` (SQL) | **Keep, extend** | Two copies of one rule, already agreeing. Both need the S4 rules (`canceled` keeps access to period end, `past_due` 3-day grace). The SQL copy only passes keys that exist in `ai_default_limits()`, so new keys must be added there or they are silently dropped. |
| `requireFeature` and `PAID_FEATURES` | **Keep** | The right single server check. S6 adds keys. It can only guard things that have a server route (see the note under section 3). |
| AI quota meter (`ai_quota_reserve_v2`, settle, release, `ai_reservations`, `ai_usage_events`) | **Keep as the hidden safety layer** | Atomic, tested, already on every AI route. Units stay internal. Sparks sit on top as the user-facing meter. The default windows are far too high and are replaced by plan values. |
| Unit formula (`units.ts`: input 1, cached 0.1, output 4) | **Keep** | Output really costs 8.3 times input, so units understate output-heavy calls by up to 2 times. Fine for a safety layer; Sparks do not depend on it. |
| `ai_price_book` and `ai_cost_usd_micro` | **Extend** | Voice cost is logged as 0 although the price is in the book; grounded search has no price at all. Both are needed for an honest margin report. |
| `spendGuard` (global daily cap, SMS and receipt at 3 times) | **Keep** | The last line of defence if every per-user limit fails. |
| `LIMIT_CATALOG` | **Extend** | Has `sms_accounts_max` and `budget_plans_max` with `enforced: false`; S6 enforces them. Add `sparks_per_month` and `sms_ai_per_day`. `ai_chat_per_day`, `receipt_scans_per_month`, `voice_entries_per_day` stay unlimited: Sparks replace them. |
| `src/lib/sms/aiUsage.ts` (100 SMS AI calls a day, read then act) | **Replace** | The number moves to the plan (`sms_ai_per_day`) and the check moves to the atomic counter (S4 P2-22 already asked for this). |
| `loyalty_accounts`, `loyalty_ledger`, `loyalty_tiers` | **Keep untouched** | This is the third ledger. S5b designs on it. |
| Admin Plans view and `set_entitlement` | **Keep** | Already grants a plan with a status and end date. It writes `source: 'admin'`; the preview in section 7 needs `promo`, a one-word change in S6 or a direct SQL grant. |
| Billing webhook, purchase code, store products | **Do not exist** | Built in S6 from section 8 and S4 section 5. |

Nothing is replaced wholesale. The scaffold was built for this and survives contact with the design.

## 3. Freemium ladder

Rule: free is the complete loop (capture, categorise, budget, review, goals). Plus is more accounts on autopilot, more AI, and the deeper tools.

| Feature | Free | Plus |
|---|---|---|
| Manual expenses, income, transfers, categories | Unlimited | Unlimited |
| Accounts, cards, wallets, cash | Unlimited | Unlimited |
| **SMS auto-tracking** | **2 tracked accounts [changed, was 3]**. **[S5c]** An account is a bank or wallet account; cards under it come along; cash never counts | Unlimited |
| Budget: one active plan, manual builder, templates, month close | Yes | Yes |
| Saved budget plans (active plus drafts and archive) | 2 | Unlimited |
| Budget compare and stress test | No | Yes |
| Goals, debts, subscriptions, savings, net worth, paydays | Yes | Yes |
| Reports: the last 3 months **[changed, was 2]** | Yes | Yes |
| Advanced reports: any range, trends, year view | No | Yes |
| Data export **[changed, was Plus-only]** | Yes | Yes |
| Share one budget with a partner (not built; first Plus feature after launch) | No | Yes, when it ships |
| Second currency and FX | Yes | Yes |
| Buddgy chat, AI budget, receipt scan, voice, Explain my month | Yes, paid in Sparks (20 a month) | Yes, 100 Sparks a month |
| Local quick-add and common questions (no model call) | Free, no Sparks | Free, no Sparks |
| Live-price estimates (goal cost, emergency fund) | 3 a day (S4), 10 Sparks each | 10 a day, 10 Sparks each |
| Notifications, biometric lock, offline, sync, web and mobile | Yes | Yes |
| Support | Standard | Standard (priority support is not sold) |

Choices and why:

- **SMS is free but capped at 2 tracked accounts [changed].** The regex and template tiers cost nothing and the AI fallback costs $0.00045, so the cap is a value gate, not a cost gate. Paid-only SMS would hide the reason people install, and would weaken the Play permission story (SMS is the app's core use). SMS tracking is not unique: rivals already sell it in Egypt and the UAE (business review, section 3). At 3 accounts only 12% of simulated buyers would ever meet the cap; at 2, 30% do. Test 2 against 3 with real users.
- **Export and three months of reports are free [changed].** A new finance app cannot afford to look as if it holds a user's own data hostage; rivals are criticised for exactly that.
- **Every AI surface works on free.** One meter (Sparks) instead of five feature gates. A free user can try the receipt scanner, voice and the budget builder, and learns what Plus is by running out, not by reading a locked icon.
- **Second currency stays free.** A third of the testers are in the Gulf; for them it is part of the core loop.
- **One paid tier.** Two tiers double the paywall, the store products and the QA for no evidence of demand.

Enforcement note for S6: reports, export, stress test and the plan count are computed on the device from synced data, so they can only be gated in the UI (reading `/api/entitlements/me`). Accept that. Things with a server path are gated on the server: every AI route (already through `reserveAiQuota`), and the SMS account cap (a database trigger on `payment_methods.track_sms`, so no client can exceed it).

**[S5c] The cap, exactly.** `track_sms` defaults to true today on every payment method, cash included, so the trigger as first written would fire on every new account. Rule: one tracked account is a payment method with `track_sms` true, type not cash, not deleted or closed, and `parent_id` null. The column default becomes false. The trigger never blocks: at the cap it stores `track_sms = false`. Existing rows are left alone. Paywall sentence: "Free tracks 2 bank or wallet accounts; their cards come along; cash is always free."

**Over the cap.** Nothing is deleted, ever. A free user with more than 2 SMS accounts picks which 2 stay on; messages for the others are held for review for 30 days with one line explaining why. Extra saved plans become read-only. This applies at trial end and at subscription end.

## 4. Trial

| Option | For | Against |
|---|---|---|
| Store free trial (card first) | Store enforces one per account; converts well where cards work | Google's own Egypt page warns Egypt-issued cards "may be declined"; needs billing live first; most Egyptian users will not add a card to try an app |
| App's own no-card trial ("reverse trial") | No card; works on web, iOS and Android the same day; uses the existing `trialing` status | Abuse control is weaker than the store's |
| No trial | Nothing to build | New users never feel unlimited SMS or the full AI |

**Decision: the app's own trial, 14 days, no card, starts at signup.** Fourteen days spans at least one salary or a full run of card spending, which is when SMS tracking shows its value.

- **Unlocked:** everything in Plus, with a trial allowance of 60 Sparks (not 100).
- **Written as:** `user_entitlements` row `plan_key = 'plus'`, `status = 'trialing'`, `source = 'default'`, `trial_ends_at = now + plans.trial_days`. The resolver already drops a lapsed trial to free with no background job.
- **Abuse control.** The owner's rule is "tied to store purchase history, not email". That is only possible for a store offer, so the design splits it:
  - **[S5c] No device key in v1 (council 4 of 4).** DeviceCheck bits survive resale, so a second-hand iPhone would be refused; the Android app set ID resets on reinstall; the web has no key at all. The trial is granted on the server once per normalised email (lower case; for Gmail drop dots and anything from `+`), only after a verified sign-in (Google, Apple or a confirmed email code). A signup limit and a daily count of trials granted go in with it. Device checks are added later only if that count shows abuse.
  - The loss if someone beats it is bounded: at most about $0.49 of model cost per account on the `plus_trial` limits (**[S5c]**, was "about $0.20"), and 14 days of unlimited SMS accounts. A new account starts with empty data.
  - Anything with money value (the intro price below) goes through the store, which enforces one per Apple or Google account.
- **[S5c] Not built in v1.** Apple can end an introductory offer on a set date; Google Play cannot (offers are switched off by hand or by an API call and buyers keep their terms). Council 3 of 3 voices: launch without it. The paragraph below is kept as the spec if the owner reinstates it (conditions in the review, section 15).
- **Founding price at launch [changed, was phase 2]:** the annual plan at EGP 399, AED 79.99 or SAR 79.99 for the first year, as a store introductory offer, only during the first 60 days after public launch (the founding-member window S5b defines), then removed. Apple allows one intro offer per person per subscription group; Google's standard offers go only to users who never had the subscription. If S6 cannot schedule and remove it safely in both stores, launch without it.

**Conversion prompts** (reuse the existing prompt-stack registry and sheet components; at most one prompt a day; never during money entry):

**[S5c] Wording.** Call it "14 days of Plus, no card", never "free trial" beside a price (on both stores that phrase means a store trial that charges at the end). Say that nothing is charged and nothing is deleted.

1. Day 1: one card, "You have Plus for 14 days", three bullets.
2. Day 12 **[changed, was a day-10 summary]**: "What Plus found in your last 30 days", built from the user's own data (accounts tracked, where the money went, the year so far), so the end of the trial is felt.
3. Day 13: what changes tomorrow, in plain words, with the account picker if they are over 2.
4. Day 14: drop to free; the paywall is one tap away, not forced.
5. After that, only in context: turning on a 3rd SMS account, running out of Sparks, tapping compare, stress test or an advanced report.

Store rules for the paywall (S9 owns the copy): price and period shown, auto-renew wording, Restore Purchases, links to terms and privacy.

## 5. AI credits: Sparks

**Name.** "Sparks" (working name; owner picks). Chosen because it is not a money word: a finance app that shows "coins", "points" or "credits" next to real balances invites confusion. Alternatives: Boosts, Buddgy Energy. Arabic wording is the owner's call.

**What one Spark is.** A flat price per action, not metered tokens. Users can predict it; the hidden unit windows still catch abnormal calls.

| Action (quota feature key) | Sparks | Avg cost | Cost per Spark |
|---|---|---|---|
| Buddgy message, tool hops included (`chat`; `chat_hop` is 0) | 1 | $0.0035 | $0.0035 |
| Voice entry (`voice`) | 1 | $0.0007 | $0.0007 |
| Insight or categorise call (`proxy`) | 1 | $0.0009 | $0.0009 |
| Receipt scan (`receipt`) | 2 | $0.0031 | $0.0016 |
| Budget AI build or adjust (`budget`) | 2 | $0.0029 | $0.0015 |
| Estimate without live prices (`goals`) | 1 | about $0.001 | $0.001 |
| Estimate with live prices (`goals`, grounded) | 10 | $0.035 list | $0.0035 |
| SMS AI fallback (`sms`) | **0** | $0.00045 | n/a |
| Local fast path, anything with no model call | 0 | 0 | n/a |

- **SMS never costs Sparks.** It runs in the background, the user neither sees nor chooses it, and charging for it would turn the hero feature into silent loss. It has its own hidden cap, `sms_ai_per_day` (free 20, Plus 30). Past the cap a message is held for review, not dropped. **[S5c]** The cap counts model calls, not messages (one message makes about 2 calls, up to 4), and SMS calls are taken out of the unit windows so SMS and Buddgy cannot starve each other: `sms_ai_calls_per_day` (free 30, trial 60, Plus 60) and `sms_ai_calls_per_month` (free 150, trial 250, Plus 450). Today a quota denial marks the row failed; S6 makes it a held message.
- A failed call costs nothing. **[S5c]** Sparks are taken when a call settles `ok`, or `aborted` with output tokens above zero (otherwise cutting a stream just before its end is a free answer). An error, a release, or an abort with no output is free.

**Allowance.**

| Plan | Sparks a month | Reset |
|---|---|---|
| Free | 20 | First of the month, UTC |
| Trial | 60 for the 14 days | Ends with the trial |
| Plus | 100 **[changed, was 150]** | On each renewal date (monthly); annual subscribers reset monthly from the purchase date |

Unused allowance expires at reset. No carry-over. The busiest tester made 61 AI calls in a month with SMS parsing included (which costs no Sparks), so 100 is still above real heavy use; 55 of 60 simulated buyers said even 20 would be enough.

**Three ledgers, kept apart.**

| Ledger | What it holds | Expires | Cash value | Table |
|---|---|---|---|---|
| 1. Allowance | Plan, trial and bonus Sparks | Yes, at period end | None | `spark_allowances` (new) |
| 2. Purchased | Sparks bought as consumable packs | Never | Yes: a liability until spent; refundable through the store | `spark_purchases` (new, phase 2) |
| 3. Loyalty | Points | S5b decides | None, not transferable | `loyalty_ledger` (exists) |

- **Spend order:** allowance first (soonest expiry first: trial, plan, bonus), then purchased, oldest pack first. Apple requires subscription credits to be used before purchased ones.
- **Loyalty never touches ledger 2.** If S5b lets points turn into Sparks, they arrive as a `bonus` row in ledger 1 with an expiry. A reward must never create purchased-type balance, or free points would become a refundable liability.
- Purchased Sparks cannot be transferred, gifted, cashed out or used outside buddget (Google requires in-app currency to stay in the app).

**Top-up packs: designed, not in v1.** Council 3 of 3 against shipping them now: total AI cost is $0.20 a month, and packs bring a liability ledger, refund clawback, two more store products and Apple's credit rules, for pennies. The schema in section 8 leaves the slot open so adding them later is one migration and two products, not a redesign.

Spec for when they ship (trigger: in any month, 10% of Plus subscribers use over 80% of their allowance, or users ask):

| Pack | Egypt | UAE | Net (Egypt) | Avg cost | Worst cost (all chat) |
|---|---|---|---|---|---|
| 100 Sparks | EGP 69 | AED 9.99 | $0.94 | $0.20 | $0.35 |
| 300 Sparks | EGP 179 | AED 24.99 | $2.45 | $0.60 | $1.05 |

- **Plus subscribers only.** Keeps the subscription as the main path and the liability small.
- **Never expire.** Apple's rule is that credits bought by IAP "may not expire". Its new exception for generative AI apps needs a special entitlement, a 12-month minimum, the term on the paywall, and reminder emails 30 and 7 days before expiry. Not worth it.
- **Caps:** balance at most 1,000 purchased Sparks; at most 3 pack purchases a day.
- **Refund:** unspent Sparks from that pack are removed; spent ones are not chased; a second refund in 90 days turns packs off for that account.
- A lapsed subscriber keeps purchased Sparks and can spend them on free.

**Hidden caps under the Sparks (plan `limits`, enforced by the existing reserve function).**

| Key | Today (default) | Free | Plus |
|---|---|---|---|
| `sparks_per_month` (new) | none | 20 | 100 |
| `ai_units_5h` | 600,000 | 40,000 | 120,000 |
| `ai_units_24h` | 1,500,000 | 60,000 | 200,000 |
| `ai_units_7d` | 6,000,000 | 200,000 | 450,000 |
| `ai_req_per_min` | 30 | 10 | 20 |
| `sms_ai_per_day` (new) | 100 (in code) | 20 | 30 |
| **[S5c]** replaces the row above: `sms_ai_calls_per_day` | 100 log rows (in code) | 30 | 60 |
| **[S5c]** `sms_ai_calls_per_month` (new) | none | 150 | 450 |
| `grounded_per_day` | 3 | 3 | 10 |
| `sms_accounts_max` | unlimited, not enforced | 2 | unlimited |
| `seats` (new, for a later household plan) | none | 1 | 1 |
| `budget_plans_max` | unlimited, not enforced | 2 | unlimited |

**[S5c]** A third column exists in the review (section 14): the `plus_trial` plan (60 Sparks, 60,000 / 100,000 / 300,000 units, 20 a minute, SMS calls 60 a day and 250 in the trial). The global daily spend cap is not set today; S6's first migration sets `ai_spend_guard.dailyCapUsd` to 5.

**Worst user, modelled first.**

| Case | Model cost a month | Revenue (net) | Result |
|---|---|---|---|
| Today, one abuser at the default limits | $10 to $16 | $0 | The real exposure. Closed by the table above. |
| Free, all 20 Sparks on chat | $0.07 | $0 | Fine |
| Free, 20 forged SMS a day hitting the AI tier all month | $0.27 | $0 | Needs a stolen or own ingest token; capped |
| Free, both of the above | $0.34 | $0 | Ceiling for a free account |
| Trial abuser, new device each time | $0.20 per cycle | $0 | Bounded |
| Plus, all 100 Sparks on chat at average cost | $0.35 | Egypt: $0.94 monthly plan, $0.57 a month on annual | Positive |
| Plus, 100 Sparks all on live-price estimates at list price | $0.35 | same | Positive; needs 10 estimates |
| Plus, 100 Sparks on chat and the SMS AI cap hit every day | $0.75 | same | Loses $0.18 a month on an Egypt annual plan; needs deliberate abuse of both caps |
| Plus, pathological long outputs up to the 7-day unit cap | at most $1.20 | same | Loses up to $0.50 a month on one account. Rare by construction; watch it in admin, do not design for it |
| Plus, typical (twice today's heaviest tester, who cost $0.05) | $0.10 | same | About 90% gross margin on the monthly plan |

**[S5c] Corrected ceilings.** The table above is too low on its abusive rows: the legacy proxy route lets one Spark cost about $0.04, so the unit windows set the ceiling, not the Sparks. On the revised limits: free at most $0.61 a month (was $0.34), a trial account $0.49 (was $0.20), Plus $1.42 (was $1.20). The Egypt annual case at both caps was understated (it is $1.16 at the measured 2 calls a message, not $0.75); with the monthly SMS call cap it becomes $0.55 against $0.57. Typical use is unchanged at $0.07 to $0.10.

Credits here are a fairness and upsell device, not cost recovery. The margin check passes with room at every realistic level.

## 6. Prices

| Market | Monthly | Annual | Annual vs 12 months | Net monthly | Net annual |
|---|---|---|---|---|---|
| Egypt (EGP) **[changed]** | 69 | 499 | 40% off | EGP 51.4 ($0.94) | EGP 372.1 ($6.83) |
| UAE (AED) **[changed]** | 14.99 | 99.99 | 44% off | AED 12.13 ($3.30) | AED 80.94 ($22.04) |
| Saudi Arabia (SAR) **[changed]** | 12.99 | 99.99 | 36% off | SAR 9.60 ($2.56) | SAR 73.91 ($19.71) |
| Rest of world (USD anchor) | 4.99 | 39.99 | 33% off | $4.24 before local tax | $33.99 |

Was: Egypt 79 / 599, UAE and Saudi 14.99 / 119.99. Founding price, first 60 days, annual only: EGP 399, AED 79.99, SAR 79.99 for the first year. **[S5c] Not built in v1.** For the record its net is $5.46, $17.63 and $15.77 a year.

- **Why 69 and 499 in Egypt.** The one direct rival that reads bank SMS sells at EGP 89.99 a month and 499.99 a year; other budgeting apps list about EGP 240 to 250. The simulated panel's acceptable range was EGP 25 to 90 with indifference near 45, and the annual plan works out at EGP 41.6 a month. It also sits under Spotify (79), Anghami (90) and YouTube Premium (115).
- **Why the Gulf prices differ from Egypt's and from each other.** UAE rivals run AED 8.99 to 29.99 a month (median 19.99); Saudi rivals SAR 12.99 to about 65. The panel's ranges were AED 5 to 25 and SAR 5 to 20. Saudi VAT is 15% against 5%.
- **Prices to test with real buyers:** Egypt 49 and 79; UAE 9.99 and 19.99; Saudi 9.99 and 14.99. One market at a time, by revenue per paywall view.
- **Why the annual discount is steep.** It pulls people to one payment, which matters where card renewals fail.
- **Dissent kept:** the council's Pragmatist wanted EGP 99 / 799. The business review moved the other way; neither is proven.
- **Promise and guarantee [new]:** a subscriber's price does not rise for 12 months. Annual plan: unhappy in the first 30 days, tell us; on Google Play we refund directly, on the App Store we back the request to Apple and add six months free if Apple declines.
- **[S5c] Reworded (council 4 of 4).** No "guarantee" word and no six months: "Changed your mind within 30 days of buying the annual plan? On Android, tell us and we refund you. On iPhone, Apple handles refunds: we show you how to ask, and if Apple says no we add 3 months to your plan." Apple lets a developer extend a renewal date by at most 90 days, twice a year. It is a support action, once per subscription; S6 builds nothing for it. The price promise is keepable on both stores as written.
- **[S5c] Showing the annual price.** Google requires that an annual plan does not show its monthly equivalent most prominently. The paywall leads with the yearly amount.
- **Devaluation.** Review the EGP price every quarter. A rise for existing subscribers needs their consent in both stores; new subscribers can simply get the new price.
- **Fees assumed:** Apple 15% (requires enrolling in the Small Business Program; owner action), Google 15%, RevenueCat $0 under $2,500 tracked revenue a month, then 1%.
- **Break-even [new]:** fixed costs are about $58 a month (business review, section 6). Contribution per subscriber-month is about $0.69 in Egypt, $2.50 in the UAE and $2.03 in Saudi Arabia; blended $1.31; break-even about 44 subscribers. **[S5c]** Rounded up it is 45 (Egypt-only 85, UAE-only 24, Saudi-only 29). It also leaves out free users: at 2% paying each subscriber carries 49 free users at about $0.01 a month each, so the real figure is about 71. Apple's 15% starts 15 days after the end of the month in which Small Business Program enrolment is approved.

Store products (S6 creates them):

| Store | Product | Id |
|---|---|---|
| App Store | Subscription group "buddget Plus" | `plus_monthly`, `plus_annual` |
| Play | Subscription `plus` | base plans `monthly`, `annual` |
| Both, phase 2 | Consumables | `sparks_100`, `sparks_300` |

Family Sharing off. No lifetime product. **[S5c]** No introductory offer in either store. RevenueCat restore behaviour is "Keep with original App User ID", so one store subscription cannot be passed between app accounts.

## 7. Payment path

**Inside the apps: Apple IAP and Play Billing only.** Both stores require it for subscriptions and for in-app currency. **[S5c]** Confirmed on both stores' pages today: neither allows it in Egypt, the UAE or Saudi Arabia. In the app there is no link, button or wording that points at another way to pay (Apple allows that only on the US storefront; Google only in listed regions, and Egypt and the UAE are not among them).

**RevenueCat or direct: RevenueCat.** Council 4 of 4.

| | RevenueCat | Direct StoreKit 2 + Play Billing |
|---|---|---|
| Build | One Capacitor plugin, one webhook | Two native integrations, two notification formats (Apple signed JWS, Google Pub/Sub), receipt checks, grace, retries, upgrades |
| Cost | $0 to $2,500 a month tracked, then 1% | $0 |
| Risk | A vendor in the money path; pricing can change | The highest-risk code in the app written by hand, twice |
| Exit | Store products belong to buddget; the entitlement table is ours, so leaving means writing the direct integration later | n/a |

RevenueCat owns subscription state and trial eligibility. **buddget's database owns Sparks**, because the spend has to happen in the same transaction as the quota reservation. RevenueCat's own virtual currency feature is not used.

**Web.** At launch the web app shows the plan and says Plus is bought in the mobile app. A Plus bought on a phone works on web through the same account. Web checkout through Paymob or Fawry (cards, wallets, cash at a kiosk; about 2.75% plus EGP 3 against 15%) is legal for purchases made on the web and is the answer if store cards keep failing in Egypt, but it is a third rail with its own refunds and tax and is not built now. InstaPay is person-to-person; no merchant collection rules were found.

**What InstaPay, Fawry and Paymob may cover:** purchases started and finished on the website, by people who chose to go there, never advertised inside the iOS or Android app. They may not unlock anything from inside the apps.

**Cheapest validation first.** The plan suggested manual entitlements paid by InstaPay or Fawry. The council rejected the paid part 3 of 3, and so do the rules:

- TestFlight builds may not be given to testers "in exchange for compensation of any kind".
- Apple forbids an app's "own mechanisms to unlock content or functionality".
- The testers are the owner's circle. A payment from them measures goodwill, not demand.

So validation is three steps, none needing billing code:

1. **Survey** (section 9), sent to all 45.
2. **Free Plus preview.** Grant every tester `plan_key = 'plus'`, `status = 'active'`, `source = 'promo'`, `current_period_end` = launch day, after S6 seeds the plan and limits. Then read real use from `ai_usage_events` and the account counts: who goes past 3 SMS accounts, who spends more than 20 Sparks, who opens export or advanced reports. That is the evidence for where the free line sits.
3. **One real purchase by the owner** on an Egyptian card and on carrier billing in each store's test track, including one renewal, before any tier is published. If Egyptian cards fail at renewal, annual plans and carrier billing move to the front and web checkout moves up the list.

The first real price signal is store conversion after launch.

## 8. Mapping onto the live database (for S6)

Order: migration, apply, regenerate types, then code. Every statement below is a proposal; none has been run.

**1. `plans`.** Update `free.limits` and insert `plus`.

```
free.limits  = { ai_budget_per_hour: 15, sparks_per_month: 20, sms_accounts_max: 2, budget_plans_max: 2, seats: 1,
                 sms_ai_per_day: 20, grounded_per_day: 3,
                 ai_units_5h: 40000, ai_units_24h: 60000, ai_units_7d: 200000, ai_req_per_min: 10 }
plus         = { key: 'plus', name: 'Plus', status: 'active', trial_days: 14, sort_order: 1,
                 features: ['advanced_reports', 'budget_compare', 'budget_stress_test'],
                 limits: { sparks_per_month: 100, sms_accounts_max: null, budget_plans_max: null, seats: 1,
                           sms_ai_per_day: 30, grounded_per_day: 10,
                           ai_units_5h: 120000, ai_units_24h: 200000, ai_units_7d: 450000, ai_req_per_min: 20 } }
```

**[S5c]** Section 14 of the review replaces the two limit objects above: `sms_ai_per_day` becomes `sms_ai_calls_per_day` and `sms_ai_calls_per_month`, and a third row `plus_trial` is added (same features as `plus`, its own limits, no store products). `grounded_per_day` must also be added to `ai_default_limits()`; it is missing there today.

New column `plans.store_products jsonb` mapping `{ app_store: {monthly, annual}, play_store: {...} }`. Price columns stay as admin display anchors (`currency = 'EGP'`, 6900 and 49900). `data_export` is no longer a paid feature. Reserve the feature key `shared_budget` and the limit key `seats` now: a later household plan is then one more `plans` row and one more product in the same store subscription group, with no schema change.

**2. `user_entitlements`.** Add `product_id text`, `store text` (`app_store`, `play_store`), `store_original_txn text` (unique where not null), `will_renew boolean`, `last_event_at timestamptz`. The `source` check already has `apple`, `google`, `promo`, `loyalty`; no change.

Row rule (one row per user): a store event always wins over `default`, `promo` and `loyalty`. A promo or loyalty grant to someone with a live store subscription is not written to this row; give them bonus Sparks instead. The webhook never touches `limit_overrides` or `feature_overrides`. When a plan lapses, overrides stay (they are staff decisions); S4 section 5 item 4 is answered that way.

**3. Resolver and `ai_effective_limits`.** Apply S4's rules in both, with the one shared test table S4 asked for: `canceled` grants the plan until `current_period_end`; `past_due` grants it until `current_period_end` plus 3 days. Add `sparks_per_month`, `sms_ai_per_day`, `grounded_per_day`, `sms_accounts_max`, `budget_plans_max` to `ai_default_limits()` (the SQL merge ignores unknown keys) and to `LIMIT_CATALOG`. Add `budget_compare` and `budget_stress_test` to `FEATURE_CATALOG`.

**4. `billing_events` (new).** `provider`, `event_id` (unique), `type`, `user_id`, `event_at`, `received_at`, `applied`. Insert first, process only if the insert won; skip an event older than `user_entitlements.last_event_at`. This is the idempotency table from S4 section 5. Log id and type, never the payload.

**5. Webhook** `POST /api/billing/revenuecat`, service role only. RevenueCat app user id is the Supabase user id, set by the server at login. Check the `Authorization` secret with a constant-time compare (RevenueCat also offers an HMAC header over `timestamp.body`; use it if available on the plan, with the 5-minute window from S4).

| RevenueCat event | Write |
|---|---|
| `INITIAL_PURCHASE`, `RENEWAL`, `UNCANCELLATION`, `PRODUCT_CHANGE` | `status = 'active'`, `plan_key = 'plus'`, `source` by store, `current_period_end` = expiry, `will_renew = true`; open a new Sparks period. **[S5c]** Only `INITIAL_PURCHASE` and `RENEWAL` open a Sparks period, and at most one `plan` row exists per user per period (monthly: the store period; annual: the monthly anniversary of purchase). `UNCANCELLATION` and `PRODUCT_CHANGE` never grant Sparks, or cancelling and un-cancelling would mint them |
| `CANCELLATION` (not a refund) | `status = 'canceled'`, `canceled_at`, `will_renew = false`; access runs to period end |
| `CANCELLATION` with a refund reason | `status = 'expired'` now; purchased Sparks from a refunded pack removed. **[S5c]** RevenueCat's refund signal is `cancel_reason = CUSTOMER_SUPPORT`. Also end the open `plan` allowance row now. `REFUND_REVERSED` restores both |
| `BILLING_ISSUE` | `status = 'past_due'`. **[S5c]** Access lasts until the store grace expiry RevenueCat reports (store grace set to 3 days on Apple, 7 on Google); 3 days after the period end is only the fallback |
| `EXPIRATION` | `status = 'expired'` |
| `SUBSCRIPTION_PAUSED` (Play) | `status = 'paused'` |
| `TRANSFER` | move the row to the new user id, expire the old one. **[S5c]** Should not occur with restore behaviour "Keep with original"; if it does, it grants no Sparks |
| `NON_RENEWING_PURCHASE` (phase 2 packs) | insert `spark_purchases` keyed on the store transaction id |

A nightly reconcile job asks RevenueCat for every row whose `current_period_end` passed more than a day ago and is still `active` or `past_due`. Answer 2xx only after the write commits; RevenueCat retries 5 times over about 80 minutes. **[S5c]** Confirmed today: events carry `id` and `event_timestamp_ms`, and an HMAC header `X-RevenueCat-Webhook-Signature` over the timestamp and raw body is available; use both it and the `Authorization` secret.

**6. Trial.** At signup the server (the existing `handle_new_user` path or the first authenticated call) inserts the `trialing` row if the device has no claim. New table `trial_claims`: `device_key_hash` (unique), `user_id`, `platform`, `claimed_at`. Web signups get the trial once per account (no device key); the loss is bounded as in section 4. **[S5c]** `trial_claims` is `email_key text unique`, `user_id`, `claimed_at`; no device key. The row written is `plan_key = 'plus_trial'`, and only after a verified sign-in.

**7. Sparks.**

- `spark_prices`: `feature` (primary key), `sparks`. Seeded from the table in section 5; `goals_grounded` is its own key. Editable in admin without a deploy.
- `spark_allowances` (ledger 1): `id`, `user_id`, `kind` (`plan`, `trial`, `bonus`), `granted`, `used`, `period_start`, `period_end`, `ref` (plan key, or the loyalty ledger id for a bonus). A free user's row for the month is created on first use. Unique on (`user_id`, `kind`, `period_start`).
- `spark_purchases` (ledger 2, phase 2, create the table now, leave it empty): `id`, `user_id`, `store`, `store_txn` (unique), `product_id`, `sparks`, `remaining`, `price_micros`, `currency`, `purchased_at`, `refunded_at`. Outstanding liability is `sum(remaining)` where not refunded.
- `spark_spend` (append-only): `user_id`, `reservation_id`, `feature`, `sparks`, `allowance_id` or `purchase_id`, `created_at`.
- `ai_quota_reserve_v2` gains one step: look up the price, check that allowance plus purchased covers it, hold it on the reservation (new column `ai_reservations.sparks`). New denied layer `sparks` (HTTP 429, with the reset date) so the client can show the upgrade sheet. `ai_quota_settle` with status `ok` writes `spark_spend` and increments `used` in spend order; error and release write nothing.
- `ai_quota_status` returns `{ sparks_left, sparks_total, resets_at, purchased_left }` for the balance line in Settings and in the chat header.
- **[S5c]** `spark_spend` has a check that exactly one of `allowance_id` and `purchase_id` is set. When a unit window (not Sparks) denies a call, the client shows the reset time and no upgrade sheet.
- All four tables: row security on, users may select their own rows, writes by service role only.

**8. Enforcement points.**

| Gate | Where |
|---|---|
| Sparks and unit windows | `ai_quota_reserve_v2`, already called by every AI route |
| SMS AI per day | The SMS parse route, through the atomic counter (replaces `aiCallsToday`). **[S5c]** Counted inside `ai_quota_reserve_v2` as model calls per rolling 24 hours and 30 days; `sms` is excluded from the three unit windows; a denial holds the message and answers the phone 2xx |
| SMS account cap | Trigger on `payment_methods` when `track_sms` becomes true: count for the user against `sms_accounts_max` from `ai_effective_limits`. **[S5c]** Counts top-level, non-cash accounts; sets the flag false at the cap and never raises (section 3) |
| Advanced reports (beyond 3 months), compare, stress test, plan count | UI, from `/api/entitlements/me`; add the keys to `PAID_FEATURES` for any that get a server route |

**9. Cost truth.** `ai_price_book`: add `per_call_usd` and a row for grounded search ($0.035); make `ai_cost_usd_micro` charge audio by seconds (units divided by 100). Without this the admin margin view under-reports voice and search.

**10. Loyalty (for S5b).** No schema change from S5a. Constraint: a loyalty reward may write a `bonus` row in `spark_allowances` or set a time-boxed `loyalty` entitlement for a user with no store subscription. It may never write `spark_purchases`.

## 9. Willingness-to-pay survey (ready to send, not sent)

Send as a form link in the testers' channel. Anonymous, 3 minutes. English first, Arabic under it.

**Intro.** We are deciding what stays free in buddget and what a paid plan would cost. Your honest answers matter more than kind ones. Nothing here commits you to anything.
نحدد الآن ما الذي سيبقى مجاناً في buddget وكم ستكون تكلفة الاشتراك. إجابتك الصريحة أهم من المجاملة، ولا يترتب عليها أي التزام.

1. Which country do you live in? (Egypt / UAE / Saudi Arabia / other)
   في أي بلد تعيش؟
2. Which phone do you use buddget on? (iPhone / Android / web only)
   على أي جهاز تستخدم buddget؟
3. How many bank accounts, cards and wallets do you actively use? (1 / 2 / 3 / 4 / 5 or more)
   كم حساباً بنكياً وبطاقة ومحفظة تستخدمها فعلياً؟
4. How do you track your money in buddget today? (SMS auto-tracking / I type it / voice / receipt photo / I mostly do not) Pick all that apply.
   كيف تسجل مصروفاتك اليوم؟ (الرسائل تلقائياً / أكتبها / الصوت / صورة الإيصال / لا أسجل غالباً)
5. If buddget disappeared tomorrow, how would you feel? (very disappointed / somewhat / not disappointed)
   لو اختفى buddget غداً، كيف ستشعر؟ (محبط جداً / إلى حد ما / لا يهمني)
6. Pick the 3 you would miss most: automatic SMS tracking / Buddgy chat / AI budget builder / receipt scan / voice entry / reports / goals / debts and installments / export.
   اختر أكثر 3 ستفتقدها.
7. Which apps or services do you pay for monthly today? (free text, for example music, video, cloud storage)
   ما التطبيقات أو الخدمات التي تدفع لها شهرياً الآن؟
8. A plan with unlimited SMS accounts, much more AI, advanced reports and export. At what monthly price would it be **so cheap you would doubt its quality**? (number, your currency)
   عند أي سعر شهري ستراه رخيصاً لدرجة الشك في جودته؟
9. At what monthly price would it be **a good deal**?
   عند أي سعر شهري ستراه صفقة جيدة؟
10. At what monthly price would it **start to feel expensive, but you would still consider it**?
    عند أي سعر شهري سيبدأ يبدو غالياً لكنك قد تفكر فيه؟
11. At what monthly price is it **too expensive to consider**?
    عند أي سعر شهري يصبح غالياً لدرجة أنك لن تفكر فيه؟
12. Would you rather pay monthly, or once a year for about 4 months free? (monthly / yearly / neither)
    هل تفضل الدفع شهرياً أم مرة في السنة مع نحو 4 أشهر مجاناً؟
13. How would you pay? (card in the App Store or Google Play / phone credit / wallet such as Vodafone Cash / InstaPay / Fawry / I would not pay online)
    كيف ستدفع؟ (بطاقة في المتجر / رصيد الهاتف / محفظة / إنستاباي / فوري / لن أدفع عبر الإنترنت)
14. Has a card payment in the App Store or Google Play ever failed for you? (yes / no / never tried)
    هل فشلت معك عملية دفع بالبطاقة في المتجر من قبل؟
15. What one thing would make you pay for buddget? (free text)
    ما الشيء الواحد الذي سيجعلك تدفع مقابل buddget؟

Reading it: questions 8 to 11 are the standard four price questions; the acceptable range is between where "too cheap" crosses "expensive" and where "good deal" crosses "too expensive". Split by country. With about 30 answers, treat it as a sanity check on EGP 69, not as proof, and cut stated willingness roughly in half (friends answer generously). Question 5 at 40% "very disappointed" or more is the usual sign the product is ready to charge. Questions 13 and 14 decide how urgent carrier billing and web checkout are.

## 10. Owner decisions

Each has the architect's recommendation and the council's vote. The owner picks.

| # | Decision | Recommendation | Council |
|---|---|---|---|
| 1 **[changed]** | SMS auto-tracking on free | Free, capped at **2** tracked accounts (was 3); unlimited on Plus. Test 2 against 3 with real users. **[S5c]** An account is a bank or wallet account with its cards; cash never counts (council 3 of 4; Skeptic: count banks) | Council: capped 3 of 4. Board split: Offers lens 1, Product lens 3, Monopoly lens no cap |
| 2 | Number of paid tiers | One, "Plus". A household plan later, when partner sharing ships and 20% of subscribers use it | Council 4 of 4; the panel's one-tier and two-tier results were the same; 13 of 20 competitors have one tier |
| 3 **[changed]** | What Plus contains | Section 3 table. Export and 3 months of reports move to free. Partner sharing is the first Plus feature to build after launch. All AI surfaces stay usable on free through Sparks; second currency stays free; priority support is not sold | Tier list 4 of 4. Pragmatist and Critic would make receipt, voice and the AI builder Plus-only; the architect keeps them metered on free so one meter replaces five gates |
| 4 **[changed]** | Launch markets | Egypt, UAE and Saudi Arabia priced by hand; **marketed only where bank coverage has been measured**, Egypt first | Board: Monopoly lens wants Egypt only until proven |
| 5 **[changed]** | Price | EGP 69 / 499; AED 14.99 / 99.99; SAR 12.99 / 99.99; USD 4.99 / 39.99 (was EGP 79 / 599, AED and SAR 14.99 / 119.99) | Council had EGP 79, 3 of 4. Board 3 of 3: price is not the binding problem |
| 6 | Trial | App's own 14-day no-card trial at signup, 60 Sparks, once per account and device. **[S5c]** Once per verified, normalised email; no device key in v1 (council 4 of 4) | 3 of 4. Skeptic dissents: no trial, free is the trial |
| 7 **[changed]** | Opening offer | A founding price on the annual plan for the first 60 days (EGP 399, AED 79.99, SAR 79.99), then removed; no other intro offer. **[S5c] Not in v1** (council 3 of 3 voices; the owner can reinstate it under the review's section 15) | Council had said no intro offer at launch, 4 of 4. Changed on the business review; S5c to check |
| 8 | Credits name | "Sparks" | Not voted. Critic would ship v1 with no branded name |
| 9 | Credit pricing | Flat per action (section 5); SMS never costs Sparks | 4 of 4 |
| 10 **[changed]** | Allowance | Free 20, trial 60, Plus **100** a month (was 150), no carry-over | Council 4 of 4 on 20; 55 of 60 simulated buyers said 20 is enough |
| 11 | Top-up packs | Not in v1. Create the empty table now; ship packs when 10% of subscribers pass 80% of their allowance. Then: Plus only, never expire, 100 for EGP 69, 300 for EGP 179 | 3 of 3 voices against packs at launch. **This departs from the owner brief**, which asked for packs; the architect changed position on the council's argument |
| 12 | Lower the hidden AI limits now | Yes, in S6's first migration, before anything is sold | 4 of 4. This is the one item with real money at risk today |
| 13 | Billing provider | RevenueCat | 4 of 4 |
| 14 | Web checkout (Paymob, Fawry) | Later; first see whether Egyptian cards fail in the stores | 4 of 4 |
| 15 | Validation before billing | Survey, then a free Plus preview for all testers through `promo`, then one real owner purchase and renewal on an Egyptian card. No paid manual pilot | 3 of 3 against a paid pilot. Departs from the plan's InstaPay idea, for the reasons in section 7 |
| 16 **[changed]** | Annual discount | 40% in Egypt, 44% in the UAE, 36% in Saudi Arabia | Range across council voices 21% to 37%; deeper now so the annual plan is the one to buy |
| 17 **[new]** | Gates before the paid plan is promoted | (1) a published list of Egyptian banks with measured accuracy; (2) 40% of testers who switch SMS on see a first automatic transaction within 10 minutes; (3) at least 5 of 47 testers say they would buy the annual plan after the Plus preview; (4) if under 2% of active users pay by day 60, reopen the free line before the price. **[S5c]** Gates 1, 2 and 4 are given exact measures and gate 3 becomes behaviour (at least 5 testers pass a free limit in real use on 2 or more days), in the review's section 9 | Board 3 of 3; S5c council 4 of 4 on gate 3 |
| 18 **[new]** | Promise and guarantee | 12-month price promise; 30-day annual-plan guarantee worded within store rules. **[S5c]** The word "guarantee" is dropped; plain refund wording with 3 months added if Apple declines (section 6) | Offers lens; S5c council 4 of 4 |
| 19 **[new]** | Pay-once (lifetime) price | Not at launch; revisit after 90 days of paywall data | 12 of 60 simulated buyers asked for it; none took it when offered |

Owner actions that are not choices: enrol in the Apple Small Business Program; authorise the RevenueCat connector when S6 starts; send the survey.

## 11. What the council changed

This section records the first council round. The business review later moved the price, the opening offer and the SMS cap again; see the **[changed]** rows in section 10.

- **Packs moved out of v1** (architect had them at launch).
- **Store intro price moved to phase 2** (architect had it at launch).
- **Price settled at 79**, not 99 (architect leaned 99 for worst-user margin; the cost data does not need it).
- **Live-price estimate priced at 10 Sparks**, not 5 (Critic: at list price 5 was a loophole).
- **Paid manual pilot dropped.**
- Raised by the voices and adopted: test a real Egyptian card purchase and renewal before trusting subscriptions (Skeptic); carrier billing may be the best-converting method in Egypt (Pragmatist); the dangerous failure is the downgrade cliff, so nothing is deleted and over-cap SMS is held, not dropped (Critic); webhook idempotency keyed on the store transaction plus a reconcile job (Critic).
- Rejected with reason: Skeptic's "no trial". The free tier caps SMS accounts and Sparks, so without a trial a new user never sees what Plus is.

## 12. Sources checked (2026-11-15)

Read directly today unless marked.

- Apple, App Review Guidelines, sections 2.2, 3.1.1, 3.1.1(a), 3.1.2(a), 3.1.3, 3.2.2: https://developer.apple.com/app-store/review/guidelines/ (section 3 wording came through a summary of the page, not verbatim)
- Apple, expiring consumables for generative AI apps: https://developer.apple.com/in-app-purchase/expiring-consumables/
- Apple, Small Business Program: https://developer.apple.com/app-store/small-business-program/
- Apple, introductory offers: https://developer.apple.com/help/app-store-connect/manage-subscriptions/set-up-introductory-offers-for-auto-renewable-subscriptions/ (through a summary)
- Google Play, Payments policy: https://support.google.com/googleplay/android-developer/answer/9858738 and https://support.google.com/googleplay/android-developer/answer/10281818
- Google Play, service fees: https://support.google.com/googleplay/android-developer/answer/112622
- Google Play, subscriptions and offers: https://support.google.com/googleplay/android-developer/answer/12154973
- Google Play, payment methods in Egypt: https://support.google.com/googleplay/answer/2651410
- Google Play, user choice billing regions: https://support.google.com/googleplay/android-developer/answer/13821247
- RevenueCat pricing, Capacitor install, webhooks, offers: https://www.revenuecat.com/pricing/ , https://www.revenuecat.com/docs/getting-started/installation/capacitor , https://www.revenuecat.com/docs/integrations/webhooks , https://www.revenuecat.com/docs/subscription-guidance/subscription-offers
- Secondary (search results, not primary pages): Apple's 14% VAT in Egypt from July 2023 (https://appleinsider.com/articles/23/07/10/apple-app-store-prices-to-increase-for-select-countries); Gemini grounding at $35 per 1,000 prompts past 1,500 a day (https://developers.googleblog.com/gemini-api-and-ai-studio-now-offer-grounding-with-google-search/); USD to EGP (https://egyptianstreets.com/2026/10/23/us-dollar-surpasses-egp-55-for-first-time-against-egyptian-pound/); Spotify Egypt (https://www.spotify.com/eg-en/premium), Netflix Egypt (https://help.netflix.com/en/node/24926/EG); Egypt App Store price index (https://opentherank.com/app-price-index/egypt/); Paymob and Fawry fees (https://paymentproviders.io/country/eg).

## 13. Not verified

- The business review adds its own list (its section 11): the buyer panel is simulated, competitor prices are iOS storefront only, and buddget's bank coverage in the UAE and Saudi Arabia has not been measured.
- From 2026-12-01 `gemini-2.5-flash` requests route to a newer model at that model's rates (seen on the provider's price page during the review). Every AI cost in section 5 must be re-read after that date. **[S5c]** Re-read: the newer model (`gemini-3.5-flash-lite`) has the same text prices, so no Sparks price or cap changes; only web-search grounding changes (5,000 free a month, then $14 per 1,000). What does change is the model answering SMS, receipt and budget calls, which must be tested before 2026-12-01.

- **No price was tested with a real buyer.** Every price here is a judgement from anchors.
- Whether the App Store and Play offer exactly EGP 69, 499, AED 14.99 and 99.99, SAR 12.99 and 99.99 as price points. Use the nearest tier.
- Apple section 3 wording was read through a page summary, not verbatim. S5c should read 3.1.1 and 3.1.2 on the page.
- Whether a no-card reverse trial for a subscription app is accepted by App Review. It is common practice and not named in the rules read; S5c to check, and S9 to describe it in the review notes.
- Whether the Small Business Program's 15% applies to a subscription's first year. The page says 15% on "Apple In-App Purchases" with no carve-out; not stated explicitly. buddget is not yet enrolled as far as this session knows.
- Google's VAT handling in Egypt and the UAE, and UAE payment methods (the page failed to load). Google's net was assumed to follow the same formula as Apple's.
- Any income or withholding tax on store payouts to an Egyptian developer.
- RevenueCat: Capacitor 8 support, whether the 1% applies to all revenue or only the part above $2,500, the HMAC webhook option on the free plan, and the virtual currency and promotional entitlement docs (both pages returned 404). The RevenueCat connector is not authorised, so nothing was read from an account.
- Apple billing grace period lengths and whether a 3-day `past_due` grace matches both stores' retry windows (S4 already flagged this for S6).
- Whether Egyptian cards actually fail in the stores, and whether carrier billing is offered for subscriptions on the owner's developer accounts. Section 7 step 3 tests this.
- Paymob and Fawry fees and InstaPay merchant rules come from secondary pages only.
- AI costs: the SMS figure is a flat 1,500-token estimate, voice is logged as $0 and was costed from the list price, grounded search is not separated in the logs and no Google bill was read. Chat and receipt averages rest on 4 and 2 calls.
- The Sparks prices assume `gemini-2.5-flash`. A model change moves every cost in section 5.
- iOS DeviceCheck and the Android app-set id as trial keys were not prototyped.
- Fixed costs and break-even were not computed.
- The account-count figures use payment methods, not SMS-tracked accounts; how many testers track more than 3 by SMS was not measured.
- The survey has not been sent and its Arabic wording was not reviewed by a native speaker.
