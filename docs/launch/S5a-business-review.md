# S5a business review: buyer view, three markets, one plan or more

Date: 2026-11-15. A design review, no code, no migrations, no database writes, nothing sent to testers. It tests `docs/launch/S5a-pricing.md` from the buyer's side and changes it where the evidence says so. Method follows six skills of the MIT-licensed `founder-skill` repository (competitors, consumer panel, pricing, CFO, offer, board), applied by hand: the plugin was not installed and none of its scripts were run. The persona dealing, tallies and price maths are a small seeded script of this session's own (seed 20261115).

**Read this first.** The buyer panel is 60 simulated people played by an AI model, briefed to be hard to please. Simulated buyers usually lean agreeable, so a panel's buy rate is normally an upper bound; this one was told that saying no is normal, and it said no. Either way it picks what to test with real people. It is not proof of anything, and no line quoted from it is a testimonial.

## 1. Why only one plan? (the direct answer)

**One paid plan is right for launch. A Pro and Max ladder like Claude's is not, and here is the difference.**

Claude sells two paid tiers because heavy use costs many times more to serve and real users hit the limits every week. The higher tier sells something people already ran out of. buddget has nothing that behaves like that:

- **Cost does not scale with use.** A heavy buddget user costs about $0.05 a month in AI. The most a Plus subscriber can cost at the cap is about $0.35. There is no expensive resource to ration.
- **Nobody runs out.** 55 of 60 simulated buyers said the free 20 AI credits a month are enough. The real testers' busiest month was 61 AI calls. A tier that sells "more AI" sells something nobody is short of.
- **The panel did not want it.** Shown free plus one tier, 0 of 60 would pay. Shown free plus two tiers (Plus and a Pro at double the price with 600 credits, partner sharing, a monthly AI review and priority support), 0 of 60 would pay. The second tier won one extra trial, from a buyer who wanted to share a budget with his wife, and he and others said the same thing: put sharing in the cheaper plan.
- **Competitors mostly agree.** Of the apps whose tiers could be read, 13 have one paid tier, 6 have two, 1 has three or more.
- **Each tier has a cost.** Two more store products per store, a second paywall, upgrade and downgrade paths, and a second set of billing tests, for a base of 47 testers.

So today a higher tier would earn its place only as a price anchor that makes Plus look cheap. That is a trick, not value, and buyers who distrust a new finance app will read it as one.

The four options, compared:

| Option | Verdict | Why |
|---|---|---|
| (a) One paid plan | **Yes, now** | Matches cost, evidence and build capacity |
| (b) Two paid tiers (Plus, Pro) | No | Nothing scales with use; the panel's A and B results were the same |
| (c) One plan plus a household plan | **The likely second product, later** | Sharing one budget with a partner is the only "more" that buyers asked for (10 of 60 named it as something that would change their answer) |
| (d) One plan plus credit packs as the "more" lever | No | No demand for more credits; packs stay designed and unbuilt |

**What would change this answer** (real data, not simulated):

| Signal | Then |
|---|---|
| Partner sharing ships, and 20% of Plus subscribers use it or 30% of people who leave the paywall name it | Add a household plan (2 to 5 people) above Plus |
| 10% of Plus subscribers use over 80% of their credits in a month | Ship credit packs; if it persists, a higher-credit tier |
| Freelancers or shop owners ask for separate books for a business | A "Business" plan with more than one ledger |

**Adding a tier later needs no redesign.** `plans` is one row per plan with a limits object and a features list, and `user_entitlements.plan_key` points at it. S6 should add two things now so the door is open: a limit key `seats` (free 1, Plus 1 until sharing ships) and the feature key `shared_budget`. A household plan is then one more `plans` row, one more product in the same store subscription group (higher level, so the stores handle the upgrade), and no schema change.

## 2. What the review found, in short

1. **The price is not the problem. The paid plan's content is.** Plus sells volume (more accounts, longer reports, more AI) and most buyers never reach the limit. "Free already covers me" was the reason 48 of 60 gave for not paying.
2. **Trust comes before price.** 11 of 60 would not let any app read bank SMS. The most common things that would change a no were a lower price (31 buyers) and proof that the app reads the buyer's own banks (28), then reviews (21), working without SMS (17), paying once (12), partner sharing (10), full Arabic (8, all in Saudi Arabia).
3. **buddget is not alone.** An SMS-reading app already sells in Egypt at EGP 89.99 a month. Two more do it in the UAE. Saudi Arabia has two bank-linked local apps, one owned by a large bank. The earlier document's line that no competitor has SMS tracking was wrong and is corrected.
4. **A better listing did not rescue it.** A revised offer (named banks, a privacy note, 2 free SMS accounts, a lower Egypt price, partner sharing inside Plus, a pay-once option, a price promise) went to 20 of the same buyers. Still none would pay. One moved from "would not install" to "would use it free".
5. **The business is cheap to carry.** Fixed costs are about $58 a month and break-even is about 44 subscribers. Launching with low revenue expectations costs little; what matters first is proof, reviews and retention.
6. **The board (three lenses) scored the model 3, 4 and 4 out of 10** and all three voted "fund only if" real, measured gates are met before the paid plan is pushed.

