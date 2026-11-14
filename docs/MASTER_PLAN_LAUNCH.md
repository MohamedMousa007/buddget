# Buddget launch master plan (council-ordered, model-routed)

Written 2026-11-14. Evidence below was read from the repo and the live DB (read-only aggregates, no row contents). Council verdict: Fable only where judgment changes the outcome (SMS correctness, money-path security); cheaper models for bulk execution; switch models at session boundaries, never mid-task.

## 0. Capacity and clock

- Weekly Fable bucket is separate and **resets weekly**: next reset 2026-11-17 04:00 UTC (06:00 Cairo). So there are two Fable windows in this plan: W1 (now to Nov 17) and W2 (Nov 17 to Nov 24). Unused W1 allowance is lost; do not pad W1 with low-value work.
- The 5-hour limit is the real constraint. Run Fable in short bursts, each ending in a committed checkpoint file so a cut-off loses nothing.
- Extra usage is off ($40/month cap). Do not enable it for this plan.
- Models: Fable 5.2 (hardest reasoning), Opus 5.5 (design/strategy/final review), Sonnet 5.5 (implementation, sweeps), Haiku 5.5 (bulk labeling, repetitive screen sweeps).

## 1. What the review found (evidence, not opinion)

### SMS tracking (live DB, 10 SMS users, 952 logs, 2026-06-16 to 2026-11-13)
| Finding | Number | Meaning |
|---|---|---|
| SMS expenses with no payment method | 449 of 576 (78%) | Almost certainly the "marked as cash" bug: no account is linked, so the UI falls back to cash. Cash is a rendering default, not a parse result. To confirm in S1 how `null` renders. |
| Purchases categorised Other or null | 270 of 366 (74%); 185 (51%) have no normalized merchant | Category accuracy problem is merchant resolution, not the regex. Food is only ~21 of ~300 classified. |
| `Instapay` as a category | 140 SMS expenses | Transfers are landing as spending categories. |
| IPN transfers paired | out 170 / in 135, only 1 paired each; own_transfer 8 total; counterparty last4 present on 7 of 170 out | Own-account transfer detection barely fires, so doubling is expected: the out leg is an expense and the in leg is income. |
| Currency exchange | 4 rows, all paired, 2 expense-linked | Small sample; the FX leg still reaches the expense table. Needs rule-level review, not more data. |
| AI dependency | 446 of 779 parsed (57%) still go to the AI tier | Speed and cost target. Template tier has 51 active, curated_db 11; **0 auto-promoted ever**; 1 quarantined, 1 retired. |
| Non-parse | 170 `not_transaction`, 3 timeouts | Filter is fine; timeouts are the speed signal. |

### Monetization (live DB + repo)
- `plans` has one row: `free`, price 0, limits `{ai_budget_per_hour: 15}`, no features. No paid plan exists.
- No billing code anywhere (no StoreKit, Play Billing, RevenueCat or Stripe). The scaffolding exists: `plans`, `user_entitlements` (source can be apple/google/stripe/promo), `src/lib/entitlements/*`, `GET /api/entitlements/me`, an AI quota "wheel" (`ai_quota_reserve/settle`), `LIMIT_CATALOG` with items marked `enforced: false`, admin Plans view, loyalty tables.
- AI cost is tiny: about $0.19 total over 30 days across all users (SMS call ~$0.00045, budget ~$0.003, chat ~$0.002). **AI is not the cost problem today**, so credits should be a fairness/abuse control and an upsell lever, not a margin engine. Re-check with growth.
- Store copy says "Free. No ads." in `docs/GOOGLE_PLAY_SUBMISSION.md`; it must change before a paid plan ships.

