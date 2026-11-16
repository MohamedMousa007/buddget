# Briefing for ChatGPT: write a prompt for Fable 5 that rebuilds Buddget's budget builder from scratch

You are helping the owner of Buddget write ONE prompt for a coding model (Fable 5). Fable 5 will recreate, from scratch, a state-of-the-art, AI-enabled **budget builder** (plus a minimal first-run entry to it). Below: what the app is, every data domain the builder can use, how today's builder works, the council decision on onboarding, and what your prompt must demand. Facts marked (current) come from the live codebase; items marked (recommended) are design decisions for the rebuild.

---

## 1. The product in one paragraph

Buddget (Buddgy is its AI character) is a mobile-first personal-finance app for Egypt and the Gulf (EGP, AED, SAR; English and Arabic with full RTL). It runs as a Next.js 16 / React 19 / TypeScript web app and as Capacitor iOS and Android shells. State is Zustand, offline-first, synced to Supabase (Postgres, RLS on every user table, last-write-wins merge). AI is Gemini behind server routes. It tracks spending (including automatic capture from bank SMS), income and paydays, accounts, subscriptions, debts, savings, investments, goals, and builds budget plans.

## 2. The goal of the rebuild

One budget builder that is **very intelligent and very smooth**, that works for three kinds of person without branching the product:

| User | State | What the builder must do |
|---|---|---|
| A | Brand-new signup. No data, possibly not even a name. | Cold start: after a ~30-second account stub, produce a first usable budget in about a minute from almost nothing (benchmarks + AI), then improve it as facts arrive. |
| B | Signed in, no data, making a new or additional budget. | Skip the stub. Reuse remembered stable facts from the account profile; ask only plan-level questions. |
| C | Signed in with history (transactions, accounts, income, debts, goals, subscriptions, savings). | Pre-fill from real data and **confirm, never ask**. Ask only per-plan decisions and genuine conflicts. |

Rule: branch by **what is already known**, never by user type. One adaptive graph, three starting states.

## 3. Council decision: onboarding or not?

Question put to a four-voice council (Architect, Skeptic, Pragmatist, Critic): should the prompt include a separate onboarding, and what is asked at onboarding versus only in the builder?

- **Architect (opening view):** keep a separate short onboarding module sharing one data contract with the builder; split data by lifetime (account-level once, plan-level per budget).
- **Skeptic:** "onboarding vs builder" is a false binary. The only thing needed before any screen renders is currency/locale. Collapse onboarding to one gate (country, currency, language, optional name); the builder is the first-run experience; everything else is asked lazily, when it changes a number.
- **Pragmatist:** ship a ~30-second Welcome of at most 3 screens that sets account facts and lands in the builder; no accounts, balances, income, payday, goals or SMS inside it.
- **Critic:** same direction, plus risks: stale "stable" answers poisoning new plans; unsynced offline data on a new device looking like a new user; permission prompts denied permanently if asked out of context.