## 3. Step 1: competitors

Public pages only, read 2026-11-15 by three research agents. Google Play pages returned no content, so every local price is from the iOS App Store storefront. Many store listings show a price with no period; those are marked. Review themes come from the handful of reviews each page showed, so they are anecdotes with counts, not rates.

### Egypt

| App | What it sells | Comparable price (EGP) | Paid tiers | Source |
|---|---|---|---|---|
| Pockito | Logs bank SMS and Apple Pay taps; AI, voice | 89.99 a month, 499.99 a year, 34.99 a week | 1 | https://apps.apple.com/eg/app/id6755700782 |
| Spendee | Budgets, shared wallets | 249.99 a month; Plus from 69.99; lifetime 2,499.99 | 2 + lifetime | https://apps.apple.com/eg/app/id635861140 |
| Wallet (BudgetBakers) | Budgets, goals, shared finances | 249.99, 799.99, 1,299.99, 2,499.99 (periods not labelled) | 1 + lifetime | https://apps.apple.com/eg/app/id1032467659 |
| YNAB | Zero-based budgeting | 239.99 and 5,999.99 (periods not labelled) | 1 | https://apps.apple.com/eg/app/id1010865877 |
| Monefy | Simple manual tracker | 629.99, 1,999.99, 2,999.99 (not labelled) | 1 | https://apps.apple.com/eg/app/id1212024409 |
| Pocket | One-time paid tracker | 199.99 once, no subscription | 0 | https://apps.apple.com/EG/app/id6762511332 |
| Masareef, Masareefy, Flosy | New Egyptian-Arabic trackers; two claim bank-text logging | Only USD found ($1.99 to $2.99 a month; Masareefy has a Family plan) | 1 to 2 | https://apps.apple.com/app/id6778533443 , https://apps.apple.com/app/id6779322746 , https://apps.apple.com/app/flosy/id6780290572 |
| Telda (indirect) | Wallet and card with spending categories and budgets | Free | 0 | https://apps.apple.com/eg/app/id1519608437 |
| Substitutes | Excel, phone notes, the bank's app, nothing | Free | | not sourced |

Complaints seen: rigid categories and missing analysis (Wallet, Monefy, 3 reviews); buggy updates, wrong AI receipt totals and an extra AI fee (Spendee, 2); waitlist and locked funds (Telda, 3). Pockito: 15 ratings, no complaints shown.

### United Arab Emirates

| App | What it sells | Comparable price (AED) | Paid tiers | Source |
|---|---|---|---|---|
| Monee.ae | UAE-built; parses bank SMS; Shortcuts logging | 19.99 a month, 129.99 a year | 1 | https://apps.apple.com/ae/app/id6447753044 |
| Expensly | Auto-logs bank SMS and card taps; Arabic; Zakat | 29.99 a month, 199.99 a year; Family 49.99 | 2 + family | https://apps.apple.com/ae/app/id6780650179 |
| Crunch | Budget tracker linking banks | 19.99 a month, 199.99 a year | 1 | https://apps.apple.com/ae/app/id1571747682 |
| YooToo | UAE budget tracker | 29.99 a month, 229.99 a year | 1 | https://apps.apple.com/ae/app/id6761253882 |
| Spendee | Budgets, bank sync | 28.99 a month | 2 | https://apps.apple.com/ae/app/id635861140 |
| Money Lover | Expense tracker | 11.99 a month, 69.99 a year | 3+ | https://apps.apple.com/ae/app/id486312413 |
| Money Manager | Manual tracker | 8.99 a month, 77.99 a year | 1 | https://apps.apple.com/ae/app/id560481810 |
| Wallet | Budgeting, bank sync | 24.99 to 214.99 (not labelled) | 1 | https://apps.apple.com/ae/app/id1032467659 |
| YNAB | Zero-based budgeting | 57.99 and 399.99 (not labelled) | 1 | https://apps.apple.com/ae/app/id1010865877 |
| Mashreq NEO insights (indirect) | In-bank tracker, 40+ categories | Free to customers | 0 | https://www.mashreq.com/en/uae/news/2026/may/mashreq-launches-money-insights/ |

Complaints seen (1 to 3 star, UAE reviews): bank sync broken or no UAE banks (Wallet about 17 of 33, Spendee about 4, Crunch about 3); paid and then sync failed or refund refused (Wallet about 9, Spendee about 4); paywalls and upgrades not activating (Money Lover about 8); price rises (YNAB 2).

### Saudi Arabia

