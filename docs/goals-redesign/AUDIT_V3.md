# Goals v3: Phase 0 audit

Source: `design/design_handoff_goals_v3` (README + prompt). Only the Phase 0 audit is done. No production code written.

## Facts that differ from the handoff's assumptions

| Handoff assumes | Codebase |
|---|---|
| `GOALS_ALLOCATION.md`, `allocation_pct`, `goal_allocation_runs`, a month-end allocation run | None exist. `docs/goals-redesign/PROMPT.md` is an older brief. The only month-end job is `/api/cron/month-carry` (`src/lib/savings/monthCarry.ts`), which sweeps surplus into ONE pocket (`defaultCarryPocketId`, or creates a goal pocket / vault). |
| Goal has `funding_mode`, `share_pct`, `frequency`, `priority` to add | `Goal.priority` already exists (int, used for sort). `monthlyContribution` exists (a fixed amount, unused as a mode). No mode, share or frequency. |
| Goal owns a pocket created at creation | Link is `linkedSavingsAccountIds[]` / `linkedDebtIds[]` plus `manualCurrentAmount`. No auto-created pocket. `resolveCarryDestination` can create a goal pocket lazily. |
| `Progress` may host checkpoint nodes | `ui/progress.tsx` is a plain bar. `ProgressRing` exists (reuse for the 120 px cheer ring). |
| `reconcileGoalsForState` | exists, runs on ~16 store mutations (achieve + progress). |

## Reuse map (path = what exists)

| Piece | Verdict |
|---|---|
| Button, SegmentedControl (`size="field"` for Every month/quarter), AmountField, CurrencyField, MonthYearPicker, UnifiedDatePicker, Scrim, SkeletonList, Switch, StatTile, SelectableCard, AccentTile, PromptBanner, EmptyState, ProgressRing, BuddgyIcon (`components/ai`) | Exist in `src/components/ui` (BuddgyIcon in `components/ai`). Reuse as-is. Check: AmountField light-mode glass variant, CurrencyField needs className. Both are bug-fix-level changes, to be confirmed with you. |
| Sheet | No `Sheet` in `ui/`. Existing modal chrome (`ModalShell` / `SheetFrame` used by Subscriptions) is the equivalent. Will reuse, not create. |
| Alert banner | `PromptBanner` inline variant. Fits. |
| Trophy chip | New, small, goals folder. |
| GoalCard (192 px fixed) | Existing `features/goals/GoalCard` + `GoalCardTop/MetaRows/Footer/ProgressBar` are variable height with edit/delete menus. **Replace** (new component; old one removed in a separate commit after you confirm). |
| New: GoalStatusLine+`getGoalStatus`, CheckpointBar, PaceMeter+CounselorCard (CoachCard shares a base), FundOption+ShareSlider, TrophyHero+AchievedRow, LifeMomentTile+BuddgyHero, TrophyChip | Create under `src/components/features/goals/`. |
| Add goal | `modals/AddGoalSheet.tsx` (249 lines) + `useAddGoalForm.ts` (352 lines): single-step form. **Replace** with 3-step flow; keep category list (`lib/constants/goalCategories.ts`, 16 categories vs design's 12 + 2 + 2). |
| Goal detail | None today (card opens edit sheet). New. |
| Goals page | `app/goals/page.tsx` rewritten for All/Active/Paused/Achieved. |
| Celebrations / notifications | `GoalAchievementListener` exists (achievement only). Milestone cheer, feed items, push copy are new. Need to inspect the notifications code before wiring. |

## Data model gaps (migration 0116, DB-first)

`goals` add (all additive, nullable/defaulted): `funding_mode text default 'manual'`, `share_pct numeric(5,2)`, `fixed_amount numeric` (reuse `monthly_contribution` instead? see Q below), `frequency text default 'monthly'`, `pocket_id uuid`. `priority` reused. New table `goal_allocation_runs(goal_id, period, amount)` unique on (goal_id, period) with RLS. Then: `database.types.ts`, `goalMapper.ts`, `Goal` type, snapshot/import/UUID remap/soft-delete paths, `useHydrateGoals`.

Month-end run: extend the month-carry cron (or a sibling step) to do priority-ordered share/fixed fill from period savings, idempotent via `goal_allocation_runs`, then carry only the remainder. This is real engine work and touches money, not just UI.

## Pure functions (Phase 1, unit-tested)

`detectFundingScenario`, `getUsualKeep` (reuse monthCarry for scenario A), `computePace`, `getGoalStatus`, `allocateMonth`, `replanOptions`. No conflicts with existing code.

## Conflicts / recommendations

1. README says Teal is brand and gold is investments: matches DESIGN_SYSTEM tokens (`primary-ink/soft/bright`, `on-primary`, `red-text`, `cat-1..` all exist).
2. 20 px card radius vs DS 16 px: recommend 16 (README's own recommendation). Needs your call.
3. "Behind" requires elapsed cycles and a funded plan; there is no per-cycle contribution history stored today. Behind-months/streak need either deriving from pocket deposits per month or the new `goal_allocation_runs`. Recommend deriving from `goal_allocation_runs` plus manual deposits; goals older than the table show "Getting started".
4. Strict component-reuse rule (CLAUDE.md): GoalCard replacement, CheckpointBar etc. are genuinely new primitives; I will name reuse per screen. No edits to existing UI primitives without telling you.
5. Hidden size: this is a multi-week epic (engine + migration + ~12 new components + 7 screens). Recommend shipping in slices: (1) foundations + migration + pure functions, (2) Home + GoalCard + Achieved + Empty, (3) Add flow, (4) Detail + replan, (5) celebrations/notifications, (6) proposed screens.

## Questions (defaults proposed; say "go with defaults" to proceed)

1. Cancelled goals: deleting asks where pocket money goes (Free pocket default), no cancelled list. Default: yes.
2. Add-flow drafts persist on close? Default: no.
3. Paused view: only paused goals. Default: yes.
4. All view: Active first, then a "Paused" labelled group. Default: yes.
5. Quarterly deposit day: first day of each calendar quarter. Default: yes.
6. "You usually keep" needs 1 full month of history. Default: yes.
7. Card radius: 16 (DS) instead of 20. Default: 16.
8. `fixed_amount`: reuse existing `monthlyContribution` column instead of adding a new one. Default: reuse.
9. Scope: build slice 1 then 2 now and stop for review, or all slices in one go? Default: slices 1+2.

## Status (2026-10-18)

All six slices shipped to dev + main. Decisions taken: delete asks where the pocket money goes (keep pocket or move); add-flow drafts persist (localStorage); Paused view shows paused only; All view = Active then Paused; quarterly deposits run on quarter-end cycles of the user's own month-start day; "You usually keep" needs one full month; 16px card radius; `monthlyContribution` is the fixed amount; "Business" added as a category (0117).

Known gaps: the month-carry cron is still unscheduled (see its header), so allocation and milestone/behind pushes have not run live; no insight line on home; AI parse and cost estimate were unit-tested on their parsers only, not against the live model; Arabic/dark were checked visually on the home, split sheet and cheer sheet only.
