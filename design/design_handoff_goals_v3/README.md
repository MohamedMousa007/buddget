# Handoff: Goals redesign (v3) for Buddget

Read `CLAUDE_CODE_PROMPT.md` first. It is the entry point. This README is the full spec.

## Overview

A redesign of the Goals area of Buddget: home list, empty state, achieved ("trophy room") view, a 3-step add-goal flow with Buddgy built into every step, an adaptive "Fund it" step, a simplified goal detail, and the celebration and notification surfaces.

Goals covered: save-for goals (emergency fund, vacation, car...), and the existing debt-freedom and spending-limit goal types (shown as one card on the home list, "Food and dining limit").

Design intent in one paragraph: the app should feel like a counselor, not a spreadsheet. Setting a goal starts from the date, the app shows how that date compares with what the user actually keeps each month, and always tries to fit the goal by moving the date first. Nobody is blocked: a user with no budget and no income history can still create, fund and track a goal. Language stays positive. "Behind" only appears after a plan exists and has been missed for at least a couple of cycles.

## About the design files

`source/Goals Mockups v2.dc.html` (with `source/support.js`) is a **design reference built in HTML**. It is a prototype of the intended look and behavior, not production code. Recreate the screens in the Buddget codebase (React, Tailwind v4, the `Buddget.*` component library, Zustand store, Capacitor shells) with its own patterns. Do not ship or copy the HTML. Open the file in a browser to inspect any frame at full size; the canvas has pan and zoom.

The file is one canvas of numbered frames. Section ids you will see:

| Id | What it is | Status |
|---|---|---|
| 3a | Empty state, light and dark | Implement |
| 3b | Add goal: step 1, step 2 (two pace states), Buddgy cost sheet | Implement |
| 3c | Add goal: step 3 "Fund it" in three scenarios | Implement |
| 3d | Goal detail v2, on track (light) and behind (dark) | Implement |
| 4 | Review findings (text) | Read |
| 4a | Paused tab view | Proposed, confirm then implement |
| 4b | Split sheet with priority order | Proposed, confirm then implement |
| 2a | Goals home (light and dark), achieved view, old empty state | Implement the first three frames. The 4th frame (old empty state) is superseded by 3a |
| 2b, 2c, 2d, 2e | Old add flow, old Buddgy chat, old split sheet, old detail | Superseded. Archive only. Do not implement |
| 2f | Milestone cheer sheet, goal-achieved celebration | Implement (trophy now white on brand teal, see Decisions) |
| 2g | Push banners, in-app feed, notification settings | Implement, with the copy change in Decisions |

## Fidelity

**High fidelity.** Layout, spacing, type, color tokens, copy and states are final unless listed under Open questions. Recreate pixel-accurately using the design system's components and tokens. Where the mockup deviates from the design system, the deviation is listed under "Known deviations" so you can choose deliberately.

All numbers in the mockups are illustrative. The dates and amounts in some frames do not reconcile with each other (for example "Aug 2027" is shown as 12 months from now while today is Oct 2026). Compute everything from real data; never hardcode.

## Screenshots

`screens/` holds 2x PNGs of every frame to implement (780 px wide for a 390 px phone). File names:

- `00-review-findings.png` the 8 review findings
- `01-goals-home-active-light.png`, `02-goals-home-active-dark.png`
- `03-goals-home-paused-PROPOSED.png`
- `04-achieved-trophy-room.png`
- `05-empty-state-light.png`, `06-empty-state-dark.png`
- `07-add-step1-describe-or-pick.png`
- `08-add-step2-date-stretch.png`, `09-add-step2-date-comfortable.png`, `10-add-step2-buddgy-cost-sheet.png`
- `11-add-step3-fund-budget-and-income.png`, `12-add-step3-fund-income-only.png`, `13-add-step3-fund-nothing-yet.png`
- `14-goal-detail-on-track-light.png`, `15-goal-detail-behind-dark.png`
- `16-split-savings-priority-PROPOSED.png`
- `17-milestone-cheer.png`, `18-goal-achieved-celebration.png`
- `19-notifications-push.png`, `20-notifications-feed.png`, `21-notification-settings.png`

Known screenshot artifacts: the frames are captured from HTML, so the mono font may render as a system fallback and the AmountField glass variant needed a color override in light mode (see Known deviations). Trust the tokens in this README over pixels for those two.

---

## Design principles (apply everywhere)

1. **Date first.** The user picks when. The app derives how much.
2. **Never block, always fit.** Totals can exceed 100%, there is no minimum budget, and a goal can be manual-only. When something is tight, offer a later date first, then a smaller target, then a bigger amount.
3. **Positive vocabulary.** Creation flow words: "A stretch, but possible", "Comfortable", "That fits your month". Never "unrealistic", "impossible", "behind" or red in creation.
4. **"Behind" is earned.** Only for a goal that has an active plan, after at least 2 missed cycles. Before that: "Getting started".
5. **Buddgy is part of the flow, not a separate mode.** It lives inside step 1 (input), step 2 (cost helper and the counselor card), step 3 (tip), and the detail screen (coach card). It is the app's own `BuddgyIcon`, never a sparkle icon.
6. **One goal card size.** Every goal card on the list is exactly 192 px tall. Differences are expressed only by the one-line status and one button.
7. **Teal is the brand and the primary action. Red is only for over-budget and destructive. Amber is warning (behind). Green is success. Gold is investment and is not used for achievements.**
8. **Savings glyph is Lucide `Coins`. Never a pig.**