### Launch readiness (repo)
- Docs and assets exist: `APP_STORE_SUBMISSION.md`, `GOOGLE_PLAY_SUBMISSION.md`, `STORE_PRIVACY.md`, iOS `PrivacyInfo.xcprivacy`, account deletion route, legal pages, bilingual site.
- Open per QA Round 6: Android release is still debug-signed (R8 + env-based release signing written but never built), Play `RECEIVE_SMS` declaration and receipt-retention confirmation, Firebase key restriction, `SMS_REQUIRE_DEVICE_HEADER=1` on Vercel, native Kotlin/Swift unverified on device, store links on the site are `null` (beta list), no real reviews, screenshots and the automation claim need retaking/refreshing.
- Docs drift: `CLAUDE_CONTEXT.md` still says native builds are GitHub Actions only (superseded by local `native-release.sh`) and lists dark-mode tokens while QA6 reports one light palette. Reconcile in S9.

### UI/UX (live walk, limited)
- Dev app ran at 375 px. `/flow`: no horizontal overflow, but **25 interactive elements under 44x44** (header icons 36x36, month arrows 32x32, filter chips 36 high). Project rule is 44 minimum; verify whether a larger hit-area wrapper exists before changing.
- The dev auth bypass renders zeros on data surfaces, so this walk could not judge real-data UX. A seeded walk is a session below (S7).

### QA history changes the QA plan
Six QA rounds are done (QA6: 0 P0, 7 P1 all fixed, ~46 P2 and ~134 P3 mostly fixed; Trail of Bits and Sentry skills already vetted and used; semgrep ran). A fresh "whole app" sweep would mostly rediscover closed items. QA6 "Not covered" is the real target: live browser sweep with data, real-device native, Buddgy on the live model, light/tablet/desktop, plus all code written after Nov 12 (SMS delivery watch, queue retry/eviction, canary cron, R8 build).

## 2. Sessions

Order: S1 → S2 → S3 are the critical path. S4 runs in W1 after S2. H-tasks (human) start today. S5/S6 can run in parallel with S2 on different files.

Rules for every session (from project CLAUDE.md): read `CLAUDE_CONTEXT.md`, DB-first (`list_migrations`, schema vs `database.types.ts`), order migration → `execute_sql` → regen types → code, `npm run verify` before any push, diff audit, `git add` only your own paths, never build or upload apps unless the user says so, reuse existing UI components. Each session writes a closing note to `docs/launch/Sx-closing.md`.

### H0. Human tasks (start today, calendar-bound, no model)
1. Play Console: submit the `RECEIVE_SMS` permission declaration with the 30-second screen recording (script in `GOOGLE_PLAY_SUBMISSION.md` §3). Rejection would block the core feature, so this goes first.
2. Check Play's testing requirement for new personal developer accounts (closed-test tester count and duration) and start the closed test if it applies. This is the likeliest launch-date driver; confirm the current rule on Play Console.
3. App Store Connect: create the app's subscription group and products as drafts once S5 fixes the SKUs; prepare reviewer notes and a demo account.
4. Console/env: `SMS_REQUIRE_DEVICE_HEADER=1` on Vercel, restrict and rotate the Firebase key, confirm receipt-image retention wording.

### S1. SMS forensic audit — **Fable 5.2**, read-only, W1 day 1 (1 to 2 bursts)
Goal: prove root causes before touching code, and build the evaluation set everything else is measured against.
- Confirm cash root cause: how null `payment_method_id` renders; check all 449 rows by user and bank.
- Build a gold set from the 952 logs (masked): label expected kind, category, account, own-transfer/FX status. Fable proposes labels; **you spot-check a sample** (about 60 rows) before it counts. Hold out 30% untouched for promotion checks.
- Classify every miss into: no account link, merchant unresolved, wrong kind, unpaired transfer, FX, parse failure. Quantify each.
- Review the 51 templates + 11 curated_db: which are wrong or too broad; why 0 auto-promotions (QA6 SLG-3 said fixed; verify).
- Output: `docs/launch/S1-sms-audit.md`, `docs/launch/gold-set.jsonl` (masked), fix design with acceptance numbers (target e.g. cash-misflag to near 0, Other/null below 25%, own-transfer pairing above 90% on gold set).
Exit: you approve the fix design and the gold set sample.