| App | What it sells | Comparable price (SAR) | Paid tiers | Source |
|---|---|---|---|---|
| Drahim (owned by Al Rajhi) | Open-banking link to Saudi banks, budgets, investing | 29.99 and 249.99 (not labelled) | 1 | https://apps.apple.com/sa/app/id1591612912 |
| Malaa | Saudi open banking: track, save, invest | Free on the listing | not found | https://apps.apple.com/sa/app/id1491121903 |
| Money Lover | Money manager | 12.99 a month, 77.99 a year | 2+ | https://apps.apple.com/sa/app/id486312413 |
| Wallet | Expense tracker | 20.99, 59.99, 129.99; lifetime 199.99 (not labelled) | 1 + lifetime | https://apps.apple.com/sa/app/id1032467659 |
| YNAB | Zero-based budgeting | 64.99 and 499.99 (not labelled) | 1 | https://apps.apple.com/sa/app/id1010865877 |
| Throof | Envelope budgeting, paste-in SMS | Free, no subscription | 0 | https://apps.apple.com/app/id6761828775 |
| Pockito | SMS expense tracker | USD only: $9.99 a month, $49.99 a year | 1 | https://apps.apple.com/app/id6755700782 |
| Bank apps, STC Pay (indirect) | Spending analytics in the bank or wallet | Free | 0 | https://www.sab.com/en/everyday-banking/ways-to-bank/sab-360/ |

Complaints seen: bank-link errors and duplicate transactions (Drahim 2), older months behind the paywall (Drahim 1), missing export and backup (Wallet about 5), not open to non-Saudi residents (Malaa 1).

### Price range, map and gap

| Market | Monthly low | Monthly median | Monthly high | Annual low | Annual median | Annual high | buddget (revised) |
|---|---|---|---|---|---|---|---|
| Egypt (EGP) | 89.99 | about 245 | 249.99 | 499.99 | not reliable | about 6,000 | 69 / 499 |
| UAE (AED) | 8.99 | 19.99 | 29.99 | 69.99 | 129.99 | 229.99 | 14.99 / 99.99 |
| Saudi Arabia (SAR) | 12.99 | about 29.99 | about 64.99 | 77.99 | about 249.99 | about 499.99 | 12.99 / 99.99 |

Egypt has only two labelled monthly prices, so its median leans on unlabelled ones. The Saudi median is Drahim's unlabelled 29.99.

Positioning map (capture on one axis, local fit on the other):

| | Global, English-first | Local: Arabic, local banks |
|---|---|---|
| **Automatic capture** | Wallet, Spendee, Crunch (bank sync that reviewers say fails on local banks) | Pockito (Egypt), Monee.ae and Expensly (UAE), Drahim and Malaa (Saudi, by bank link), **buddget** |
| **Manual entry** | YNAB, Monefy, Money Manager, Money Lover | Masareef, Flosy, Throof, Excel and notes |

**The gap.** The automatic-and-local corner is no longer empty. What is still open in it: one app that does automatic capture **and** the rest of a household's money (debts, installments and buy-now-pay-later, goals, savings, two currencies) with a free tier that is honestly usable, and that can show it reads the buyer's own bank. Nobody in the tables publishes measured accuracy by bank.

**Who could copy buddget fastest.** Egypt: Pockito already has the hero feature and a similar price. UAE: Monee.ae, then Expensly (already has Arabic and a family plan). Saudi: Drahim, which has the bank relationships and about 21,000 ratings. Wallet is the best-resourced global app and its UAE reviews show a bank-sync problem that SMS would solve (an inference, not a stated plan).

## 4. Step 2: buyer panel

**Set-up.** 60 simulated buyers, one Sonnet subagent each, in waves of 10, one fixed brief for everyone. Each saw the listing as a store would show it, in local currency, with the trial, then two paid ladders in an order alternated by buyer id: (A) free plus Plus; (B) free plus Plus plus a Pro at double the price. Each answered in JSON: decision per ladder, tier, period, a reason code, the reason in their own voice, the main objection, what would change a no, how they can pay, and four price answers. The architect never answered for a buyer.

**Customer profiles the cards were dealt from.** Every share, income band and payment mix below is **this session's estimate**, not sourced data. Only the direction (Egypt is price-sensitive and has payment friction; the Gulf has expats who send money home) rests on things read earlier, such as Google's own warning that Egypt-issued cards may be declined.

| Market | Segments (share, monthly income) | Behaviours dealt (2 each) | Objections dealt (2 each) | Can pay in a store by |
|---|---|---|---|---|
| Egypt, 24 | Young salaried professional (40%, EGP 15,000 to 35,000); mid-career family earner (25%, 35,000 to 90,000); fresh graduate or gig worker (25%, 7,000 to 15,000); freelancer paid partly in USD (10%, 40,000 to 150,000) | Pays for a subscription already; never paid for an app; cash from the ATM; wallet and InstaPay only; credit card and installments; Excel or notes; quit a budgeting app; shares decisions with a spouse | Prices rise every year; no SMS access; Excel is free; card declined in the store; subscriptions are a trap; free is enough; bank app shows it; distrust of a new app | Card 35%, phone credit 20%, wallet only 30%, cannot 15% |
| UAE, 18 | Arab expat professional who remits (35%, AED 8,000 to 20,000); South Asian expat who remits (30%, 4,000 to 10,000); high-income Western expat (15%, 20,000 to 45,000); Emirati national (20%, 18,000 to 40,000) | Remits monthly; costs in another currency; several credit cards; many subscriptions; relies on the bank app; spreadsheet; dependents at home; saving for a home or wedding | Bank app categorises; no SMS access; too many subscriptions; doubts local bank support; pay once not monthly; distrusts AI advice; built for Egypt; free is enough | Card or wallet pay 85%, other 15% |
| Saudi Arabia, 18 | Saudi young professional (40%, SAR 8,000 to 16,000); Saudi head of family (20%, 15,000 to 35,000); Arab expat who remits (25%, 5,000 to 14,000); South Asian expat (15%, 3,000 to 7,000) | Apple Pay, mada, STC Pay; buy-now-pay-later often; several subscriptions; remits; relies on the bank app; never budgeted; saving for a wedding or home; notes or spreadsheet | Bank app shows it; no SMS access; too many subscriptions; doubts local bank support; pay once; wants full Arabic; free is enough; distrust of a new app | Card 82%, other 18% |