---

## Screens

Global frame: 390 x 844 phone, light and dark (`.dark` on an ancestor). Page background `--color-brand-bg`, text `--color-brand-text-primary`, base 14 px / 1.35 line height, DM Sans for text, JetBrains Mono (`font-mono-numbers`) for every amount, date and percentage.

### 1. Goals home (frames 2a-1 light, 2a-2 dark)

Purpose: see all goals at a glance, spot what needs attention, add money, create a goal.

Top to bottom, inside the page with 16 px side padding, 14 px gap:

1. **Header** (52 px): back chevron (44 px target, -12 px start margin), title "Goals" 24/700, letter-spacing -0.01em; right-side menu icon 20 px secondary text.
2. **Insight line**: flame icon 18 px `--color-brand-amber` + one sentence 14 px secondary text with the bold lead in primary text. Example: "**9 milestones** reached this year. Vacation hits 50% in about 2 weeks." Data-driven; omit if nothing meaningful to say.
3. **View switch row** (flex, gap 8):
   - `Buddget.SegmentedControl`, `flex:1`, options **All, Active, Paused** (in that order). Selected: Active.
   - **Trophy chip** (not part of the SegmentedControl): 44 px high, 12 px radius, 14 px horizontal padding, 1 px `--color-brand-border` border, `--color-brand-elevated` fill, Lucide `Trophy` 18 px in `--color-brand-primary-ink` + count in mono 14/600. Tapping it opens the Achieved view (screen 3). `aria-label="Achieved goals, 3"`. When the Achieved view is open: border `--color-brand-primary`, fill `--color-brand-primary-soft`, and the SegmentedControl has no selected segment.
4. **Alert banner** (only when at least one goal is behind 2+ months; shows the worst one): `--color-brand-elevated` fill, 1 px border, 16 px radius, 12 px padding, column gap 10. Top row: amber `AlertTriangle` 18, text 13/1.45 ("Vacation has been behind for 3 months. Add EGP 2,100 a month to finish by Aug 2027."), dismiss X (32 px wide hit area visually, 44 px effective). Below: full-width outline `Button` 44 px tall, label "Replan Vacation". Use `PromptBanner` if it fits, otherwise build to this spec.
5. **Section title row**: left "Active goals" 18/700 + count pill (mono 12/600, secondary text, elevated fill, 999 radius, 2x8 padding, min 24 wide). Right: **"New goal" `Button`** (default/teal), 44 px tall, 14 px horizontal padding, `Plus` 16 px + label. The title always reflects the selected view: "All goals", "Active goals", "Paused goals", "Achieved goals", each with its count.
6. **Goal cards** (see GoalCard below), 14 px gap. Sort: needs-attention first (over limit, due soon, behind), then the rest by target date ascending.

No floating action button. No "Paused goals" row at the bottom (the Paused tab replaces it).

#### GoalCard (new component, fixed height)

Outer: `height:192px; box-sizing:border-box; overflow:hidden`, `--color-brand-card` fill, 1 px `--color-brand-border`, `--shadow-sm`, 20 px radius (see Known deviations), padding `16px 16px 0`, column, gap 12. The whole card is tappable and opens the goal detail; the footer button has its own action.

Rows:
- **Row 1** (flex, center, gap 12): category tile 44x44, 14 px radius, 22 px icon, tile = category color `--color-cat-N` at 16% mixed into card, icon in the full category color. Middle (flex 1, min-w 0): name 16/600/1.15 single line with ellipsis; under it a due line, mono 12 secondary (target month, "Resets 1 Nov" for limit goals, "Paused · was Dec 2028" when paused). Right: percent, mono 20/600.
- **Row 2**: current amount mono 26/600, letter-spacing -0.02em; then "of 120,000 EGP" mono 13 secondary, baseline aligned, gap 6.
- **Row 3, CheckpointBar** (height 16, `flex:none`): track at top 5 px, 6 px high, `--color-brand-elevated`, 999 radius, fill color per state. Four 16 px nodes at 25, 50, 75, 100%. Reached node: `--color-brand-primary` fill with a 2 px card-colored ring and a Check glyph (10 px, `--color-brand-on-primary`). Unreached: card fill with a 2 px `--color-brand-border` ring. 100% node is right-aligned (`calc(100% - 16px)`). Limit goals have no nodes.
- **Footer** (`margin: auto -16px 0`, height 56, 1 px top border, padding `0 12px 0 16px`, flex, center, gap 8): status icon 16 px, status text 13 single line with ellipsis (flex 1), then one `Button` 44 px tall, 14 px horizontal padding. Wrapper around the button is `display:flex; align-items:center`.

