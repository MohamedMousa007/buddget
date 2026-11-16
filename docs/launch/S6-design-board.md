# S6 design board: buddget Pro page, Sparks and the founders club

Date: 2026-11-15. A design decision only: no code, no migrations, no database writes. The owner rejected the first S6 canvas (version 10) as "so simple", lacking branding and exclusivity. They asked for a dedicated subscription page in the profile menu, a plans page that sells the value of Pro, and a full page instead of a sheet where that fits.

Method: the `founder-board` skill of the MIT-licensed `founder-skill` repository, run by hand, as in S5a section 8. One brief that stands on its own, and three Sonnet subagents, one lens each:

- Offers: the value equation.
- Monopoly: durable advantage and distribution.
- Product: customer experience first, focus, simplicity.

The subagents saw only the brief, which summarised S5a pricing, the S5a business review and S5b loyalty. Each lens paraphrases published ideas; none speaks for any person or claims their endorsement.

## 1. Tally

| Lens | Score | Vote | Most dangerous risk it named |
|---|---|---|---|
| Offers | 4 / 10 | Fund if | The offer is a feature gate, not a transformation; restyling the list does not move 0 of 60 |
| Monopoly | 4 / 10 | Fund if | Status with no audience: a club on a product nobody has chosen yet is decoration |
| Product | 5 / 10 | Fund if | Leading with the wrong thing (AI, Sparks, badges) and decoration without proof |

**3 fund if, average 4.3.** The board supports the redesign only as a sales page built on outcomes and proof. A more vibrant skin on the same feature list does not count.

**Risks raised by more than one seat (listed first):**
1. **No proof on the page.** All three raised it. 28 of 60 buyers asked for proof that the app reads their bank. A premium look with no evidence reads as a costume.
2. **Leading with Sparks or AI.** All three raised it. 55 of 60 said 20 Sparks are enough, so Sparks are a footnote, not a pillar.
3. **Founder status read as paid status.** All three raised it. If Founder and Pro look alike, users assume founders get Pro, and Apple 3.1.1 becomes a review risk. They need two visibly different visual languages.
4. **Fake urgency would undo the trust.** Offers and Product raised it. No counters, timers, "only N left" or "you'll lose it" copy.

## 2. Decisions

### 2.1 Plans page structure and value story

The plans page is a full page. Sections, in this order:

1. **Promise.** "Every account on autopilot. Your whole year in view." This is the sentence a user would say to a friend. The Arabic is in the copy table on the canvas.
2. **Proof strip, from the user's own data.** For example: the accounts being read, the transactions logged automatically this month, and "2 of 2 free SMS accounts in use". With SMS off, show one sample bank message turning into a ledger row, labelled as an example, plus the privacy line.
3. **Three outcomes.** Each gets one sentence and one small visual, not bullets:
   - *Every account, automatically:* SMS on all banks and wallets.
   - *The whole year in view:* any report range, trends, the year view.
   - *Plans you can test:* unlimited saved plans, compare and stress test.

   The installments and BNPL total is already free, so it is not sold here. Partner sharing appears only as "Coming first after launch", never as live.
4. **Free and Pro side by side.** A short table, then "What stays free". The rows are in 2.2.
5. **Choose a plan.** Yearly is pre-selected, with the yearly amount as the largest figure; monthly is second. Below them: the price promise, the annual change-of-mind line, the auto-renew wording, Restore, Terms and Privacy.
6. **Sticky footer CTA:** "Continue with yearly" or "Continue with monthly", so the label says what happens.

Sparks appear only as a table row and a footnote. Nothing on the page sells AI.

**Dissent kept:** Monopoly wanted the proof strip above the promise; Offers and Product wanted it second. **Chair's call: second.** The promise frames what the proof proves. On the end-of-days page the user's own recap moves to the top.

### 2.2 Free vs Pro comparison and the annual saving

Six rows, grouped by outcome, showing only what differs:

| Row | Free | Pro |
|---|---|---|
| SMS auto-tracking | 2 bank or wallet accounts | Every account |
| Reports | Last 3 months | Any range, trends, year view |
| Saved budget plans | 2 | Unlimited |
| Compare and stress test | No | Yes |
| Live-price estimates | 3 a day | 10 a day |
| Sparks for Buddgy | 20 a month | 100 a month |

Below the table, one line answers the fear that data is held hostage: "Free keeps the whole loop: manual entry, budgets, goals, debts and installments, export, two currencies."

**Annual saving.** The yearly amount is the largest figure, for example EGP 499 a year. Beneath it, smaller: "About EGP 41.58 a month". The saving is stated plainly, never as a crossed-out price: "40% less than 12 monthly payments" (UAE 44%, Saudi 36%). The monthly option shows EGP 69 a month.

### 2.3 Exclusivity mechanics

**Two visual languages:**

- **Pro is the product.** A teal aurora on a deep teal surface, the "PRO" mark, and a member card that says "Member since". It is the same teal family as the brand, pushed further.
- **Founder is a person's history.** A gold-foil numbered card on the dark auth floor, with "Founder #023" set in mono. Gold is used for founders only, never for Pro.
- **Beta tester is also history.** A quieter silver-teal outline badge with no number, so it does not read as a consolation prize.

**Where status shows:**

- The ProfileBanner in the Settings hub.
- The profile menu, next to the name, where the staff badge already sits.
- The Founders club page and the credits screen.
- One Buddgy greeting the first time after the number is issued, never repeated.

**Where status never shows:**

- The plans page or paywall: status is not a sales lever.
- The store title or icon.
- Other users' screens, until partner sharing exists.
- Any line that implies a discount, Sparks or Pro time.

**Pro as membership:** a welcome page after purchase, "Member since" on the Pro card, and a Pro mark in the profile menu. Early access stays below the Pro line.

**No scarcity counters.** The cap and the window are stated once, factually, on the Founders club page: "At most 100 founders. The window closes 60 days after launch."

**Dissent kept:** Monopoly asked for a founder card that can be shared outside the app, the only distribution lever in sight. Product warned against badges outside the app. **Chair's call:** design a "Share your founder card" image action with no reward attached. It is an owner question: S5b allowed an unrewarded share link but did not design it.

### 2.4 Sparks presentation

- **Quiet by default.** A small count beside the Buddgy entry points ("34 left"). The existing `QuotaWheel` ring stays inside chat. Sparks never appear on the dashboard and are never animated for urgency.
- **A Sparks page under buddget Pro.** It shows:
  - a ring reading "34 of 100", with the reset date;
  - what each action costs;
  - "SMS auto-tracking never uses Sparks", stated plainly.
- **At zero.** Buddgy is "resting until 1 Dec", and the page says that everything except AI replies still works. A Free account gets one quiet "See Pro" link. A Pro account is offered nothing to buy (no packs in v1).

**Dissent kept:** Product wanted the ring at every Buddgy entry point; Offers wanted it inside chat only. **Chair's call:** a number at the entry points, the ring in chat and on the Sparks page only.

### 2.5 Where the Subscription page sits

**Settings hub.** A full-width buddget Pro membership card goes directly under the ProfileBanner, above quick actions, and replaces the small `SubscriptionCard` lower down. It opens `/settings/pro` and shows one of these states:

- Free
- Pro, with the renewal date
- Pro, day 6 of 14
- a billing problem

**Profile menu (`ProfileDropdown`).** A "buddget Pro" row goes right under the name block and opens the same page. **The label is "buddget Pro", not "Subscription"**: the menu already has "Subscriptions" (recurring bills, `/subscriptions`), and two of them would confuse.

**Founders club.** A separate page (`/settings/founders`), reached from the badge on the ProfileBanner and from a row on the buddget Pro page. It is shown only to founders and beta testers. Plan and status stay apart (2.3).

