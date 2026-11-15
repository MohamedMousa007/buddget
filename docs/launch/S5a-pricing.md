# S5a: pricing, free trial and AI credits

Date: 2026-11-15. Decision document, no code, no migrations, no database writes. Inputs: the live database (`ydihurtbcnoflhormgzi`, read-only), the billing scaffold in the repo, `docs/launch/S4-security.md` sections 5, 6 and 8, store pages read today (section 12), and one council round (Skeptic, Pragmatist, Critic as Sonnet subagents; Fable as architect).

Readers: the owner picks the ladder and SKUs from section 10. S5b reads sections 5 and 8 (ledgers, what a loyalty reward may touch). S5c attacks sections 3 to 7. S6 implements section 8.

## 0. Summary

- **One paid plan, "Plus".** Free keeps the whole loop, including SMS auto-tracking on up to 3 accounts. Plus removes the caps and adds depth.
- **Price:** EGP 79 a month or EGP 599 a year in Egypt; AED 14.99 / 119.99; USD 4.99 / 39.99 elsewhere.
- **Trial:** every new account gets Plus for 14 days with no card (the app's own `trialing` entitlement), then drops to free with nothing deleted. No store trial at launch; a store intro price is added once billing is proven.
- **AI credits ("Sparks"):** flat price per action, monthly allowance of 20 on free and 150 on Plus, SMS parsing never costs the user. Top-up packs are designed here but **not shipped in v1** (council 3 of 3).
- **Rails:** Apple IAP and Play Billing through RevenueCat. Web checkout later. No paid manual pilot: validate with the survey plus a free Plus preview granted through the `promo` source.
- **The finding that matters most:** today's hidden limits would let one abuser burn about $10 to $16 a month. The new plan limits fix that whether or not anything is ever sold.

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

Net to Buddget from a shelf price P: `P / (1 + VAT) x 0.85`. Egypt VAT 14%, UAE 5%, KSA 15%.

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
| **SMS auto-tracking** | **3 tracked accounts** | Unlimited |
| Budget: one active plan, manual builder, templates, month close | Yes | Yes |
| Saved budget plans (active plus drafts and archive) | 2 | Unlimited |
| Budget compare and stress test | No | Yes |
| Goals, debts, subscriptions, savings, net worth, paydays | Yes | Yes |
| Reports: this month and last month | Yes | Yes |
| Advanced reports: any range, trends, year view | No | Yes |
| Data export | No | Yes |
| Second currency and FX | Yes | Yes |
| Buddgy chat, AI budget, receipt scan, voice, insights | Yes, paid in Sparks (20 a month) | Yes, 150 Sparks a month |
| Local quick-add and common questions (no model call) | Free, no Sparks | Free, no Sparks |
| Live-price estimates (goal cost, emergency fund) | 3 a day (S4), 10 Sparks each | 10 a day, 10 Sparks each |
| Notifications, biometric lock, offline, sync, web and mobile | Yes | Yes |
| Support | Standard | Standard (priority support is not sold) |

Choices and why:

- **SMS is free but capped at 3 tracked accounts.** The regex and template tiers cost nothing and the AI fallback costs $0.00045, so the cap is a value gate, not a cost gate. Paid-only SMS would hide the one thing no competitor has, and would weaken the Play permission story (SMS is the app's core use). Three covers a bank account, a card and a wallet; 15 of 22 testers with accounts fit under it.
- **Every AI surface works on free.** One meter (Sparks) instead of five feature gates. A free user can try the receipt scanner, voice and the budget builder, and learns what Plus is by running out, not by reading a locked icon.
- **Second currency stays free.** A third of the testers are in the Gulf; for them it is part of the core loop.
- **One paid tier.** Two tiers double the paywall, the store products and the QA for no evidence of demand.

Enforcement note for S6: reports, export, stress test and the plan count are computed on the device from synced data, so they can only be gated in the UI (reading `/api/entitlements/me`). Accept that. Things with a server path are gated on the server: every AI route (already through `reserveAiQuota`), and the SMS account cap (a database trigger on `payment_methods.track_sms`, so no client can exceed it).

**Over the cap.** Nothing is deleted, ever. A free user with more than 3 SMS accounts picks which 3 stay on; messages for the others are held for review for 30 days with one line explaining why. Extra saved plans become read-only. This applies at trial end and at subscription end.

## 4. Trial

| Option | For | Against |
|---|---|---|
| Store free trial (card first) | Store enforces one per account; converts well where cards work | Google's own Egypt page warns Egypt-issued cards "may be declined"; needs billing live first; most Egyptian users will not add a card to try an app |
| App's own no-card trial ("reverse trial") | No card; works on web, iOS and Android the same day; uses the existing `trialing` status | Abuse control is weaker than the store's |
| No trial | Nothing to build | New users never feel unlimited SMS or the full AI |

**Decision: the app's own trial, 14 days, no card, starts at signup.** Fourteen days spans at least one salary or a full run of card spending, which is when SMS tracking shows its value.

- **Unlocked:** everything in Plus, with a trial allowance of 60 Sparks (not 150).
- **Written as:** `user_entitlements` row `plan_key = 'plus'`, `status = 'trialing'`, `source = 'default'`, `trial_ends_at = now + plans.trial_days`. The resolver already drops a lapsed trial to free with no background job.
- **Abuse control.** The owner's rule is "tied to store purchase history, not email". That is only possible for a store offer, so the design splits it:
  - The no-card trial is granted once per account **and once per device** (iOS DeviceCheck bit, which survives reinstall; Android app-set id hashed, which does not survive a factory reset). A second account on a claimed device starts on free.
  - The loss if someone beats it is bounded: 60 Sparks (about $0.20) and 14 days of unlimited SMS accounts.
  - Anything with money value (the intro price below) goes through the store, which enforces one per Apple or Google account.
- **Phase 2, after 60 days of live billing:** a store intro price (for example the first month at EGP 39, or the first year at EGP 449) offered at trial end. Apple allows one intro offer per person per subscription group; Google's standard offers go only to users who never had the subscription.

**Conversion prompts** (reuse the existing prompt-stack registry and sheet components; at most one prompt a day; never during money entry):

1. Day 1: one card, "You have Plus for 14 days", three bullets.
2. Day 10: a personal summary ("SMS booked 41 transactions across 4 accounts, you used 22 Sparks").
3. Day 13: what changes tomorrow, in plain words, with the account picker if they are over 3.
4. Day 14: drop to free; the paywall is one tap away, not forced.
5. After that, only in context: turning on a 4th SMS account, running out of Sparks, tapping export, compare, stress test or an advanced report.

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

- **SMS never costs Sparks.** It runs in the background, the user neither sees nor chooses it, and charging for it would turn the hero feature into silent loss. It has its own hidden cap, `sms_ai_per_day` (free 20, Plus 60). Past the cap a message is held for review, not dropped.
- A failed or aborted call costs nothing (Sparks are taken at settle with status `ok`; the reservation only holds them).

**Allowance.**

| Plan | Sparks a month | Reset |
|---|---|---|
| Free | 20 | First of the month, UTC |
| Trial | 60 for the 14 days | Ends with the trial |
| Plus | 150 | On each renewal date (monthly); annual subscribers reset monthly from the purchase date |

Unused allowance expires at reset. No carry-over. The busiest tester made 61 AI calls in a month with SMS parsing included (which costs no Sparks), so 150 is well over twice real heavy use.

**Three ledgers, kept apart.**

| Ledger | What it holds | Expires | Cash value | Table |
|---|---|---|---|---|
| 1. Allowance | Plan, trial and bonus Sparks | Yes, at period end | None | `spark_allowances` (new) |
| 2. Purchased | Sparks bought as consumable packs | Never | Yes: a liability until spent; refundable through the store | `spark_purchases` (new, phase 2) |
| 3. Loyalty | Points | S5b decides | None, not transferable | `loyalty_ledger` (exists) |

- **Spend order:** allowance first (soonest expiry first: trial, plan, bonus), then purchased, oldest pack first. Apple requires subscription credits to be used before purchased ones.
- **Loyalty never touches ledger 2.** If S5b lets points turn into Sparks, they arrive as a `bonus` row in ledger 1 with an expiry. A reward must never create purchased-type balance, or free points would become a refundable liability.
- Purchased Sparks cannot be transferred, gifted, cashed out or used outside Buddget (Google requires in-app currency to stay in the app).

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
| `sparks_per_month` (new) | none | 20 | 150 |
| `ai_units_5h` | 600,000 | 40,000 | 120,000 |
| `ai_units_24h` | 1,500,000 | 60,000 | 200,000 |
| `ai_units_7d` | 6,000,000 | 200,000 | 450,000 |
| `ai_req_per_min` | 30 | 10 | 20 |
| `sms_ai_per_day` (new) | 100 (in code) | 20 | 60 |
| `grounded_per_day` | 3 | 3 | 10 |
| `sms_accounts_max` | unlimited, not enforced | 3 | unlimited |
| `budget_plans_max` | unlimited, not enforced | 2 | unlimited |

**Worst user, modelled first.**

| Case | Model cost a month | Revenue (net) | Result |
|---|---|---|---|
| Today, one abuser at the default limits | $10 to $16 | $0 | The real exposure. Closed by the table above. |
| Free, all 20 Sparks on chat | $0.07 | $0 | Fine |
| Free, 20 forged SMS a day hitting the AI tier all month | $0.27 | $0 | Needs a stolen or own ingest token; capped |
| Free, both of the above | $0.34 | $0 | Ceiling for a free account |
| Trial abuser, new device each time | $0.20 per cycle | $0 | Bounded |
| Plus, all 150 Sparks on chat at average cost | $0.53 | $1.08 monthly plan, $0.68 a month on annual | Positive |
| Plus, 150 Sparks all on live-price estimates at list price | $0.53 | same | Positive; needs 15 estimates, the daily cap allows it |
| Plus, pathological long outputs up to the 7-day unit cap | at most $1.20 | same | Loses up to $0.50 a month on one account. Rare by construction; watch it in admin, do not design for it |
| Plus, typical (twice today's heaviest tester, who cost $0.05) | $0.10 | same | About 90% gross margin on the monthly plan |

Credits here are a fairness and upsell device, not cost recovery. The margin check passes with room at every realistic level.

## 6. Prices

| Market | Monthly | Annual | Annual vs 12 months | Net monthly | Net annual |
|---|---|---|---|---|---|
| Egypt (EGP) | 79 | 599 | 37% off | EGP 58.9 ($1.08) | EGP 446.6 ($8.19) |
| UAE (AED) | 14.99 | 119.99 | 33% off | AED 12.13 ($3.30) | AED 97.13 ($26.45) |
| Saudi Arabia (SAR) | 14.99 | 119.99 | 33% off | SAR 11.08 ($2.95) | SAR 88.69 ($23.65) |
| Rest of world (USD anchor) | 4.99 | 39.99 | 33% off | $4.24 before local tax | $33.99 |

- **Why 79.** It sits on the Spotify Egypt price (EGP 79) and under Anghami (90) and YouTube Premium (115). Budgeting apps on the Egypt store run EGP 48 to 250 a month and EGP 270 to 1,000 a year. Egypt subscription prices sit about 56% under US prices; 79 against $4.99 is 71% under, deliberately on the low side for an unknown brand.
- **Why the annual discount is steep.** It pulls people to one payment, which matters where card renewals fail.
- **Dissent kept:** the Pragmatist wanted EGP 99 / 799 (net $1.36). Test it after launch with a store price experiment, not before.
- **Devaluation.** Review the EGP price every quarter. A rise for existing subscribers needs their consent in both stores; new subscribers can simply get the new price.
- **Fees assumed:** Apple 15% (requires enrolling in the Small Business Program; owner action), Google 15%, RevenueCat $0 under $2,500 tracked revenue a month, then 1%.
- **Break-even is not computed.** Fixed costs (Vercel, Supabase, Apple and Google developer fees) were not looked up. At $1.08 net, 100 monthly Egyptian subscribers bring about $108 a month.

Store products (S6 creates them):

| Store | Product | Id |
|---|---|---|
| App Store | Subscription group "Buddget Plus" | `plus_monthly`, `plus_annual` |
| Play | Subscription `plus` | base plans `monthly`, `annual` |
| Both, phase 2 | Consumables | `sparks_100`, `sparks_300` |

Family Sharing off. No lifetime product.

## 7. Payment path

**Inside the apps: Apple IAP and Play Billing only.** Both stores require it for subscriptions and for in-app currency. In the app there is no link, button or wording that points at another way to pay (Apple allows that only on the US storefront; Google only in listed regions, and Egypt and the UAE are not among them).

**RevenueCat or direct: RevenueCat.** Council 4 of 4.

| | RevenueCat | Direct StoreKit 2 + Play Billing |
|---|---|---|
| Build | One Capacitor plugin, one webhook | Two native integrations, two notification formats (Apple signed JWS, Google Pub/Sub), receipt checks, grace, retries, upgrades |
| Cost | $0 to $2,500 a month tracked, then 1% | $0 |
| Risk | A vendor in the money path; pricing can change | The highest-risk code in the app written by hand, twice |
| Exit | Store products belong to Buddget; the entitlement table is ours, so leaving means writing the direct integration later | n/a |

RevenueCat owns subscription state and trial eligibility. **Buddget's database owns Sparks**, because the spend has to happen in the same transaction as the quota reservation. RevenueCat's own virtual currency feature is not used.

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
free.limits  = { ai_budget_per_hour: 15, sparks_per_month: 20, sms_accounts_max: 3, budget_plans_max: 2,
                 sms_ai_per_day: 20, grounded_per_day: 3,
                 ai_units_5h: 40000, ai_units_24h: 60000, ai_units_7d: 200000, ai_req_per_min: 10 }
plus         = { key: 'plus', name: 'Plus', status: 'active', trial_days: 14, sort_order: 1,
                 features: ['advanced_reports', 'data_export', 'budget_compare', 'budget_stress_test'],
                 limits: { sparks_per_month: 150, sms_accounts_max: null, budget_plans_max: null,
                           sms_ai_per_day: 60, grounded_per_day: 10,
                           ai_units_5h: 120000, ai_units_24h: 200000, ai_units_7d: 450000, ai_req_per_min: 20 } }
```

New column `plans.store_products jsonb` mapping `{ app_store: {monthly, annual}, play_store: {...} }`. Price columns stay as admin display anchors (`currency = 'EGP'`, 7900 and 59900).

**2. `user_entitlements`.** Add `product_id text`, `store text` (`app_store`, `play_store`), `store_original_txn text` (unique where not null), `will_renew boolean`, `last_event_at timestamptz`. The `source` check already has `apple`, `google`, `promo`, `loyalty`; no change.

Row rule (one row per user): a store event always wins over `default`, `promo` and `loyalty`. A promo or loyalty grant to someone with a live store subscription is not written to this row; give them bonus Sparks instead. The webhook never touches `limit_overrides` or `feature_overrides`. When a plan lapses, overrides stay (they are staff decisions); S4 section 5 item 4 is answered that way.

**3. Resolver and `ai_effective_limits`.** Apply S4's rules in both, with the one shared test table S4 asked for: `canceled` grants the plan until `current_period_end`; `past_due` grants it until `current_period_end` plus 3 days. Add `sparks_per_month`, `sms_ai_per_day`, `grounded_per_day`, `sms_accounts_max`, `budget_plans_max` to `ai_default_limits()` (the SQL merge ignores unknown keys) and to `LIMIT_CATALOG`. Add `budget_compare` and `budget_stress_test` to `FEATURE_CATALOG`.

**4. `billing_events` (new).** `provider`, `event_id` (unique), `type`, `user_id`, `event_at`, `received_at`, `applied`. Insert first, process only if the insert won; skip an event older than `user_entitlements.last_event_at`. This is the idempotency table from S4 section 5. Log id and type, never the payload.

**5. Webhook** `POST /api/billing/revenuecat`, service role only. RevenueCat app user id is the Supabase user id, set by the server at login. Check the `Authorization` secret with a constant-time compare (RevenueCat also offers an HMAC header over `timestamp.body`; use it if available on the plan, with the 5-minute window from S4).

| RevenueCat event | Write |
|---|---|
| `INITIAL_PURCHASE`, `RENEWAL`, `UNCANCELLATION`, `PRODUCT_CHANGE` | `status = 'active'`, `plan_key = 'plus'`, `source` by store, `current_period_end` = expiry, `will_renew = true`; open a new Sparks period |
| `CANCELLATION` (not a refund) | `status = 'canceled'`, `canceled_at`, `will_renew = false`; access runs to period end |
| `CANCELLATION` with a refund reason | `status = 'expired'` now; purchased Sparks from a refunded pack removed |
| `BILLING_ISSUE` | `status = 'past_due'` |
| `EXPIRATION` | `status = 'expired'` |
| `SUBSCRIPTION_PAUSED` (Play) | `status = 'paused'` |
| `TRANSFER` | move the row to the new user id, expire the old one |
| `NON_RENEWING_PURCHASE` (phase 2 packs) | insert `spark_purchases` keyed on the store transaction id |

A nightly reconcile job asks RevenueCat for every row whose `current_period_end` passed more than a day ago and is still `active` or `past_due`. Answer 2xx only after the write commits; RevenueCat retries 5 times over about 80 minutes.

**6. Trial.** At signup the server (the existing `handle_new_user` path or the first authenticated call) inserts the `trialing` row if the device has no claim. New table `trial_claims`: `device_key_hash` (unique), `user_id`, `platform`, `claimed_at`. Web signups get the trial once per account (no device key); the loss is bounded as in section 4.

**7. Sparks.**

- `spark_prices`: `feature` (primary key), `sparks`. Seeded from the table in section 5; `goals_grounded` is its own key. Editable in admin without a deploy.
- `spark_allowances` (ledger 1): `id`, `user_id`, `kind` (`plan`, `trial`, `bonus`), `granted`, `used`, `period_start`, `period_end`, `ref` (plan key, or the loyalty ledger id for a bonus). A free user's row for the month is created on first use. Unique on (`user_id`, `kind`, `period_start`).
- `spark_purchases` (ledger 2, phase 2, create the table now, leave it empty): `id`, `user_id`, `store`, `store_txn` (unique), `product_id`, `sparks`, `remaining`, `price_micros`, `currency`, `purchased_at`, `refunded_at`. Outstanding liability is `sum(remaining)` where not refunded.
- `spark_spend` (append-only): `user_id`, `reservation_id`, `feature`, `sparks`, `allowance_id` or `purchase_id`, `created_at`.
- `ai_quota_reserve_v2` gains one step: look up the price, check that allowance plus purchased covers it, hold it on the reservation (new column `ai_reservations.sparks`). New denied layer `sparks` (HTTP 429, with the reset date) so the client can show the upgrade sheet. `ai_quota_settle` with status `ok` writes `spark_spend` and increments `used` in spend order; error and release write nothing.
- `ai_quota_status` returns `{ sparks_left, sparks_total, resets_at, purchased_left }` for the balance line in Settings and in the chat header.
- All four tables: row security on, users may select their own rows, writes by service role only.

**8. Enforcement points.**

| Gate | Where |
|---|---|
| Sparks and unit windows | `ai_quota_reserve_v2`, already called by every AI route |
| SMS AI per day | The SMS parse route, through the atomic counter (replaces `aiCallsToday`) |
| SMS account cap | Trigger on `payment_methods` when `track_sms` becomes true: count for the user against `sms_accounts_max` from `ai_effective_limits` |
| Export, advanced reports, compare, stress test, plan count | UI, from `/api/entitlements/me`; add the keys to `PAID_FEATURES` for any that get a server route |

**9. Cost truth.** `ai_price_book`: add `per_call_usd` and a row for grounded search ($0.035); make `ai_cost_usd_micro` charge audio by seconds (units divided by 100). Without this the admin margin view under-reports voice and search.

**10. Loyalty (for S5b).** No schema change from S5a. Constraint: a loyalty reward may write a `bonus` row in `spark_allowances` or set a time-boxed `loyalty` entitlement for a user with no store subscription. It may never write `spark_purchases`.

## 9. Willingness-to-pay survey (ready to send, not sent)

Send as a form link in the testers' channel. Anonymous, 3 minutes. English first, Arabic under it.

**Intro.** We are deciding what stays free in Buddget and what a paid plan would cost. Your honest answers matter more than kind ones. Nothing here commits you to anything.
نحدد الآن ما الذي سيبقى مجاناً في Buddget وكم ستكون تكلفة الاشتراك. إجابتك الصريحة أهم من المجاملة، ولا يترتب عليها أي التزام.

1. Which country do you live in? (Egypt / UAE / Saudi Arabia / other)
   في أي بلد تعيش؟
2. Which phone do you use Buddget on? (iPhone / Android / web only)
   على أي جهاز تستخدم Buddget؟
3. How many bank accounts, cards and wallets do you actively use? (1 / 2 / 3 / 4 / 5 or more)
   كم حساباً بنكياً وبطاقة ومحفظة تستخدمها فعلياً؟
4. How do you track your money in Buddget today? (SMS auto-tracking / I type it / voice / receipt photo / I mostly do not) Pick all that apply.
   كيف تسجل مصروفاتك اليوم؟ (الرسائل تلقائياً / أكتبها / الصوت / صورة الإيصال / لا أسجل غالباً)
5. If Buddget disappeared tomorrow, how would you feel? (very disappointed / somewhat / not disappointed)
   لو اختفى Buddget غداً، كيف ستشعر؟ (محبط جداً / إلى حد ما / لا يهمني)
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
15. What one thing would make you pay for Buddget? (free text)
    ما الشيء الواحد الذي سيجعلك تدفع مقابل Buddget؟

Reading it: questions 8 to 11 are the standard four price questions; the acceptable range is between where "too cheap" crosses "expensive" and where "good deal" crosses "too expensive". Split by country. With about 30 answers, treat it as a sanity check on EGP 79, not as proof, and cut stated willingness roughly in half (friends answer generously). Question 5 at 40% "very disappointed" or more is the usual sign the product is ready to charge. Questions 13 and 14 decide how urgent carrier billing and web checkout are.

## 10. Owner decisions

Each has the architect's recommendation and the council's vote. The owner picks.

| # | Decision | Recommendation | Council |
|---|---|---|---|
| 1 | SMS auto-tracking on free | Free, capped at 3 tracked accounts; unlimited on Plus | Capped 3 of 4 (Pragmatist 2 accounts, Critic 3, architect 3). Skeptic dissents: no cap, it is the only differentiator and the cap protects nothing |
| 2 | Number of paid tiers | One, "Plus" | 4 of 4 |
| 3 | What Plus contains | Section 3 table. All AI surfaces stay usable on free through Sparks; second currency stays free; priority support is not sold | Tier list 4 of 4. Pragmatist and Critic would make receipt, voice and the AI builder Plus-only; the architect keeps them metered on free so one meter replaces five gates |
| 4 | Launch markets | Egypt, UAE and Saudi Arabia priced by hand; everywhere else from the USD anchor | Not voted; follows from 14 of 47 testers being AED-based |
| 5 | Price | EGP 79 a month, EGP 599 a year; AED and SAR 14.99 / 119.99; USD 4.99 / 39.99 | EGP 79 3 of 4. Pragmatist dissents: EGP 99 / 799 |
| 6 | Trial | App's own 14-day no-card trial at signup, 60 Sparks, once per account and device | 3 of 4. Skeptic dissents: no trial, free is the trial |
| 7 | Store intro price | Not at launch; add after 60 days of live billing | 4 of 4 (the architect first wanted it at launch and changed) |
| 8 | Credits name | "Sparks" | Not voted. Critic would ship v1 with no branded name |
| 9 | Credit pricing | Flat per action (section 5); SMS never costs Sparks | 4 of 4 |
| 10 | Allowance | Free 20, trial 60, Plus 150 a month, no carry-over | 4 of 4 on 20 and 150 |
| 11 | Top-up packs | Not in v1. Create the empty table now; ship packs when 10% of subscribers pass 80% of their allowance. Then: Plus only, never expire, 100 for EGP 69, 300 for EGP 179 | 3 of 3 voices against packs at launch. **This departs from the owner brief**, which asked for packs; the architect changed position on the council's argument |
| 12 | Lower the hidden AI limits now | Yes, in S6's first migration, before anything is sold | 4 of 4. This is the one item with real money at risk today |
| 13 | Billing provider | RevenueCat | 4 of 4 |
| 14 | Web checkout (Paymob, Fawry) | Later; first see whether Egyptian cards fail in the stores | 4 of 4 |
| 15 | Validation before billing | Survey, then a free Plus preview for all testers through `promo`, then one real owner purchase and renewal on an Egyptian card. No paid manual pilot | 3 of 3 against a paid pilot. Departs from the plan's InstaPay idea, for the reasons in section 7 |
| 16 | Annual discount | 37% in Egypt, 33% elsewhere | Range across voices 21% to 37% |

Owner actions that are not choices: enrol in the Apple Small Business Program; authorise the RevenueCat connector when S6 starts; send the survey.

## 11. What the council changed

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

- **No price was tested with a real buyer.** Every price here is a judgement from anchors.
- Whether the App Store and Play offer exactly EGP 79, 599, AED 14.99 and 119.99 as price points. Use the nearest tier.
- Apple section 3 wording was read through a page summary, not verbatim. S5c should read 3.1.1 and 3.1.2 on the page.
- Whether a no-card reverse trial for a subscription app is accepted by App Review. It is common practice and not named in the rules read; S5c to check, and S9 to describe it in the review notes.
- Whether the Small Business Program's 15% applies to a subscription's first year. The page says 15% on "Apple In-App Purchases" with no carve-out; not stated explicitly. Buddget is not yet enrolled as far as this session knows.
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
