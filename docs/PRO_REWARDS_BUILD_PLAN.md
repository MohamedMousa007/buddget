# Pro, Rewards and Founders: build plan (final, for execution)

> **Superseded (owner, 2026-11-19).** `docs/launch/PRO_REWARDS_SPEC.md` (signed off 2026-11-17 night, after the financial review) replaces this plan. Where they differ, the spec and the shipped code are right: tier gifts 10/20/30 Sparks, streak gifts 10/20/40 at 12/26/52 weeks, 12-month gift life, no Free pack bonus, Pro pack bonus 15% (20% at Diamond), no per-tier Free AI credits, no member price, a pack refund zeroes only what is left. QA finding S8G-01 is closed by this note.

Status: final draft for owner sign-off (2026-11-17). Design source: the "buddget Pro, Rewards and Founders" mockup v13.
Billing stays behind `billing.enabled`; every surface below is hidden until it is on.

Owner decisions:
- The entry tier is **Silver**.
- The profile uses **option A**: a gold PRO tag on the avatar, with the tier badge after the name.
- Point values do not change.
- Every Spark pack keeps about a third of the shelf price as profit after VAT, the store and AI.
- Loyalty includes cash-value benefits, paid from a retention budget.

## 1. Sparks pricing (corrected audit)

**How the app charges:** 1 Spark per $0.001 of real model cost, rounded up per call (migration 0298, `spark_charge(ceil(cost/1000))`). So a Spark never costs more than $0.001.

**Assumptions:**
- 54.5 EGP per USD.
- VAT included in the shelf price: Egypt 14%, Saudi 15%, UAE 5%.
- The store keeps 15%.
- Each Spark is counted at the full $0.001, so every margin below is a floor.

**Correction to the v12 audit:** it priced Sparks per feature from the legacy `spark_prices` table, at 49 EGP per USD. That was wrong. The owner's planning figure holds: EGP 9.99 for 70 Sparks leaves EGP 3.63.

**Old packs:** 70 / 150 / 400 / 900 / 2,500. A Free buyer in Egypt left 36 / 34 / 31 / 26 / 29%. With Pro's +25% bonus that fell to 27 / 23 / 20 / 13 / 18%.

**New packs.** Prices are unchanged except Saudi's largest pack. Pro's bonus becomes +15%.

| Pack (ID) | Egypt | UAE / Saudi / US | Kept by us, Free buyer | Kept by us, Pro buyer |
|---|---|---|---|---|
| 60 (`sparks_60`) | EGP 9.99 | Egypt only | 42% (EGP 4.18 per 10) | 37% |
| 125 (`sparks_125`) | EGP 19.99 | Egypt only | 40% | 35% |
| 320 (`sparks_320`) | EGP 49.99 | AED 3.99 / SAR 3.99 / USD 0.99 | 40% | 34% (other markets 39-48%) |
| 650 (`sparks_650`) | EGP 99.99 | AED 7.99 / SAR 7.99 / USD 1.99 | 39% | 34% (other markets 39-47%) |
| 2000 (`sparks_2000`) | EGP 299.99 | AED 18.99 / SAR 21.99 / USD 4.99 | 38% | 33% (other markets 35-39%) |

- **Bonuses never stack.** A buyer gets whichever is bigger: the Pro bonus or the member bonus.
- **Product IDs:** the store products don't exist yet, so `spark_products` and the App Store guide simply change.
- **Currency rule:** above 60 EGP per USD, the 650 pack for a Pro buyer drops to 30%. At that point, re-size the Egypt packs.

## 2. Loyalty

**Earning:**
- Point values are unchanged: +10 kept week, +10 budget set, +40 tracked month.
- Streak multiplier: x1.5 from week 4, x2 from week 8. A miss drops one step.
- A kept week needs at least 3 reviewed transactions.
- A budget counts once a month, and only with real categories.

**Tiers:** Silver 0, Emerald 300, Diamond 800, Elite 1,500 + active Pro, Elite Founder.
- Tiers are set by lifetime points and are never lost to a missed week.
- If Pro lapses, an Elite member shows as Diamond. Elite returns when Pro does.

**Cash-value benefits**, from a retention budget: worst case under 25% of the member's gross profit, expected under 10%.