The deal is random, so the dealt mix differs from the shares (for example 7 Emiratis of 18, not 4).

**Result.**

| | Egypt (24) | UAE (18) | Saudi (18) | All (60) |
|---|---|---|---|---|
| Ladder A: would pay | 0 | 0 | 0 | 0 |
| Ladder A: serious about the trial | 0 | 0 | 1 | 1 |
| Ladder A: free, never pay | 23 | 15 | 14 | 52 |
| Ladder A: would not install | 1 | 3 | 3 | 7 |
| Ladder B: would pay | 0 | 0 | 0 | 0 |
| Ladder B: serious about the trial | 1 (Pro, for sharing) | 0 | 1 (Plus) | 2 |
| Top reason: free is enough | 21 | 14 | 13 | 48 |
| Top reason: will not share SMS or distrust | 3 | 4 | 4 | 11 |
| Accounts wanted on SMS: 0 / 1-2 / 3 / 4+ | 8 / 10 / 5 / 1 | 6 / 6 / 3 / 3 | 4 / 8 / 3 / 3 | 18 / 24 / 11 / 7 |
| 20 free AI credits enough | 23 | 16 | 16 | 55 |
| Can pay by card | 10 | 16 | 13 | 39 |
| Cannot pay in a store at all | 5 | 0 | 1 | 6 |

By segment and behaviour nothing separates: every segment in every market landed on "free". The two who took the trial seriously were a Saudi-based Arab expat with 4 accounts who tracks in notes, and an Egyptian who decides money with his wife.

**Buy rate: 0 of 60 under both ladders.** With real freemium apps a few percent of active users pay, so read this as "expect the low end, and do not expect the current paid plan to sell itself", not as "nobody will ever pay".

**Top three reasons for passing, one simulated line each (not testimonials).**

| Market | Reason | In the buyer's voice (simulated) |
|---|---|---|
| Egypt | Free covers me | "The free tier gives me SMS tracking on 3 accounts and I only use 2, so I'd install it for the auto-log and never pay." |
| Egypt | Will not share SMS with an unknown app | "I will not let an unknown new app read my bank SMS, which is its whole selling point." |
| Egypt | Subscriptions | "A one-time payment instead of a monthly subscription." |
| UAE | No proof it fits here | "I can't tell if an app built for Egypt handles UAE bank SMS formats." |
| UAE | The bank app does it | "My bank app already shows my spending by category." |
| UAE | Subscription fatigue | "I already pay for too many subscriptions." |
| Saudi | Free covers me | "Free already gives me SMS tracking on 3 accounts and I only use one bank." |
| Saudi | No proof it reads my bank | "Proof that it reads my Saudi bank SMS correctly." |
| Saudi | Arabic | "The listing does not say the Arabic is complete throughout the app." |

**What would change a no** (buyers who raised each, across both ladders):

| Theme | Egypt | UAE | Saudi |
|---|---|---|---|
| Proof it reads my banks | 6 | 12 | 10 |
| Lower price | 12 | 8 | 11 |
| Reviews | 7 | 8 | 6 |
| Works without SMS, or a clear privacy promise | 7 | 6 | 4 |
| Pay once | 6 | 3 | 3 |
| Partner or family sharing | 5 | 2 | 3 |
| Full Arabic | 0 | 0 | 8 |
| A way to pay (wallet, InstaPay, phone credit) | 3 | 0 | 0 |

**Three lines per market.**

- **Egypt.** They would install it for free SMS tracking and stay free; most already cope with Excel or the bank app. A fifth cannot pay in a store at all and another quarter can only pay by wallet. They expect every subscription to get dearer each year and would rather pay once.
- **UAE.** They can pay, and price is not the first objection. They want proof it understands UAE banks and remittances, and they compare it with what the bank app already gives them free. Several distrust AI money advice, so the AI is not a selling point there.
- **Saudi Arabia.** The same proof question, plus full Arabic, plus installment and buy-now-pay-later control. The only buyer close to paying had 4 accounts and was tired of typing. Local bank-linked apps set the comparison.

## 5. Step 3: price

Van Westendorp points from the panel's four answers (monthly price of Plus):

| Market | Too cheap to trust below | Cheapest sensible (PMC) | Indifference (IDP) | Upper limit (PME) | Competitor monthly range |
|---|---|---|---|---|---|
| Egypt (EGP) | 15 median | 25.5 | 45.5 | 89.5 | 89.99 to 249.99 |
| UAE (AED) | 4 median | 5.1 | 14.9 | 24.9 | 8.99 to 29.99 |
| Saudi Arabia (SAR) | 4 median | 5.1 | 9.9 | 19.9 | 12.99 to about 65 |

