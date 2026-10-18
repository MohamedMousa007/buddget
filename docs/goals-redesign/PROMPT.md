# Prompt for Claude Code: refactor and redesign Goals end to end

You are redesigning every Goals experience in Buddget (offline-first finance app, iOS/Android/web, Egypt, base EGP). Goal: **minimal and easier, with no feature cut**. Follow `CLAUDE.md` (DB-first, lint + tsc + test + build before push, no native build unless asked) and `docs/DESIGN_SYSTEM.md`. Use the shipped Subscriptions redesign as the style reference: `src/app/subscriptions/page.tsx`, `SubscriptionsHero`, `SheetFrame` (header, scrolling body, pinned `sheet-cta` footer with one primary action), `SubscriptionGroups`, `SubscriptionRow`, `StatusChip`, `HomeNudge`, `SubscriptionsRail`, `docs/subscriptions-redesign/IMPLEMENTATION.md`.

## Step 0: audit first
Read this brief, then the code listed below, and write a short plan (what is replaced, reused, data-model changes, migrations) before coding. Apply migrations DB-first, regenerate `database.types.ts`.

## What exists today (verified)
**Data**: `Goal` in `src/lib/store/types.ts` (16 categories, status active|achieved|paused|cancelled, `targetAmount` null for spending_control, `currency`, `manualCurrentAmount`, `targetDate`, `linkedSavingsAccountIds`, `linkedDebtIds`, `monthlySpendingLimit`, `spendingCategory`, `priority`, `monthlyContribution`, `notes`, `achievedAt`). Store actions `addGoal/updateGoal/deleteGoal/achieveGoal` (`useFinanceStore.ts` ~1103-1148); `reconcileGoalsForState` runs on ~16 mutations (debt payments, savings deposit/withdraw/delete, import). DB table `goals` (enum `goal_category` uses legacy names emergency/home/other; `goal_status` has no `cancelled`; `goalMapper.ts` maps cancelled to paused). Logic in `src/lib/goals/*`: `computeGoalProgress`, `reconcileAchievedGoals`, `debtPaidInCurrency`, `coerceGoalCategory`, `defaultGoalCopy`; hooks `useGoalProgress`, `useDebtRemainingForGoal`, `useAddGoalForm` (352 lines). Sync: `sync.ts`, `merge.ts`, `snapshot.ts`, `useHydrateGoals`, import schema `financeImportSchema.ts:482`.

**UI**: one route `/goals` (`src/app/goals/page.tsx`, header with lone Add button, Active list, `—— Achieved ——` section); `GoalCard`, `GoalCardTop` (expand toggle that does nothing), `GoalCardMetaRows`, `GoalCardFooter`, `GoalProgressBar` (hand-rolled), `GoalCategoryPicker` (16 chips, `house` preselected), `GoalLensList` (one-line links on Budget and Debts), `GoalAchievementListener` (toast only, mounted in `ModalProvider`), `AddGoalSheet` (2 steps, ~10 fields, no pinned footer, no validation).

**Appears elsewhere**: Sidebar and ProfileDropdown links; Budget (`budget-setup/page.tsx` GoalLensList spending_control); Debts (`debts/page.tsx` GoalLensList debt_freedom); Wealth pocket line "Feeds {goal} · N%" (`WealthList.goalLines`, `goalsAmount/goalLabel` in `savings-v3/types.ts`); month-end carry (`app/api/cron/month-carry/route.ts`, `lib/savings/monthCarry.ts`); Buddgy `add_goal`/`update_goal` (`lib/ai/gemini.ts`, `aiActionHandlers.ts`, `AIChatActionPreview.tsx`), ideas/nudges (`buddgyIdeas.ts`); import/export, account delete/reset, UUID remap. Separate concept to keep distinct but reconcile in UX: per-debt **payoff goal** (`Debt.goal`, `openDebtGoalEdit`, `BorrowHeroCard`, `AddBorrowForm`, `borrowGoal.ts`).

**Not present**: Flow/dashboard card, Quick Add tile, setup-checklist step, notifications/push, reports, contribute sheet, link sheet, detail sheet, pause/resume/reopen, celebration sheet, reorder, history.