### S2. SMS fixes, TDD — **Fable 5.2** for design/review, **Sonnet 5.5** subagents for mechanical coding, W1 days 1 to 3
Each slice is a failing test from the gold set first, then the fix, then `npm run verify`:
1. Account/payment-method resolution from bank + last4 + sender so SMS expenses stop defaulting to cash; cash only for ATM-to-wallet or explicit cash.
2. Merchant to category: Egypt/GCC merchant dictionary (curated, tiered ahead of AI), normalization, learn from user corrections, AI only for unknowns.
3. Transfer handling: own-account detection by IPN reference, counterparty last4/name vs the user's registered accounts, and a single-count rule (own transfer is a transfer, never expense + income). Instapay stops being a spending category.
4. Currency exchange: one economic event, one count, store rate; fee separate.
5. Speed: raise template/curated hit rate to cut AI calls (57% today); fix timeouts.
Migrations go through the DB-first order. Exit: gold-set metrics meet S1 targets on both train and held-out parts.

### S2 status and council decisions (2026-11-14, done; details in `docs/launch/S2-closing.md`)
S2 and its follow-up (template promotion, provider cascade, own-transfer signals, cut-off merchant categories) are on `main`. Replay on the gold set: unplaced SMS expenses 77% → about 15% (the rest have no account digits), "Other" on holdout 41% → 31%, AI share unchanged at 57 to 59% (two templates promoted, no new reach yet). Live migrations 0261 to 0268.

Council on the five open items (4 voices; verdicts adopted):
1. **AI categoriser: apply, but as a visible suggestion.** BUILT. `expenses.category_source` marks an AI guess; the row shows "Suggested"; saving it records confirmed or changed. A suggestion is never evidence for another row. Dissent kept (Skeptic): a badge on an applied guess does not literally meet "an AI guess only pre-fills a question"; the fallback is suggestion-only.
2. **iPhone Shortcut bank value: deferred, spec only** (2 to 2; the tie went to "defer" because a bank value would not place any still-unplaced row and touching the Shortcut risks the capture pipe). Spec is in the closing note. Revisit when the cascade's miss rate is known at real volume.
3. **Category picker: keep the edit-sheet route now, extract a `CategoryGrid` in S7** (3 of 4). Gate: if fewer than about 20% of the unknown-merchant questions get answered, bring the extraction forward. The answer rate is now recorded.
4. **Credit sender: read it from the user's own transaction title.** BUILT. The log-reading hook is removed.
5. **The 15 relabels: all stay out of the gold set until S3** (2 to 2; the tie went to "leave out" because accepting rule-derived labels makes the evaluation grade the rules against themselves).

Premise raised by all three outside voices: there is one manual category edit in the whole database, so every "learn from the user" path is unmeasured. The two new counters (suggestions confirmed vs changed; questions answered vs skipped) are the numbers to read before any further auto-apply.