The optimal point came out equal to the cheapest sensible point in all three markets (the "too cheap" and "too expensive" curves do not overlap), so it is not reported separately.

**How far to trust it.** Not far. The answers anchored on the price the buyer was shown: when the Egypt listing said 79, the median "getting expensive" answer was 62.5; when the re-test said 59, it was 59.5. And at no price shown did anyone say they would pay. The curve says where a price stops looking absurd, not where people buy.

**Decision per market.**

| Market | Monthly | Annual | Was | Why | Two prices to test with real buyers |
|---|---|---|---|---|---|
| Egypt | **EGP 69** | **EGP 499** | 79 / 599 | Inside the panel's range and under its upper limit; under the one direct rival's 89.99; annual equal to that rival's 499.99 and worth EGP 41.6 a month, near the indifference point | 49 and 79 |
| UAE | **AED 14.99** | **AED 99.99** | 14.99 / 119.99 | Monthly sits on the indifference point and under the competitor median of 19.99; annual moves under the competitor median of 129.99 | 9.99 and 19.99 |
| Saudi Arabia | **SAR 12.99** | **SAR 99.99** | 14.99 / 119.99 | The Saudi panel's range sits lower than the UAE's; 12.99 matches the cheapest labelled rival and is far under the bank-owned app's 29.99 | 9.99 and 14.99 |
| Elsewhere | USD 4.99 | USD 39.99 | same | Anchor only | none |

**Why the Gulf prices are three times Egypt's in dollars, and no longer equal to each other.** Egypt's EGP 69 is about $1.27 on the shelf; AED 14.99 is $4.08; SAR 12.99 is $3.46. The panel's own ranges differ by that much (Egypt's upper limit is about $1.64, the UAE's $6.78, Saudi's $5.31), the competitor ranges differ the same way, and so do the dealt incomes. The UAE and Saudi numbers split because the Saudi range came out lower and Saudi VAT is 15% against 5%.

**How to test.** Stores can run a price test without code changes to the app: Google Play price experiments by country, and RevenueCat experiments on iOS (two offerings, users split at random). Run one market at a time, at least 4 weeks, and compare revenue per visitor to the paywall, not conversion alone. Until there are a few hundred paywall views a week, no test will separate two prices, so the first months simply run the launch price.

**Opening offer.** A founding price on the annual plan only: **EGP 399, AED 79.99, SAR 79.99 for the first year**, for anyone who subscribes in the first 60 days after public launch, ending on the date S5b sets for the founding-member window. It is a store introductory offer (pay up front, one year), so the store enforces one per account and the normal price applies at renewal. No crossed-out "was" price is shown; the listing states the normal price and the end date. It is not repeated, so it does not teach people to wait.

**Not at launch: a pay-once price.** 12 buyers asked for it and several rivals sell one. In the re-test, with a pay-once option on the listing (EGP 1,299, AED 249, SAR 249), nobody took it and those who mentioned it wanted "much lower". A cheap lifetime price in a devaluing currency caps revenue for good. Revisit after 90 days of real paywall data.

## 6. Step 5: numbers

Unit: one subscriber-month. Prices are the revised ones. Half of subscribers on annual is an assumption.

**Fixed monthly costs.**