## Known bugs to fix as part of this work
1. Editing a goal always writes `status:'active'` (`useAddGoalForm.ts:272`), reactivating paused/achieved goals.
2. `cancelled` goals are invisible and round-trip to `paused` in the DB.
3. No UI for pause/resume/cancel/reopen; paused and achieved goals show no progress.
4. Priority is invisible, defaults to list length, sorted ascending on `/goals` but descending in `resolveCarryDestination`: pick one rule and expose reorder.
5. Month-carry cron creates a pocket named after the goal but never links it in `goals.linked_savings_account_ids`, so progress never sees it and the next month creates another.
6. `computeGoalProgress` counts a full linked balance for every goal: two goals on one pocket double count; emergency-cover pockets are not excluded.
7. debt_freedom target is a snapshot of remaining debt; progress is total paid ever on the linked debts: use one basis (paid since goal creation, or remaining). Gold debts return 0 progress when price is missing.
8. `achieveGoal` skips reconcile and has no caller; `onGoalAchieved` (`newlyAchievedIds`) unused.
9. spending_control never completes, has no over-limit state or warning, and uses the globally selected month filter, not the current period.
10. Save has no validation (goal without a target). Default names not localized (`defaultGoalCopy`).
11. AI `add_goal` hard-codes empty links and null limit/category, so it cannot create working spending_control or debt_freedom goals; no `delete_goal`; Buddgy context has no progress.
12. Dead code and copy: global `addGoal` modal (never opened), `useDependencyStatus`/`dependencies.ts` goal flag, unused i18n keys (`pageTitle, active, paused, currentProgress, achievedOn, seeAll, dashboardEmpty, profileSummaryLine, nextMilestone, manage`), orphan tour strings, `priority` form state, `compact` card prop, `settings.hub.goals`. Delete or wire each.
13. Design-system violations: custom `inputClass`, raw `Input` without `size="brand"`, `text-[10px]`, hand-rolled card and progress bar, adjacent small icon buttons for edit/delete.

## Required redesign

### Principles
One idea per surface, one primary action, sentence case, numbers first, defaults minimal, advanced fields behind "More". Tokens only, 44px targets, 48px inputs, teal for primary, red only for destructive and over-limit, amber for behind-schedule, mono numerals, full RTL/logical properties, dark mode, offline-first (everything local, sync later).

### Goals home (`/goals`)
- Teal hero band like Subscriptions (fixed height in loading/empty/data): total saved toward goals vs total targets, progress bar, three cells (active goals, on track, next target date). Title row with back.
- Segmented control Active · Achieved · All (Paused and Cancelled collapsed like Subscriptions, with Reopen).
- Goal rows: emoji tile, name, one status chip (On track, Behind, Due in N months, Paused, Achieved date, Over limit), progress bar, `current / target` mono. Whole row opens the detail sheet. No expand toggles, no inline edit/delete icons.
- Pace engine (pure, tested): from `targetDate` and `monthlyContribution` compute needed per month, projected date, on track / behind; show "Need X / month" when a date exists and no contribution is set.
- One nudge max (behind schedule, target date near, over limit), dismissible via `dismissBanner`.
- Desktop (lg+): primary column plus 22rem rail (upcoming milestones/target dates, at most two insight cards); add and detail as centred 28rem dialogs.
- First-run empty state: 6 starter tiles (Emergency fund prefilled 6 months of income, Vacation, Car, House, Debt freedom, Spending control) plus primary Add goal.

