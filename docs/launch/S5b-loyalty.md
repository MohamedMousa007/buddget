# S5b: Founding members and loyalty

Date: 2026-11-15. A design document: no code, no migrations, no database writes, nothing sent to testers. Inputs: the S5b section of `docs/MASTER_PLAN_LAUNCH.md`, `docs/launch/S5a-pricing.md` (sections 5, 8, 10), `docs/launch/S5a-business-review.md` (sections 1, 2, 5, 7, 8). S5a's recommendations are taken as given; section 12 says where a different owner pick would change this design. Users are cited only as counts.

**Revised 2026-11-15 by the S5c review** (`docs/launch/S5c-review.md`). Changed lines are marked **[S5c]**. Where this document and section 14 of the review differ, the review wins. In short: an active day is a server-observed user action, not an app session; the nightly job proposes founders and the owner approves each one; the founding price is not built in v1; points are paid only for weeks and budgets with real activity; there is no device key for spotting duplicates.

## 0. Summary

- **Founders:** at most 100 people, and the window closes at public launch + 60 days, whichever comes first. One bar for everyone, testers included: **7 active days spread over at least 2 weeks, at least one record they entered or confirmed, and at least one active day inside the window.** Testers' past activity counts. **[S5c]** An active day is a day with a server-observed user action (2.1). Today 11 of 47 accounts pass on the older session-based count (fewer will on the new one); 14 more were active in the last 60 days and could pass before the window closes. Testers who miss it keep a permanent "Beta tester" badge with no number.
- **The founder perk is status.** Badge, number, early access, a founders' channel, an opt-in name in the credits screen, roadmap votes. No Sparks, no Plus time, no lasting discount. The founding annual price (EGP 399, AED 79.99, SAR 79.99, first year) is open to anyone who subscribes inside the window, founder or not, as a store introductory offer. **[S5c] The founding price is not built in v1**, so founders have no money perk at all.
- **Loyalty counts weeks, not days or transactions.** A week is "kept" when the user finishes a one-tap weekly check with nothing left unconfirmed. Points come only from kept weeks, a fully tracked month and a budget set for the month, each at most once per period. Points are never spent in v1 and have no cash value.
- **Three tiers, switched on later:** Seed, Sprout, Tree (بذرة، نبتة، شجرة). Thresholds stay unset until real data exists. No demotion.
- **No referrals.** An unrewarded share link only. Partner invites come with the household plan.
- **v1 ships:** the founder grant job and badge, the weekly streak, and the points ledger with its event log. Tiers switch on between day 60 and day 90 after launch, on a written trigger (section 5.4).
- **Plainly:** loyalty cannot fix activation (27 of 47 accounts have never recorded anything) and cannot make Plus worth buying. It can turn the few real users into proof, and give the app the weekly habit loop the business review found missing.

## 1. Facts this design rests on (live, read-only, 2026-11-15)

| Fact | Value |
|---|---|
| Accounts | 47 (none soft-deleted). The plan calls about 45 of them beta testers |
| Accounts with any record (expense, income or savings) | 20; 27 have none |
| Zero-record accounts that switched SMS on | 2 of 27. 7 never opened the app after signup, 11 opened it on only 1 or 2 days. So the zero-record group is mostly people who installed and left, not an SMS failure |
| 10+ records | 12 |
| 7+ active days / 14+ active days | 17 / 11 |
| "10+ records or 14+ active days" (the earlier example bar) | 16 |
| Proposed bar (7 active days over 2+ weeks, 1+ record) | 11; 9 of them active in the last 60 days |
| Active in the last 60 days but not yet at the bar | 14 |
| Set a budget | 9 |
| No sign-in for 30 days | 22 |
| Activity tracking began | 2026-03-22 (`app_activity_days` is a view over `app_analytics_daily` plus raw events) |
| Loyalty tables | `loyalty_tiers`, `loyalty_accounts`, `loyalty_ledger` exist, all empty; row security on with **no policies**, so only `service_role` can read or write |
| `admin_adjust_loyalty_points` | Security definer, `service_role` execute only; sets the tier from `active` tiers by `lifetime_points`, honours `tier_locked` |
| `loyalty_ledger.user_id` | `on delete cascade` from `auth.users`; `actor_id` points at `admin_staff` |
| `loyalty_ledger_id_seq` | Usage granted to `anon` and `authenticated` (harmless without table rights; S6 should revoke it) |
| `user_entitlements.source` | Already allows `loyalty` |
| Weekly review screen | Does not exist. Month close exists (`useMonthClose`) and is computed on the client; nothing about it is stored on the server |
| Analytics events | 4 rows in total (onboarding only); activity lives in the daily roll-up |

