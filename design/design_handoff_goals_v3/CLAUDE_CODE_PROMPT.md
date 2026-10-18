# Prompt for Claude Code: implement the Goals redesign (v3)

Paste everything below into Claude Code, from the root of the Buddget repo, with this `design_handoff_goals_v3/` folder available (copy it into the repo or point to it).

---

You are implementing a redesign of the **Goals** area of Buddget (React + Tailwind v4 + the `Buddget.*` component library, Zustand store, Capacitor iOS/Android shells, Supabase-backed sync). The design is delivered as a handoff folder:

- `README.md` is the full spec: screens, measurements, copy, logic, states, tokens, decisions, open questions. **Read it completely before writing code.**
- `screens/*.png` are 2x images of every frame. Open them and compare as you build.
- `source/Goals Mockups v2.dc.html` is the interactive design canvas. It is a design reference, not code to copy. Open it in a browser to inspect any frame. Do not paste its markup or inline styles into the app.

## What we want

A Goals experience that feels like a counselor:

1. **Home** with an All / Active / Paused switch, a trophy chip showing the number of achieved goals, a title row ("Active goals 6") with a "New goal" button on the opposite side, an alert banner for goals that are behind for months, and **fixed-height (192 px) goal cards** with exactly one status line and one button each.
2. **Achieved view** ("trophy room") in brand teal, motivating, with a hero count, total saved, stats and a list of wins.
3. **Empty state** where Buddgy is the first thing the user meets: a text prompt, six life-moment tiles, and a preview of what every goal includes.
4. **Add goal** in 3 steps with Buddgy built into each step: (1) describe it or pick a category, (2) **date first**, with a compact date control, amount and currency using the app's own `AmountField` and `CurrencyField`, a monthly or quarterly toggle, optional "already saved", and a **counselor card** that compares the pace asked with what the user usually keeps and offers a later date, (3) **Fund it** that adapts to what the app knows (budget and income, income only, nothing yet), explains that a pocket will be created in Wealth, and lets the user choose a share of what they save, a fixed amount, or manual. Nobody is ever blocked.
5. **Goal detail v2**: one number, one bar, one plan card, and for a goal behind for months a Buddgy coach card with two ways back. Everything else behind a menu.
6. Celebrations and notification updates, plus two proposed screens (Paused view, split sheet with priority order) that need confirmation.

## How to work (follow this order)

### Phase 0: audit before building (do not skip)

1. Read `README.md` and view every image in `screens/`.
2. Explore the codebase: the Goals screens, the goals store and types, the Wealth/pockets code, `monthCarry.ts`, `reconcileGoalsForState`, `resolveCarryDestination`, the Buddgy/AI client, notifications code, and `design system` component docs (`components/**/<Name>.prompt.md` and `.d.ts`). Also read `handoff/GOALS_ALLOCATION.md` if present.
3. Produce an **audit report** (write it to `design_handoff_goals_v3/AUDIT.md` or print it) with:
   - For each UI piece in the README's "Component reuse audit": does the component exist, can it be reused as is, needs an adjustment (say exactly what), or must be created. Name the file path.
   - Any place the codebase already implements part of this (old goals list, goal detail, add-goal flow, allocation, celebration, notifications) and whether to replace or adapt it.
   - Data model gaps vs the README (fields to add; migrations needed; sync/merge/snapshot/import changes).
   - Anything in the README that conflicts with the code or the design system, and your recommendation.
4. **Stop and ask me** about the open questions in the README and anything the audit surfaced that you cannot decide safely. Do not guess on: cancelled goals, draft persistence, quarterly deposit day, history threshold for "You usually keep". Propose a default for each and wait for my answer, or proceed with the README's stated proposal if I say so.

### Phase 1: foundations