### Sheets (all built on `SheetFrame`, one primary action each)
1. **Add goal**: step 1 category grid (no preselected default, grouped Save for / Pay off / Control spending, icons from Lucide or emoji tile); step 2 shows only name, target (or monthly limit + applies to), currency inline segmented control, target date, and an impact line "Need X / month" above one CTA. Collapsed **More**: monthly contribution, linked accounts/debts, manual progress, notes, priority. Disabled Save until valid. Edit uses the same sheet prefilled, keeps status.
2. **Goal detail**: progress, pace banner, linked accounts/debts by name with unlink, contribution history (see below), next milestone, actions (Add money, Edit, Pause/Resume, Reopen, Delete via destructive confirm sheet). Footer CTA depends on state (Add money / Resume / Reopen).
3. **Add money (contribute)**: pick a linked pocket (or create one inline), amount via `AmountField`, date; writes a real savings deposit so progress stays derived; for goals without links offers manual progress with history. Spending-control and debt goals offer their own action (set limit, record debt payment).
4. **Link accounts and debts**: dedicated picker sheet replacing inline chips and the "fund" name hack: all savings/investment/vault pockets, shows which other goals already claim each (fix double counting by splitting a pocket's balance across goals or marking exclusive), excludes emergency-cover pockets. Inline "create pocket" opens the existing pocket setup sheet.
5. **Pause / cancel / reopen confirm**: plain, no dark patterns; cancelled goals keep history and appear under Paused/Cancelled.
6. **Delete confirm** (destructive, with undo toast).
7. **Celebration sheet** on achievement (replaces toast-only): summary, achievedAt, time taken, actions "Set next goal" / "Move to Wealth", no confetti or illustrations.
8. **Reorder / priority sheet**: drag list; defines carry order for month-end.
9. **Secondary pickers**, all restyled and verified: `CurrencySheet`, `UnifiedDatePicker`, `NumberPad` (AmountField), applies-to category `SelectField`, payment/pocket pickers, the inline pocket-create flow. Confirm each works inside the new sheets (z-index, Android back, keyboard).
10. **Spending-control sheet variant**: limit, period, applies to; shows month-to-date spend and over-limit state; amber at 80%, red only over limit.
11. **Debt-freedom variant**: picks debts, shows paid vs remaining on one basis, links to the Debts page; reconcile with `Debt.goal` payoff goal: one clear entry point, shared wording, no duplicate UI.

### Everywhere else goals must appear or be fixed
- **Flow/dashboard**: compact goals strip or card (top goal + progress) and a goals item in the setup checklist and progress chip ("Set your first goal").
- **Quick Add**: "Goal" tile (new goal) and "Add to goal" shortcut; remove the dead global `addGoal` modal path or route it through this.
- **Budget**: keep `GoalLensList` for spending_control but restyle; show limit vs spend consistent with the new row.
- **Debts**: keep debt_freedom lens, link to detail sheet.
- **Wealth**: keep "Feeds {goal} · N%" lines; add "Link to goal" action in pocket detail; fix cron pocket creation to link the goal and honour the unified priority rule.
- **Notifications and push** (cron + prefs under Settings, mirror subscription alerts): milestones 25/50/75/100%, behind schedule, target date in 30/7 days, spending limit 80% and over. Two settings switches max.
- **Buddgy**: `add_goal` supports links, limit, spending category and debt goals; add `update_goal` fields, `delete_goal`, goal lookup with progress; nudge/chip kept; action preview restyled.
- **Reports/net worth**: goals progress line if a surface exists; otherwise skip and say so.
- **Settings hub**: wire or delete the orphan `settings.hub.goals`.
- **Sidebar/profile**: keep links; use the shared goals glyph (`Target`) consistently.
- **i18n**: EN + AR for every string, localized default names, remove dead keys. RTL follows the app's existing convention (dir stays ltr, logical properties, LTR numerals).

## Must preserve (no feature loss)
All 16 categories and emoji with DB mapping and `coerceGoalCategory` fallback; progress sources (linked savings, linked debts, manual, spending); auto-achievement via `reconcileGoalsForState` on every relevant mutation; unlink on account/debt delete; emergency prefill (6 x monthly income) and months-of-expenses line; debt prefill (all active debts); soft-delete sync, UUID remap, import/export schema; Buddgy actions and nudge; Wealth feed lines; month-end carry; achievement celebration; offline behaviour.

## Data model and migration
Add only what is needed (suggested: `goal_status` += `cancelled`, `goals.paused_at`, `goals.cancelled_at`, `goal_contributions` table or reuse savings transactions with a `goal_id`, exclusive-pocket flag or allocation percentages). Keep changes additive; run `SELECT` audits before any destructive change; write a short migration note and list every deviation from this brief.

## Deliverables
Implementation behind existing routes; unit tests for pace engine, progress (including shared pockets and debt basis), reconcile, status transitions (edit keeps status, pause/resume/reopen/cancel), carry destination and priority rule, alert evaluation, mappers round trip; browser verification at 390 and 1440, light/dark, EN/AR for home, empty, each sheet and each state; an acceptance checklist reported pass/fail; updated `CLAUDE_CONTEXT.md`. Do not dispatch native builds unless the user asks.