## 2. Founding members

### 2.1 Who qualifies

One bar for every person, tester or public:

1. **7 active days**, on at least **2 different calendar weeks**. An active day is a day in `app_activity_days` with at least one session.
   **[S5c] Replaced.** `app_activity_days` is filled by `analytics_touch`, a function any signed-in client can call, so one scripted call a day made an active day; 334 of 528 recorded days have under 30 seconds of activity. An active day is now a day, in the user's timezone, on which the server recorded a user action: a record the user created or edited by hand, an SMS item the user confirmed, or a finished weekly check, by a server-set timestamp. Rows written by the SMS pipeline, imports and sync replays do not count. It is a view over existing tables.
2. **At least one record the person made or confirmed**: a manual expense, income or savings entry, or an SMS transaction they confirmed. A row the SMS pipeline wrote with no user action does not count.
3. **At least one active day inside the window** (public launch to close). This is what keeps a tester who never comes back from holding a number.
4. Not a staff account (`admin_staff`). Staff help run the program; they do not take slots. **[S5c]** The join is `admin_staff.user_id` (4 rows, all filled).
5. **[S5c] The owner approves each founder.** The nightly job only proposes accounts that pass 1 to 4. A number is issued when the owner approves that account in admin, in approval order, with no bulk approve. Without this, 100 scripted accounts could take every number (council 4 of 4).

Activity before launch counts, so testers who used the app start ahead. The bar is deliberately light. It filters people who installed and left, not people who track lightly: someone who logs a few things a week for two weeks passes.

Why this bar and not the earlier "10+ transactions or 14 active days": counting transactions rewards volume, which the brief rules out, and SMS auto-logging makes volume passive. 14 days would leave only 11 people today and mostly measures who joined earliest. The council's three voices proposed three different levels (section 9); this one sits between them and is measurable today from existing tables.

### 2.2 The 45 testers

The earlier council said the testers "count automatically". The data says that would put numbers on about 27 accounts that never recorded anything, which empties the badge of meaning and gives no proof. Adopted instead (council 3 of 3):

- Every tester account that exists on launch day gets a **permanent "Beta tester" badge** (wording in section 10), whatever their activity. That is the thanks for carrying the risk. **[S5c]** Apple 2.2 says beta apps cannot be given to testers "in exchange for compensation of any kind". The badge is kept (council 3 of 4; Skeptic would drop it) on three rules: it is granted at public launch to every pre-launch account, it is never announced as a reward for joining or staying in the beta, and it carries no credit, discount or feature.
- A tester who meets the bar by the close date is also a founder. Testers who already meet it on launch day get the lowest numbers.
- Testers are not given a reserved block of numbers. A tester who qualifies on day 40 gets the next number on day 40.
- Before launch, the owner sends lapsed testers one plain note: the window, the bar, the date. That is the only reminder. No second "last chance". **[S5c]** The note must not offer the Beta tester badge.

### 2.3 Cap and window

- **Opens** at public launch (the day both store listings go live). **Closes** at 23:59 Cairo time on launch + 60 days, or the moment number 100 is issued, whichever comes first.
- Both dates are written into the migration that opens the window. Changing them needs a new migration, which is the point: no extension, no second window, no "founders round two".
- If fewer than 100 people qualify, the program closes short. Numbers are not backfilled later.
- The founding annual price ends on the same date (S5a decision 7). S5c checks that the store offers can be set to end on that date in both stores. **[S5c]** Checked: Apple can, Google Play cannot. The founding price is not built in v1.

### 2.4 How the number is assigned

- A server job runs nightly during the window (the existing cron route), plus once at launch. **[S5c]** The job writes proposals; numbers are issued on the owner's approval, in approval order. The ordering rules below decide the order proposals are shown in. Admin shows the pending count so approval cannot silently stall.
- **Launch run:** testers who already pass the bar are numbered from #001 in order of account creation.
- **Nightly runs:** everyone who newly passed the bar that day is numbered in the order they passed it (the later of the day they reached the seventh active day and the day of their first record; ties by account creation).
- Numbers come from one locked counter inside the grant function, so two runs cannot hand out the same number.
- A number, once issued, is never reissued, even if the account is deleted or the grant is revoked.
- The client never decides. It reads `founder_number` from `/api/entitlements/me`, which reads the server table.

### 2.5 Edge cases