| Item | Monthly | Source or basis |
|---|---|---|
| Vercel Pro, one seat | $20.00 | https://vercel.com/pricing ("$20 per user / month"). **Assumed**: the plan the owner is on was not checked; the repo runs 7 daily crons, which the free plan also allows, but commercial use on the free plan could not be confirmed |
| Supabase Pro | $25.00 | https://supabase.com/pricing ("from $25/month"). **Assumed** plan; the free plan pauses after a week idle and caps the database at 500 MB |
| Apple Developer Program | $8.25 | $99 a year, https://developer.apple.com/programs/ |
| Two domains (.app and .online) | $4.83 | About $23 and $35 a year at one registrar, from third-party price trackers (estimate) |
| Google Play account | $0 | $25 once, https://support.google.com/googleplay/android-developer/answer/6112435 |
| Sentry, Firebase messaging, RevenueCat | $0 | Free tiers (https://sentry.io/pricing/ , https://firebase.google.com/pricing , https://www.revenuecat.com/pricing/) |
| **Total** | **$58.08** | |

**Variable cost and contribution per subscriber-month.**

| | Egypt | UAE | Saudi Arabia |
|---|---|---|---|
| Shelf price, monthly plan | EGP 69 | AED 14.99 | SAR 12.99 |
| VAT inside the price | 14% | 5% | 15% |
| Store fee | 15% | 15% | 15% |
| Net, monthly plan | $0.94 | $3.30 | $2.56 |
| Net, annual plan, per month | $0.57 | $1.84 | $1.64 |
| AI at typical use | $0.05 | $0.05 | $0.05 |
| SMS parsing at typical use | $0.02 | $0.02 | $0.02 |
| RevenueCat | $0 under $2,500 a month tracked; then 1% of all tracked revenue | | |
| **Contribution (half monthly, half annual)** | **$0.69** | **$2.50** | **$2.03** |
| Break-even if only this market | 84 subscribers | 23 | 29 |

**Blended** (64% Egypt, 30% UAE, 6% Saudi, the testers' currency mix): contribution **$1.31**, break-even **44 subscribers**.

**Price below variable cost?** Not at typical use. One case is: an Egypt annual subscriber who spends all 100 credits on chat every month ($0.35) and also triggers the SMS AI cap every day ($0.40) costs $0.75 against $0.57 net, a loss of $0.18 a month. It needs deliberate abuse of both caps. The Plus SMS AI cap drops from 60 to 30 a day to bound it; watch it in admin.

**12-month ramp.** Starts from the real base of 47 testers. The growth numbers are **assumptions**: 150 installs in month 1 growing 25% a month, 30% of installs become active, 90% of actives stay each month. Paying share 2% of actives, which is generous next to the panel (2 of 60 serious about the trial, none paying).

| Month | Installs | Active | Subscribers | Monthly result |
|---|---|---|---|---|
| 1 | 150 | 58 | 1 | -$57 |
| 3 | 234 | 168 | 3 | -$54 |
| 6 | 458 | 430 | 9 | -$47 |
| 9 | 894 | 914 | 18 | -$34 |
| 12 | 1,746 | 1,839 | 37 | -$10 |

Break-even is not reached inside 12 months on these assumptions; it arrives around month 13. The whole year costs about **$490**.

| What-if | Month-12 subscribers | Month-12 result | 12-month total |
|---|---|---|---|
| Base | 37 | -$10 | -$488 |
| Price down 10% | 37 | -$15 | -$510 |
| Conversion down 20% | 29 | -$19 | -$529 |
| AI cost up 15% | 37 | -$10 | -$489 |
| EGP down 20% against the dollar | 37 | -$13 | -$503 |
| Conversion at 0.5% | 9 | -$46 | -$645 |

**Reading.** None of the what-ifs changes the picture. The model is insensitive to price, AI cost and the exchange rate at this size; it is sensitive only to how many people install and stay. Egypt is the worst market per subscriber and the launch market; one UAE subscriber is worth 3.6 Egyptian ones.

## 7. Step 6: offer

**Obstacles between the buyer and the result, in the buyer's words** (from the panel and competitor reviews):

1. I don't know this app. 2. It has no reviews. 3. It wants to read my bank messages. 4. I can't tell what happens to those messages. 5. Does it read my bank? 6. It was built for Egypt; I live in the Gulf. 7. Is it really all in Arabic? 8. My bank app already shows my spending. 9. Excel does this for nothing. 10. I take my salary out in cash, so SMS misses most of it. 11. On iPhone I have to set something up first. 12. The free version already covers my accounts. 13. Another subscription. 14. Prices here go up every year. 15. I would rather pay once. 16. My card gets declined in the store. 17. I can only pay by wallet or phone credit. 18. I tried a budgeting app and quit in a month. 19. I decide money with my spouse and this is for one person. 20. It says nothing about the money I send home. 21. I owe on four installment plans and can't see the total. 22. I don't trust AI with money advice. 23. Rivals locked my own history and export behind a paywall. 24. If I stop paying, do I lose my data? 25. What if it books a wrong amount?

**What that turns into.** Scored 1 to 5 for value to the buyer and cost to deliver (5 is cheap).

| Change | Answers obstacles | Value | Cost to deliver | Decision |
|---|---|---|---|---|
| Publish the list of supported banks and wallets per country, with measured accuracy, in the listing, on the site and in onboarding | 5, 6 | 5 | 4 (the gold set already measures it for Egypt; UAE and Saudi need measuring) | **Do, before any marketing in that country** |
| A plain privacy block: SMS is optional, only bank messages are read, text deleted after 30 days, nothing sold | 3, 4 | 5 | 5 (already true; check each claim against the code first) | **Do** |
| Say clearly that everything works by typing, voice or receipt photo | 3, 10 | 4 | 5 | **Do** |
| Free SMS tracking on 2 accounts, not 3 | 12 | 3 | 5 | **Do** (board split, see section 8) |
| Export free; free reports cover 3 months, not 2 | 23, 24 | 4 | 5 | **Do**: holding a user's own data behind the paywall costs trust that a new finance app does not have |
| Plus leads with "every account on autopilot and the whole year in view", not with AI credits | 8, 9, 22 | 3 | 5 | **Do** |
| Day 12 of the trial: "what Plus found in your last 30 days", from the user's own data | 12, 18 | 4 | 3 | **Do** (replaces the generic day-10 summary) |
| Share one budget with a partner | 19 | 5 | 1 (cross-user sync and row security in a local-first app; weeks) | **First build after launch**; the trigger for a household plan |
| A "sent home" view for remittances | 20 | 4 in the Gulf | 3 | Candidate after launch; needs the owner's yes |
| Installments and buy-now-pay-later total shown in the listing and first screens | 21 | 4 | 5 (already built) | **Do** in the copy |
| Price promise: a subscriber's price does not rise for 12 months | 14 | 4 | 5 | **Do** |
| Founding price on the annual plan, 60 days, fixed end date | 13, 14 | 3 | 4 | **Do** |
| Pay-once price | 15 | 3 | 4 | Not at launch |
| Wallet, InstaPay or phone-credit payment | 16, 17 | 4 in Egypt | 2 | Phone credit comes free with Play Billing where offered; web checkout later, as already planned |
| Fully Arabic, stated on the listing | 7 | 5 in Saudi | 5 if true | **Do**, after an Arabic pass in S7 |

**Guarantee the numbers can afford.** "Annual plan: if you are not happy in the first 30 days, tell us. On Google Play we refund you ourselves. On the App Store the refund is Apple's decision; we back your request, and if Apple says no we add six months free." Worst case it costs one annual net payment ($6.83 in Egypt) per unhappy buyer. Apple does not let a developer issue the refund, so the wording must not promise one.

**Urgency.** Only the founding window, which has a real end date and a real cap, and belongs to S5b. S5b must respect: one window, one end date, no extension, no second "last chance"; the founding price is the only money perk and lasts one year; the badge and number are the lasting part.

**Value equation, before and after** (1 to 10; higher is better on each line):

| | Before | After | Why |
|---|---|---|---|
| Outcome wanted | 6 | 7 | Leads with "every account, whole year, both partners" instead of counts and credits |
| Belief it will work | 3 | 5 | Named banks with accuracy, privacy block, guarantee, price promise |
| Speed to the result | 7 | 7 | Unchanged: SMS logging is immediate |
| Ease | 6 | 6 | Unchanged: iPhone still needs a one-time setup |

**Re-test (20 buyers, same seed: the first 8 Egypt, 6 UAE, 6 Saudi).** Listing with named banks, the privacy block, 2 free SMS accounts, Egypt at EGP 59 a month and 449 a year, Saudi at 12.99, partner sharing shown inside Plus, a pay-once price and the price promise.

| | First panel (same 20) | Revised offer |
|---|---|---|
| Would pay | 0 | 0 |
| Serious about the trial | 0 | 0 |
| Free, never pay | 18 | 19 |
| Would not install | 2 | 1 |

**What moved: almost nothing.** One UAE buyer moved from "would not install" to "would use it free", citing the privacy block. Asked what mattered most, 11 of 20 named the two free SMS accounts (as the reason free is enough), 3 the privacy block, 2 the bank names, 1 each sharing, pay-once and Arabic. The bank names were on the listing and buyers still asked for proof from reviews: a claim in a listing is not proof. Egypt was re-tested at 59 and the decision above is 69, because the lower price changed no decision.

## 8. Step 7: board

Three Sonnet subagents, one published framework each, shown the revised model and all the evidence above.

| Lens | Score | Top three things that would kill it | Vote |
|---|---|---|---|
| **Offers** (value equation) | 4 / 10 | The paywall sits on value few people need, and the trial ends with no felt loss. No proof and no guarantee in the offer. Squeezed between a similar-priced rival and buyers who want it cheaper | **Fund if** at least 5 of the 47 testers commit to the annual plan after a Plus trial with the day-12 moment, and at least 20 testers show named Egyptian banks parsed correctly |
| **Monopoly** (secret, 10x, small market first) | 3 / 10 | SMS tracking is already sold by others and given away here. A trust wall with no reviews and no distribution plan. A weak paid wedge, launched in the market with the worst unit economics, spread over three countries | **Fund if** a public Egypt beta shows parse accuracy above the incumbent on named banks and real conversion above 5% of active users |
| **Product** (job to be done, activation, habit) | 4 / 10 | The paywall is on the wrong side of the value. Activation and trust: SMS refusal, iPhone setup before any value. No habit loop: nothing brings people back, and the trial's end takes away nothing they felt | **Fund if** 40% of testers who connect SMS get a first automatic transaction within 10 minutes and 5% of a real trial cohort convert; ship partner sharing in Plus and move export to free |

**Where they agree.** The price is not the issue. The free tier already delivers the reason to install, and Plus sells things few people need. Partner sharing is the best paid feature in sight. Proof from real users must come before the paid push. Do not lead with AI credits.

**Where they disagree (kept).**

| Question | Offers | Monopoly | Product | Architect's call |
|---|---|---|---|---|
| Free SMS accounts | 1 | Do not limit accounts at all; charge for what the data uniquely enables | 3, as a soft limit | **2**. At 3, 12% of the panel ever meet the gate; at 2, 30%; at 1, 52%. One breaks the free loop for anyone with a salary account and a card. Test 2 against 3 with real users |
| Export | Keep reports as the paid outcome | not addressed | Move export to free | **Free** |
| Partner sharing timing | Ship at launch | Part of the paid wedge | Ship in Plus at launch | **First build after launch**; it is weeks of work and should not hold the launch |
| Markets | not addressed | Egypt only until proven | not addressed | Price all three in the stores; **market only where the bank list is measured**, Egypt first |

**Launch gates the board asked for, adopted.** Measured, with real people, before the paid plan is promoted:

1. A published list of Egyptian banks and wallets with measured parse accuracy.
2. Of testers who switch SMS on, 40% see a first automatic transaction within 10 minutes.
3. After the free Plus preview with the day-12 moment, at least 5 of the 47 testers say in the survey they would buy the annual plan at the founding price. This is a stated commitment, not a payment: testers on TestFlight cannot be charged.
4. After launch: if under 2% of active users are paying at day 60, reopen the free line and what Plus contains before touching the price.

## 9. The freemium split and the trial, revisited

- **Is the 3-account SMS cap the right gate?** No. It gates almost nobody: 7 of 60 buyers wanted 4 or more accounts, and 18 wanted none read at all. Moved to 2. This is still a weak gate, and the review's main finding is that account count cannot carry the paid plan by itself.
- **Per market.** Egypt: 13 of 24 wanted 2 or 3 accounts, so the line between 2 and 3 matters most there. UAE and Saudi: more buyers have 4 or more (6 of 36) and they can pay, so the cap bites where the money is.
- **Are 20 free credits enough to feel the product?** Yes: 55 of 60 said so and 5 were unsure. Kept at 20. It also means credits are not a reason to upgrade, so Plus drops from 150 to 100 and the pitch stops leading with them.
- **The trial.** Kept: 14 days, no card, at signup. Almost nobody in the panel would start a card-first trial, and 6 of 60 cannot pay in a store at all. Changed: the day-10 summary becomes a day-12 "what Plus found in your last 30 days" built from the user's own data, so the end of the trial is felt.

## 10. What changed in the design, and why

| # | Was (S5a-pricing.md) | Now | Why |
|---|---|---|---|
| 1 | One paid plan | **Unchanged**, with a written trigger and mapping for a household plan | Sections 1 and 8 |
| 2 | Free SMS on 3 accounts | **2 accounts** | The cap at 3 met 12% of buyers |
| 3 | Egypt EGP 79 a month, 599 a year | **EGP 69 and 499** | Panel range and the direct rival's price |
| 4 | UAE AED 14.99 and 119.99 | **AED 14.99 and 99.99** | Annual under the competitor median |
| 5 | Saudi SAR 14.99 and 119.99 | **SAR 12.99 and 99.99** | Saudi range is lower; VAT is higher |
| 6 | Store intro price in phase 2 | **Founding price on the annual plan for the first 60 days** | An honest opening offer with an end date |
| 7 | Plus 150 credits | **100** | Nobody is short of credits; it bounds the worst user |
| 8 | Plus SMS AI cap 60 a day | **30** | Bounds the one loss-making case |
| 9 | Export is Plus-only | **Free** | Trust; rivals are criticised for it |
| 10 | Free reports: this month and last | **Last 3 months** | Same reason |
| 11 | Day-10 trial summary | **Day-12 "what Plus found"** | Offers lens: make the end of the trial felt |
| 12 | "The one thing no competitor has" | **Removed**; competitors named | It was wrong |
| 13 | No guarantee | **30-day annual-plan guarantee, worded within store rules; 12-month price promise** | Obstacles 13 to 15 |
| 14 | No launch gates on the paid plan | **Four measured gates** | Board, 3 of 3 |
| 15 | Three markets priced and treated alike | **Priced in all three; marketed only where bank coverage is measured** | Buyer proof question; Monopoly lens |
| 16 | Roadmap silent | **Partner sharing is the first Plus feature to build after launch** | The only paid feature buyers asked for |
| 17 | Limits lacked `seats` | **Add `seats` and `shared_budget` keys now** | So a household plan needs no redesign |

Unchanged: RevenueCat, no top-up packs in v1, the 14-day no-card trial, the three ledgers, the hidden AI limits, the survey, no paid pilot.

## 11. Not verified

- **Everything in the panel is simulated.** 60 AI-played buyers, briefed to be sceptical, are not customers. The 0-of-60 result, the price ranges and every quoted line are prompts for real tests.
- The customer profiles (segment shares, income bands, how people can pay) are this session's estimates.
- The price-sensitivity answers anchored on the shown price, so the ranges are soft.
- Competitor prices are from the iOS App Store storefront only; Google Play pages could not be read. Many prices have no period label. Several pages failed (rate limits, 403, 404).
- Competitor claims about SMS and bank coverage are the developers' own. None was tested.
- Review themes rest on a handful of reviews per app.
- **buddget's own bank coverage in the UAE and Saudi Arabia was not measured.** The re-test listing named banks in all three countries as a "what if this were true" test. No such claim may be published until measured.
- The privacy block's claims (only bank messages read, text deleted after 30 days, nothing sold) follow the repo's context file; each should be checked against the code and the privacy policy before it is published.
- The 12-month ramp's installs, activation and retention are assumptions; there is no acquisition plan behind them.
- Vercel and Supabase plans are assumed; the domain prices are from third-party trackers.
- RevenueCat's 1% above $2,500 applies to all tracked revenue according to a docs example seen in a search snippet, not the pricing FAQ itself.
- The price page says `gemini-2.5-flash` is deprecated and from 2026-12-01 requests route to a newer lite model at that model's rates. Every AI cost in S5a assumes today's price and must be re-read after that date.
- Whether a pay-up-front annual introductory offer can be scheduled to stop on a set date in both stores was not checked.
- The guarantee wording was not checked against Apple's and Google's rules on refund promises.
- The board is three AI subagents applying published frameworks, not investors.