**Verdict (the Architect moved to the others' position; three voices aligned against the original six-step idea):**

1. **No separate multi-step onboarding spec.** Replace it with an **account stub** (language, country to currency, optional name), at most 3 screens, about 30 seconds, then straight into the builder in cold-start mode.
2. **The builder is the first-run experience.** Its first screen is the free-text "describe your situation" opener (income, household, goals in one sentence), not a form.
3. **Accounts, balances, income, payday, goals, SMS and push are asked inside the builder or just-in-time**, at the moment they change a number. Permission asks (SMS, push) come **after the first plan is shown**, never before.
4. **A field registry is the real fix for drift.** Every field is tagged `account` or `plan`, with source, TTL and confidence. This single registry prevents re-asking and silent overwrites.
5. **Gate on server hydration, not local emptiness.** "New user" is decided only after the first server pull completes. A returning user on a new device or with unsynced offline data must never be treated as user A.
6. **Persist every answer immediately and allow partial drafts**, with an "incomplete budget" resume card, so abandoning mid-flow never leaves an empty home screen.
7. **Pre-fill and confirm for anything derivable from data.** Stable answers get a "still true?" recap with timestamp and per-field TTL before a new plan trusts them.

Strongest dissent (rejected in part): keep a richer onboarding that collects accounts, balances and income up front so dashboards are not thin. Resolution: the builder collects them with the same screens, and partial progress is saved, so nothing is lost.

## 4. Data inventory: everything that can feed the budget

Scope: **A** = account-level (asked once, remembered), **P** = plan-level (asked per budget), **D** = derived from existing data (never asked, only confirmed).

### 4.1 Identity and environment
| Data | Scope | Notes |
|---|---|---|
| Name | A, optional | Cosmetic. Never block on it. |
| Country | A | Drives benchmark tables (rent, food, transport, utilities). EG, AE, SA supported (current). |
| Base currency | A | Derived from country, one-tap override. Currencies: EGP, AED, SAR, USD, EUR, GBP (current). |
| Language, RTL | A | Switch the whole UI the moment it is chosen. |
| City | A, optional | Finer benchmarks. |
| Timezone, week start | A | Defaults from device. |

### 4.2 Income
| Data | Scope | Notes |
|---|---|---|
| Monthly take-home | A (D if history) | Most important number; every line is sized against it. |
| Income type | A | salary, freelance, business, seasonal, mixed, benefits, allowance |
| Stability | A | fixed / variable / mixed; variable earners also give a slow-month figure ("floor") |
| Job security | A | A shaky job raises the safety-net target to at least 6 months. |
| Tax set-aside | A | Share of income held back (0 to 40%). |
| Pay frequency, payday day(s) | A | monthly 1 day, biweekly 2, weekly up to 4; drift window; income events can be projected, confirmed, late, missed, partial. |
| Multiple sources | A | salary, bonus, side hustle, rental, investment, other. |
| Which account receives pay | A | Links income to an account. |
| Extra income that could be added | P | Used when fixed costs leave almost nothing. |

### 4.3 Accounts (where money lives)
Types: cash, bank account, debit card, credit card, prepaid card, wallet, BNPL, other. Each has name (bank catalogue), currency, optional last4, an **opening balance as of a date**, and cards hang under an account. Balances reconcile against bank SMS balance reports. Scope A, D when SMS or history exists. Liquid total feeds the safety net.

### 4.4 Housing and household
| Data | Scope | Notes |
|---|---|---|
| Housing: rent / own / family / company | A | |
| Rent amount and frequency; includes utilities? | A | If ledger rent differs from stated rent by more than 20%, ask which is right (conflict check). |
| Mortgage payment, years left, property costs | A | Owned homes. |
| Contribution to family household costs | A | |
| Household: solo / couple / family | A | |
| Dependants, youngest child age, school fees, childcare | A | |
| Partner role and share of shared costs | A / P | |
| Sends money to family regularly (amount) | A | Remittance-style commitments. |

### 4.5 Lifestyle and everyday spending
Transport mode (public, car, taxi, walk, mix); car ownership, payment and whether it overlaps a listed loan; food-out frequency; lifestyle (minimal, balanced, comfortable); health cover, health cost, chronic medication; cash-heavy spending flag (tracked spend then counts at half weight). Scope A. Everyday categories the engine sizes: groceries, dining, transport, health, shopping, fun, family, other (D from 3-month averages when history exists).

### 4.6 Bills and subscriptions
Recurring bills (name, amount, due day, essential or not, linked ledger categories) and subscriptions (brand catalogue with regional plans, plan, amount, billing cycle, billing day, status active/trial/paused/cancelled, tracking via SMS/ask/log). Scope D when found, otherwise A. Confirm: "We found N regular bills and subscriptions. Right?"

### 4.7 Debts and instalments
Kinds: credit card, personal loan, instalment / BNPL (Tabby, Tamara, valU, Sympl, Souhoola...), family/friends, student loan, back taxes. Per debt: balance, monthly minimum, APR (assumed 25% card, 12% loan if unknown), due day, credit limit, instalment count and amount, interest-free flag, direction (I owe / they owe). Also: pay card in full each month?, anything overdue (arrears, cleared over 3 months), payoff strategy (avalanche, snowball, balanced), extra per month available. Scope A for the debts themselves, P for strategy and extra.

### 4.8 Savings, safety net, investing, retirement, giving
Liquid savings on hand; emergency-fund target in months (default scales with income type and job security); savings pockets and a monthly-savings vault; savings target (percent or amount) and what makes saving hard; life/income-protection insurance and premium; retirement (employer plan counts, so only "none" earns a recommended line) and monthly amount; investing (gold, crypto, stocks, property; current monthly amount caps the investing line); zakat/giving mode and amount. Scope A, except savings target which is P.

### 4.9 Goals
17 categories (emergency fund, house, car, vacation, education, wedding, phone/device, family support, charity, gift, investment, debt freedom, quality of life, spending control, retirement, business, custom). Per goal: target, already saved, deadline or monthly amount, priority, funding mode (share / fixed / manual), linked savings pockets and debts. Scope A for goals, P for how aggressively this plan funds them. A goal that needs more than the plan can spare triggers a replan question (move date, lower target, or safety first). Goals may take at most 35% of income.

### 4.10 Annual and one-off costs
Costs that come once or twice a year (car renewal, school start, travel, festivals, big purchase in the next 2 years). Divided by 12 into a monthly line. Scope P.

### 4.11 Priorities and trade-offs
Priorities (safety, debt, goals, invest, enjoy, family), a save-hard vs live-comfortably slider (0 to 100), what to trim first when money is tight, housing-share-too-high response, deficit plan. Scope **P** (deliberately re-asked each plan, though remembered for the AI).

### 4.12 History (D)
Transactions by category and month, rent seen in the ledger, 3-month averages per everyday category, income history and floor, learned per-line adjustments from past edits and month closes, close memory (a declined proposal is not repeated).

## 5. How today's builder works (current, for Fable 5 to improve upon)

- **Entry (CreateChooser):** intent-first: save more, reach a goal, pay off debt (plus blank, template, copy a plan, continue a draft). With history, every starting point asks less.
- **Opener:** free text "describe your situation"; AI parses it and every answered question is skipped.
- **Question graph:** about 100 possible questions in 10 modules (found, income, housing, household, life, debts, security, goals, annual, priorities). Each question has a control type (confirm, chips, multi, amount, stepper, toggle, slider), a one-line "why we ask", a `when` condition reading earlier answers, a **stake** (how much it can move the plan), and a tier: **core** (always asked if needed), **std** (competes for a short per-run budget, ranked by stake), **follow** (unlocked by a parent answer, never cut). Questions are grouped several per screen; a cursor means earlier modules are never revisited. "Not sure" uses a typical value and marks the line **estimated**.
- **Known facts:** live data beats anything typed once; remembered answers fill the rest; per-plan decisions are not carried over.
- **Engine (deterministic, versioned):** sizes seven blocks: bills, subscriptions, debts, everyday, safety, goals, grow. Uses regional benchmarks, a 10% spending cushion, an essentials floor at 70% when trimming, trim order (fun, shopping, dining, other, family, transport, health, groceries), debt warn at 36% of income and hard limit 50%, needs warn at 60%, costly debt at 15% APR and above comes before extra saving, tax reserve, variable-income fallback at 80%, starter safety net 6 months, full 12 months, personal-history scaling clamped between 0.5x and 2x of benchmarks.
- **AI layer:** refines the draft, parses the situation text, adjusts lines from natural language ("lower dining by 20%"); locked lines are never changed; each line carries a one-line rationale and confidence (high / estimated).
- **Plan model:** status draft / ready / archived; intent balanced / saver / debt crusher / custom; origin ai / manual / template / clone; lines carry block, live link (subscriptions, debts, goal, emergency) so amounts stay live, due day, essential flag, lock.
- **After build:** plan review, activation by cycle, comparison between plans, month-close sheet that proposes raising or lowering lines, learning that feeds the next plan.
- **Today's first-run (current, being replaced):** a 6-step journey (About you, goals, accounts and balances, income and payday, SMS/push automation on native only, budget handoff), about 2 minutes, behind a feature flag. The council verdict above replaces it with the account stub.

## 6. Requirements for the rebuild ("state of the art")

The prompt for Fable 5 should ask for all of these:

1. **Cold start in about 60 seconds:** account stub, then opener, then income plus a handful of anchors, then a first draft on benchmarks, improved progressively. No dead ends; every screen skippable with a typical value marked "estimated".
2. **Field registry** (single source of truth): every field has `scope (account|plan)`, `source (user|derived|ai_inferred|default)`, `confidence`, `updatedAt`, `ttl`. The graph asks only when a field is missing, expired, low-confidence or in conflict.
3. **Pre-fill and confirm, never ask** for anything derivable; show a compact "what I found" card; conflicts (stated vs ledger) get an explicit choice.
4. **Explainability:** every number shows why (benchmark, your history, your answer), with confidence; a "what changed" diff when answers change.
5. **Natural-language control throughout:** describe, adjust, ask "what if" ("what if I move out in 6 months", "what if income drops 20%") with live recompute.
6. **Scenario and stress checks** before activation: slow-month income, job loss runway, debt payoff timeline, goal feasibility; plain-language warnings, not alarms.
7. **Culturally aware for the region:** informal income, cash-heavy spending, family support and remittances, zakat and sadaqah, gold as savings, BNPL, multi-currency, EGP inflation (benchmarks need a version and a refresh date).
8. **Resilient:** every answer persisted immediately (offline-first), partial drafts, resume card, idempotent retries (a retried build never creates duplicate debts or goals), works offline with a deterministic fallback when AI is unavailable.
9. **Permissions in context:** SMS and push priming only after the first plan shows value, with a calm path on "no".
10. **Accessibility and craft:** 44px touch targets, safe-area insets, RTL and Arabic first-class, dark mode, reduced motion, Buddgy's mood changes per step.
11. **Privacy and safety:** AI calls send only the fields needed; no financial advice claims; no personal data in URLs; clear note that figures are estimates.

## 7. Hard constraints and past incidents (must be in the prompt)

- **Never infer "new user" from empty local state.** Wait for first server pull; a returning user on a new device or with unsynced offline data must not enter the cold-start path, and local answers must never overwrite server data (last-write-wins sync).
- Never block the app on onboarding; always skippable and resumable; progress stored on the synced profile.
- Money movement that is not spending (top-up, ATM, currency exchange, card payoff, transfers) must stay out of spend totals and budgets; savings and debt payments are transfers, not expenses.
- Accrual vs cash: a credit-card or BNPL purchase counts when spent; paying the card later is not new spending.
- Reuse the existing design system (tokens only, no hard-coded colours, existing sheets, chips, cards, rows, HeroBand); never reshape an existing component, only add variants.
- Database first: new fields need a migration, applied and types regenerated, before UI code.
- Native (Capacitor) quirks: sign-in is token-only on native; never call session refresh by hand; the welcome splash is a one-shot latch.
- Tests with every module: engine, graph conditions, registry TTL, hydration gate, idempotent build.

## 8. What your prompt to Fable 5 should contain

1. Role and goal (one paragraph) and the three user states.
2. The council verdict above, as binding decisions.
3. The data inventory (section 4) as the scope, with the field registry requirement.
4. The builder behaviour requirements (section 6) and constraints (section 7).
5. Deliverables in order: (a) field registry and data contract, (b) question graph and ask/skip rules, (c) engine rules, (d) AI prompts and JSON schemas with fallbacks, (e) UI flow for the account stub and the builder (mobile first, light, dark, Arabic), (f) test plan, (g) migration list.
6. Acceptance criteria: time to first draft under 60 seconds for user A; zero re-asked facts for user C in a test fixture; user on a new device never sees the stub; every line has a rationale; offline path works.
7. Instruction to **ask the owner before** any ambiguous product choice and to state assumptions first.

## 9. Open points for the owner to confirm

- Collect "what brings you" (see / runout / save / debt / budget) in the stub, or only the builder's intent chooser? Recommended: only the intent chooser.
- Keep SMS capture as an optional post-first-plan step on native only (current behaviour); web skips it.
- Benchmark data for countries beyond EG, AE, SA: use AI-sourced estimates marked "estimated" until real tables exist.