Fill and percent colors: default track fill `--color-brand-primary-bright`; percent in primary text. Behind: fill and percent `--color-brand-amber`. Over limit: fill `--color-brand-red`, percent `--color-brand-red-text`. Paused: fill `--color-brand-text-muted`, percent secondary text.

#### Status line table (priority order, first match wins)

| # | Condition | Icon (color) | Text | Text weight | Button (variant) |
|---|---|---|---|---|---|
| 1 | Limit goal over its limit | AlertTriangle (`--color-brand-red`) | "Over by EGP 320" | 600, primary text | Adjust (outline) |
| 2 | Not achieved and target date in 30 days or less | Calendar (`primary-ink`) | "Due in 30 days" | 600 | Review (outline) |
| 3 | Behind 1+ cycles with an active plan | AlertTriangle (`amber`) | "Behind 3 months" ("Behind 1 month" for one) | 600 | Replan (default, the only teal button on the list) |
| 4 | Remaining amount <= one planned deposit | Check (`green`) | "One deposit away" | 600 | Add money (default) |
| 5 | Streak of 3+ months hitting the plan | Flame (`amber`) | "5-month streak" | 500, secondary text | Add money (outline) |
| 6 | Otherwise | Flag (`primary-ink`) | "Next: 75% · 15,600 to go" | 500, secondary text | Add money (outline) |
| P | Paused | Pause (`text-muted`) | "Paused since Aug" | 500 | Resume (default) |

Quarterly goals: the plan unit is a quarter. Statuses 3 and 5 use "quarters", and row 6 can show "Next deposit 1 Jan". Detail and pushes use "a quarter".

Never show more than one status. The "how to catch up" detail (shortfall, projected date, options) lives in the banner and the detail sheet, not on the card.

### 2. Achieved view / trophy room (frame 2a-3)

Opened from the trophy chip. Same header, same switch row (no segment selected, chip selected), title row "Achieved goals 3" (not yet in the mock, add it).

- **Hero card** (24 px radius, padding `22 18 18`, fill `--color-brand-primary`, text `--color-brand-on-primary`, centered): 72 px white disc with `Trophy` 36 px in `--color-brand-primary`, plus an 8 px ring `rgba(255,255,255,.22)`. Big count mono 56/700, letter-spacing -0.03em, with "goals achieved" 18/700 beside it. Line: "You set aside **EGP 218,000** on purpose, one month at a time." (14, max-width 280). Three stat tiles (grid 3, gap 8, tiles `rgba(255,255,255,.16)`, 14 px radius): average months to finish, count finished early, checkpoints hit.
- **"Your wins" list**: section label 11/700 uppercase, 0.08em tracking, muted. Each row is a card (20 px radius): 52 px circle with 2 px `--color-brand-primary-bright` ring, `--color-brand-primary-soft` fill, the goal's icon in `--color-brand-primary-ink`, a 20 px `--color-brand-primary` check badge at bottom-end; name 15/600; "EGP 120,000" mono 13 secondary; note 12/600 `primary-ink` ("11 months · on time", "5 months · 1 month early"); finish date mono 11 secondary at the end.
- **Closing card**: dashed 1.5 px border, "Number four is next" 14/600 and a full-width default `Button` "Set a goal".

### 3. Empty state (frames 3a-1 light, 3a-2 dark)

Shown when the user has zero goals. Replaces the old dull empty state.

- Header as home.
- **Buddgy hero** (24 px radius, `--color-brand-primary-soft`, padding `20 18`): 64 px white disc (card color, `--shadow-sm`) holding `BuddgyIcon mood="happy" size={44}`; headline "What are you looking forward to?" 22/700, -0.02em. Body 14/1.45 secondary: "Tell me in your own words. I will work out the amount, the date and a monthly pace that suits your life." Input row: 52 px pill input (26 px radius, card fill, placeholder "A week in Dahab next summer"), plus 52 px circular send button (`--color-brand-primary`, `Send` icon). Submitting goes to Add goal step 2 with Buddgy's parsed result prefilled (see Buddgy).
- **"Or start from a moment"**: label, then 2-column grid, 10 gap, six tiles (16 px radius, card fill, border, `--shadow-sm`, padding 12): Emergency fund ("Start with 3 months of spending"), Vacation ("Pick a date, get a pace"), Car ("A down payment or the full price"), Home ("A deposit within reach"), Education ("Tuition, courses, a new skill"), Something else ("Name it your way"). 40 px category tile + 14/600 name + 12 secondary line. Tapping starts Add goal at step 2 with category set.
- **"Every goal comes with"** card: dashed 1.5 px border, 20 px radius, padding 16: a sample CheckpointBar at 50% and three rows with a 18 px `--color-brand-primary-bright` icon: "Checkpoints at 25, 50, 75 and 100%", "A pace that adapts to your month", "Its own pocket in Wealth".
- **Bottom**: full-width outline `Button` "Start from scratch" (goes to step 1).

### 4. Add goal flow (bottom sheet, 24 px top radius, top inset 40 px, scrim `rgba(10,12,16,.55)`)

Common chrome: drag handle 36x4; header row with back (steps 2 and 3), a 3-segment progress (28x4 each, 4 gap, filled = `--color-brand-primary`, else `--color-brand-border`), close X (44 px). Footer pinned: top border, padding `12 16 18`.