| Case | Rule |
|---|---|
| Account deleted | The founder row keeps the number and the dates, `user_id` becomes null, and the number is retired. It still counts toward the 100. Nothing personal is kept |
| Data reset (`profiles.data_reset_at`) | Founder status stays. Status belongs to the person, not to their data |
| Refund of the founding annual plan | No effect on founder status: status was never bought. The store enforces one introductory offer per store account; a refunded buyer who subscribes again pays the normal price |
| Subscription lapses | No effect. The badge is not tied to paying |
| Two accounts, one person | One founder per person. **[S5c]** There is no device key (the trial no longer uses one); the owner's approval step is the control, with sign-in method, creation date, action days and record count shown per candidate. Signals: same device key (the `trial_claims` hash from S5a), same phone, same store account if both subscribe. On a match the earlier number stays and the later one is retired, with a reason. Staff decide from an admin list, not automatically, because households share phones |
| Tester who never returns | Beta tester badge only. No number |
| Account moved to a new login (store `TRANSFER`) | Founder status does not move with a subscription. It stays with the Supabase user id |
| Fraud found later (farmed accounts) | Staff can retire a number with a reason; the row stays, audited in `admin_audit_log`. Not reissued |
| A later household plan | Each partner has their own status. A shared budget never carries or merges a badge |

## 3. Founder perks, and what each costs

| Perk | What it is | Cost to deliver | v1 |
|---|---|---|---|
| Badge and number | "Founder #023" on the profile and in Settings; a small mark next to the name in the app | About 1 day: an existing badge or chip primitive, one field in `/api/entitlements/me`. No running cost | Yes |
| Beta tester badge | Same placement, no number | Same build | Yes |
| Credits screen | A page in Settings listing founders by number, and by display name only for those who opt in. **[S5c]** A name shows only after the owner approves it | About half a day. Opt-in, display name only, off by default | Yes |
| Early access | Founders get new features first, through a `founder` feature cohort. **[S5c]** Never across the plan line: a feature that is or will be Plus-only needs Plus even in early access (Apple 3.1.1) | Small per feature; needs each new feature behind a flag (`feature_overrides` and the feature catalog exist) | Yes, from the first feature after launch |
| Founders' channel | One group chat run by the owner, plus a "Founder feedback" option in the in-app support form that tags the ticket | No build beyond a ticket tag. **The real cost is owner time: about 1 to 2 hours a week.** The most expensive perk and the most useful one | Yes |
| Roadmap votes | A short poll each quarter on what to build next | Owner time, about 1 hour a quarter. Votes are advisory | After launch |
| Founding annual price **[S5c] not built in v1** | EGP 399, AED 79.99, SAR 79.99 for year one, then the normal price | A store introductory offer, already in S6. The cost is the discount, about EGP 100 per buyer in year one, only for those who buy. Open to everyone in the window, so strictly it is not a founder perk | S6 |

Not offered, and why:

- **Bonus Sparks for founders.** Buyers are not short of Sparks, and a Spark gift says nothing about status. The brief allowed one time-boxed pack; the architect declines it. If the owner wants it: a `bonus` row of 50 Sparks expiring in 30 days, costing at most about $0.18 per founder.
- **Plus time.** Apple 3.1.1 says apps may not use their own mechanisms to unlock content (read through a summary, section 7). A free Plus month also teaches founders that Plus is free.
- **Lifetime anything.** Ruled out by the brief.

## 4. The loyalty ladder

### 4.1 What earns progress

Only outcomes, each at most once per period, each checked on the server:

| Event | Definition | Points | Once per |
|---|---|---|---|
| Kept week | The user finishes the weekly check (4.2) for that week with no unconfirmed SMS items left in it | 10 | Week |
| Budget set | A budget plan is active for the cycle (`budget_plan_activations` covers it) by day 7 of the cycle | 10 | Cycle |
| Fully tracked month | At cycle end: a budget was active, at least 3 of the cycle's weeks were kept (a freeze counts), and nothing in the cycle is still unconfirmed | 40 | Cycle |

**[S5c] Two payment rules.** A kept week pays its 10 points only if the week has at least one record dated in it (any source); a "nothing this week" check keeps the streak and pays 0. Budget set pays only if the user created, activated or edited the budget in that cycle or the one before; a budget left untouched pays nothing. Otherwise four function calls a month earned every point with no real use.

The most anyone can earn in a month is about 100 points (5 kept weeks, budget set, tracked month). Points measure months of steady use. Nothing pays for more transactions, logins, savings deposits or AI use.

Not counted, on purpose: number of transactions, app opens, Sparks used, goal deposits (a savings entry is a typed record and trivial to fake), streak length beyond the weekly points, and anything about ratings or reviews (forbidden by both stores, section 7).

### 4.2 The streak

