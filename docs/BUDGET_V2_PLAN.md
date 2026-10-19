# Budget v2 — In-depth plan (v2, supersedes the rushed v1)

Status: PLAN FOR AGREEMENT. No mockups until Gate 1 (this plan) is agreed. No app code changed.
Route stays `/budget-setup` (tab "Budget"). Nothing here touches native builds.

Process gates: **G1 plan agreed → G2 mockup variations chosen → G3 DB migration applied → build in phases (each green: lint + tsc + test + build).**

---

## 0. Corrections to my v1 (so you know what changed and why)

| v1 said / did | Reality | Consequence |
|---|---|---|
| Mockups used emoji and a made-up face | Design system = Lucide outline icons; Buddgy = `BuddgyIcon` (visor-helmet SVG, 16 moods) | Mockups will inline the exact Lucide path data from `node_modules/lucide-react` and the exact `BuddgyIcon` SVG, moods per context |
| Hero band on the page | You want the space for the plan itself | No hero. The page leads with the plan (§4) |
| "Debt payments excluded from expense caps" | Debt payments are `Expense.category='Debt'`, a **spend** category. Only Savings / Installment / CC Payoff / Transfer / ATM / Top up / FX are non-spend | Debts block is a spend cap (min + extra). Goal/safety/invest deposits are savings transactions (not spend). |
| "Budget owns the savings pool, goals take a share" | Goals are funded **at cycle close from the month-end carry** (`allocateGoalFunding`, cron `month-carry`), i.e. actual leftover, by `fixed` or `share` of that carry, in priority order | Budget states the **intended** saving; Goals block shows what each goal will draw; mismatch is surfaced, never silently reconciled (§8) |
| Three buckets (Commitments / Future / Living) | Too coarse; hid Subscriptions and Goals inside "Future" | Seven first-class blocks, each with its own visual language (§3) |
| Studio = card per screen | Shallow; goals' live-card pattern is better | The plan **builds itself in front of you** while you answer (§5.2) |

---

## 1. What the study found (facts that shape the design)