#### Step 1: What are you working toward? (frame 3b-1)

- Title 26/700/-0.02em; sub "Describe it and I will fill in the rest, or pick one below." 14 secondary.
- **Buddgy card** (20 px radius, `--color-brand-primary-soft`, padding 14): row with `BuddgyIcon` 24 and "Buddgy will estimate cost, date and pace" 13/600; input row (48 px pill, placeholder "e.g. A week in Dahab next summer") + 48 px send button.
- Category groups (label 11/700 uppercase muted + 4-column grid, 8 gap, 14 px radius cells, 40 px tile, 11/600 name, min 44 tall): **Save for** (Emergency fund, Home, Car, Vacation, Education, Wedding, Retirement, Business, Gadget, Gift, Investing, Other), **Pay off** (Debt freedom, Credit card), **Control spending** (Monthly limit, Category cap).
- Picking a category or submitting text goes to step 2.

#### Step 2: Make it real, date first (frames 3b-2 and 3b-3)

Header: 48 px category tile, "Make it real" 24/700, sub "Set the date first. The amount follows." Fields in this order, 14 gap:

1. **Name**: 48 px field, category icon, value.
2. **Target date** (the primary control, 1.5 px `--color-brand-primary` border, 14 px radius, min 56 tall, elevated fill, padding `0 6 0 12`): Calendar icon 20 `primary-bright`; date mono 20/600 ("Aug 2027"); months-away mono 12 secondary ("12 months"); two 44x44 square buttons (12 px radius, card fill, border) with Minus and Plus. +/- moves one month; long-press accelerates; minimum is next month. Tapping the date opens `MonthYearPicker`. This replaces the earlier large date card with quick chips, which took too much room.
3. **Target**: `Buddget.AmountField` (flex 1, 52 px) plus `Buddget.CurrencyField compact` (128 px wide, 52 px). Under it a link row: `BuddgyIcon` 20 + "Not sure? Ask Buddgy for typical costs" (13/600, `primary-ink`). It opens the cost sheet.
4. **Save**: `Buddget.SegmentedControl` "Every month" / "Every quarter".
5. **Counselor card** (20 px radius, `--color-brand-primary-soft`, padding 14, column gap 12): header row with `BuddgyIcon` 24, headline 13/600, and a zone pill (card fill, 999 radius, 11/700): "Stretch" or "Comfortable". Pace meter: 10 px track on card fill, fill `--color-brand-primary-bright`, a 2 px vertical tick in primary text at the "usual" position. Beneath: "Pace asked: **3,750**" and "You usually keep **3,000**" (12 secondary, mono bold values). Body 13/1.45. When the zone is Stretch or higher: two 44 px buttons side by side, "Use Oct 2027" (default) and "Keep Aug 2027" (outline).
6. **Already saved · Optional**: `Buddget.AmountField` with `currency="EGP"` prefix. Label has "· Optional" in muted.

Footer: summary line mono 13 ("**EGP 3,750 a month** · finish 1 Aug 2027"), full-width default `Button` "Next: fund it".

Removed from the old design: "Your why" field (and its quote on the detail), the inline EGP/USD toggle, the "12 months" helper hint. "Already saved" stays but is optional.

#### Buddgy cost sheet (frame 3b-4)

A 150 px-inset bottom sheet over a dimmed step 2. Header: `BuddgyIcon mood="thinking" size={28}`, "Typical cost" 16/700, sub "Vacation · near current prices" 11 secondary, close. Body: Buddgy bubble (elevated, 16/16/16/4 radius) "A week in Dahab runs EGP 30,000 to 45,000 for two people. Pick the style that fits and I will fill in the target." Three radio rows (56 px, 14 px radius, selected = 1.5 px primary border + `primary-soft`): Beach camp 30,000, 3-star hotel 38,000, Resort 45,000. Assumption footnote 12 secondary. Footer button "Use EGP 38,000" writes the target and closes.

#### Step 3: Fund it, adaptive (frames 3c-1, 3c-2, 3c-3)

Title "Fund it", sub "Choose how money reaches Vacation." Elements:

1. **Context pill** (999 radius, elevated, Check 14 `primary-bright`, 12/600): tells the user what the app is using.
2. **Pocket explainer** (16 px radius, border, padding `12 14`): `Coins` 20 + "A **Vacation pocket** will be created in Wealth. Money you set aside lives there, and its balance is your progress."
3. **Three funding options**, radio rows:
   - **A share of what I save** (default, expanded, 1.5 px primary border, 20 px radius): title, sub "Adapts to each month. No fixed amount.", big percent mono 22/600 `primary-ink`; slider (8 px track, 28 px thumb with 3 px primary ring, 44 px hit area, step 5%, 0 to 100); base line (secondary 13); result line (mono 14/600); share chips for each goal that has a share (999 radius, selected goal on `primary-soft`); total line 12 secondary.
   - **A fixed amount** (collapsed row, 56 px): "The same each month" or "each quarter".
   - **I will add money myself** (collapsed row, 56 px): "No automatic transfers. Tap Add money anytime."