- **Unit: a week.** Week start comes from `user_settings.week_start_day` and the date from `user_settings.timezone`. Defaults by market in section 10.
- **What makes a week count:** the weekly check. A one-tap sheet built from the existing sheet and row primitives: the week's total, the top three categories against budget if there is one, and any unconfirmed SMS items to clear. The button is "Looks right". A week with no spending counts if the user confirms "nothing this week". The user must act: a week where SMS logged everything and the user never looked does not count.
- **Grace:** the check for a week can be done until the end of the third day of the next week.
- **[S5c] Server-side keys.** The server computes the week from the user's settings (the key is the date of the week's first day) and two kept weeks must be at least 5 days apart, so changing the week-start setting cannot create extra weeks.
- **Forgiveness:** every 8 kept weeks bank one freeze (at most 2 banked). A missed week uses a freeze automatically. A broken streak loses no points and no tier; only the "weeks in a row" number resets.
- **Shown as:** "6 weeks in a row" on the weekly check and in Settings. No flames, no countdowns, no "you'll lose it" push. One optional reminder on the last grace day, off by default.

Why weeks (council 3 of 3): a daily streak punishes travel, Eid and Ramadan, and pushes people to log every coffee to keep it alive, which is the over-tracking the brief rules out. A month is too slow to feel. The weekly check is also the habit loop the business review's Product lens said is missing.

### 4.3 Tiers (switched on later)

| Tier | English | Arabic | Threshold (lifetime points) | Rewards |
|---|---|---|---|---|
| 1 | Seed | بذرة | 0 | Everyone starts here. Nothing extra |
| 2 | Sprout | نبتة | Set at switch-on. Placeholder: 300 (about 3 steady months) | Two extra app themes; a Buddgy outfit; 20 bonus Sparks once on reaching it, expiring in 30 days |
| 3 | Tree | شجرة | Set at switch-on. Placeholder: 1,000 (about 10 steady months) | A Tree badge; a second Buddgy outfit; the early-access cohort (same as founders); 30 bonus Sparks once, expiring in 30 days |

- Three tiers (council 3 of 3). Plant names won 3 of 4 voices; the Critic proposed Starter / Steady / Anchor (مبتدئ، ثابت، راسخ). Plant words are not money words, which matters next to real balances, and they suit Buddgy. Five native speakers in each market should read them before they ship.
- **No demotion.** Tiers use `lifetime_points`, which only grow. A finance app should not take status away after a bad month.
- **Rewards are cosmetic, early access and a little expiring Sparks.** No Plus time, no discounts, no cash, no prize draws.
- Bonus Sparks are written only as a `bonus` row in `spark_allowances` (ledger 1) with an end date, never in `spark_purchases`. Cost at most about $0.11 per grant.
- Founders and tiers are separate. A founder starts at Seed like everyone else.

### 4.4 Points are not a currency

In v1 points are never spent. There is no rewards store and no redemption. `points_balance` equals `lifetime_points`. A spending store would give points value, bring in the stores' currency rules, and add a liability for little gain. If one is ever wanted, it gets its own review.

## 5. Rollout

### 5.1 What v1 contains (S6)

1. The founder table, the grant function and its nightly job, the window dates in the migration.
2. Founder and Beta tester badges in the profile and Settings; the credits screen with opt-in names.
3. The weekly check sheet, the streak, freezes.
4. Points earned from the three events, written to `loyalty_ledger` through the event log.
5. A "Founder feedback" tag in the in-app support form.
6. System review prompts at good moments (5.3), never rewarded.
7. Admin: the existing Loyalty view shows founders, retired numbers and the duplicate list.

Not in v1: tiers (rows seeded as `draft`), tier rewards, Buddgy outfits, roadmap votes, any spending of points.

### 5.2 Data to record from day one

So the tiers can be calibrated and the program judged, record from the first day of launch:

| Data | Where |
|---|---|
| Every kept week, freeze used, budget set and tracked month, with period key and time | `loyalty_events` (new) |
| Weekly check opened but not finished, with the number of unconfirmed items left | `loyalty_events`, kind `week_check_abandoned` |
| Streak length and best streak | `loyalty_accounts` (new columns) |
| Founder grants, retirements and reasons | `founders` |
| Review prompt shown, by trigger | `loyalty_events`, kind `review_prompt` (whether the user rated is not visible to the app) |
| Active days | Already in `app_activity_days` |
| Paywall views by country, time to first SMS transaction | Already required of S6 by S5a |

### 5.3 Review prompts (proof)

**[S5c]** Checked verbatim against Apple 5.6.1 and Google's ratings policy: compliant. No screen that asks "are you enjoying buddget?" before the prompt. Use only Apple's `SKStoreReviewController` and Google's In-App Review API. Ask after a fully tracked month or after 4 kept weeks, at most once per 120 days per person, never on a day with an SMS error. Never tied to a reward or a feature.