| Benefit | Silver | Emerald | Diamond | Elite (Pro) |
|---|---|---|---|---|
| Member bonus on packs | - | +5% | +10% | Pro +15% (no stacking) |
| Weekly AI credits (Free only) | - | +3 | +5 | Pro limits |
| Sparks gift on reaching the tier | - | 30 | 60 | 150 |
| Member price on Pro (Free with 8 real weeks) | - | first year EGP 399 (20% off) | first year EGP 399 (20% off) | - |

- **Streak gifts:** 10 / 30 / 60 / 120 Sparks at 4 / 12 / 26 / 52 weeks.
- **Gift rules:** gifts go in a new `reward` kind in `spark_allowances`, expire after 60 days, and are spent before bought Sparks. Bought Sparks never expire.
- **Retention offers:**
  - Win-back: 30% off monthly for 2 months, once per account. Still +$0.49/mo after AI.
  - Save offer: 10% off the next year, once, for members of 12+ months who turn auto-renew off.
  - Founders: 20% off their first renewal (12 months). Never a forever price.
- **The member price is an experiment.** A 50% holdout never sees it. It switches off unless conversions reach 1.4x, which is the break-even.
- **Free perks:**
  - Letterpress cards, the badge after the name and the founder avatar ring.
  - App icons for Emerald, Diamond and Elite.
  - Streak freeze every 4 weeks from Emerald.
  - Streak repair within 48h, bought with points.
  - Monthly recap card.
  - Early access from Diamond.
  - Points shop: freeze, repair, card finish, Buddgy look.
- **Showing the value:**
  - Pack sheet: "650 Sparks + 65 Diamond bonus (worth EGP 10)".
  - Monthly recap: "Diamond gave you EGP 48 this year".
  - A tier-up screen with a 60-day countdown on the gift.
  - Monday notice: "Your Diamond credits are in".

**Cost per year, worst / expected:**
- Steady Free member reaching Diamond: $0.57 / $0.23. This is covered if about 5 in 100 such members go Pro who otherwise wouldn't.
- Elite Pro member: $0.46 (10% of gross profit) / $0.18 (4%).

**Guardrails:**
- Refunds of a pack after use claw back the pack and its bonus (Apple Consumption API, negative balance allowed).
- Gifts are limited to one account per device.
- Test accounts never take founder numbers.
- No rewards for ratings.
- No chance-based rewards with cash value.
- Full offer terms are shown before the store sheet.
- Each reward has an admin switch and a cost line.

## 3. Open decisions

1. **Heavy Pro users on the Egypt yearly plan.** Using the full weekly limit costs about $3.67/yr more than EGP 499 brings in (typical use leaves $4.73). Either watch 8 weeks of data, or set a 120-credit weekly limit for yearly members in Egypt.
2. **Family Sharing on Pro:** recommended off at launch.
3. **Store enrolment:** confirm Apple Small Business and Google's 15% tier.

## 4. Database (migration first, then types, then code)

1. Update `spark_products` (60/125/320/650/2000 with new IDs) and set `sparks_bonus.proPercent` to 15.
2. Add a member bonus rule: the max of the Pro bonus and the tier bonus.
3. Replace the draft tiers with silver/emerald/diamond/elite/founder, including perks and colours. There are 0 loyalty accounts, so this is safe.
4. Tier assignment from `lifetime_points` (`tierFor` exists). Elite gated on Pro; Elite Founder on founder + Elite.
5. Add the multiplier, the real-week gate, the freeze rules and seasonal freezes to `loyalty_record_week_check`.
6. Points shop RPC: spend `points_balance` and write a ledger row.
7. Add a `reward` allowance kind with expiry; tier-up and milestone grants; Free weekly bonus credits by tier.
8. Offer-eligibility RPC: member price, win-back and save offer, each limited to once per account.
9. Refund clawback that includes bonus Sparks.
10. Monthly Pro stats RPC.
11. `loyalty_program` founder window, excluding test accounts.

## 5. UI (reuse first; new pieces need owner OK)

- **Plan and billing:**
  - Flip rig on `MemberCard` (an additive `flip` prop).
  - Hover light.
  - Tier badge after the name.
  - Four-action manage bar.
  - Pro this month panel.
  - Sparks in the purchase history.
- **Usage:**
  - Packs inline, with the bonus shown in EGP value.
  - Most popular badge and a More packs option.
  - Credit amounts on the meters.