### S2b. Whole-pipeline SMS review — **Fable 5.2**, read-only, after S2 lands (owner request 2026-11-14)
S1 only chased the four reported symptoms. S2b reviews the entire SMS logic end to end and hunts for issues nobody reported. Output `docs/launch/S2b-sms-review.md`, findings ranked P0 to P3 with a repro or a log id each; fixes go to a follow-up Sonnet session, money-path ones reviewed by Fable.
- **Every stage:** device capture (Android receiver, iOS Shortcut), on-device queue and retry, ingest gates and tokens, dedupe, the four parse tiers, direction guard, date and currency resolution, dispatch, pairing, expense/income/debt writes, confirm/undo/dismiss, push, learning funnel, promotion and quarantine, retention and masking, admin views.
- **Every kind, measured on the gold set, not only the four symptoms:** purchase, online purchase, transfers in and out, own transfer, FX, ATM, card payoff, installment, salary and other income, refund, declined, fee, subscription match, balance report, and the 170 rejected rows (false negatives).
- **Coverage matrix:** per bank and wallet in Egypt and Saudi Arabia, which message types parse, on which tier, with what accuracy; list the gaps.
- **Cross-checks:** totals after SMS vs bank-reported balances; duplicates across tiers; order-of-arrival and race cases; time zones; multi-device; a user with zero accounts; Arabic vs English; latency per tier.
- **Provider identification for sender-less messages (found 2026-11-14):** of 379 unplaced rows with no bank, 197 (52%) can be named from data already held: the same user's same digits appear elsewhere with exactly one bank. Another 105 have digits but no known bank, in about 26 message formats; each bank has a distinctive house format, so a small format-to-bank table (mostly Saudi banks, absent from the catalog) covers them. 77 have no digits and cannot become an account. S2b confirms these numbers with the S2 harness and specifies: per-user digits-to-bank memory, format fingerprint table, hotline and URL signals read before masking, and the iOS Shortcut passing the sender.

### S2b-2 and S2c. Second review, then the fix session — **Fable 5.2** designs and reviews, **Sonnet 5.5** subagents code (added 2026-11-14)
- S2b-2 (done): adversarial second review, `docs/launch/S2b2-second-review.md`. It replaces three unsafe fixes, corrects the duplicate evidence, drops two wrong findings and adds N1 to N27.
- S2c scope: section 7 of that file (invariants spec first, then batch 1 steps 1 to 11 in order), with the decisions in its section 10. Native changes are written but not built.
- Exit: invariants spec in `docs/launch/`, batch 1 landed with tests, the closing replay over all 952 messages reporting the checks listed in section 7, `npm run verify` green, pushed to dev and main, closing note `docs/launch/S2c-closing.md` listing what moved to batch 2 and to S3.
- S3 starts only after S2c lands; its repair list is the corrected one in section 7 plus the `baab5343` default in section 10.

### S3. Data repair and curation — **Sonnet 5.5** (dry-run), **Fable 5.2** reviews the diff, W1 day 3
- Replay all 952 logs through the new pipeline with `replayHarness` and produce a **dry-run diff report** (what would change, per user, per field). No writes yet.
- The dry-run must be re-run after the last rule change (no repair is applied from an older one) and must list rows the user has edited separately; a repair never overwrites them.
- You approve a sample, then apply as a migration (rows are real money data; every change reversible, old values kept in an audit column or table).
- Promotion: run the promotion checker against the **held-out** set; promote to curated only the templates that pass. Keep quarantine shadow mode on. Never bulk-promote unreviewed.
Exit: repaired data, promoted templates with a recorded holdout result, rollback note.

Carried into S3 from S2 (2026-11-14): owner reviews the 15 relabels before they enter the gold set; old rows need `bank_source`, `format_key` and `shape_key` (the bank is re-derived from the masked body); rows flagged `template_revoked_at` are a repair input; `sms_try_pair` should refuse a same-account pair in SQL (today the guard is in `dispatch.ts`).

### S4. Security and money-path QA slice — **Fable 5.2**, W1 day 3 to W2 day 1
Scope is narrow on purpose: RLS and grants delta since QA6; every new route/RPC added after Nov 12; AI endpoints (abuse is direct cost); queue/retry/eviction code and the SMS token paths; net worth, balance and cash-flow math; entitlement enforcement points that billing will rely on; webhook signature design for the future billing events. Tools: the already-vetted semgrep/Trail of Bits/Sentry skills. Output: `docs/launch/S4-security.md` with P0/P1/P2 and tests for each real finding.

Carried into S4 from S2 (2026-11-14): `sms_parse_log.clean_title` still holds transfer counterparty names; a test fixture (`src/lib/sms/ipnTransfer.test.ts`) contains what looks like a real personal name; server-side SQL that totals income does not know `income_events.exclusion`.