### 5.4 Trigger for switching tiers on

Not before launch + 60 days. At the first check on or after day 60, switch on if both hold:

1. At least **40 people** have 4 or more kept weeks.
2. Among people active in the first month, those with 4+ kept weeks are **still active in week 8 more often** than those without (a clear gap; at this size there will be no statistical test).

Then set thresholds from the real distribution: Sprout reachable by about the top third of active people within 3 months, Tree by about the top tenth within a year. Flip the tier rows to `active` in a migration; the existing function then assigns tiers.

If condition 1 still fails at day 90, do not switch tiers on. That is a retention problem and tiers will not fix it; report it to the launch gate. If condition 2 fails, the weekly check is not working as a habit loop; redesign it before putting tiers on top.

## 6. What the program can and cannot do for the business review's findings

| Finding | Can loyalty help? |
|---|---|
| Trust comes before price | **A little, indirectly.** Founders are real people with numbers. With consent, their quotes and an aggregate line ("82 founders, 310 tracked months") can go on the website. That helps only once they exist |
| Proof: reviews and real usage | **Yes, within store rules.** Review prompts timed to good moments; the founders' channel feeds "my bank parsed correctly" reports into the published bank list (launch gate 1). Reviews can never be rewarded |
| Retention: "nothing brings people back" | **Yes, this is its main job.** The weekly check is a reason to come back once a week, and it clears unconfirmed items, which improves the data |
| Activation (27 of 47 never recorded anything) | **No.** A badge does nothing for someone who has not seen value. That is onboarding and SMS setup (S7) |
| "Free already covers me" | **No.** Loyalty does not make Plus worth buying, and by design it gives away nothing from Plus |
| Price, devaluation, "another subscription" | **No.** The founding price is a pricing tool, not loyalty |
| Partner sharing | **Not now.** Status stays per person so the household plan needs no change |

## 7. Store rules

Read 2026-11-15 by a fetch agent. Marked where only a summary was read. **[S5c]** Apple 2.2, 3.1.1, 3.1.2, 3.2.2 and 5.6.1 have now been read verbatim (page last updated 2026-10-16); the readings below hold. 3.2.2(x): apps "may otherwise incentivize users to take specific actions within apps". 3.1.2(a) adds one rule: subscribers get what they paid for "without performing additional tasks", so no loyalty step may gate anything Plus includes. Google's payments FAQ says earned points may be issued without Play Billing.