- Types and migration for `funding_mode`, `share_pct`, `fixed_amount`, `frequency`, `priority` (and reconcile with `allocation_pct` if it already exists). Follow the existing goals sync pattern exactly (soft delete, UUID remap, snapshot, import).
- Pure, unit-tested functions:
  - `detectFundingScenario(state)` returns 'A' | 'B' | 'C'
  - `getUsualKeep(state)` (median net savings of last 3 full months; budget-based when budget exists)
  - `computePace({ target, saved, targetDate, frequency, usualKeep })` returns `{ asked, ratio, zone, fill, altDate }`
  - `getGoalStatus(goal, now)` returns icon, tone, text, button per the status priority table
  - `allocateMonth({ goals, periodSavings })` returns amounts per goal in priority order (shares over 100% allowed)
  - `replanOptions(goal, state)` returns move-date and keep-date options
- Update the month-end allocation run for the no-cap rule and priority fill. Keep idempotency (`goal_allocation_runs` unique on goal and period). Create the goal's pocket at goal creation, with zero balance.

### Phase 2: screens, one at a time, each verified against its screenshot

Order: GoalCard and CheckpointBar, Goals home (light and dark), Achieved view, Empty state, Add goal step 1, step 2 (with counselor card and Buddgy cost sheet), step 3 (all three scenarios), Goal detail v2, celebrations and notification copy, then Paused view and split sheet once confirmed.

For each screen: build with `Buddget.*` components and design tokens (`var(--color-brand-*)`, never raw hex), logical properties only (RTL), `font-mono-numbers` on every amount, date and percentage, 44 px minimum tap targets, light and dark. Compare to the matching PNG and fix differences before moving on. Add Storybook or preview entries if the repo uses them.

### Phase 3: polish and tests

- Unit tests for every function in Phase 1 including edge cases (zero usual keep, past target date, target already reached, quarterly, shares over 100%, paused goals, goals younger than 2 cycles).
- Screens in Arabic (RTL), dark mode, offline (AI entry points hidden), reduced motion.
- Accessibility pass per README (slider semantics, radiogroup, labels, contrast).
- Remove superseded old UI only after the new one is wired and I confirm. The old frames 2b, 2c, 2d, 2e are archived design references; do not implement them.

## Hard rules

- Use the design system's components and tokens. Do not recreate `Button`, `SegmentedControl`, `AmountField`, `CurrencyField`, `BuddgyIcon`, `Sheet` and the like. If one needs a change, make it in the component and tell me.
- Teal is the brand and every primary action. **Red only for over-budget and destructive.** Amber for behind. Green for success. **Gold is for investments; do not use it for achievements.**
- Savings glyph is Lucide `Coins`. Never a pig. No notification bell on native headers.
- Buddgy is always the app's `BuddgyIcon`. Never a sparkle icon.
- Creation-flow language is positive. Never say "unrealistic" or "behind" while creating a goal. "Behind" only appears for an active plan after 2 missed cycles.
- Counselor text is deterministic and works offline. Only the free-text parse and the cost estimate use the AI service; both must fail gracefully.
- Every goal card on the list is exactly 192 px tall. One status line, one button.
- Nobody is blocked: shares can exceed 100%, a goal can be manual-only, a user with no budget and no income history can still create and fund a goal.
- All numbers in the mockups are illustrative and some do not reconcile with each other. Compute from real data.
- Do not ship the HTML from `source/`. Re-implement in the app's own stack.
- If something in the README is ambiguous, ask me. Do not invent behavior.

## Definition of done

- Every screen in the README matches its screenshot in light and dark, LTR and RTL.
- A user with no budget and no income can create a goal, choose "share of what I save" at 100%, and see the goal card show a sensible status after a month.
- A user with budget and income sees the A-scenario numbers; income only sees B; the pace meter, zone pill and alternative date are correct for monthly and quarterly goals.
- A goal behind for 3 months shows "Behind 3 months" and a Replan button on its card, the banner on home, and the coach card with two working options on the detail.
- The home list never shifts layout between cards of different status.
- The audit report exists, open questions are answered, and old goals UI that was replaced is removed in a separate commit.
- Tests for all Phase 1 functions pass.

Start with Phase 0 now. Report your audit and questions before writing production code.