### S5a. Pricing, free trial and AI credits design — **Fable 5.2**, W1 (owner decision 2026-11-14, council advised design free, implementation fitted)
Clean-sheet design: start from the business questions, not the tables. Treat the existing `plans`/`user_entitlements`/resolver/quota scaffold as a **constraint to challenge**: first fit-test it (about an hour), then keep, extend or replace each part with a written reason. Council (3 of 3) rejected "disregard the existing structure" because it yields churn and a spec that cannot map onto the live DB; it endorsed Fable designing freely. Also evaluate the cheapest validation first: manual entitlements via the `promo` source plus InstaPay/Fawry to test willingness to pay before building billing. Skills to consider only if S5 picks RevenueCat: RevenueCat/ai-toolkit (official). Do not install `rc-claude-code-plugin` without a review (a Tessl audit flagged it as high risk).
This is a decision document, not code. Deliverable `docs/launch/S5-monetization.md`:
- Freemium ladder grounded in the data: what is free (core tracking, manual entry, limited accounts), what is paid (e.g. SMS auto-tracking volume, AI chat/receipt/voice quotas, multi-account depth, reports/export, budgets studio), a trial, annual discount.
- Egypt-first pricing in EGP with USD/AED anchors, purchasing-power reality, and store fee/tax assumptions (verify against current Apple/Google programs before committing).
- AI credits: map existing quota "wheel" limits to plan limits; credits as fairness and upsell, margin check from the real cost table (cost is cents today).
- Payment path: Apple IAP and Play Billing are mandatory for in-app digital subscriptions. Evaluate RevenueCat vs direct StoreKit/Play Billing (build vs buy); web checkout only outside the apps.
- Owner decisions list (below). Exit: you pick the ladder and SKUs.

Owner brief added 2026-11-14 (all must be covered in the S5a brainstorm, with a council inside the session):
- **Freemium:** the free tier keeps the complete core loop so free users genuinely enjoy the app; paid adds depth, volume and convenience. S5a decides exactly which features, with the feature inventory in `CLAUDE_CONTEXT.md` as input.
- **Free trial structure:** compare store-native intro offers vs the app's own `trialing` entitlement; trial length; what is unlocked; conversion prompts. Anti-abuse: tie the trial to store purchase history/Apple ID/Play account, not email, so re-signup cannot restart it.
- **AI credits (own name, pay-as-you-go top-ups, like Claude tokens):** plans include a monthly allowance (expires); users can buy top-up packs (consumable IAP); one credit unit abstracts model cost with a margin; per-feature credit costs (chat, budget AI, receipt, voice, SMS AI); spend order (allowance first, then purchased); hard caps and abuse limits; model the worst power user first (real cost today is about $0.19/month across all users, so it is a fairness and upsell mechanism). Keep **three separate ledgers**: plan allowance, purchased credits (a liability, maybe refundable), loyalty points (no cash value, non-transferable).
- **Pricing evidence:** survey the 45 beta users on willingness to pay before publishing tiers.
- **Egypt payments:** store IAP vs InstaPay/Fawry/Paymob; store rules decide what must go through IAP (digital goods and AI credits do).