**Budget today**
- Flat model: `BudgetPlan{categories[]}` → rows with `name, icon(emoji), amount, currency, isSavings`, optional subcategories (0 rows in prod). No groups, no kinds, no due days, no links to subscriptions/debts/goals, no income on the plan, no status.
- Everything matches by **row name** (`resolveBudgetKey`, `simpleMonth` substring matchers: "car" counts as transport → "Car Maintenance" becomes essentials by accident). Fragile.
- Live DB: 19 plans, 53 categories, 0 subcategories, `budget_feedback` empty (nothing writes it). No `/api/budget` route. The old guided "buddgyFlow" UI is gone; only persisted vestiges remain.
- `isSavings` is set only by the AI replace handler; a synced row loses the name-based fallback (round-trips as false) → real latent bug.
- Store actions whitelist fields (`updatePlanCategory`, `updateBudgetPlan`): **new fields are silently dropped** unless the actions change. Merge is plan-level last-write-wins only.
- Consumers reading the **legacy** `budgetCategories` and ignoring plans (bugs we must fix as part of this): `fundingBasis` (goals' "usual keep"), `WidgetSync` (widget budget total = 0 with a plan), `useNotifications` budget alerts, AI `update_budget_category`.
- `useBudgetSetupPage.totalIncome` uses the current calendar month while `useMonthlyStats` uses the selected month → headers can disagree. `unassignedSpend*` stats exist but nothing renders them.
- Active-plan lookup (`find(id) ?? plans[0]`) is copy-pasted in 6 places.

**Goals v3 (the quality bar you pointed at)** — thin page + `useGoalRows` + pure status machine `{kind, icon, tone, button}`; fixed-height cards with exactly one status line and one action; `CheckpointBar`; category tile = Lucide icon tinted 16% of `--color-cat-N`; insight/banner/trophy appear only when relevant; new-goal flow = Buddgy text → **live `GoalDraftCard` sharing state with the manual steps**; AI never does the maths (deterministic pace/share), tolerant JSON parse, offline-safe manual path; autosaved draft; `BuddgyStatus` rotating waits; copy short, warm, sentence case.

**Buddgy** — `BuddgyIcon({mood,size,filled,alive,look})`, moods: idle small listening thinking scanning done happy alert error offline awake wink sleepy curious worried talking. Used 20–32px in flows, 48–64 standalone. AI calls go through `/api/ai` (thin Gemini passthrough, auth required, **no per-user quota**, rate limit off by default). `responseSchema` passes through untouched. Memory today = `buddgyNotes` (≤20, device-only localStorage, not synced) + derived habits in `buildMemoryBlock`; manager UI at `/settings/ai`. No undo exists for chat actions; the confirmation card pattern exists.

**Data a budget can read (all exist)** — subscriptions (`chargesLeftThisMonth`, `yearlySetAside`, billing day/cycle/status/trial), debts (installments, BNPL, credit-card min %, due day, APR not stored for all), recurring expenses, income sources/paydays/occurrences (`projectedIncomeForMonth`), savings pockets (`isEmergencyCover`), `emergencyFundConfig`, `zakatConfig`, goals (fundingMode/sharePct/priority/frequency), profile (household, lifestyleTier, foodFrequency, transportMode, monthlyRent, rentIncludesUtilities), 90-day expense history.

---

## 2. Product thesis and soul

**One sentence:** *Budget is where you decide what each paycheck is for, and see — at a glance — whether life is following the plan.*

Not YNAB's monthly envelope chore. A **plan** you design once (with Buddgy or by hand), tweak when life changes, and glance at.

Values (shown in copy and in how the engine orders money, not as slogans):
1. **Safety before style** — a starter safety net outranks comfort spending.
2. **Costly debt outranks low-yield saving.**
3. **Essentials first, never shamed** — over-budget reads "adjust", never "failed".
4. **Every number has a why** — each AI line carries a one-line rationale and a confidence.
5. **You stay in control** — preview before apply, undo after, lock any line from AI.
6. **Minimal** — one status + one action per line, stats appear only when they matter.

---

## 3. The plan model (concepts)

### 3.1 Vocabulary
- **Plan** — named, has intent (`balanced | saver | debt_crusher | custom`), income basis, status. Created only by the user.
- **Block** — a purpose of money. Seven first-class blocks (below).
- **Line** — one row inside a block. Can be **manual** or **linked** (amount derived live from another part of the app).
- **Cycle** — the user's month (respects `monthStartDay`).
- **Free** — income minus all lines. Goal is ~0 ("every dirham has a job").

### 3.2 The seven blocks (this replaces the 3-bucket idea)

| # | Block | What lives here | Source of amount | Signature visual |
|---|---|---|---|---|
| 1 | **Home & bills** | rent/mortgage, utilities, internet, phone, insurance, school, childcare, help | manual (due day optional) | month strip with due-day dots; paid/upcoming state in Track |
| 2 | **Subscriptions** | all active subscriptions (+ yearly set-aside) | **linked, live** from Subscriptions | brand logo chips, "N charges left", set-aside line |
| 3 | **Debts** | minimums per debt/BNPL/card + **extra payoff** | **linked** minimum (installment / card min%) + manual extra | payoff bars, APR badge, debt-free date |
| 4 | **Everyday** | groceries, dining, transport, health, personal, fun, family, other | manual cap (anchored on 3-month avg) | category tiles with fill meter (spent vs cap in Track) |
| 5 | **Safety net** | emergency-fund contribution | manual, sized by engine | cover gauge: months of essentials held vs target (3/6) |
| 6 | **Goals** | one line per active goal | **linked, read-only**: planned draw from goal's funding settings | `CheckpointBar` per goal + on-track status |
| 7 | **Grow & give** | investing, zakat/giving, sinking funds (annual items → monthly) | manual | simple allocation chips |

Rules: Debts and Subscriptions are **spend** (ledger categories `Debt`, `Subscription`); Safety, Goals, Grow are **savings movements** (excluded from expense caps like `isSavings` today); Bills and Everyday are spend. Every line carries `expenseCategories[]` — the ledger categories that count against it — replacing name guessing.

Colour mapping from the 6-step category ramp (+ neutral): bills `cat-4`, subscriptions `cat-6`, debts `cat-3`, everyday `cat-5`, safety `cat-1`, goals `cat-2`, grow = neutral secondary. Flagged: the ramp has only 6; "grow" uses neutral ink.

### 3.3 Line status machine (pure, like `getGoalStatus`)
One status + one action per line, never colour-only:
`ok` · `near` (≥85% of cap in Track) · `over` · `unfunded` (essential/linked with 0) · `unbudgetedSpend` (ledger spend with no line) · `dueSoon` · `paid` · `drifted` (linked total changed since plan was built, e.g. new subscription) · `locked`.

### 3.4 Plan lifecycle
`draft` (invisible to stats) → `ready` → `active` (exactly one; pointer = `profiles.active_budget_plan_id`) → `archived`.
**Activation log** (`budget_plan_activations`): each activation takes over the current month onward; past months keep the plan that was active then. No scheduling, no per-month budgets (see §12b).

---

## 4. Page anatomy (no hero) and the variations you will choose from

### 4.1 Skeleton (mobile)
1. **Plan bar** (compact, not a hero): plan name + cycle label (tap → plan switcher) · mode toggle **Plan | This month**.
2. **Flow strip**: income → blocks, one thin proportional strip in block colours + one sentence ("Every dirham has a job" / "AED 1,558 still free") + CTA when not balanced. The strip is also the **table of contents**: tap a segment to jump to its block.
3. **Blocks** (the body). Each block header = name, total, % of income, one status. Each block body uses its own signature visual (§3.2).
4. **Add** CTA per block (contextual: "Link a debt", "Add a bill", "Add a goal").
5. **Buddgy noticed (n)** — a single collapsed chip, max 3 insights, opens a sheet. Stats do not sit on the page.
6. Sticky bottom capsule **Balanced ✓ / Left to assign X** (builder and review only).

Desktop (`lg`): `PageGrid` — blocks primary; sticky rail = flow strip, plan switcher, "noticed".

### 4.2 Track mode ("This month")
Same blocks, same order, overlay actual: bills ticked paid/upcoming; subscriptions "charges left"; debts paid vs due; goals funded/behind; everyday spend vs cap with pace; unassigned spend surfaced (finally). No separate page.

### 4.3 Variations I will mock (each part, so you can pick)
- **Page structure:** A *Blocks* (flat seven, jump strip) · B *Chapters* (Must pay / Everyday / Secure, blocks collapsible) · C *Month board* (cash-flow-first: payday → due dates → spending, blocks as lenses).
- **Flow strip:** stacked strip · stepped waterfall · ring.
- **Plan switcher:** swipe **deck** of mini-plans · **sheet** with Active/Drafts/Archived + compare · **timeline** of plans (superseded: Deck chosen; history lives in a separate Plan history log).
- **Line presentation:** compact row · rich card (goals-style, fixed height, status + action).
- **Each block's visual:** two takes for bills, subscriptions, debts, everyday, safety, goals.
- **Create chooser** ×3 · **Studio** ×3 · **Building** ×2 · **Review** ×3 (document, diff-first, compare-with-current) · **Adjust by text** ×3 (dock, sheet, inline) · **Manual builder** ×2 · **Track** ×2 · **Line detail** ×2 · **Memory consent/manager** ×2 · **Insights** ×2 · empty/legacy-upgrade/error states · desktop layout · dark mode.

Fidelity rules for mockups: exact tokens from `globals.css`; DM Sans / JetBrains Mono; **real Lucide path data**; **real `BuddgyIcon` SVG with the right moods**; sizes/radii/touch targets from the design system; sheets styled like `ModalShell`. If the Design System artifact (currently has no files) can be re-synced, mock with real components.

---

## 5. Flows, end to end

### 5.1 Entry (F1)
Empty → two paths: **Build with Buddgy** / **Build it myself** (blank · template · from last 3 months · clone). Existing plans → "New plan" lives in the switcher. Draft in progress → "Resume (60%)". Legacy plan (pre-v2) → **Upgrade banner**: "We grouped your lines into blocks — review" (no silent regrouping).
Offline: AI path shows offline state, manual works. AI 503 → manual (existing message).

### 5.2 AI Studio (F2) — "the plan builds itself"
Not a chat. **Top: the live plan** (flow strip + blocks materialise/resize as answers land, same state as the manual builder — the `GoalDraftCard` idea at plan scale). **Bottom: one question dock** with tactile controls (chips, steppers, number pad, sliders, quick toggles). Buddgy (`BuddgyIcon`, mood by situation) gives a one-line "why I ask". A **readiness ring** shows coverage; **Build is locked until all required info exists**.

Question graph (declarative, pure TS; `required|important|optional`, `askIf`, `prefill`, `writes`):

| Area | Question | Tier | Prefill | Writes |
|---|---|---|---|---|
| Money in | Confirm income sources + paydays | R | income sources | – |
| | Income stability (fixed / variable / mixed) | I | variance of events | `financial_profile.incomeStability` |
| | Irregular income (bonus, allowance) | O | – | financial_profile |
| Home | Housing (rent / own / family / company) | R | – | `financial_profile.housing` |
| | Rent/mortgage amount + utilities included | R (if rent/own) | `monthlyRent` | `profile.monthlyRent`, `rentIncludesUtilities` |
| | Household (solo/couple/family), dependents + age bands | R / I | `household` | `profile.household`, `financial_profile.dependents` |
| | Supporting others (remittance) | I | Remittance spend | financial_profile |
| Bills | Confirm detected subscriptions, recurring expenses | R | subscriptions, recurring | – |
| | Missing typical bills: phone, internet, insurance (health/car), school, help, gym | I | 90-day spend patterns | creates lines |
| Debts | Confirm debts; APR for those lacking it; payoff strategy; extra amount | R / I | debts | debt notes, financial_profile.payoff |
| Daily life | Food frequency, lifestyle tier | I | profile | `profile.foodFrequency`, `lifestyleTier` |
| | Commute mode; owns a car (loan/fuel/insurance) | I (ask car only if car) | profile | `profile.transportMode`, financial_profile.hasCar |
| Secure | Emergency fund status + target months (6 if variable income/dependents) | I | cover pockets, `emergencyFundConfig` | `profile.emergencyFundConfig` |
| | Goals: confirm; add missing | R-ish | goals | creates goals via existing flow |
| | Investing / retirement interest; zakat | O | `zakatConfig` | financial_profile |
| Push | Priorities (pick ≤3) + security↔lifestyle slider | I | – | financial_profile.priorities |

Adaptive: kids → education/childcare lines; car → fuel/insurance/service; variable income → conservative income basis + smoothing buffer; APR ≥ ~15% → pay it before investing; no safety net → starter fund first; data-rich user ≈ 4–6 questions, blank user ≈ 12–18. Every non-required question has **"Estimate for me"** (flagged low-confidence in Review).

**Parallel profile fill:** each answer writes through immediately (`updateProfile` / `financial_profile`) with a small "Saved to profile" tick; a "What I know" peek lists live facts (editable). Profile writes are what the user explicitly answered; **memory is separate and consent-gated** (§6.6).

### 5.3 Build (F3) — engine first, AI second
1. **Engine** (deterministic, offline-capable): income basis (conservative for variable income) → waterfall:
   1 fixed bills + linked subscriptions + linked debt minimums → 2 starter safety net (≈1 month) if none → 3 high-APR extra payoff → 4 full safety net to target months → 5 goals (their own settings) → 6 invest/give → 7 everyday sized from the user's **own 3-month averages** with a floor (essentials ≥ ~70% of avg) and trimmed by the priority slider → 8 remainder to buffer. Benchmarks are **ranges** per country/household/lifestyle (e.g., housing 30–35% flagged, not forced); low-income users are not shamed (essentials may legitimately be 70%+). Annual items become monthly sinking-fund lines. A **cash-flow check** compares due days to payday ("rent due 1st, salary 25th").
2. **AI refine** (`smart`, thinking medium, strict `responseSchema`): adjusts lines within guardrails, writes per-line rationale + confidence, 3 "why" reasons, risks.
3. **Validator** (pure, tested): sums to income ± tolerance, no negatives, essentials floor, ≤10× income per line, ids/refs exist, base currency, linked lines overwritten with live values, de-duped names. Failure → one repair retry → **deterministic fallback plan** (never an error wall).

### 5.4 Review (F4)
The finished plan as a document: plan header, "Why this plan" (3 reasons), blocks with rationale + confidence chips, "1 line estimated" flags, locks. Footer: **Confirm & activate** · **Edit** · **Ask Buddgy to change…**. Confirm asks: *Replace active plan now / start next cycle / keep as ready*. Over-assigned blocks confirm; under-assigned offers one-tap "send to buffer".

### 5.5 Adjust by text (F5)
Free text → `adjust` op → **ops** (`set|add|remove|move|rename|lock`) on known line ids → diff preview ("3 changes, still balanced"), Apply / Undo. Locked lines are never touched. Each applied/undone adjustment is logged (`budget_feedback`: text, before, after, ops, outcome) and the last 5 feed future builds as few-shot. Durable facts surfaced as **memory proposals** (never auto-saved).

### 5.6 Manual builder (F6) — simpler than YNAB, still rich
Start: blank · template (Essentials-first, Zero-based, Debt-crusher, Saver) · from last 3 months · clone. Same blocks as the live plan; **per-block add flows**: add bill (name, amount, due day) · link subscriptions (auto) · link debts (auto min, add extra) · add goal (opens existing goal flow) · set safety target · add category (suggested from your spend, with "3-mo avg — use"). Line sheet: amount (`AmountField`/`NumberPad`), % of income, essential, locked, rollover (if approved), note. Sticky **Free** capsule. "Ask Buddgy" on any line/block.

### 5.7 Plans & switching (F7)
Switcher variants (§4.3). Actions: set active (confirm impact), duplicate, rename, archive, delete (`useConfirm`). **Compare** two plans (line deltas). Optional **stress test** ("income −20%", "rent +10%") → shows deficit and what Buddgy would trim (**Q4**).

### 5.8 Track (F8), Insights (F9), Month close (F10)
Track described in §4.2. Insights: pure rules, ≤3, each links to its line (e.g., safety net cover <3 months, essentials >60%, line over 3 months running, new subscription drift, rent >35%). **Month close** at cycle end: summary + proposed tweaks ("dining ran 18% over three months — raise it or cap it?") → this is the learning loop.

### 5.9 Memory (F11)
Consent card at Review end and inline after adjusts ("Remember: doesn't own a car?"). Manager = extend `/settings/ai`: "What Buddgy knows" (profile-derived facts + remembered notes, with source/date, delete, pause learning). Rules: ≤40, deduped, only durable facts that change advice (no balances, one-offs, account numbers).

### 5.10 States
No income (build from actuals, 2× buffer) · offline · AI unavailable · loading skeleton · over/under-assigned · draft resume · legacy upgrade · linked drift · conflict after sync (plan newer on server) · empty block.

---

## 6. AI system design

6.1 **Server route `/api/budget/ai`** (new), ops: `followup | build | adjust | insight`. Why not raw `/api/ai`: per-user quota (none exists there), prompts stay server-side, schema enforcement + validation server-side, injection-safe boundaries, consistent native `apiBase`. Mirrors `sms/parse` quota pattern (`geminiBudget`) and `receipt/scan` schema style (OpenAPI-subset enums).
6.2 **Tiers:** followup `fast`/minimal; build `smart`/medium (maxOutput ~4k); adjust `smart`/low; insight rule-based first, AI only for phrasing.
6.3 **Input hygiene:** facts block is structured data; free text is delimited as untrusted data; output must pass schema + validator; AI never writes the DB — the client applies ops via store actions after preview.
6.4 **Concurrency:** requests keyed by answers-hash, AbortController, stale responses dropped; 30 s timeout; idempotent build cache by hash.
6.5 **Determinism:** the engine (not the model) does arithmetic; the model proposes, explains, and flags.
6.6 **Memory consent flow:** model returns `memoryProposals[]`; UI shows toggles; only accepted rows are written to `buddgy_memories(status='active')`.
6.7 **Evals:** extend `buddgy.eval.test.ts`-style golden cases for build/adjust (assert structure and sums, not wording).

---

## 7. Data model & backend (DB-first; migration → apply → regen types → code)

**Live-schema check first** (`list_migrations`, `list_tables`, diff types) at G3.

`budget_plans` + `status` (`draft|ready|archived`, default `ready`), `intent`, `origin` (`ai|manual|template|clone`), `income_override numeric null`, `rationale jsonb`, `engine_version text`. Studio state reuses `buddgy_flow` (`{v:2,…}`; v-less rows = legacy, ignored).
`budget_categories` + `block` (enum of 7; default `everyday`; `is_savings` rows → `grow`/`safety` by backfill), `link_type` (`none|subscriptions|debts|goal|emergency`), `link_ids uuid[]`, `due_day int`, `essential bool`, `rollover bool`, `locked bool`, `rationale text`, `confidence text`, `expense_categories text[]`, `icon` now stores a **Lucide key** (legacy emoji → key map; unknown → generic `Wallet`).
`budget_subcategories`: untouched, UI stops using it (0 rows).
`budget_feedback` + `plan_id`, `ops jsonb`, `outcome`.
`profiles` + `financial_profile jsonb`.
`buddgy_memories(id,user_id,text,kind,source,status,created_at,deleted_at)` + RLS; migrate local `buddgyNotes` once.
`budget_plan_activations(id,user_id,plan_id,effective_from date,created_at)` append-only; `effective_from` = first day of the cycle in which the plan was activated.
Backfill rule: **no silent regrouping** — SQL only sets safe defaults; the app offers an "Upgrade my plan" review (rule-based + AI suggestion).

**Mandatory touch list for any column** (from the study): new migration file + apply · `database.types.ts` (Row/Insert/Update + enums) · `store/types.ts` · `budgetPlanMapper.ts` (`budgetPlanToRow`, `budgetCategoryToRow`, `assembleBudgetPlan`) · `sync.ts flushBudgetPlans` · store actions (replace whitelists with a generic typed patch; bump plan `updatedAt` on every mutation) · `financeImportSchema.ts` · `PERSIST_VERSION` migration (22) · `account/delete` + `reset-data` routes for new tables · `mappers.test.ts` round-trip through the **production write path**.
**Centralise** `selectActivePlan` (replace 6 copies). **Repoint legacy consumers** to the plan: `fundingBasis`, `WidgetSync`, `useNotifications`, `simpleMonth` (use `block`/`essential`, keep name fallback), AI `update_budget_category`/`replace_budget_plan` (new schema + preview coverage in `AIChatActionPreview`). Implement the `savings_month_summary.target` snapshot from the plan in `month-carry` (currently always 0).

---

## 8. How everything connects

| Domain | Rule |
|---|---|
| Income | Income = projected for the **selected cycle** (fix the calendar-month mismatch); `income_override` optional; variable income uses conservative basis. |
| Subscriptions | Block 2 line linked live; replaces `BudgetCommittedCard` + `BudgetSubscriptionsProgress`; drift detection when a new sub appears; Track uses `chargesLeftThisMonth`. |
| Debts | Linked minimums (installment, BNPL, card min%) + manual extra; spend category `Debt`; `CC Payoff`/`Installment` stay non-spend (no double count). APR missing → Studio asks. |
| Goals | Goals block lists active goals with planned draw from their `fundingMode`; funding still happens at cycle close from carry. Warn when Σ planned draw > planned saving, or plan saving ≠ historic carry. Goals' "usual keep" now computed from the plan. Edits deep-link to the goal sheet (single writer). |
| Savings / safety | Safety line feeds `emergencyFundConfig`; cover gauge reads `isEmergencyCover` pockets. |
| Flow / Dashboard | `useMonthlyStats` unchanged contract: caps keyed by row name, extended by `expense_categories`; savings blocks excluded from expense caps. |
| Notifications / Widget | Read the active plan (bug fix). |
| Buddgy | Plan rows (with block/link) in prompt context; ideas/nudges read plan; chat can open Review with a pre-filled adjust. |
| Profile | Studio answers write profile + `financial_profile`; `/settings` unchanged. |
| Shared household budgets | Out of scope (fields preserved). |

---

## 9. Design-system compliance (CLAUDE.md "component reuse")

**Reuse as-is:** `Card`, `SegmentedControl`, `OptionChip`, `SelectableCard`, `AccentTile` (Lucide tiles), `StatTile`, `ProgressRing`, `Progress`, `AmountField`/`NumberPad`, `CardActionMenu`, `PromptBanner`, `EmptyState`, `FieldButton`, `Switch(touch)`, `StatusPill`, `IconButton`, `Button` (`touch/cta/cta-block`), `ModalShell` + `.sheet-cta`, `useConfirm`, `SkeletonList`, back-guard registry, `BuddgyIcon`, `BuddgyStatus`-style waits, goals' `CheckpointBar` pattern (needs generic reuse — **flag**).
**Genuinely new (flagged for your approval):** `FlowStrip` (block-coloured proportional strip + legend + jump), `PlanBlock` shell (header + status), `LineCard` (+ pure `lineStatus`), `FreeCapsule`, `DiffChip`, `StudioDock`, `PlanDeck` (if chosen). Each is a composition of existing tokens; none reshapes an existing component. If `CheckpointBar` can't be reused for non-goals, I will propose a generic variant, not edit it.
**Alert:** none of `budget-planner/*` (1.5k lines) survives; replaced, not edited. Hero: Budget intentionally has **no `HeroBand`** (sibling pages keep theirs).
**Icons:** Lucide only (outline, 1.75–2 px); never `PiggyBank` (savings = `Coins`); no notification bell on native. Block glyphs proposed: bills `Receipt`, subscriptions `RotateCwClock`, debts `Landmark`/`CreditCard`, everyday `ShoppingBasket`, safety `ShieldCheck`, goals `Target`, grow `Sprout`. Category line icons via `CategoryGlyph`/a Lucide key map.
**Other:** tokens only, `h-12` inputs, 44 px targets, mono numerals, safe-area, Arabic/RTL via dictionaries (`types.ts` + `en.ts` + `ar.ts`), dark mode verified, `noStyledRawButtons` guard respected, nested-sheet back-button rule (one back-guard per stage; Studio is one overlay).

---

## 10. Testing
Pure-logic first (vitest, node): engine waterfall, validator (fuzz with real fixtures), ops apply/undo, infoGaps graph, lineStatus, health/insight rules, mapper round-trip on the production path, migration defaults, selectActivePlan, linked-drift. Eval cases for build/adjust. Static guards stay green. Manual device pass at the end (user-run native builds only on request).

## 11. Phasing (after G1–G3)
P0 migration + types + mappers + generic store patch + `selectActivePlan` + legacy-consumer fixes (shippable bug fixes on their own) · P1 plan model libs (engine, validator, ops, status) · P2 Plan page + blocks + switcher + Track · P3 Manual builder · P4 Studio + Build + Review + Adjust · P5 Memory + Insights + Month close · P6 i18n/a11y/dark/desktop, remove `budget-planner/*`.

## 12. Risks (updated red-team)
Double counting (linked lines + ledger) → caps keyed by `expense_categories`, drift detection · Debt vs non-spend confusion → follow `NON_SPEND_CATEGORIES` only · Goals double-writer → single writer + warning · AI arithmetic/ids/injection → engine + schema + validator + ops-only + preview · Draft pollution → `status=draft` hidden · Legacy rows → defaults + upgrade banner · Currency → base, `tryConvert` failure surfaced (not silently mixed) · No/irregular income → conservative basis · Offline → local engine + manual · Races → keyed requests · Back button → single guard · AI cost with no quota → new route with per-user budget · Merge loses row edits (plan-level LWW) → AI builds write whole plans; accept for v1, note row-level merge as follow-up · `monthStartDay` 29–31 mismatch (`getMonthRange` vs `carryDateLogic`) → clamp at one place · Household vocab mismatch (`partner` vs `couple`) → unify on profile vocabulary.

## 12b. Design decisions locked after mockups (supersede earlier text where they differ)
Mockup board numbers refer to the published canvas (claude.ai/artifact/FgeQ73L4DV8QS4P1eVDdtM).
- **Plan page:** B Chapters (02). Block visuals: Set 1 (board 01).
- **Plan switcher:** Deck (08).
- **Plan lifecycle (corrected):** budgets are created only by the user. One is active and applies to **all months** until another is activated. **No per-month budgets and no scheduling of future plans** (drop "Scheduled: November plan from Nov 1" from 08/09/10 and the timeline). Each month is automatically assigned to the active plan. Setting a plan active takes over the **current month onward**. A separate **Plan history log** (not on the main page) lists which plan was active for which months; it is the `budget_plan_activations` append-only log (`plan_id` = start of the activation month). Stats for past months read the plan active in that month.
- **Create chooser:** Intent first (16). **AI studio:** B card by card (26–28). **Review:** block by block (34). **Manual builder:** block by block (38). **Adjust by text:** sheet (32). **This month:** overlay (04). **Insights:** sheet (11). **Line detail:** sheet (35). Memory consent (13) and manager (14), building (24/25), states (18) and desktop (41) stand as drawn, adapted to the chosen structures.

## 13. Decisions
Decided by you: **Q1** effective-from + activation history (`budget_plan_activations`, past months use the plan active then) · **Q2** benchmarks for UAE, Egypt, Saudi Arabia + generic ranges with grounded live price lookup · **Q3** Lucide everywhere, emoji migrated by key map.
Defaulted by me (no preference given, easy to change): % of income shown (display only) and month-close ritual are **in v1**; stress test is **phase 6**; per-line rollover is **deferred** (sinking funds cover annual items).
Still open: **Q5** memory synced via Supabase (assumed yes, with consent) · **Q6** attempt a Design System re-sync so mockups mount real components (assumed yes, fall back to inlined tokens + real Lucide/BuddgyIcon paths).

## 14. Final build order (after G2, this is the implementation sequence)

Rules for every step: DB-first (migration → apply to `ydihurtbcnoflhormgzi` → regenerate `database.types.ts` → code); reuse components per §9; pure logic first with vitest; before push run lint + test + build with dummy Supabase env + a diff audit; en + ar strings; light + dark; 44 px targets; no native build unless you say "build and upload apps". Each step ships green and is useful on its own.

| # | Step | Scope | Done when |
|---|---|---|---|
| **S0** | Bug fixes the new page depends on (ships alone) | `selectActivePlan` helper replacing 6 copies; `fundingBasis`, `WidgetSync`, `useNotifications` read the active plan; `isSavings` round-trip fix; income month mismatch (`useBudgetSetupPage` vs `useMonthlyStats`); clamp `monthStartDay` at one place | Goals' "usual keep", widget and alerts agree with the plan; tests for each |
| **S1** | Database + store + sync | One migration: `budget_plans` (+status, intent, origin, income_override, rationale, engine_version), `budget_categories` (+block, link_type, link_ids, due_day, essential, locked, rationale, confidence, expense_categories; icon becomes a Lucide key with emoji map), `budget_feedback` (+plan_id, ops, outcome), `profiles.financial_profile`, `buddgy_memories`, `budget_plan_activations`; safe backfill (existing rows: block `everyday`, `is_savings` rows `grow`/`safety`, plans `ready`, one activation row for the current active plan); RLS; regen types; `types.ts`, mappers, `sync.ts`, `financeImportSchema`, store persist v22, generic typed patch actions (no field whitelist), delete/reset routes | Round-trip test through the production write path; live schema == types; existing 19 plans still load |
| **S2** | Domain libraries (pure) | block model + `planForMonth` (activation resolver), `lineStatus`, ops apply/undo, validator, benchmark tables (UAE, Egypt, Saudi + generic), engine waterfall, question graph, cash-flow timeline, health/insight rules, emoji→Lucide map | Unit tests incl. fuzz on real fixtures; engine returns a balanced plan for 5 personas offline |
| **S3** | Plan page (Chapters, Set 1 visuals) | PlanBar, FlowStrip (jump nav), ChapterCard, PlanBlock + seven block bodies, LineSheet, per-block add flows, Plan\|This month overlay (useMonthlyStats extended by block, unassigned spend surfaced), insights sheet + chip, empty state, legacy upgrade banner; retire `BudgetCommittedCard`/`BudgetSubscriptionsProgress` | Matches boards PlanFinal/TrackFinal/35/11; old page removed behind the same route |
| **S4** | Plans: deck, activation, history | PlanDeck, ActivateSheet (compare current vs new, takes over current month onward), PlanHistory log (in-shell view reached from deck and plan menu), duplicate/archive/delete (`useConfirm`), activation writes + past-month stats via `planForMonth` | Switching plans changes only the current and future months; history log correct; tests for month assignment |
| **S5** | Manual builder | Block-by-block stepper, Free capsule, suggestions from your data, templates, "from last 3 months" | Can build a full balanced plan by hand in under 3 minutes; confirm blocked when over-assigned |
| **S6** | Create | Intent-first chooser, resume draft, route to AI or manual | Draft autosave/resume (`buddgy_flow` v2) |
| **S7** | AI | `/api/budget/ai` (followup/build/adjust/insight) with per-user quota, `responseSchema`, validator + deterministic fallback; Studio B (card by card) with profile write-through and "What I know" drawer; build screens; Review block-by-block; Adjust sheet with ops diff + Undo + `budget_feedback`; memory proposals | Eval cases pass; offline falls back to manual/engine; AI never writes the DB directly |
| **S8** | Memory | Synced `buddgy_memories`, one-time migration of local notes, extend `/settings/ai` into "What Buddgy knows", merge into `buildMemoryBlock` | Consent required; delete works; ≤40 items |
| **S9** | Polish + extras | Month-close ritual, desktop rail layout, dark mode + Arabic pass, a11y, stress test (last), delete `budget-planner/*`, update `CLAUDE_CONTEXT.md` | Full CI parity; acceptance checklist pass/fail report |

Parallelism: S0 and S2 can run in parallel with each other; S3 needs S1+S2; S4/S5/S6 need S3; S7 needs S2+S5; S8 is independent after S1.