| Source | Read how | What matters here |
|---|---|---|
| [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) | Sections 1 and 2 verbatim; **3.1.1, 3.1.2, 3.2.2, 5.6 and 5.6.1 through a summary** | 3.1.1: paid content is unlocked through in-app purchase; apps "may not use their own mechanisms to unlock content" (summary). 3.2.2(x): apps must not force a rating or review to unlock features, and may otherwise reward in-app actions (summary). 5.6.1: use the system review prompt; custom review prompts are not allowed (summary). 2.2: TestFlight testers must not be compensated for testing (verbatim). Nothing found on badges, loyalty or referrals |
| [Google Play Payments](https://support.google.com/googleplay/android-developer/answer/9858738) | Verbatim | Bought virtual currency goes through Play Billing and stays inside the app. Silent on earned points and loyalty |
| [Google Play User Ratings, Reviews and Installs](https://support.google.com/googleplay/android-developer/answer/9898684) | Verbatim | No manipulation of ratings, reviews or installs; "Don't offer rewards or incentives for ratings or reviews" |
| [Google Play Metadata](https://support.google.com/googleplay/android-developer/answer/9898842) | Verbatim | No promotional text such as "limited time" in the listing title, icon or developer name |
| [Google Play Real-Money Gambling, Games and Contests](https://support.google.com/googleplay/android-developer/answer/9877032) | Verbatim | Real-world prizes and chance-based rewards are restricted; loyalty in non-game apps may use chance only with published rules and odds |

What the design does because of them:

- No reward of any kind for ratings or reviews; system prompts only.
- No reward unlocks Plus. Earned rewards are cosmetic, early access and expiring bonus Sparks: a reward for in-app actions (3.2.2(x), summary), never bought currency.
- No prize draws, no chance, no cash or real-world prizes.
- Founder status is granted at public launch, not during TestFlight, as thanks for using the app, not payment for testing. S5c should still check this against 2.2.
- The founding window is not advertised in the store title or icon.
- No referrals, so the incentivised-install rule does not arise.

## 8. Mapping onto the live database (for S6)

Proposals only; none has been run. Order: migration, apply, regenerate types, then code.

**1. `founders` (new).**

```
number         smallint primary key check (number between 1 and 100)
user_id        uuid unique references auth.users(id) on delete set null
cohort         text check (cohort in ('beta','public'))
qualified_at   timestamptz not null
granted_at     timestamptz not null default now()
retired_at     timestamptz
retired_reason text check (retired_reason in ('deleted','duplicate','fraud'))
```

**[S5c]** Add `founder_candidates`: `user_id` primary key, `qualified_at`, `proposed_at`, `decided_at`, `decision` (`approved`, `rejected`), `decided_by`. `loyalty_grant_founders()` fills it; an admin action per account inserts the `founders` row. On delete the number survives with a null user, so it is never reissued. Row security on; a user may select their own row; writes by `service_role` only.

**2. `beta_testers` (new).** `user_id` primary key references `auth.users` on delete cascade, `granted_at`. Filled once by the launch migration with every account that exists on launch day, minus staff.

**3. `loyalty_program` (new, one row).** `founder_window_opens`, `founder_window_closes`, `founder_cap` (100). Written by the migration that opens the window; no admin edit path.

**4. `loyalty_grant_founders()` (new).** Security definer, `service_role` execute only. Takes an advisory lock, returns at once if past the close date or at the cap, computes the bar from `app_activity_days` and the record tables, inserts the next numbers in order, writes a `founder_granted` event. **[S5c]** It computes the bar from the action-day view (2.1), never from `app_activity_days`, and inserts candidates, not numbers. Run by the cron route nightly and once at launch.

**5. `loyalty_events` (new, append-only).** `id`, `user_id` (on delete cascade), `kind` (`week_kept`, `week_frozen`, `week_check_abandoned`, `budget_set`, `month_tracked`, `founder_granted`, `review_prompt`), `period_key` (`2026-W47`, `2026-12`), `meta jsonb` (counts only, never amounts or text), `created_at`. Unique on (`user_id`, `kind`, `period_key`) for the once-per-period kinds. Users select their own rows; writes only through functions.

**6. `loyalty_accounts` (exists).** Add `streak_weeks int`, `streak_best int`, `freezes_banked smallint check (between 0 and 2)`, `last_kept_week text`. Keep `points_balance`, `lifetime_points`, `tier_key`, `tier_locked`. Add a select-own policy.

**7. `loyalty_ledger` (exists).** Earn rows: `actor_id` null, `reason` = the event kind, `ref` = the `loyalty_events.id`. Add a unique index on (`user_id`, `reason`, `ref`) where `actor_id` is null, so an event pays once. Add a select-own policy. Revoke the sequence grants from `anon` and `authenticated`.

**8. `loyalty_tiers` (exists).** Seed `seed`, `sprout`, `tree` with `status = 'draft'` and placeholder `min_points`. `admin_adjust_loyalty_points` already assigns tiers only from `active` rows, so drafts assign nothing until the switch-on migration.

**9. Earning functions (new).**

| Function | Who calls | Checks |
|---|---|---|
| `loyalty_record_week_check(p_week text)` | `authenticated`, as `auth.uid()` | **[S5c]** The server derives the week; the argument is only checked against it. The unconfirmed column is `sms_parse_log.awaiting_confirmation`. Points only if the week has a record; at least 5 days since the last kept week. The week is this week, or last week within grace; no unconfirmed SMS items remain in it (S6 names the parse-log column); then writes `week_kept`, adds 10 points, updates the streak |
| `loyalty_close_periods()` | `service_role`, nightly | Uses freezes for missed weeks; writes `budget_set` and `month_tracked` per section 4.1, with points |

Points always go through `admin_adjust_loyalty_points` (or a renamed copy with the same body), so the tier logic stays in one place.

**10. Reading status.** `/api/entitlements/me` adds `{ founder_number, beta_tester, streak_weeks, freezes_banked, lifetime_points, tier }`, read on the server. The credits screen uses a security definer function that returns the number, plus the display name only for founders who opted in (a key in `user_settings.privacy`).

**11. Bonus Sparks.** A tier reward inserts a `spark_allowances` row with `kind = 'bonus'`, `period_end` 30 days out, `ref` = the loyalty event id. Never `spark_purchases`. No `loyalty` entitlement row is used.

**12. Household later.** Every table above is keyed by `user_id`. Nothing references `budget_plans`, `shared_plan_id` or `profiles.active_shared_budget_id`.

## 9. Council (one round, 2026-11-15)

Skeptic, Pragmatist and Critic were three Sonnet subagents given the same brief and the live counts, without this conversation. The architect wrote a position first.

| Question | Architect (before) | Skeptic | Pragmatist | Critic | Result |
|---|---|---|---|---|---|
| Activity bar | One bar for all; testers' history counts; missers get a Beta badge | (b): any record and 3+ active days over 2 weeks; count user actions, not SMS-written rows | (b): 7+ active days or a budget set | (b): 7+ active days or 10+ records, and signed in within 60 days | **(b), 4 of 4.** Level synthesised: 7 days over 2 weeks (Pragmatist, Critic), a record the user made or confirmed (Skeptic), active inside the window (Critic's recency point). The Pragmatist's "or a budget set" is dropped: 9 people, and a budget alone can be one tap |
| Testers who miss | Beta tester badge | Beta badge, path to founder until close | Beta badge | Beta badge, can still earn it until close | 4 of 4 |
| Tier count | 3 | 3, not in v1 | 3, after 60 to 90 days | 3, after 60 to 90 days | 4 of 4 |
| Tier names | Seed / Sprout / Tree | Seed / Sprout / Tree | Seed / Sprout / Tree | Starter / Steady / Anchor | Plants, 3 of 4. Critic dissent kept: check the Arabic with native speakers |
| Referrals | None in v1 | None; later only non-cash, two-sided, gated | None; later non-cash, paid after the referred user passes the bar | None; later as a partner invite, not a reward scheme | **None, 4 of 4.** Later as the partner invite (Critic), not a reward |
| Streak unit | Weeks | Weeks | Weeks | Weeks | 4 of 4 |
| What makes a week count | The weekly check, nothing pending | Weekly review, or 3+ days with a record | Weekly review, or a fully tracked day | Weekly review, or all accounts confirmed for the week | **The weekly check; all 4 include it.** The "days with a record" fallback is dropped on the Skeptic's own warning that SMS rows are passive |
| Forgiveness | 1 freeze per 8 weeks | A freeze per 8 weeks plus a 7-day repair | 1 automatic skip per 8 weeks | 1 freeze per 8 weeks, no point loss | A freeze per 8 weeks, no point loss, plus a 3-day grace (a shorter repair) |

Strongest dissent, kept: the Critic warned that most testers will miss the bar and may feel snubbed, and that a cap of 100 that never fills makes the program look empty. Answer: the Beta tester badge is permanent for everyone; the credits screen shows numbers, not "x of 100"; a public counter, if used, shows founders and tracked months, not slots left.

What the council changed in the architect's view: the "active inside the window" condition (Critic) and "made or confirmed by the user" (Skeptic) were not in the first position. Two voices (Pragmatist, Critic) also said separately that onboarding, not loyalty, moves the numbers; section 6 says so.

## 10. Markets

| | Egypt | UAE | Saudi Arabia |
|---|---|---|---|
| Default week start | Saturday | Monday (public-sector week since 2022) | Sunday |
| Founding annual price | EGP 399 | AED 79.99 | SAR 79.99 |
| Launch marketing | First (S5a decision 4) | When its bank list is measured | When its bank list is measured |
| Arabic wording to test with | Egyptian readers | Gulf readers | Gulf readers; full Arabic matters most here (all 8 panel buyers who asked for it were Saudi) |

- One global cap of 100, no per-market quota. Egypt is marketed first, so most founders will be Egyptian, which matches where proof is needed first.
- Names: Founder = **عضو مؤسس**; badge text "مؤسس رقم ٢٣"; Beta tester = **مختبِر تجريبي**; streak = "٦ أسابيع متتالية"; weekly check = **مراجعة الأسبوع**; tiers **بذرة، نبتة، شجرة**. Digits follow the app's numeral setting (Eastern Arabic or Western).
- Ramadan and Eid: no special rule; the freeze and grace cover a missed week. If data shows streaks breaking in Ramadan, add one automatic freeze for the month later.
- Consumer and loyalty-scheme rules in the three countries were not checked (section 13). Points with no cash value and no redemption keep the risk low.

## 11. Abuse cases and controls

| Abuse | Control |
|---|---|
| Fake transactions to qualify or earn | Nothing counts volume. The founder bar needs one record; points need weeks and months. Fake entries buy nothing |
| Opening the app on 7 days to farm a founder number | Costs 7 real days over 2 weeks per account, and wins only a badge with no money attached. Staff can retire farmed numbers. **[S5c]** It cost less than that: seven scripted calls. Closed by the action-day definition and the owner's approval |
| Many accounts for many founder numbers | Same signals as in 2.5 (device key, phone, store account); staff review a duplicate list in admin; one founder per person |
| Tapping "Looks right" without looking | **[S5c]** Still allowed, but it pays points only for a week with a record in it. Allowed. It takes seconds and the reward is cosmetic; the check still clears unconfirmed items, which is the useful part |
| Farming bonus Sparks through tiers | Tier bonuses are once per tier and expire in 30 days; tiers need months of kept weeks. At most about $0.18 per account, ever |
| Client forging status | Status is read from server tables; earning goes through security definer functions with `auth.uid()`; no client writes to any loyalty table |
| Replaying an earn call | Unique (`user_id`, `kind`, `period_key`) on events and (`user_id`, `reason`, `ref`) on the ledger |
| Staff granting themselves numbers | Staff excluded from the bar; manual changes go through `admin_adjust_loyalty_points` and `admin_audit_log` |
| Referral fraud | No referrals |
| Rewarded reviews | None offered; both stores forbid it |

## 12. Owner decisions

| # | Decision | Recommendation | Council | Depends on S5a pick |
|---|---|---|---|---|
| 1 | Founder bar | 7 active days over 2+ weeks, 1+ record the user made or confirmed, active once inside the window; the same for testers. **[S5c]** Active days are server-observed user actions; the owner approves each founder (council 4 of 4) | (b) 4 of 4; level synthesised | None |
| 2 | Testers who miss the bar | Permanent Beta tester badge, no number; can still qualify until close | 4 of 4 | None |
| 3 | Number order | Qualified testers first by signup date, then everyone by date of qualifying | Architect only | None |
| 4 | Cap and window | 100 or launch + 60 days, dates fixed in a migration, no extension | Set by the plan | Decision 7 (founding offer) ends the same day |
| 5 | Founder money perk | None beyond the founding annual price, which is open to every subscriber in the window. **[S5c]** The founding price is not built in v1, so none | Architect; plan | **Decision 7.** If the owner drops the founding price, founders have no money perk at all, which is fine. If the owner wants the price for founders only, it needs per-user offer codes or promotional offers in both stores; S5c must check that first |
| 6 | Bonus Sparks for founders | None | Architect only | Decisions 8 (name) and 10 (allowance) |
| 7 | Streak | Weeks; the weekly check with nothing pending; 3-day grace; a freeze per 8 kept weeks; no point loss | 4 of 4 on weeks and on the check | None |
| 8 | What earns points | Kept week 10, budget set 10, tracked month 40; nothing else | Architect, consistent with the council | None |
| 9 | Tiers | Three: Seed, Sprout, Tree (بذرة، نبتة، شجرة); no demotion; switched on per section 5.4 | 3 of 4 on names; 4 of 4 on count and timing | None |
| 10 | Tier rewards | Themes, Buddgy outfits, early access, one-time expiring bonus Sparks; never Plus time | Architect | Decision 3 (what Plus contains): if themes become Plus-only, tier themes must be different ones |
| 11 | Referrals | None; an unrewarded share link; a partner invite with the household plan | 4 of 4 | Decision 2 (household plan later) |
| 12 | Spending points | Never in v1 | Architect | Decision 11 (packs): stays apart from purchased Sparks either way |
| 13 | Review prompts | System prompts only, after a tracked month or 4 kept weeks, at most every 120 days | Required by store rules | None |
| 14 | Credits screen | Numbers for all founders; display names only with opt-in | Architect | None |

Owner actions that are not choices: send lapsed testers one note about the window before launch; run the founders' channel (about 1 to 2 hours a week); have five native readers per market check the Arabic names.

## 13. Not verified

- **[S5c]** The first four items below are now settled in `docs/launch/S5c-review.md` (sections 7 and 11); `admin_staff.user_id` is the staff join; `sms_parse_log.awaiting_confirmation` is the unconfirmed column.
- Apple sections 3.1.1, 3.1.2, 3.2.2, 5.6 and 5.6.1 were read **through a summary**, not verbatim. The "own mechanisms to unlock content" and "may incentivize in-app actions" lines need a verbatim read in S5c.
- Whether giving TestFlight testers a badge at launch could be read as compensation under Apple 2.2.
- Whether both stores let the founding introductory offer end on an exact date (already on S5c's list).
- Consumer-protection and loyalty-scheme rules in Egypt, the UAE and Saudi Arabia.
- How `admin_staff` maps to user accounts: a join on `admin_staff.id = auth.users.id` matched none, so staff exclusion needs the right column in S6.
- The column that marks an SMS item as waiting for the user, which the weekly check relies on. S6 names it.
- Whether the existing cron route can run the nightly grant job, or a new schedule is needed.
- Active days come from app sessions. A session that only opens the app counts; whether to require a minimum session length was not tested.
- Tier thresholds, review-prompt timing and the switch-on numbers are placeholders until real data exists.
- The Arabic wording has not been read by native speakers in each market.
- Week-start defaults per market are from general knowledge, not checked against users' settings.