**Dissent kept:** Product wanted one home for plan, Sparks and founder status. **Chair's call:** Sparks live under Pro because they are part of the plan, and founder status gets its own page because the shared risk 3 outweighs having one home.

### 2.6 Full page or sheet, per entry point

| Entry point | Surface | Content |
|---|---|---|
| Settings hub card, profile menu row | **Full page**: buddget Pro (state page) | Plan state, Sparks, manage, restore. For Free accounts the page is the plans page |
| End of the 14 days | **Full page**, once, on the first launch after day 14 | Leads with "What you keep for free" and a recap of what Pro did ("Pro read 4 accounts and logged 63 transactions"), then the plans section |
| Sparks ran out | **Sheet** | One reason, the reset date, what still works, "See everything in Pro" to the full page |
| SMS account cap hit | **Sheet** | "Free tracks 2 bank or wallet accounts; their cards come along; cash is always free", pick which 2, link to the full page |
| Locked report range or stress test | **Sheet** | Names the locked thing, one line, link to the full page |
| Founder perks | **Full page**: Founders club | Card, number, perks, credits opt-in, channel link |

A sheet names the exact thing that is blocked and never repeats the whole pitch.

## 3. Conditions merged (one checklist)

- [ ] The proof strip ships with the plans page and uses real local data, not a mockup or an invented testimonial.
- [ ] The promise sentence leads the page; Sparks are a table row and a footnote only.
- [ ] Pro and Founder look different, and gold is for founders only.
- [ ] No counters, timers, "only N left" or loss copy anywhere.
- [ ] Founder and Beta status never appear on the plans page and never imply money, Sparks or Pro time.
- [ ] Partner sharing is shown only as "coming first after launch".
- [ ] The end-of-days page shows, as facts, what the user got and what they keep.
- [ ] Copy rules (S5c item 16 and the copy test):
  - "buddget Pro" throughout.
  - None of these words in billing copy, in either language: "free trial", "web", "website", "cheaper", "checkout", "refund".
  - The 30-day annual line reads "Changed your mind within 30 days? We'll make it right", with a link to the help article. The store mechanics stay in help.
- [ ] Store rules on the page: price and period, auto-renew wording, Restore, Terms and Privacy links.
- [ ] Before Pro is promoted, re-run the S5a panel on the new page. If "free covers me" still wins, change what Pro contains, not its styling (Offers and Product).

## 4. The strongest version

buddget Pro is sold as one sentence, "every account on autopilot, the whole year in view". It is proved with the buyer's own numbers before any price appears. It looks like a membership, a deep-teal aurora card that says "Member since", and it is honest about what stays free.

Founders are a separate, numbered, gold club of at most 100, earned by use and never bought. They appear where people see themselves and are never used to sell. Sparks are a quiet meter nobody has to think about.

The style makes Pro feel worth belonging to. Only the proof and the outcomes can make it sell.

## 5. Open questions for the owner

1. Can a founder share their card as an image, with no reward? This is Monopoly's distribution lever; S5b allowed an unrewarded share link.
2. Is partner sharing firm enough to say "coming first after launch" on the page?
3. Does the proof strip need a server count, or are local counts enough? The design assumes local: accounts with SMS on, and transactions with `source = sms` this cycle.
4. Should testers who have left keep seeing the Beta tester badge, or only active ones?
5. Should the Pro welcome page be shown once after purchase? The design includes one.
6. Arabic for "buddget Pro" and "Founders club". The design keeps "buddget Pro" in Latin letters inside Arabic text, and uses "نادي المؤسسين" for the club.

## 6. Not verified

- The memos are simulated reviewers working from a brief. No real buyer has seen the new page.
- The panel re-test (the last condition in section 3) has not been run.
- The store reading is the one done in S5b and S5c. The new page's wording was checked against the copy-rules word list only.