4. **Buddgy tip** (16 px radius, `primary-soft`, `BuddgyIcon` 24 + 13/1.45 text).

Footer: summary 13 secondary ("EGP 4,200 a month into your Vacation pocket") and default `Button` "Start my goal".

The three scenarios (determined by `detectFundingScenario()`, see Logic):

| | A: budget and income | B: income only | C: nothing yet |
|---|---|---|---|
| Context pill | "Using your budget and income" | "Using your last 3 months of income" | "No budget yet. You can add one later" |
| Base line | "of EGP 12,000 monthly savings (income minus budget)" | "of what you keep each month, about EGP 3,000 lately" | "of whatever you save each month" |
| Result line | "= EGP 4,200 a month" | "≈ EGP 1,800 a month" | "No amount to promise yet" |
| Total line | "Total 90%. The other 10% stays free for you." | "Shares add up to 135%. That is fine: goals fill in priority order, Emergency fund first. Reorder anytime." | "Add more goals later and shares can overlap. They fill in priority order." |
| Tip | "This puts you on pace for Aug 2027." | "At 60% you would arrive around Mar 2028. At 100% it is Nov 2027. Or move the date and keep 60%." | "After your first month I will show your real pace and suggest a date that fits." |
| Fixed row sub | "each month" | "each month" | "each quarter" (example of frequency chosen in step 2) |

### 5. Goal detail v2 (frames 3d-1 light on track, 3d-2 dark behind)

Bottom sheet. Header: kind label (12/600 secondary, e.g. "Save for · Emergency fund"), `MoreHorizontal` (44) and close. Everything that used to be a list of actions (edit, pause, delete, link accounts, alerts) goes behind the more menu.

Content (22 px gap):
1. Identity: 52 px tile, name 22/700, status chip (elevated pill, 6 px status dot, 11/600).
2. Progress block: current mono 40/600 -0.03em; "of 120,000 EGP"; percent mono 18/600 at the end. CheckpointBar (16 px). Four labels under it (grid 4): percent mono 12/600 (`primary-ink` when reached, else secondary) and short date mono 11. One sentence 14 secondary: "Next checkpoint: 75% in about 2 months."
3. **Coach card, behind only** (20 px radius, amber 10% mixed into card, 1 px border, padding 14): `BuddgyIcon` 24, "Behind for 3 months" 15/600, "EGP 6,300 short of plan since July. Two ways back:". Two option rows (14 px radius, card fill, border, padding `10 12`): title 14/600 + sub 12 secondary + a 104 px 44 px-tall `Button`: "Move the date to Jun 2028 / EGP 2,400 a month fits what you save" [Move date, default]; "Keep Aug 2027 / Raise to EGP 4,100 a month (35%)" [Raise, outline].
4. **Plan card** (16 px radius, border, three 56 px rows with 20 px `primary-bright` icon, label 12 secondary, value 14/600, chevron): Finish line, Each month ("EGP 4,800 · 40% of savings"), Pocket. Each row opens its editor.
5. Footer: full-width default `Button` "Add money".

Removed from the old detail: progress-rate card and chart, "why" quote, vertical checkpoint timeline (replaced by the 4-label row), streak card, alerts row, action list.

### 6. Paused view (frame 4a, PROPOSED)

Same screen as home, switch = Paused, title "Paused goals 2", helper line 13 secondary: "Paused goals are not counted as behind and receive no monthly savings. Money already saved stays in their pockets." Cards use the same GoalCard with the Paused row of the status table. Resume restores the previous plan and re-enables auto-funding next cycle.

### 7. Split savings sheet (frame 4b, PROPOSED)

Reached from the share chips and from "Gets N%" style rows. Header "Share your savings", sub "Goals fill in this order each month". Top card: "You keep about EGP 3,000 a month" with a "Last 3 months" pill. One row per goal with share: drag handle (`GripVertical`), priority number badge (22 px circle), 36 px tile, name, "≈ EGP N a month", percent mono 18/600, 6 px bar. "Total 135%" with no error color. Buddgy note: "Together these ask for more than you keep. That is fine: in a tight month Emergency fund gets its share first, and Vacation gets what is left. Drag to change the order." Footer "Save order". Replaces the old sheet that blocked totals above 100%.

### 8. Celebrations (frames 2f)

- **Milestone cheer** (bottom sheet): 120 px progress ring (`primary-bright` stroke on elevated, 10 px), centered percent mono 30/700; title "Halfway there" 24/700; body 14/1.5 secondary; chips for streak and next milestone; "Keep going" button.
- **Goal achieved** (full screen, `--color-brand-primary` background, white text): confetti (reduce-motion: static), two pulsing rings, **white disc with a teal trophy** (changed from gold), "GOAL ACHIEVED" 13/700 uppercase, "You did it!" 38/700, summary line, big amount, stat tiles (months, deposits, streak), four filled checkpoint bars, "Set your next goal" (white button), Share, Move to Wealth.

### 9. Notifications (frames 2g)

Push banners, in-app feed, settings (two switches: Progress and celebrations, Alerts). Keep the existing structure. Change the "behind" copy as in Decisions.