- **Rewards page (new):**
  - Letterpress card on the rig.
  - Hot streak strip.
  - Tier ladder.
  - Earn and Spend points lists.
  - Points shop.
  - Tier-up screen.
- **Founders club:** signature card on the rig. The credit name form, credits list and share button stay.
- **Profile (option A):** gold PRO tag on the avatar and the tier badge after the name. Founders also get the avatar ring and a numbered chip.
- **App icons:** Emerald, Diamond and Elite. Monthly recap share card.
- **New components needing approval:**
  - Flip rig
  - Letterpress card
  - Signature card variant
  - Manage bar
  - Streak strip
  - Tier badge
  - Avatar PRO tag and ring
  - Points shop sheet
  - Recap card
  - Tier-up screen

## 6. Cannot do as drawn

- Phone tilt by device motion needs an iOS permission prompt, so phones use tap-to-flip instead.
- Pinyon Script has no Arabic letters.
- "Priority replies" was removed.
- Tier offers need per-user offer codes (Apple) and developer-determined offers (Google). Introductory offers can't be targeted.

## 7. Board review: scale, free users and the 2-year price plan

Source: the "buddget Loyalty Decision" artifact (board section). The board found:

- **Egypt and the Gulf have different jobs.** Egypt is the growth engine (organic, invites, partners). The Gulf is the profit engine: 1,000 UAE users earn about 6x what 1,000 Egypt users do.
- **Free users are cheap.** Each costs about EGP 5–6 a year in AI and infra, and at most EGP 92. The free limits stay as they are.
- **Egypt-only Pro AI limit.** Pro in Egypt gets 100 credits a week and 300 SMS AI calls a month; the Gulf keeps 150 and 450. This takes the heaviest Egypt yearly member from -EGP 200 a year to about break-even at EGP 499, and +EGP 65 at 599. It needs a per-country Pro limit in `plans`/`ai_effective_limits`.
- **Price changes apply to new subscribers only.** Each one happens only when its trigger is met. Egypt changes each plan at most once a year. Currency rule: review Egypt prices whenever the EGP moves 15%.

| Quarter | Egypt | UAE | Saudi | Trigger |
|---|---|---|---|---|
| Q1 2027 | 69 / 499 | 14.99 / 99.99 | 12.99 / 99.99 | launch; Egypt Pro limit; yearly plan shown first |
| Q2 2027 | hold | hold | hold | week-12 review |
| Q3 2027 | yearly 599 | hold | hold | 2 quarters of data; paying share not falling |
| Q4 2027 | hold | hold | hold | New Year push on yearly |
| Q1 2028 | monthly 79 | hold | hold | monthly churn not rising; Ramadan yearly campaign |
| Q2 2028 | hold | 16.99 / 119.99 | 14.99 / 109.99 | Gulf paying share at least 3%; Gulf ads start only below break-even CPI |
| Q3 2028 | yearly 649 only on currency trigger | hold | hold | EGP down 15%+ since the last change |
| Q4 2028 | review all for 2029 | | | household plan |

**2-year outlook** (users 2k to 72k active; year-1 marketing $15.5k; year-2 marketing 20% of revenue):

| Case | Year 1 | Year 2 profit | Margin | After 24 months |
|---|---|---|---|---|
| Conservative (3% paying, Gulf 30%) | -$14.9k | $8.0k | 35% | -$6.9k |
| Target (5% paying, Gulf 40%, AI -25%/yr) | -$13.8k | $23.7k | 59% | +$10.0k |

- Both cases turn profitable in Q1 2028.
- These figures are before the founder's salary, support, tax and legal.

**Marketing:**
- Pay creators per paying member, not per view.
- Invites, Arabic store pages, payday and Ramadan moments, wallet/bank/employer partnerships.
- No paid installs above the break-even install price: Egypt about EGP 5.6–14, UAE about AED 1.8–4.4, Saudi about SAR 1.5–3.8.

## 8. Order of work

1. Sparks repricing (DB, App Store guide, UI copy). This happens before the owner creates the store products.
2. Tiers, week-check rules and the points shop.
3. Rewards page, cards, rig and hover light, and badges.
4. Plan and billing, Usage and Founders.
5. Gifts, member bonus and offers, each behind its admin switch.
6. App icons and the recap card.