### S5b. Loyalty program and founding members — **Opus 5.5** brainstorm, W1, after S5a (council result 2026-11-14: 2 of 3 voices said mid-tier brainstorm, top model for review)
Deliverable `docs/launch/S5b-loyalty.md`. Inputs from the council:
- **Founding members:** hard cap of **100 and** a closing date (launch + 60 days), whichever comes first. The 45 beta users count automatically (they carried the risk); about 55 public slots. A founder must also pass a light activity bar (for example 10+ transactions or 14 active days) so the badge means something. Status is a **server-side flag granted once by a migration/job**, never computed on the client.
- **Founder perks, mostly status:** permanent badge, founder number (#023), early access to features, direct feedback channel with you, name in a credits screen, roadmap votes, and at most a time-boxed perk (one-time AI credit pack, or a discount capped at 12 months). **No lifetime free premium and no "forever" discount**: EGP prices are volatile and unlimited AI for founders is the perk that can quietly hurt you.
- **Loyalty tiers:** design the full ladder and rewards (themes, badges, mascot skins, early features, time-boxed credit bonuses), but reward **consistency and outcomes** (a fully tracked month, budget set, weekly review), not raw transaction counts or logins, to avoid fake-transaction gaming and over-tracking in a finance app. Council dissent (Skeptic): with 45 users there is no retention data, so ship v1 as founder badge + streak + the ledger and switch tiers on after 60 to 90 days of data. Plan adopts that rollout.
- Check Apple/Google rules on rewards that carry value before any redeemable reward is designed.

### S5c. Economics, abuse and store-policy review — **Fable 5.2**, W1 or W2 (short)
Adversarial review of S5a + S5b: price math, worst-user cost, trial abuse, credit refund liability, gaming of loyalty, and Apple/Google policy on credits, rewards and subscriptions. Output: `docs/launch/S5c-review.md` with changes required before S6 starts.

### S6. Billing, AI credits and loyalty implementation — **Sonnet 5.5**, after S5a/S5b/S5c approval, W2
Scope: subscriptions + trial, the credits ledger and top-up packs, the loyalty/founder ledger and badge UI. If S5a picks RevenueCat, use the installed RevenueCat skills below (entitlements gate, paywall, purchase flow, testing setup).
Implements exactly what S5 decided, on the scaffold where S5 kept it (migrations for anything S5 replaced). Steps: seed paid plans via migration; purchase/restore/manage flows in the apps; server-verified receipts/webhooks writing entitlements; flip `enforced: false` limits that S5 gates; paywall and upgrade prompts built from existing design-system components (no new component without alert); admin Plans view already exists. **Fable 5.2** reviews the webhook and entitlement code in W2 (small, high-risk). Tests include expired/refund/grace/restore paths.

### S7. UI/UX smoothness — **Sonnet 5.5** (+ Haiku 5.5 for repetitive screen sweeps), W2
- Walk with seeded data (`buddget-qa-local` with `__finance/__settings` hooks) on 375/768/1440, light and dark if present, plus the iOS simulator and an Android emulator for native.
- Fix under-44 px touch targets (verify hit areas first), perceived performance (skeletons, boot, nav), empty/error/offline states, SMS review/held flows, and onboarding friction.
- Rules: reuse existing components, additive variants only, tokens only, design-system doc first.
- Output: before/after screenshots and a friction log with severity.

Carried into S7 from S2 (2026-11-14): extract a reusable `CategoryGrid` from the expense form (owner approval needed, additive, form unchanged) so the "what kind of place is X?" question is answered in place; show the stored bank suggestion as the pre-selected bank when a bank-less account is kept; the edit sheet for an Unassigned expense still preselects Cash.

### S8. QA delta — **Sonnet 5.5** (sweeps) with **Haiku 5.5** for repetition, W2
- Vet the neonwitty QA skill before installing (read the repo, check what it executes, as QA6 did for the others); install only if it passes.
- Cover QA6 "Not covered" plus new code: live browser sweep with data, real-device native (SMS receive, queue drain, biometric, push), Buddgy against the live model with the eval script, light/tablet/desktop.
- Triage findings; anything touching money or auth escalates to Fable in W2.

### S9. Store and website readiness — **Sonnet 5.5**, W2
- Signed Android release build and R8 sanity run on a device; iOS archive checks; both only when you say build.
- Update store copy (remove "Free. No ads."), Data safety and nutrition labels for purchases, subscription terms and auto-renew disclosures, Restore Purchases, reviewer notes explaining SMS (Android receive-only; iOS via Shortcuts), demo account.
- Retake screenshots from the store build; refresh the automation claim; fill store links; legal pages reconciled; fix `CLAUDE_CONTEXT.md` drift.

### S10. Launch gate — **Opus 5.5** with a council (+ **Fable 5.2** in W2 for the money-path re-review)
Go/no-go checklist: gold-set metrics, S4 findings closed, billing sandbox pass on both stores, store declarations approved, staged rollout plan, monitoring (Sentry, SMS canary, queue health in admin), rollback steps, support readiness.

## 3. Decisions needed from you (none block S1)
1. Is SMS auto-tracking free, capped on free, or paid? (affects S5/S6 and the Play declaration story)
2. Launch markets and currency: Egypt-only at launch, or GCC pricing too?
3. Trial: yes/no and length. Annual discount level.
4. Build vs buy for billing (RevenueCat vs direct).
5. Whether the gold-set sample can use your own accounts' messages (yes assumed; masked).

## 3b. Skills installed (2026-11-14)
- `revenuecat@RevenueCat` v2.5.1 and `revenuecat-play-billing@RevenueCat` v1.0.0, user scope, from the official `RevenueCat/ai-toolkit` marketplace (MIT). Vetted first: no hooks, no risky patterns in the skills; the only external piece is a remote RevenueCat MCP server (`https://mcp.revenuecat.ai/mcp`) that needs your authorization before it works. The skills are inert guidance until used; whether RevenueCat is adopted is decided in S5a, not by installing them.
- Not installed: `rc-claude-code-plugin` (a Tessl audit flagged its purchase-flow skill as high risk) and the neonwitty QA skill (vetted in S8).
- Restart or reload the Claude session for the new skills to appear in the skill list.

## 4. Kickoff prompts (copy into a fresh session on the named model)
- **S1 (Fable 5.2):** "Read docs/MASTER_PLAN_LAUNCH.md S1. Do the SMS forensic audit read-only on live DB ydihurtbcnoflhormgzi and the repo. Write docs/launch/S1-sms-audit.md and a masked gold-set.jsonl, then stop for my spot-check."
- **S2 (Fable 5.2):** "Read S1-sms-audit.md. Implement slices 1 to 5 of S2 test-first against the gold set, migration → apply → types → code, verify green. Delegate mechanical coding to Sonnet subagents; you review every diff."
- **S3 (Sonnet 5.5):** "Replay all SMS logs through the new pipeline with replayHarness, produce a dry-run diff report only. Do not write to the DB."
- **S4 (Fable 5.2):** "Run S4 scope from docs/MASTER_PLAN_LAUNCH.md. Findings with repro tests only."
- **S5a (Fable 5.2):** "Read docs/MASTER_PLAN_LAUNCH.md S5a. Brainstorm extensively and run /council inside the session on freemium split, trial, AI credits (name, packs, ledgers) and payment rails. Treat the existing plans/entitlements scaffold as a constraint to challenge. Write docs/launch/S5a-pricing.md."
- **S5b (Opus 5.5):** "Read S5b and S5a-pricing.md. Design the loyalty program and founding-member rules per the council inputs. Write docs/launch/S5b-loyalty.md."
- **S5c (Fable 5.2):** "Adversarially review S5a and S5b for economics, abuse and store policy. Write docs/launch/S5c-review.md."
- **S6 to S9 (Sonnet 5.5):** point at the matching section; each ends with `npm run verify` and a closing note.
- **S10 (Opus 5.5):** "Run /council on go/no-go using the closing notes."

## 5. Risks
- Bulk promotion bakes wrong labels into curated at scale: holdout set, shadow mode, human sample before any promotion.
- Overfitting to a 10-user sample (mostly your own banks): keep the dictionary generic, test on held-out users.
- Fable burns the 5-hour window mid-batch: idempotent batches, checkpoint files, commit per slice.
- Store review: SMS permission and IAP rules can reject or delay; H0 starts the clocks now.
- Parallel sessions share one checkout: use separate worktrees for S5/S6/S7 and never `git add -A`.