---

## Logic and rules

### Funding scenario detection
```
hasIncomeHistory = at least one full month of income transactions
hasBudget        = user has a budget set up
scenario = hasBudget && hasIncome ? 'A' : hasIncomeHistory ? 'B' : 'C'
```
The scenario only changes copy and which base figure is shown. It never disables an option.

### "What the user usually keeps" (`usualKeep`)
- A: income minus budgeted spending (the existing monthly-savings figure, reuse `monthCarry.ts`).
- B: median of net savings over the last 3 full months, floored at 0.
- C: unknown. Hide the pace meter's "usual" tick; counselor card falls back to a neutral line ("You can fine-tune this after your first month").

### Pace and counselor (step 2)
```
periods     = months (or quarters) from the next period start to the target date
asked       = max(0, target - alreadySaved) / periods         // per period
ratio       = asked / usualKeep (per same period)
zone        = ratio <= 0.6 ? 'Easy' : ratio <= 1.0 ? 'Comfortable' : ratio <= 1.4 ? 'Stretch' : 'Ambitious'
meter fill  = min(100, ratio * 62)%   // usual tick sits at 62%
```
Pill labels: Easy and Comfortable show "Comfortable" copy; Stretch shows "Stretch"; Ambitious shows "Stretch" too (never a negative word) but changes the suggestion order. When zone is Stretch or Ambitious, compute the earliest date where ratio <= 1.0 (round up to the next month) and offer it as the primary button ("Use Oct 2027"). If that date is more than 5 years out, offer a smaller target instead. Order of suggestions: later date, then smaller target, then bigger monthly amount. Buttons are always optional; the user can keep their date.

Copy templates (deterministic, no LLM needed):
- Stretch: "A stretch, but possible" / "This asks a little more than you usually keep. {altDate} would sit right at your usual pace."
- Comfortable: "That fits your month" / "It matches what you usually keep. If a month runs short, the plan stretches instead of breaking."
- Unknown usual: "Here is the pace for that date" / "I will compare it with your real savings after your first month."

### Funding modes (data)
Add to `goals` (additive, nullable): `funding_mode` ('share' | 'fixed' | 'manual', default 'manual' for existing rows), `share_pct` numeric(5,2) null, `fixed_amount` numeric null, `frequency` ('monthly' | 'quarterly', default 'monthly'), `priority` int. Keep `allocation_pct` from `GOALS_ALLOCATION.md` if already migrated; treat it as `share_pct`. Follow the existing goals sync pattern (soft delete, UUID remap, snapshot/import).

Each period at run time:
- `share`: `amount = round(periodSavings * share_pct / 100)`, applied in priority order. If the sum of all `share` amounts exceeds `periodSavings`, higher-priority goals get their full amount first and the remainder goes to lower priority until savings are used up. Unfilled shares are not carried forward.
- `fixed`: transfer `fixed_amount` if available, in priority order with the shares.
- `manual`: no transfer.
- Skip paused, cancelled and achieved goals; their share becomes unassigned.
- When a goal reaches its target mid-run, transfer only the remainder, mark achieved, release its share.

**This changes `GOALS_ALLOCATION.md` rule 1** ("Sum <= 100, Save disabled over"). New rule: no cap. Totals over 100% are allowed and shown calmly. Update that document and the cron accordingly. Idempotency (`goal_allocation_runs` unique on goal and period) is unchanged.

### Pocket
Create the goal's pocket when the goal is created, balance 0, linked to the goal, named "{Goal} pocket", icon `Coins`. Progress = pocket balance (plus "already saved" as the opening deposit). Link, split and shared-pocket behavior from `GOALS_ALLOCATION.md` rule 7 is unchanged.

### Planned amount, "behind" and streak
```
plannedByNow = target * elapsedPeriods / totalPeriods           // linear plan from first deposit cycle
shortfall    = max(0, plannedByNow - current)
behind       = hasPlan && elapsedCycles >= 2 && shortfall > 0.05 * target
behindMonths = consecutive completed cycles ending now where cumulative current < cumulative planned
```
`hasPlan` means funding_mode is share or fixed. Manual goals never show "Behind"; they show the next checkpoint. Goals younger than 2 cycles show "Getting started" instead of any behind state. Streak = consecutive completed cycles where the contribution >= the planned amount. Due-soon = not achieved and target date within 30 days.

### Replan options (detail coach card)
- Option 1, move the date: the earliest date where `asked <= usualKeep` for the remaining amount.
- Option 2, keep the date: required per-period amount and the share it represents (`required / periodSavings`, rounded up to 5%).
Choosing either updates the goal, recomputes checkpoints, and clears the behind banner.

### Checkpoints
25, 50, 75, 100% of target. Reached = filled node with date. Next and later nodes show projected dates from the current pace. Crossing a checkpoint triggers the cheer sheet, a feed item and (if enabled) a push. 100% triggers the full-screen celebration.

### Achieved count and stats
Hero stats: average months from creation to achievement, number finished on or before the target date, total checkpoints hit across achieved goals.

---

## Buddgy

