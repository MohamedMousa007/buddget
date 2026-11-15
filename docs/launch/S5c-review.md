# S5c: adversarial review of pricing, credits, trial and loyalty

Date: 2026-11-15. A review document: no product code, no migrations, no database writes, nothing sent to testers. It attacks `docs/launch/S5a-pricing.md` (as revised by `docs/launch/S5a-business-review.md`) and `docs/launch/S5b-loyalty.md`. Evidence: the repo at this commit, the live database (`ydihurtbcnoflhormgzi`, read-only), store and provider pages read today (section 13 says how each was read), and one council round (section 12). Users are cited by the first 8 characters of their id or as counts.

**Verdict: S6 may start.** Nothing found needs a redesign. Eight things in the designs would have been built wrong as written (the rows marked "Blocks S6"); each is corrected in place in the two design documents (marked **[S5c]**) and listed in section 14 so S6 can follow that list alone. Three owner-accepted choices change (section 15): the founding price is not built in v1, the trial has no device key in v1, and the free SMS cap counts bank accounts with their cards, not payment methods. Separately, six things must happen before anything is **sold**, none of which S6 can do (section 15, owner actions).

Severity used below: **Blocks S6** (S6 would build something wrong; fixed by this session's edits), **Fix in S6** (S6 must do it, the list says how), **Later** (after launch or outside S6).

## 0. The ten findings that matter most

| # | Finding | Severity |
|---|---|---|
| 1 | The global daily AI spend cap is not set. `platform_settings` has no `ai_spend_guard` row, so the "last line of defence" never blocks (W-1) | Fix in S6, first migration |
| 2 | SMS AI calls and Buddgy share the same hidden unit windows. On the proposed free limits, a busy SMS day locks the user out of chat, and chat use makes SMS parsing fail (W-2) | Blocks S6 |
| 3 | The SMS AI cap counts log rows, not model calls, and counts messages parsed by plain rules too. One message makes about 2 model calls, up to 4 (W-3) | Blocks S6 |
| 4 | The free SMS account cap cannot be built as written: `track_sms` defaults to true on every payment method, cash included, so 6 of the 10 SMS testers are over a cap of 2 on day one without having chosen anything (T-5) | Blocks S6 |
| 5 | Sparks are charged only when a call ends `ok`. A streamed answer that the client aborts just before the end is free (C-1). Cancelling and un-cancelling a subscription would open a new Sparks period each time (C-2) | Blocks S6 |
| 6 | An "active day" for the founder bar is one call to a database function any signed-in client can make. Seven scripted calls and one typed record earn a founder number; 100 scripted accounts take every number (L-1) | Blocks S6 |
| 7 | Google Play cannot end an offer on a date; it is switched off by hand or by an API call, and buyers keep their terms. The council voted 3 of 3 to launch with no founding price (P-6) | Blocks S6 (scope) |
| 8 | Two of the four privacy-block claims are not true today: "only bank messages are read" is false, "text deleted after 30 days" is partly true. Unmasked message text is sent to Google's model on the fallback path and the privacy policy does not say so (V-2, V-3, V-5) | Later (before the block is published; S7, S9) |
| 9 | The Terms say the service "is provided free of charge" and promise 14 days' notice before paid features (V-6). The notice must go out at least 14 days before Plus is sold | Later (before selling; owner) |
| 10 | Break-even is understated. It rounds down (45, not 44), assumes full-price buyers while the offer pushed everyone to the founding annual price (79), and leaves out what free users cost (about 71 at full price) (M-1 to M-4) | Later (numbers corrected in place) |

## 1. Price maths

Recomputed from the shelf prices with `net = price / (1 + VAT) x 0.85`, USD at 54.5 EGP, 3.6725 AED, 3.75 SAR.

| Market | Monthly net | Annual net | Annual per month | Founding annual net | Founding per month | Reproduces? |
|---|---|---|---|---|---|---|
| Egypt, 14% VAT | EGP 51.45, $0.944 | EGP 372.06, $6.83 | $0.569 | EGP 297.50, $5.46 | $0.455 | Yes |
| UAE, 5% | AED 12.13, $3.304 | AED 80.94, $22.04 | $1.837 | AED 64.75, $17.63 | $1.469 | Yes |
| Saudi Arabia, 15% | SAR 9.60, $2.560 | SAR 73.91, $19.71 | $1.642 | SAR 59.12, $15.77 | $1.314 | Yes |
| Rest of world | $4.24 | $33.99 | $2.83 | n/a | n/a | Yes |

Annual discounts (39.7%, 44.4%, 35.9%, 33.2%), contribution per subscriber-month ($0.686, $2.50, $2.03) and the blended $1.311 all reproduce. The founding-price columns were never computed in either document.

| Id | Finding | Evidence | Severity | Change |
|---|---|---|---|---|
| M-1 | Break-even figures are rounded down. 44 subscribers earn $57.68 against $58.08 | 58.08 / 1.311 = 44.3; per market 84.7, 23.2, 28.6 | Later | Read 45 blended; Egypt-only 85, UAE-only 24, Saudi-only 29. Corrected in S5a section 6 |
| M-2 | Break-even assumes half monthly, half annual, all at full price. The offer was designed to pull early buyers to the founding annual price | Founding contribution: $0.385, $1.399, $1.244; blended $0.741 | Later | If early buyers all take the founding annual price, break-even is 79, not 45. Moot if the founding price is not built (P-6) |
| M-3 | The 12-month ramp says it starts from 47 testers. Its numbers only reproduce from 14 active users | 14 x 0.9 + 45 = 57.6 (the table's 58); from 47 the first month would be 87 | Later | The table is right and the sentence is wrong. Active-months 7,972, subscriber-months 159, total -$488, break-even in month 13 all reproduce from 14 |
| M-4 | The ramp and the break-even leave out what free users cost. At 2% paying, each subscriber carries 49 free users | Measured: $0.197 over 27 days across 22 active users, about $0.01 per active user a month. 49 x $0.01 = $0.49 against $1.31 | Later | Contribution net of free users is about $0.82; break-even about 71 subscribers at full price; the year costs about $570, not $490. New users cost more than testers for their first weeks (trial Sparks, new message shapes), so treat $0.01 as a floor |
| M-5 | Apple's 15% needs enrolment and is not instant | Program page: the rate applies 15 days after the end of the fiscal month in which enrolment is approved. Without it Apple keeps 30% in year one: Egypt monthly net $0.777 | Later (owner, now) | Enrol before the store products are created. Until the rate applies, Egypt contribution is about $0.56 |
| M-6 | Commission base and VAT handling are now confirmed for both stores, with one gap | Apple: proceeds are the price "minus any applicable taxes"; Apple collects and remits in Egypt, the UAE and Saudi Arabia (Exhibit B, PDF dated 2026-08-27). Google: tax-inclusive in all three and Google remits (for a developer outside the UAE and Saudi Arabia). The VAT rates themselves were not on either page | Later | S5a's formula stands. Egyptian income or turnover tax on the payouts is still outside the model (section 11) |
| M-7 | RevenueCat's 1% | Pricing page: free to $2,500 tracked a month, "then pay 1% of what you track". Whether 1% is on all of it or the excess was not on the page | Later | Irrelevant under about 1,900 blended subscribers |
| M-8 | Google's rule on how an annual price is shown | Subscriptions policy: an annual plan must not show the monthly-equivalent price most prominently | Fix in S6 (paywall), S9 (copy) | The paywall shows "EGP 499 a year" as the main price. "EGP 41.6 a month" may appear only as smaller secondary text |

## 2. Worst-user cost

What the code allows today (live functions read 2026-11-15): `ai_default_limits()` gives 600,000 units per 5 hours, 1,500,000 per 24 hours, 6,000,000 per 7 days and 30 requests a minute; the one plan row sets only `ai_budget_per_hour: 15`. One unit costs at most $0.000000625 on today's model, so the 7-day window allows about $16 a month per account. S5a's "$10 to $16" reproduces. The SMS path allows 100 a day by its own counter.

Largest real use so far: 46,650 units in one user-day, 79,484 in one user-week, 23 non-SMS calls by one user in 27 days, $0.052 for the costliest user.

| Id | Finding | Evidence | Severity | Change |
|---|---|---|---|---|
| W-1 | The global daily spend cap is off | `spendGuard.ts` reads `platform_settings.ai_spend_guard.dailyCapUsd`; the key does not exist, so `capUsd` is null and `spendLevel` always returns `ok`. S5a section 2 calls this guard the last line of defence | Fix in S6, first migration | Insert `ai_spend_guard = {"dailyCapUsd": 5}`. Today's whole-platform spend is under $0.01 a day; $5 is 500 times that and stops a scripted farm the same day. Essential features (SMS, receipt) stop at 3 times the cap, as coded |
| W-2 | SMS AI calls share the unit windows with every Sparks feature | Each SMS-triggered call reserves and settles a flat 1,500 units under feature `sms` (`sms/parse/route.ts:961-970`, `meteredAi.ts`); `ai_quota_reserve_v2` sums all features in each window. On S5a's free limits (60,000 a day) 40 SMS calls fill the day. When the window is full the SMS row is written `failed / rate_limited` and the phone gets HTTP 429 | Blocks S6 | Take `sms` out of the unit windows in both directions: the three window sums exclude `feature = 'sms'`, and an `sms` reservation skips the window loop. SMS is bounded by its own counters (W-3). A denied SMS call must hold the message for review, not fail it |
| W-3 | The SMS AI cap counts the wrong thing | `sms_ai_today` counts parse-log rows where `parsed_ok` is true by any method (rules included) or an AI reject. It is not a count of model calls. One AI-tier message triggers up to 4 calls: the parse, the template learner, the merchant category, the adjudicator. Live: 150 `sms` usage events against 74 AI-tier rows in 30 days, about 2 calls a message. The busiest real user-day had 18 calls | Blocks S6 | Count model calls inside `ai_quota_reserve_v2`, the way `voice_entries_per_day` is counted (settled events plus live reservations, feature `sms`). Two keys replace `sms_ai_per_day`: `sms_ai_calls_per_day` (free 30, trial 60, Plus 60) and `sms_ai_calls_per_month` (free 150, trial 250, Plus 450). The monthly cap is what bounds cost; the daily cap only smooths. Delete `aiCallsToday` and the `RATE_LIMIT_PER_DAY` constant |
| W-4 | S5a's worst-case table is too low on every abusive row | The legacy proxy route `/api/ai` is planned at 1 Spark, but the caller supplies the contents (up to 60 parts, 256 KB, 4 images), the system instruction and up to 8,192 output tokens. One call can cost about $0.04, not the $0.0009 average. So the unit windows, not the Sparks, set the ceiling | Later (numbers corrected in place) | True ceilings on the limits in section 14: free $0.54 from the 7-day window plus $0.07 SMS = **$0.61 a month** (S5a said $0.34); trial $0.38 plus $0.11 = **$0.49 per account** (S5a said $0.20); Plus $1.22 plus $0.20 = **$1.42 a month** (S5a said at most $1.20). Each window can overshoot by one call |
| W-5 | The Egypt annual subscriber at both caps | The business review's case: 100 chat Sparks ($0.35) plus the SMS cap ($0.40) = $0.75 against $0.57. It assumed one call per message. At the measured 2 calls a message the SMS half is $0.81 and the loss is $0.59 a month; against the founding price ($0.455) it is $0.70 | Fix in S6 (by W-3) | With the monthly call cap (450 calls, $0.20) the same case costs $0.55 against $0.57: break-even, not a loss. A subscriber who also drives long outputs to the 7-day window can still cost $1.42 against $0.57. Accept that: it needs deliberate abuse, typical use is $0.07, and admin should list any account above $0.50 in a month |
| W-6 | A trial account gets Plus's hidden windows | S5a writes the trial as `plan_key = 'plus'`, so a throwaway account gets 450,000 units a week for two weeks. Web signups have no device key, no captcha and no signup rate limit (section 4) | Fix in S6 | A third plan row `plus_trial` with its own limits (section 14). The trial entitlement points at it. Same features as Plus |
| W-7 | The spend guard and the admin margin view cannot see three costs | Voice is logged at $0 (Groq Whisper at $0.111 an hour, 10 seconds minimum billed per request: at least $0.0003 an entry, up to $0.025 for the largest clip the route accepts). Web-search grounding has no price row. SMS is a flat 1,500-token estimate | Fix in S6 | Already S5a section 8 item 9. Add: SMS calls settle the token counts the provider returns, not the flat estimate |
| W-8 | The window check lets one more call through | `v_used >= limit` is tested before the new call is added | Later | Accept. The overshoot is one call |

## 3. The AI cost table after 2026-12-01

Read on the provider's pricing, deprecations and changelog pages today, through a fetch tool that returns an extraction of the page, not raw HTML (section 13).

- From 2026-12-01 every request to `gemini-2.5-flash` routes to `gemini-3.5-flash-lite` and is billed at that model's rates.
- **Text prices do not change**: input $0.30, output $2.50, cached input $0.03 per million tokens, the same as today. So no Sparks price and no unit window changes, and the bound of $0.000000625 per unit holds.
- Audio input falls from $1.00 to $0.30 per million tokens. Buddget's voice does not use it (voice runs on Groq Whisper).
- Web-search grounding changes: from 1,500 free a day then $35 per 1,000 grounded prompts, to 5,000 free a **month** (shared across the newer models) then $14 per 1,000 "requests". The page does not say whether one prompt that runs several searches is several requests.
- `gemini-2.5-flash-lite` (Buddgy's fast tier) keeps its price ($0.10 in, $0.40 out) and has no shutdown date, but since 2026-09-18 the 2.5 models are open only to accounts that already used them.

| Sparks price or cap | Before | After 2026-12-01 |
|---|---|---|
| Chat, voice, insight, receipt, budget, plain estimate (1, 1, 1, 2, 2, 1 Sparks) | Costs in S5a section 5 | Unchanged |
| Estimate with live prices (10 Sparks) | $0.035 at list | $0.014 if one search each, up to about $0.07 if a prompt runs five. Keep 10 Sparks until the first invoice shows the unit |
| `grounded_per_day` (free 3, Plus 10) | Under a 1,500-a-day free quota | Under a 5,000-a-month free quota. Sparks already limit a user to 2 (free), 6 (trial) or 10 (Plus) a month, so 5,000 covers about 500 subscribers at their cap |
| Unit windows, requests a minute | S5a section 5 | Unchanged |
| `ai_price_book` | `gemini-2.5-flash` row at 0.30 / 2.50 / 0.03 | Still right. Add a `gemini-3.5-flash-lite` row at the same rates and a grounding row at $0.014 |

| Id | Finding | Severity | Change |
|---|---|---|---|
| A-1 | The price does not move but the model does. SMS parsing, receipts, the budget builder and the legacy proxy all name `gemini-2.5-flash`. On 2026-12-01 a different model answers them, 16 days from now, with no change on Buddget's side. The code also sends 2.x-style thinking settings to any model whose id starts `gemini-2.` | **Later, but dated: before 2026-12-01** (S8 or its own short session, not S6) | Run the SMS gold set, the receipt checks and the Buddgy eval against `gemini-3.5-flash-lite` by name, fix what moves, then set the model id explicitly so the switch happens on a day Buddget chooses |
| A-2 | S5a's "not verified" line said every AI cost must be re-read after the date | Later | Done here: nothing changes except grounding. Line updated in S5a section 13 |

## 4. Trial abuse

The trial is 14 days of Plus at signup, no card, granted by the app. S5a wanted it once per account and once per device.

| Route to a second trial | Does the proposed key stop it? |
|---|---|
| New email on the web app | **No.** Web has no device key. S5a accepted one trial per account there |
| New email, same iPhone | Yes. The two DeviceCheck bits persist across reinstall, erase and transfer to a new owner (Apple, WWDC21 session 10244; the current reference page does not state it) |
| A second-hand iPhone whose last owner tried Buddget | **Refused, wrongly.** Apple leaves resetting the bits to the developer, who cannot know the phone was sold. Second-hand phones are common in Egypt |
| New email, same Android phone, app reinstalled | **No.** The app set ID resets when the developer's last app is uninstalled, on factory reset, or after 13 months unused (Android developer docs) |
| Second store account | Not relevant: the app trial does not look at the store account |
| Second phone | No key can stop it, on either platform |
| Android with Play Integrity "device recall" | Would work (3 bits per device, survive reset, kept 3 years), but it is in beta and needs Google's approval |

| Id | Finding | Evidence | Severity | Change |
|---|---|---|---|---|
| T-1 | The device key stops one of six routes, wrongly refuses honest second-hand phones, and protects something worth cents | Table above. Loss per abused trial is at most $0.49 after W-6. A re-signup starts with empty data, and for a money tracker the history is the lock-in. The JSON backup restore is offered only when signed out (`DataCard.tsx:27,35-42`); whether a restored local store uploads at signup was not checked | Blocks S6 (scope) | **Council 4 of 4: no device key in v1.** One trial per account. The trial starts only for a verified sign-in (Google, Apple, or an email whose code was confirmed), is granted on the server, and is keyed on a normalised email (lower case; for Gmail drop dots and anything after `+`) so aliases do not multiply it. `trial_claims` becomes `email_key` (unique), `user_id`, `claimed_at`. Add a signup limit (S6 picks the mechanism; 5 an hour per IP is the target) and a daily count of trials granted in admin. Add device recall or DeviceCheck later only if that count shows abuse |
| T-2 | No signup controls exist today | No captcha, no rate limit on signup in the repo; email confirmation is a Supabase dashboard setting that could not be read; 6 of 26 email accounts are unconfirmed | Fix in S6 | Confirm in the dashboard that email confirmation is required. An unconfirmed account gets no trial and no Sparks |
| T-3 | App Review and an app-granted trial | Apple 3.1.1 forbids an app's "own mechanisms to unlock content or functionality, such as license keys". Apple 3.1.2(a) describes only store trials. Nothing read permits or forbids an automatic, unpaid unlock. Google: nothing read forbids it; its payments rules apply where payment is taken | Later (S9) | It is tolerated practice, not written permission. Keep it automatic at signup: no codes, no keys, no way to "redeem" it. Do not call it a "free trial" next to a price on the paywall (that phrase means a store trial with auto-charge on both stores); call it "14 days of Plus, no card". Say plainly that nothing is charged and nothing is deleted. Describe it in the review notes. Fallback if Apple objects: a store introductory free trial on the annual plan |
| T-4 | Two accounts sharing one paid subscription | RevenueCat's default restore behaviour moves a store subscription to whichever app account restores it last. S5a's `TRANSFER` row would follow it | Fix in S6 | Set restore behaviour to "Keep with original App User ID". A second account restoring the same store purchase gets a clear message. Moving a subscription to another account is a support action. A `TRANSFER` event never opens a Sparks period |
| T-5 | The free SMS cap is not buildable as written | `payment_methods.track_sms` defaults to **true**. All 60 live payment methods are flagged, 13 of them cash. Among the 10 testers with SMS activity the flagged non-cash counts are 4, 6, 4, 1, 2, 4, 4, 2, 2, 1: six are over a cap of 2 without having chosen anything. A trigger that fires "when `track_sms` becomes true" would fire on every new account, and free users may add unlimited accounts | Blocks S6 | **Council 3 of 4: count top-level accounts.** One tracked account = a payment method with `track_sms` true, not cash, not deleted or closed, and `parent_id` null. Cards attached to a bank account come with it and never count. A standalone card counts as one. Rules: (1) the column default becomes false; the app sets it true when the user turns tracking on for that account; (2) the trigger never blocks creating or editing an account: over the cap it stores `track_sms = false`; (3) messages for an untracked account are held for review for 30 days with one line saying why; (4) existing flags are left as they are, and anyone over the cap picks 2 at the end of the trial or preview. Paywall sentence: "Free tracks 2 bank or wallet accounts; their cards come along; cash is always free." Dissent kept (Skeptic): count banks, not accounts |
| T-6 | The founding price as a trial loophole | A store introductory offer is one per store account per subscription group (Apple) or for never-subscribed users (Google) | n/a | No finding. Moot if the founding price is not built |

## 5. Credits and the three ledgers

| Id | Finding | Evidence | Severity | Change |
|---|---|---|---|---|
| C-1 | An aborted stream is a free answer | S5a: Sparks are taken "at settle with status `ok`". Streams that the client cuts are settled `aborted` with real usage (`api/ai/route.ts:154-166`, `buddgy/turn.ts:150-155`). A client that closes the connection after the last text but before the end frame pays nothing | Blocks S6 | Charge Sparks when the call settles `ok`, **or** `aborted` with output tokens above zero. Only `error`, a release, and an abort with no output are free |
| C-2 | Cancel and un-cancel mints Sparks | S5a section 8 item 5 lists `INITIAL_PURCHASE`, `RENEWAL`, `UNCANCELLATION` and `PRODUCT_CHANGE` as "open a new Sparks period". Un-cancelling is free and unlimited in store settings | Blocks S6 | Only `INITIAL_PURCHASE` and `RENEWAL` may open a `plan` period, and opening is idempotent: at most one `plan` row per user per period. `period_start` is the store period start for a monthly plan and the monthly anniversary of the purchase for an annual plan. A new purchase inside an open period reuses the row. `UNCANCELLATION`, `PRODUCT_CHANGE` and `TRANSFER` never grant |
| C-3 | A refunded or expired subscriber keeps the allowance | The `plan` row's `period_end` stays in the future after a refund. Google refunds on request for 48 hours | Fix in S6 | On `EXPIRATION`, or `CANCELLATION` with reason `CUSTOMER_SUPPORT` (RevenueCat's refund signal), set the open `plan` row's `period_end` to now. Sparks already spent are not chased. `REFUND_REVERSED` restores the row |
| C-4 | Free plus Plus in the same month | A free user who spent 20 and then subscribes gets a `plan` row of 100 on top | Later | Accept. It rewards upgrading and costs $0.07 |
| C-5 | Can the three ledgers leak into each other? | Allowance and purchased are separate tables, joined only in `spark_spend`. Loyalty writes only `bonus` rows in ledger 1. No path writes ledger 2 except a store purchase event | n/a | No leak found. Add two constraints so it stays true: a check that a `spark_spend` row names exactly one of `allowance_id` and `purchase_id`; `spark_purchases` rows are inserted only by the webhook, keyed on the store transaction id |
| C-6 | Store rules on included credits | Apple 3.1.2(a): "Subscriptions may include consumable credits". Apple 3.1.1: purchased credits "may not expire". Apple's expiring-consumables page: included credits must be used before purchased ones. Google's subscriptions policy lists a subscription that is only a lump of credits as a violation | n/a | The design complies: Plus has real features, the allowance resets monthly, spend order is allowance first. Do not let the monthly allowance shrink after the first month |
| C-7 | Packs later: the refund liability | Not built in v1. If they ship: Apple decides iOS refunds and may refund a pack after it was spent; the Apple refund request arrives with a 12-hour window to send consumption data. Saudi Arabia: a balance with "monetary value" may fall under payment rules (law-firm source, section 11) | Later | When packs are specified: let the purchased balance go negative on a refund-after-spend rather than chasing; answer Apple's consumption request; book unspent purchased Sparks as a liability at the price paid; have the Saudi stored-value point read by a lawyer before packs are sold there |
| C-8 | The empty `spark_purchases` table | S5a creates it now and leaves it empty | Later | Harmless. Keep, since the owner brief asked for the door to stay open |
| C-9 | A hidden window can stop a user who still has Sparks | 100 chat Sparks in one week is about 950,000 units against a 450,000 window | Fix in S6 | Rare by design. When a unit window denies, the message says when it resets and does not show the upgrade sheet (the user did nothing a purchase would fix) |

## 6. Loyalty gaming

Least effort for each prize, as designed:

| Prize | Least real effort | Scriptable? |
|---|---|---|
| Founder number | 7 calls to `analytics_touch` on 7 UTC days across 2 weeks, plus one typed expense | Yes. The function is granted to `authenticated`, takes a session count from the caller and writes the day row. It cannot backdate |
| Kept week (10 points) | One call to the weekly-check function. With no SMS items there is nothing to clear | Yes |
| Budget set (10 points) | Activate a budget once. It stays active, so it pays every month for ever | No further action needed |
| Tracked month (40 points) | The two above | Yes |
| Sprout (300 points, 20 bonus Sparks, themes) | Four calls a month for three months, no real use | Yes |

| Id | Finding | Evidence | Severity | Change |
|---|---|---|---|---|
| L-1 | The founder bar's "active day" is forgeable and weak even when honest | `analytics_touch(p_seconds, p_sessions, p_paths)` is callable by any signed-in client. 334 of 528 recorded day rows have under 30 seconds of activity; the median is 0. The activity part of the bar passes 17 accounts at "any session", 9 at 30 seconds, 7 at 60. One attacker with 100 scripted accounts takes all 100 numbers in two weeks, and deleted accounts retire their numbers for good | Blocks S6 | **Council 4 of 4.** (1) An active day for the bar is a day, in the user's timezone, on which the server recorded a user action: a record the user created or edited by hand, an SMS item the user confirmed, or a finished weekly check. Rows written by the SMS pipeline, imports and sync replays do not count, and the day comes from a server-set timestamp. Build it as a view over existing tables; no new table. (2) The nightly job only **proposes** founders. A number is issued when the owner approves in admin, in approval order, no gaps. Admin shows the pending count; there is no "approve all". (3) The bar is otherwise unchanged: 7 such days over 2 or more weeks, active once inside the window |
| L-2 | "11 of 47 pass today" was measured on the weak definition | S5b section 1 | Later | Not recomputed on the new definition (it needs per-table rules S6 will write). Expect fewer than 11. The owner should know the first founders may be under 10 |
| L-3 | A kept week can be faked with one tap, and S5b says so | S5b section 11 allows it because the reward is cosmetic | Fix in S6 | Keep the one tap, but the server pays points only when the week has at least one record dated in it (any source). A "nothing this week" check keeps the streak and pays 0 points. Two kept weeks must be at least 5 days apart, which also closes re-keying weeks by changing the week-start setting. The period key is the date of the week's first day in the user's setting, computed on the server |
| L-4 | "Budget set" pays for ever after one tap | S5b 4.1 | Fix in S6 | Pays once per cycle only if the budget was created, activated or edited by the user in that cycle or the one before. Otherwise 0 |
| L-5 | Multiple accounts and duplicate people | S5b relied on the trial device key, which is gone (T-1) | Fix in S6 | The owner's approval step is the control. Admin shows, per proposed founder: sign-in method, creation date, count of action days, count of records, whether SMS is on. That is enough to spot a farm |
| L-6 | Staff and test accounts | `admin_staff.user_id` exists and is filled for all 4 staff rows. S5b's join on `admin_staff.id` matched none | Fix in S6 | Exclude where `auth.users.id = admin_staff.user_id`. QA and demo accounts are excluded at approval |
| L-7 | Early access could hand a paid feature to a free user | S5b gives founders and Tree members a feature cohort. A feature that will be Plus-only, shown early to a free founder, is the app unlocking paid functionality by its own mechanism (Apple 3.1.1) | Fix in S6 | Early access never crosses the plan line: a feature that is or will be Plus-only needs Plus even in early access |
| L-8 | The credits screen shows user-chosen names to everyone | S5b 3: opt-in display names | Fix in S6 | A name appears only after the owner approves it, in the same admin step |
| L-9 | Loyalty and paid features | Apple 3.1.2(a): subscribers must get what they paid for "without performing additional tasks" such as checking in. Apple 3.2.2(x): apps "may otherwise incentivize users to take specific actions within apps". Google's payments FAQ: earned points may be issued without Play Billing | n/a | The design complies as long as no loyalty step gates anything Plus includes. Keep that sentence in the S6 brief |

## 7. Store policy

Apple's guidelines were read verbatim from the live page (last updated 2026-10-16). Google's pages were read verbatim from the live help centre. Quotes are kept short.

| Id | Topic | What the page says | Verdict and change |
|---|---|---|---|
| P-1 | Sparks as a currency | Apple 3.1.1: credits bought by in-app purchase "may not expire". 3.1.2(a) allows credits inside a subscription. Google: in-app currency stays in the app it was bought for | Complies in v1 (nothing is sold as credits). Packs later must never expire unless Buddget holds Apple's generative-AI entitlement (12-month minimum, expiry shown on the paywall, reminder emails) |
| P-2 | The no-card trial | T-3 | Tolerated practice. Wording and review-note rules in T-3 |
| P-3 | Badges, points, tiers | L-9 | Allowed on both stores. No chance, no prizes, no cash value: Google's gamified-loyalty rules do not apply |
| P-4 | A badge for TestFlight testers | Apple 2.2: beta apps "cannot be distributed to testers in exchange for compensation of any kind". Neither TestFlight page says more | **Keep the badge, with rules (council 3 of 4; Skeptic would drop it).** It is granted at public launch to every account that existed before launch. It is never announced beforehand as a reward for joining or staying in the beta, carries no credits, discount or feature, and is not called "founding". The owner's one note to lapsed testers must not offer the badge; it may state the founder window, bar and date |
| P-5 | Review prompts | Apple 5.6.1: use the provided API; custom prompts are disallowed. Section 3: no "paid, incentivized, filtered, or fake feedback". The system shows at most 3 prompts in 365 days. Google: no "rewards or incentives for ratings" | S5b complies. Timing after a good moment is what Apple's own documentation suggests. No "are you enjoying Buddget?" screen before the prompt |
| P-6 | The founding introductory offer and a fixed end date | Apple: an introductory offer has a start and an end date per storefront and ends on that date; it cannot be edited, only deleted; it cannot be limited to a number of people. Google: an offer has no date field, only activate and deactivate; buyers keep their terms. Apple offer codes can target chosen people, including new customers | **Council 3 of 3 voices: no founding price in v1** (architect was for shipping it and changed position). A missed switch-off on Google is a permanent price split, and with about 20 active testers a 20% discount tests nothing. It also removes three legal questions: a Saudi discount licence, Egypt's before-and-after price display rule, and Saudi Arabia's new rule on scarcity claims (section 11). If the owner reinstates it, the rule set is in section 15 |
| P-7 | The 30-day annual guarantee | Apple: the App Store decides and issues refunds; a developer can only show the request sheet and send consumption data. Apple lets a developer extend a renewal date by 1 to 90 days, twice in 365 days per customer. Google: the developer sets a refund policy, must honour it, and refunding an order also revokes it | **Council 4 of 4: drop the word "guarantee" and the six months.** Wording: "Changed your mind within 30 days of buying the annual plan? On Android, tell us and we refund you. On iPhone, Apple handles refunds: we show you how to ask, and if Apple says no we add 3 months to your plan." Annual plan only. The 3 months is a support action through Apple's extension API, claimed by email with Apple's reply, once per subscription. S6 builds none of it |
| P-8 | The 12-month price promise | Apple offers "keep the current price for existing subscribers". Google keeps existing subscribers on their price unless the developer ends their cohort; opt-out increases exist in all three countries with 30 days' notice | Keepable on both stores, and entirely in Buddget's hands. Note for whoever raises a price later: ending a Google price cohort ends every earlier cohort for that plan and region, so check purchase dates first |
| P-9 | Steering to web checkout | Apple 3.1.1(a): outside the United States storefront, apps and their metadata may not include buttons, links or other calls to action to pay elsewhere. 3.1.3: developers may communicate outside the app. Google payments section 4 bans leading users to another payment method in the app or listing; none of its seven alternative-billing or external-offer programs lists Egypt, the UAE or Saudi Arabia. Its "rest of world" change is dated 2027-09-30 | S5a section 7 is right. One correction: the web app's line "Plus is bought in the mobile app" is fine on the web, but the iOS and Android apps must contain no wording about any other way to pay. A web price may differ from the store price, and email may mention it |
| P-10 | Apple 3.1.3(b), buying on the web and using in the app | A web purchase may be honoured in the app only if the same item is also sold by in-app purchase there | Web checkout later is allowed on that condition |
| P-11 | Cancelling | Google requires an easy online way to cancel | S6 adds "Manage subscription" in Settings, deep-linking to the store's subscription page |

## 8. The privacy block

The block proposed for onboarding and the listing: "SMS is optional, only bank messages are read, text deleted after 30 days, nothing sold."

| Id | Claim | True today? | Evidence | Wording that is true today |
|---|---|---|---|---|
| V-1 | SMS is optional | **Yes** | Android receiver does nothing until tracking is on, default off (`SmsReceiver.kt:36-37`); permission is asked only when the user flips the switch (`useSmsTracking.ts:155-163`); onboarding has a "later" path; nothing is gated on it | "SMS reading is optional and off until you turn it on." |
| V-2 | Only bank messages are read | **No** | On Android the receiver sees every incoming SMS and forwards any message from a named or short-code sender that contains a digit, or any that looks bank-like (`SmsGate.kt:69-87`). One-time codes and adverts are dropped on the phone. Delivery, telecom and other business texts leave the phone. On iPhone the user's own Shortcut decides which messages run. The server stores every received text in `sms_parse_log.raw_body` before classifying it; non-transactions are kept as `rejected` for 7 days | "On Android, one-time codes and adverts never leave your phone. Messages that look like transactions are sent to our servers to be read. Anything that turns out not to be a transaction is deleted within 7 days." |
| V-3 | Text deleted after 30 days | **Partly** | `sms_retention()` runs nightly and is enabled; no raw text older than 31 days exists today. Raw text is cleared at 7 days (rejected, failed) and at 30 days for parsed rows **only if** the row was learned and masked; otherwise at a 60-day cap. A masked copy (`masked_body`) stays for good (687 rows older than 30 days have one), as do the sender and, for non-transfers, merchant and title. `sms_corpus` keeps redacted shapes 180 days, or for good once seen 3 times | "The original message is deleted within 30 days (60 at the latest). We keep the transaction details and a masked copy with names and numbers removed." |
| V-4 | Nothing sold | **Yes** | No ads or third-party analytics SDK; analytics is first-party; the policy says data is not sold, rented or traded | "We never sell your data and show no ads." Do not say "nothing is shared": Supabase, Google, Groq, Sentry, Resend and Linear process data |

| Id | Finding | Evidence | Severity | Change |
|---|---|---|---|---|
| V-5 | Unmasked message text goes to Google's model on the fallback path, and the policy does not say so | The parse call sends the message as received (`sms/parse/route.ts:974, 1745-1756`); the merchant-category call passes it too (`:1186`). Masking covers only the template learner and the adjudicator. The policy's Gemini entry says "your budget context and images" | Later (before launch; S7 or its own slice, with an S8 accuracy check) | Either mask account digits and names before the parse call and prove on the gold set that accuracy holds, or state it in the policy and the block: "when our own rules cannot read a message, it is read by Google's Gemini model". Until one is done the block must not imply the text stays with Buddget |
| V-6 | The Terms say the service is free and promise notice | `TermsIntroSections.tsx:50-51`: "The Service is provided free of charge", paid features only after 14 days' notice | Later (owner and S9, dated) | Rewrite the clause and send the notice at least 14 days before Plus is sold. Add subscriptions, auto-renewal, cancellation and refunds to the Terms, in Arabic and English |
| V-7 | The policy's 60-day sentence is narrower than the code | Policy: up to 60 days "for a message still waiting for you to confirm it". Code: any parsed row not yet learned and masked | Later (S9) | Make one match the other. Simplest: the policy says "30 days, and never more than 60" |
| V-8 | Processors missing from the policy | Vercel is not named. RevenueCat will be new | Later (S9) | Add both before billing ships |
| V-9 | "Only bank messages" could be made true on Android | The known-sender list already exists (`ALL_PATTERN_SETS`) | Later (owner decision) | A sender allowlist plus the money-movement test would make the claim true on Android, at the cost of missing banks not yet on the list. Not recommended before the per-bank table exists; use the true wording instead |

## 9. The four launch gates

| Gate | Measurable with today's data? | Can it pass without the thing it proves? | Change |
|---|---|---|---|
| 1. A published list of Egyptian banks with measured accuracy | Yes, from the gold set and the parse log | Yes. The sample is about 10 users and mostly the owner's own banks; a bank with 5 messages can show 100% | A bank is listed with a number only with at least 30 messages from at least 2 users other than the owner; "booked correctly" means amount, direction and account all right with no user fix. Banks under that are listed as "supported, not yet measured" |
| 2. 40% of testers who switch SMS on see a first automatic transaction within 10 minutes | Partly. `user_milestones.sms_enabled` is the earliest ingest token, and S4's token re-issue moved those dates; the first booked row is in the parse log | Yes, both ways. It mostly measures whether a bank happened to text within 10 minutes, not whether setup worked; it fails honest users who set up at night and passes anyone who sends a test message | Two measures on testers who switch SMS on after S6 ships (S6 records the switch-on time): (a) at least 60% have an automatic transaction within 72 hours; (b) the median time from a bank message reaching the phone (`captured_at`) to the booked row is under 1 minute. Under 10 testers in the count means "not measured", which is not a pass |
| 3. At least 5 of 47 testers say they would buy the annual plan | It is a survey | Yes. The testers are the owner's circle and cannot be charged | **Council 4 of 4: replace with behaviour.** During the Plus preview, at least 5 distinct testers (staff and the owner's accounts excluded) go past a free limit in real use on 2 or more separate days: a third tracked account receiving messages, or more than 20 Sparks in a month. It shows need, not willingness to pay. A miss is a signal about what Plus contains, not a launch blocker |
| 4. Under 2% of active users paying at day 60 reopens the free line | Not yet: "active" and "paying" are undefined, and nothing records paywall views | Yes, on a small base: 1 payer among 40 actives is 2.5% | Active = at least one action day (L-1's definition) in the last 30 days, testers on a `promo` grant excluded. Paying = a live `apple` or `google` entitlement, not refunded. Under 200 active users the gate reads "not measured" and the review happens anyway at day 90. It triggers a review, not an automatic change |

S6 must record: SMS switch-on time per user, paywall views by country (already required), and the two preview behaviours in gate 3.

## 10. The S5b departure: testers must pass the bar

The plan said the 45 testers "count automatically". S5b made them pass the same bar as everyone; 11 of 47 passed on its definition.

**For automatic status.** They took the risk on a rough app; that was the original promise in the plan. A bar that most of the owner's circle misses may sting. A cap of 100 with single-digit founders looks empty. The badge has no money attached, so generosity costs nothing.

**For the bar.** 27 of 47 accounts never recorded anything and 18 opened the app on 2 days or fewer. A number on those accounts is a number on nothing: it gives no proof to show buyers, and it uses 45 of 100 slots before the public arrives. Under Apple 2.2, status handed to testers because they were testers is closer to "compensation of any kind" than status anyone can earn by using the app. Nothing was promised to testers in writing; the plan is an internal document.

**Verdict: the departure stands, hardened (council 4 of 4, option B).** Founder status is earned by use, by one bar, measured on server-observed actions and issued on the owner's approval (L-1). Every pre-launch account gets the Beta tester badge under the rules in P-4. The risk the Skeptic named is real and is written into the rule: approval is per account, with no "approve all", and the owner approves only accounts that pass the bar.

## 11. Consumer and loyalty rules in Egypt, the UAE and Saudi Arabia

**This is not legal advice.** No primary law text could be read: the PDFs would not parse and the UAE and Saudi government sites refused the fetch. Every point below is from a law-firm summary, the press or a store page, and is a prompt for a lawyer.

| Topic | Egypt | UAE | Saudi Arabia |
|---|---|---|---|
| Auto-renewing subscriptions | No specific rule found; general distance-selling information duties | No "easy cancel" rule found; general contract law | No specific rule found; terms must state the withdrawal right or why none applies |
| Withdrawal and refunds | 14 days from receipt under the 2018 consumer law; reported to lapse once a service is fully used (press) | A return right tied to defects; no no-reason cooling-off for digital services found | 7 days if unused under the e-commerce law, with an exception for software downloaded online (secondary). **A unified Consumer Protection Law was approved by the Cabinet around 2026-11-10** and replaces the e-commerce law 180 days after publication; reported to keep a 7-day cancellation right, ban false scarcity claims and void terms that let a business change the deal without consent (press) |
| Prices and discounts | Stated prices include tax. A discount must show the before and after price, the real percentage, the terms and the duration (press) | Displayed prices include VAT. Promotions need a licence for locally licensed businesses; a foreign app's launch price was not found | Displayed prices include VAT. A Ministry of Commerce licence is reported to be needed before advertising any discount, online included; a foreign app's launch price was not found |
| Points, prizes, contests | Prize draws need notice to the consumer agency and a ministry licence. Nothing found on points with no cash value and no chance | Prize draws need a permit. Nothing specific on points | Contests need a licence. The reported risk for points is "monetary value" under central-bank payment rules; non-monetary rewards and no transfers reduce it |
| Arabic | Consumer documents, adverts, invoices and contracts in Arabic; a second language is allowed | Information, adverts and contracts in Arabic, or Arabic plus another language | Invoices in Arabic; a rule for online terms was not found |
| Data | Executive regulations for the data law were issued in 2025 and the one-year compliance window is reported to have ended 2026-11-01. Financial data is "sensitive"; holding it needs a licence and sending it abroad a permit (law-firm summary) | Executive regulations reported still not issued | In force; opt-in consent; standard clauses for transfers abroad. Draft amendments (consultation closed 2026-11-05) would require storage in the Kingdom for some data |
| Tax | Google remits Egyptian VAT; Apple collects and remits (Exhibit B). A small-business turnover regime (0.4% to 1.5%) exists; individuals register with the tax authority | Google remits 5% for developers outside the UAE | Google remits 15% for developers outside the Kingdom |

What the design does because of this: no founding price in v1 (no discount to license or display); no "guarantee" word (an advertised guarantee binds); the founder cap of 100 is a real cap fixed in a migration, so the scarcity is true; points have no cash value, no transfer and no chance; every paywall, the Terms and the refund wording ship in Arabic as well as English.

A lawyer should confirm:

1. Egypt's data law: whether a small controller holding bank messages on servers abroad needs the licence and the transfer permit, and the real deadline. This is the largest open legal risk and predates this review.
2. Egypt: whether a started subscription keeps the 14-day right, and whether a store-run refund meets the supplier's duty.
3. Saudi Arabia: the new consumer law's start date, and how its scarcity and change-of-terms rules read on a 100-seat founder badge and a 12-month price promise.
4. Saudi Arabia and the UAE: whether discount or promotion licences reach a foreign developer's price in an app store (only if the founding price returns).
5. Whether the notice or licence rules for contests touch a no-chance points program or the founder badge in any of the three.
6. Arabic duties for the paywall, Terms, refund wording and receipts when Apple or Google issue the invoice.
7. Egyptian tax on store payouts and whether the small-business regime applies.
8. Saudi data law: duties of a foreign controller and the draft localisation rule.
9. Whether the 3-month extension promise on iPhone creates an exposure when Buddget cannot see Apple's decision.
10. Stored-value rules in Saudi Arabia before any Sparks pack is sold there.

## 12. Council (one round, 2026-11-15)

Skeptic, Pragmatist and Critic were three Sonnet subagents given the same brief and facts, without this conversation. The architect wrote a position first.

| Question | Architect (before) | Skeptic | Pragmatist | Critic | Result |
|---|---|---|---|---|---|
| Founder bar for testers | Keep the bar, harden it, owner approves | B | B | B | **Keep and harden, 4 of 4** |
| Beta tester badge | Keep, with rules | Drop it | Keep | Keep, reworded | **Keep, 3 of 4** |
| Trial device key | Drop in v1 | B | B | B | **No device key in v1, 4 of 4** |
| Founding price | Ship in both stores with a scheduled job on Google | No founding price; at most Apple only | No founding price | No founding price; if kept, with a hard fail-safe | **Not in v1, 3 of 3 voices.** The architect changed position |
| Annual "guarantee" | Plain wording, 3 months | B, and drop the 3 months | B | B | **Plain wording, 4 of 4; the 3 months stays, 3 of 4** |
| What counts as an SMS account | Top-level accounts | Banks | Top-level accounts | Top-level accounts | **Top-level accounts, 3 of 4** |
| Launch gate 3 | Behaviour | B, two hard limits only | B | B, on 2 or more days | **Behaviour, 4 of 4** |

Strongest dissent, kept: the Skeptic would drop the Beta badge (it marks 27 accounts that never recorded anything and invites "what did I get for testing?") and would count banks, not accounts ("2 banks or wallets" is the shortest sentence and hardest to dodge; the cost is a sender-to-bank map that must be reliable).

What the council changed in the architect's view: the founding price. Two things raised by the voices and adopted: Gmail alias normalisation and a daily count of trials granted (Skeptic, Critic); a visible pending count so owner approval cannot silently stall (Critic).

Raised and not adopted: one new table of server-observed actions as the base for everything (Pragmatist, Critic). The same facts are already in the record tables and the parse log, so the bar and the gates read a view over them. If S6 finds a record table with no server-set timestamp, it adds the column there.

## 13. Sources and how each was read (2026-11-15)

| Source | How |
|---|---|
| Apple App Review Guidelines, 2.2, 3.1.1, 3.1.1(a), 3.1.2, 3.1.3, 3.2.2, 5.6, 5.6.1: https://developer.apple.com/app-store/review/guidelines/ | Verbatim (raw page, footer "Last Updated: October 16, 2026") |
| Apple, introductory offers, offer codes, promotional and win-back offers, subscription pricing (App Store Connect help) | Verbatim |
| Apple, refund notifications, refund request, consumption information; support article 118223 | Verbatim |
| Apple, expiring consumables: https://developer.apple.com/in-app-purchase/expiring-consumables/ | Verbatim |
| Apple, DeviceCheck reference; WWDC21 session 10244 transcript for persistence | Verbatim |
| Apple, extending a subscription renewal date (App Store Server API) | Verbatim |
| Apple, TestFlight overview pages | Verbatim; neither mentions compensation |
| Apple, Small Business Program; Paid Applications Agreement Exhibit B (PDF, 2026-08-27) | Program page through an extraction; Exhibit B raw |
| Google Play: Payments (9858738, 10281818), Subscriptions (9900533), offers (12154973, 140504), refunds (2741495, 2479637), price changes (13542779 and the developer guide), ratings (9898684), alternative billing and external offers (13821247 and six linked program pages), service fee (112622, 16954621), tax (138000), contests and loyalty (9877032) | Verbatim (raw HTML, `hl=en`) |
| Android: app set ID; Play Integrity device recall | Verbatim |
| Gemini API pricing, deprecations, changelog, models (now under aistudio.google.com/docs) | **Through an extraction**, not raw HTML |
| Groq speech-to-text pricing (console.groq.com/docs/speech-to-text) | Through an extraction; groq.com/pricing returned no tables |
| RevenueCat: pricing, webhooks, restore behaviour, eligibility; npm registry for `@revenuecat/purchases-capacitor` | Docs through an extraction; npm raw (14.1.0 needs Capacitor 8 or later) |
| Egypt, UAE and Saudi law | **Secondary sources only** (law-firm summaries and press) |

Could not be read: Apple's Developer Program License Agreement and Schedule 2; any Apple text on "money-back guarantee" (none exists in the pages read); what happens to a buyer already inside an Apple introductory offer when the offer is deleted; Google's Epic settlement wording; any primary law text.

## 14. Changes required before S6 starts

S6 can follow this list without the other documents. Each item is also applied in place in `S5a-pricing.md` or `S5b-loyalty.md` and marked **[S5c]**. Where this list and those documents differ, this list wins.

**Scope**

1. **No founding price.** Do not create an introductory offer in either store. Products are `plus_monthly` and `plus_annual` only, at the normal prices.
2. **No device key for the trial.** No DeviceCheck, no app set ID. `trial_claims` is `email_key text unique`, `user_id`, `claimed_at`.
3. **No "guarantee" feature.** The refund wording is copy (S9) and a support process. S6 adds only "Manage subscription" in Settings, linking to the store's subscription page.

**First migration (before anything is sold)**

4. Insert `platform_settings.ai_spend_guard = {"dailyCapUsd": 5}`.
5. Plans. `sms_ai_per_day` is replaced by the two call keys. Add every new key to `ai_default_limits()` (the SQL merge drops unknown keys) and to `LIMIT_CATALOG`, including `grounded_per_day`, which is in the catalog but not in the SQL defaults today.

| Key | `free` | `plus_trial` (new, hidden from the paywall) | `plus` |
|---|---|---|---|
| `sparks_per_month` | 20 | 60 (for the 14 days) | 100 |
| `ai_units_5h` | 40,000 | 60,000 | 120,000 |
| `ai_units_24h` | 60,000 | 100,000 | 200,000 |
| `ai_units_7d` | 200,000 | 300,000 | 450,000 |
| `ai_req_per_min` | 10 | 20 | 20 |
| `sms_ai_calls_per_day` | 30 | 60 | 60 |
| `sms_ai_calls_per_month` | 150 | 250 | 450 |
| `grounded_per_day` | 3 | 3 | 10 |
| `sms_accounts_max` | 2 | unlimited | unlimited |
| `budget_plans_max` | 2 | unlimited | unlimited |
| `seats` | 1 | 1 | 1 |

`plus_trial` has the same `features` as `plus`, `trial_days` 14 and no store products. The trial entitlement is `plan_key = 'plus_trial'`, `status = 'trialing'`.

6. In `ai_quota_reserve_v2`: the three unit-window sums exclude `feature = 'sms'`; an `sms` reservation skips the window loop and is checked against `sms_ai_calls_per_day` (rolling 24 hours) and `sms_ai_calls_per_month` (rolling 30 days), counting settled `sms` events plus live `sms` reservations. New denied layers `sms_day` and `sms_month`.
7. In the SMS parse route: remove `aiCallsToday` and `RATE_LIMIT_PER_DAY`. When the quota denies an SMS call, hold the message for review (the existing held-review path) and answer the phone 2xx so it does not retry. Never write `failed / rate_limited` for a quota denial. SMS calls settle the token counts the provider returns.

**Sparks**

8. Sparks are charged when a call settles `ok`, or `aborted` with output tokens above zero. `error`, release, and an abort with no output are free.
9. Only `INITIAL_PURCHASE` and `RENEWAL` open a `plan` allowance period, idempotently: one `plan` row per user per period (`period_start` = the store period start for monthly; the monthly anniversary of purchase for annual). `UNCANCELLATION`, `PRODUCT_CHANGE` and `TRANSFER` never grant Sparks.
10. On `EXPIRATION`, or `CANCELLATION` with `cancel_reason = CUSTOMER_SUPPORT` (a refund), set the open `plan` row's `period_end` to now. `REFUND_REVERSED` restores it and the entitlement.
11. `spark_spend` has a check that exactly one of `allowance_id` and `purchase_id` is set. Only the webhook inserts into `spark_purchases`.
12. When a unit window (not Sparks) denies a call, the client shows the reset time and no upgrade sheet.

**Billing**

13. RevenueCat restore behaviour: "Keep with original App User ID". Verify webhooks with the HMAC header (`X-RevenueCat-Webhook-Signature`, timestamp plus raw body, 5-minute window) as well as the `Authorization` secret. Idempotency on the event `id`; order by `event_timestamp_ms`.
14. `past_due` grace follows the store, not a fixed 3 days. Set the store billing grace period to 3 days on Apple and 7 on Google (the shortest each offers for a monthly or annual plan; Google has no 3-day option for them). Keep access until the grace expiry RevenueCat reports on the billing-issue event, then drop to free; 3 days after `current_period_end` is only the fallback when no expiry is reported. A fixed 3 days would cut off a Google subscriber the store is still retrying.
15. The paywall's main price for the annual plan is the yearly amount. A monthly equivalent may appear only as smaller text.
16. The iOS and Android apps contain no wording about any other way to pay. "14 days of Plus, no card" is never labelled "free trial" beside a price.

**Trial**

17. The trial is granted on the server, once per normalised email (lower case; for Gmail remove dots and anything from `+`), only after a verified sign-in (Google, Apple or a confirmed email code). Add a signup limit and an admin count of trials granted per day.

**SMS account cap**

18. One tracked account = `track_sms` true, type not cash, not deleted or closed, `parent_id` null. The column default becomes false. A trigger on insert and update stores `track_sms = false` when the user is at `sms_accounts_max`; it never raises. Existing rows are untouched. Over-cap messages are held for 30 days with a reason line. Record the time a user first turns SMS on.

**Loyalty**

19. Active day (founder bar, gate 4) = a day in the user's timezone with a server-observed user action: a record created or edited by hand, an SMS item confirmed by the user, or a finished weekly check, by a server-set timestamp. A view over existing tables. `analytics_touch` rows never count.
20. `loyalty_grant_founders()` writes proposals (`founder_candidates`: `user_id`, `qualified_at`, `proposed_at`, `decided_at`, `decision`). A number is issued by an admin action per account, in approval order. Admin shows the pending count and, per candidate, sign-in method, creation date, action days, record count and whether SMS is on. No bulk approve. Display names for the credits screen are approved in the same step.
21. Staff exclusion joins `admin_staff.user_id`.
22. Kept week: the server computes the period key (the date of the week's first day in the user's setting). Points are paid only if the week has at least one record dated in it; "nothing this week" keeps the streak and pays 0. Two kept weeks are at least 5 days apart.
23. Budget set pays only if the user created, activated or edited the budget in that cycle or the one before.
24. Early access never crosses the plan line. No loyalty step gates anything Plus includes.
25. Duplicate-person signals no longer include a device key; the owner's approval is the control.
26. The Beta tester badge is granted by the launch migration to every pre-launch account except staff. No copy anywhere presents it as a reward for testing.

**Measurement**

27. Record paywall views by country, the SMS switch-on time, and per user per month the two preview behaviours for gate 3 (a third tracked account receiving messages; Sparks used).

## 15. Owner decisions the review changes or adds

Settled by the council under the owner's working rule. The owner can overturn any of them; the cost of doing so is stated.

| # | Decision | Was | Now | To overturn |
|---|---|---|---|---|
| 1 | Founding price (S5a decision 7) | EGP 399, AED 79.99, SAR 79.99 for year one, first 60 days | **Not in v1** | Rule set if reinstated: Apple introductory offer with the end date set per storefront; Google offer with developer-determined eligibility, shown by the app only before a server-side cut-off, deactivated by a scheduled job that alerts on failure, plus a manual check that day; copy says "first year", no crossed-out price; a lawyer reads the Saudi and Egyptian discount rules first |
| 2 | Trial abuse control (S5a decision 6) | Once per account and per device | **Once per verified, normalised email; no device key** | Play Integrity device recall and DeviceCheck can be added later if the daily trial count shows abuse |
| 3 | What "2 accounts" means (S5a decision 1) | 2 tracked accounts, undefined | **2 bank or wallet accounts; cards under them come along; cash never counts** | The Skeptic's alternative is 2 banks or wallets by sender |
| 4 | Annual-plan promise (S5a decision 18) | "30-day guarantee", six months free if Apple declines | **Plain refund wording, 3 months added if Apple declines, annual only, by support** | n/a |
| 5 | Launch gates 2, 3 and 4 (S5a decision 17) | As in the business review | **Redefined as in section 9**; gate 3 is behaviour, not a survey | n/a |
| 6 | Founders (S5b decisions 1 and 3) | Nightly job issues numbers | **Job proposes, the owner approves each account**; active days are server-observed actions | Costs the owner a few minutes a day during the window |
| 7 | Beta tester badge (S5b decision 2) | Permanent badge for every tester | **Kept, never presented as a reward for testing** | Dropping it removes the Apple 2.2 question entirely |
| 8 | SMS AI cap (S5a section 5) | 20 and 30 messages a day | **Calls, not messages: 30 / 60 a day and 150 / 450 a month** | n/a |
| 9 | Billing grace (S4 council, 3 days) | 3 days after the period end | **Follows the store's grace period: 3 days on Apple, 7 on Google** | n/a |

Owner actions, none of them S6's:

1. **Before 2026-12-01:** have the SMS gold set, receipts and the Buddgy eval run against `gemini-3.5-flash-lite`, since requests switch to it that day (A-1).
2. Enrol in the Apple Small Business Program now; the 15% starts 15 days after the end of the month of approval.
3. At least 14 days before Plus is sold: update the Terms (they say the service is free) and send the notice they promise (V-6).
4. Before the privacy block is published: use the wording in section 8, and decide V-5 (mask before the model call, or disclose it).
5. Confirm in the Supabase dashboard that email confirmation is required.
6. Take section 11's list to a lawyer, the Egyptian data-law item first.
7. Unchanged from S5a: authorise the RevenueCat connector when S6 starts; send the survey; one real purchase and renewal on an Egyptian card.

## 16. Not verified

- **No law was read in the original.** Section 11 is second-hand throughout.
- The Gemini, Groq and RevenueCat pages were read through a tool that returns an extraction of the page. The routing date and prices are consistent across four pages, but no raw page and no invoice was read. What one grounding "request" is after 2026-12-01 is not defined on the page.
- Whether `gemini-3.5-flash-lite` accepts the thinking settings the code sends, and how well it parses SMS, receipts and budgets. Nothing was run.
- Apple's VAT rates for the three countries and whether App Store prices there are shown tax-inclusive (Exhibit B confirms Apple remits; the rates were not on a page read). The Egyptian VAT rate on Google's page is not stated either.
- Whether App Review accepts the app-granted trial. No rule read allows or forbids it.
- What happens to a buyer already inside an Apple introductory offer when the offer is deleted (only relevant if the founding price returns).
- RevenueCat: whether the 1% applies to all tracked revenue or the excess; whether the HMAC header is available on the free plan; how a refund of a consumable is delivered; the exact field that carries the grace expiry.
- The "about 2 model calls per AI-tier message" figure compares usage events since 2026-10-20 with parse-log rows of the last 30 days; the windows differ by a few days.
- The cost of a free user ($0.01 a month) comes from 22 active testers over 27 days. New public users will differ.
- How many accounts pass the hardened founder bar. Not recomputed.
- Whether a signed-out local store restored from a JSON backup uploads into a new account at signup (it would let a re-signup keep its history).
- Whether every record table has a server-set timestamp that the active-day view can trust.
- Whether email confirmation is enforced (a dashboard setting).
- Whether the stores offer the exact price points; whether Egyptian cards renew; carrier billing. All carried from S5a.
- The store grace-period options in item 14 are from Apple's help page and a RevenueCat article, not from a live console.
- Nothing was run on a device or against the deployed site. No code was changed.