Use `Buddget.BuddgyIcon` everywhere Buddgy appears. Never a sparkle glyph. Moods used: `idle` (default 20 and 24 px), `happy` (empty state hero, 44), `thinking` (cost sheet, 28). Keep `animated` default.

AI calls (only these two need an LLM; both must degrade gracefully):
1. **Free-text parse** (empty state input, step 1 input): `{category, name, target?, date?}` from "A week in Dahab next summer". On failure or offline, fall back to opening step 1 with the text kept as the name.
2. **Cost estimate** (cost sheet): 3 priced options with assumptions. On failure, show a short retry state and let the user type the amount.

Everything else (counselor card, zone, alternative date, fund-step tip, detail coach options) is deterministic and works offline. If the AI is unavailable, hide the two AI entry points but keep the rest. The existing AI chat plan flow (old 2c) is not part of this design.

---

## Interactions and states

- Home switch row: All/Active/Paused change the list and the title; the trophy chip opens Achieved. Persist the last view per session.
- Add goal: sheet with 3 steps; back keeps entered data; closing mid-flow asks nothing but discards (draft optional, open question).
- Step 2: ± on date moves one month with a 120 ms number tween; counselor card updates live (debounce 150 ms) and animates the meter fill (240 ms ease-out). Respect reduced motion.
- Step 3: slider updates result and tip live. Selecting a different funding option collapses the others.
- Goal card press: 98% scale, 100 ms. Button press: DS default.
- Loading: card skeletons at exact card height (192) using `SkeletonList`-style shimmer. Counselor card shows a 2-line skeleton while usual-keep is computing.
- Errors: AI failure inline text under the AI entry, never a blocking dialog. Save failure: inline error above the footer button and keep the sheet open.
- Offline: AI entry points hidden, everything else works from local state.
- RTL/Arabic: logical properties only (`ms-`, `me-`, `ps-`, `pe-`, `text-start`), chevrons mirror, amounts and dates stay LTR (`font-mono-numbers`).
- Dark mode: all frames exist in light; home, empty and detail also in dark. Test every screen in both.

## Accessibility

- All tap targets >= 44x44, including the date ± buttons and the dismiss X.
- SegmentedControl is a radiogroup (DS handles arrows).
- Trophy chip: button with `aria-label="Achieved goals, 3"`, `aria-pressed` when the Achieved view is open.
- Slider: `role="slider"`, `aria-valuemin/max/now/text` ("35 percent, about 4,200 pounds a month"), arrow keys step 5, shift+arrows step 1.
- Status is never color alone: every status has an icon and text.
- Checkpoint bar: `role="img"` with `aria-label="62 percent, 2 of 4 checkpoints reached"`.
- Contrast: text 4.5:1. Do not put text on `--color-brand-primary-bright`. Use `--color-brand-primary-ink` for teal text.
- Reduced motion: no confetti motion, no pulse, no meter animation.

---

## Component reuse audit (do this against the real codebase first)

Use the existing `Buddget.*` library. Check each against the actual source before building.

**Reuse as is**
- `Button` (default = solid teal primary, outline for secondary; all CTAs here), `SegmentedControl` (All/Active/Paused, Every month/Every quarter), `AmountField` (+ `NumberPad`), `CurrencyField`, `BuddgyIcon`, `Sheet` (add goal, detail, cost sheet, split sheet), `Badge`/chip patterns, `Progress` (check whether it can host checkpoint nodes; if not, build `CheckpointBar`), `PromptBanner` (alert banner), `EmptyState` (check; the 3a design is richer and likely a new screen composed from parts), `MonthYearPicker` / `UnifiedDatePicker` (date picking), `Switch` (notification settings), `Scrim`, `SkeletonList`, `StatTile` (achieved hero stats, restyle for on-primary), `SelectableCard` / `OptionChip` (funding option rows and cost options, verify API).
- Do not hand-roll transaction rows. None are used here.

**Create new (goals feature scope)**
- `GoalCard` (fixed 192 px, the footer status line and button; props: goal, status, onPress, onAction).
- `GoalStatusLine` (icon, text, button chosen by the priority table; pure function `getGoalStatus(goal, now)` plus a presentational component).
- `CheckpointBar` (track, fill, four nodes, optional labels row). Reused in GoalCard, detail, empty state, celebration.
- `PaceMeter` and `CounselorCard` (zone pill, meter, asked vs usual, copy, optional two buttons).
- `FundOption` and `ShareSlider` (radio row, expanded share panel, chips, total line, tip).
- `TrophyHero` and `AchievedRow` (achieved view).
- `LifeMomentTile` (empty state grid) and `BuddgyHero` (empty state hero and the step 1 input card; same input component).
- `TrophyChip` (switch-row companion; small enough to live in the goals folder).
- `CoachCard` (detail behind state) can share a base with `CounselorCard`.

**Adjust existing**
- `AmountField` glass variant: the mockup needed color overrides in light mode (value text and border looked wrong on the elevated fill). Confirm it renders correctly in light and dark; if it does not, add a light-safe default rather than overriding per screen. Show the currency prefix only when relevant.
- `CurrencyField`: it renders unstyled unless you pass `className`. Pass the field styling (52 px high, 14 px radius, elevated fill, border) via className in this feature, or add a `variant="field"` to the component.
- `SegmentedControl`: supports `icon` and `count` per option, but this design deliberately keeps the trophy chip outside it. Do not add the trophy as a 4th option.
- `Card`: the design uses 20 px radius on goal cards and hero blocks. Either extend `Card` with a `radius="xl"` or use the standard 16 px (see Known deviations).

Create shared pieces only if they are used by 2+ goals screens. Keep one file per component with its `.d.ts` and `.prompt.md` like the rest of the library if components are added to the DS; otherwise keep them in `src/components/goals/`.

---

## Design tokens used

All tokens come from the design system stylesheet. Use `var(--*)` in arbitrary-value utilities; do not hardcode hex.

- Surfaces: `--color-brand-bg`, `--color-brand-card`, `--color-brand-elevated`, `--color-brand-border`
- Text: `--color-brand-text-primary`, `--color-brand-text-secondary`, `--color-brand-text-muted`
- Brand: `--color-brand-primary` (fills), `--color-brand-on-primary`, `--color-brand-primary-bright` (#12B0A0, decorative, bar fills, icons only), `--color-brand-primary-ink` (teal text), `--color-brand-primary-soft` (tinted panels)
- Status: `--color-brand-amber` (behind, streak), `--color-brand-red` and `--color-brand-red-text` (over limit only), `--color-brand-green` (one deposit away)
- Category tiles: `--color-cat-1` to `--color-cat-6` (tile = 16% mixed into card via `color-mix`, glyph in full color)
- Shadows: `--shadow-sm` (cards), `--shadow-md` (slider thumb), `--shadow-lg` (sheets)
- Radius: buttons and fields 12 to 14, cards 16 (20 for goal cards, see deviations), sheet top 24, chips and pills 999
- Type: DM Sans 400/500/600/700; JetBrains Mono 400/500/600 for numbers via `font-mono-numbers`. Sizes in use: 11, 12, 13, 14, 15, 16, 18, 20, 22, 24, 26, 30, 38, 40, 56. Label style: 11/700 uppercase, 0.08em tracking, muted.
- Spacing: 4, 6, 8, 10, 12, 14, 16, 18, 20, 22. Page padding 16.
- Sizing constants: goal card height 192, card footer 56, button/tap 44, input 48 to 52, sheet top inset 40, sheet handle 36x4, progress track 6, checkpoint node 16.

## Decisions already made (do not revisit unless blocked)

1. Gold is for investments in the design system. Achievements use brand teal. Trophy room hero is solid `--color-brand-primary`; the celebration disc is white with a teal trophy.
2. Date leads in the add flow. Amount follows.
3. Totals over 100% are allowed. Priority order resolves shortfalls.
4. The pocket is created with the goal.
5. All/Active/Paused replaces Active/Achieved/All. Achieved is the trophy chip.
6. Goal cards are always 192 px. One status, one button.
7. "New goal" button sits in the title row. No FAB.
8. Progress rate and the "why" field are removed.
9. Push copy for months behind: "Vacation has been behind for 3 months. Move the date to Jun 2028 or add EGP 4,100 a month." Send once a month after the second missed month, not daily.

## Known deviations from the design system (choose deliberately)

- Goal cards, achieved rows and hero blocks use a 20 px radius. DS guideline is 16 px for cards. Recommend 16 unless design signs off on 20.
- The achieved hero and celebration use white (`#fff`) disc and tiles at `rgba(255,255,255,.14-.22)` on the brand fill. These should map to existing on-primary tokens if available.
- The mockup page uses `color-mix(in srgb, var(--color-cat-N) 16%, var(--color-brand-card))` for tiles. Use whatever `AccentTile` already does if it matches.
- Mockup screens are drawn at 390 px wide; the app is fluid. Use `max-w-2xl mx-auto px-4` on wide screens per the DS guide.

## Open questions (ask the product owner, do not guess)

1. Cancelled goals: proposal is that deleting asks where the pocket money goes (Free pocket by default) and removes the goal, with no "cancelled" list. Confirm.
2. Do drafts of the add flow persist if the user closes mid-way?
3. Should the Paused view also show achieved goals' pockets, or only paused goals? (Current design: only paused.)
4. All view: grouped (Active first, then Paused) or sorted by attention? Current proposal: Active first, then Paused, with a small "Paused" label above that group.
5. Quarterly goals: which day of the quarter does the deposit run? Proposal: first day of each calendar quarter.
6. Is there a minimum history length before the counselor shows "You usually keep"? Proposal: 1 full month; below that show the neutral line.

## Files

- `source/Goals Mockups v2.dc.html` the full design canvas (all frames, light and dark). Open in a browser.
- `source/support.js` runtime the canvas needs.
- `screens/*.png` 2x frame images listed above.
- `CLAUDE_CODE_PROMPT.md` the prompt to paste into Claude Code.
- Existing in the project from earlier work: `../handoff/GOALS_ALLOCATION.md` (allocation engine; see rule 1 change above), and the Subscriptions handoff in `../handoff/` (unrelated, do not mix).
