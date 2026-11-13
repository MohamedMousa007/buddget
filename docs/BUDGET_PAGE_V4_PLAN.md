# Budget page v4: final plan

Status: proposed, not built. Mockup: `docs/mockups/budget-page-v4.html` (before and after, five screens).
Source of decisions: archived session "Budget page fixes and improvements" (2026-11-04) plus the audit of build 138.

## 1. What was agreed and never built

| # | Decision | Today | v4 |
|---|---|---|---|
| 1 | Budget page uses the segment rail (plan and This month in one view) | Three collapsible chapters (`PlanChapters`, `ChapterCard`, `BlockShell`) | Summary card, rail, one segment card |
| 2 | Review: each icon shows progress or summary | Stepper shows a check for pages already passed | Amount caption and a state dot: amber = estimates, green = checked |
| 3 | Review: one reason line per segment, source per line, "Looks right" | None of the three | All three; `rationale.reasons` feed the reason line, `confidence` feeds the source tag |
| 4 | Review summary shows the key stats | Headline, two checks, full flow card | Headline, stats row (saving, debt-free date, safety months), slim bar, flagged list |
| 5 | Stress test archived | Unwired but code, copy and test remain | Deleted, noted in `docs/ARCHIVED_FEATURES.md` |
| 6 | Live plan strip while answering questions | Only a "% ready" caption | Slim strip above the question |
| 7 | "Estimate / build now" buttons not ghost text | "Good enough, build now (N%)" is a ghost button | Header chip, only from 60% |

## 2. Design critique, summarised

Before (shipped): one number drawn five times on the page; the first rows sit below four stacked cards; chapters force "see everything or nothing"; the review treats a solid block and a guessed block identically; plan actions live in three places; the page and the review render a plan line two different ways.

After (my own draft, criticised): see each tab in the mockup. Changes made because of that critique:

- Icon-only rail: added caption (share or % used), aria-labels, the name as the card title.
- "See all N": removed; show every line.
- Pace by colour only: over-pace is an icon plus words on the line.
- Review taps: segments without estimated lines are pre-checked, so only flagged ones need a tap.
- Skipping: no "Activate as is"; the CTA is "Review N flagged" and turns into "Activate plan" at zero.
- Delete next to Duplicate: stays an icon, confirm dialog, red only on the glyph.
- Removing the page's ⋯ would strand "Ask Buddgy": it moves to the review summary and the nudge row.

Skills applied: design-critique, design-system, accessibility-review, frontend-design. No third-party skill installed: the question-flow research in the earlier session found only CLI survey skills, and nothing here needs untrusted code.

## 3. Component plan (reuse first, per CLAUDE.md)

Reused unchanged: `SegmentedControl`, `Card`, `Badge`, `TintedTile`, `PromptBanner`, `ModalShell`, `SelectableCard`, `IconButton`, `StepFooter`, `PlanDeck`, `planActionItems`, `LineSheet`, `AddLineSheet`, `AdjustSheet`.

Additive variants (default look unchanged):

| Component | New prop | Used by |
|---|---|---|
| `BlockStepper` | `ring?: (block) => 0..1`, `caption?: (block) => string` | Budget page (This month rings, plan shares) |
| `BlockStepper` | `marks?: (block) => 'checked' \| 'flag' \| undefined` | Review |
| `FlowStrip` | `legend={false}`, `stats` row, `slim` | Page summary, review overview, question strip |
| `LineRow` (blocks/parts) | `source?: 'linked' \| 'data' \| 'estimated'` tag | Review and builder |

`BlockStepper` reaches its 3rd and 4th prop here, so per the project rule: propose promoting it to `SegmentRail` (it is now the page's main navigation). Decision needed.

New files: only `SegmentCard` (header + reason line + `LineRow` list + add row). It is a composition of `Card`, `TintedTile`, `Badge`, `LineRow`, not a new primitive; it replaces `BlockShell`.

Deleted: `ChapterCard`, `BlockShell`, `PlanChapters`, `PlanRail`, `InsightsChip` (folded into one nudge), `StressTestSheet` + `useStressCopy` + `stressCopy.ts` (keep `stressTest.ts` only if the owner wants the engine kept). `LearningNote` stays.

`PastPlanSheet` uses `SegmentCard` read-only.

## 4. Build order (each step verifiable)

1. `BlockStepper` props + test (renders caption, ring, marks; default unchanged). Verify: existing render tests green, new test red then green.
2. `FlowStrip` variants + `SegmentCard`. Verify: render tests.
3. Budget page: replace chapters with summary + rail + `SegmentCard`; remove `jump`, `collapsed`, chapter state. Verify: page render test for plan and month mode, 7 segments, Arabic strings present.
4. Review: `marks`, reason line, source tags, "Looks right", flagged-first CTA, pre-check rule. Verify: pure function test for "which segments are pre-checked"; Activate blocked while flagged remain.
5. Plan chip becomes the only entry; delete ⋯ menu, `PlanRail`, `InsightsChip`; add History row. Verify: all former actions reachable in the sheet.
6. Questions: live strip and header "Build now · N%" from 60%. Verify: `flowReadiness` unit test at 59/60.
7. Delete stress-test files, update `docs/ARCHIVED_FEATURES.md`, `docs/REPO_MAP.md`.
8. Refactor `BudgetPlanPage`: move takeover state (`building`, `studio`, `review`, `creating`) and month-close finish logic into hooks; one shared line-edit host for page, review and builder.
9. `npm run verify`, diff audit, dark mode and Arabic check in the preview, push dev and main. No native build unless the owner says so.

## 5. Risks

- The page loses the "all lines of the plan at once" view. Mitigation: the This month summary and the rail show every segment at a glance.
- Pre-check can read as "the engine approved it". Mitigation: reopen allowed; "Activate" blocked until no amber remains.
- New strings need English and Arabic (a test enforces parity).
- The dev preview cannot render `useMonthlyStats` surfaces without a session; verification uses the `__finance` seed hooks and a rendered snapshot.

## 6. Decisions (owner approved the recommendations, 2026-11-12)

1. Promote `BlockStepper` to `SegmentRail`: yes.
2. Drop the "Must pay / Live / Secure" chapters entirely: yes.
3. Builder and review use tap-to-edit `LineSheet`, same as the page: yes (unify).
4. Delete the stress-test engine (`stressTest.ts`) with its sheet: yes.

## 7. Layout and review decisions (supersede sections 1 to 5 where they conflict)

Owner direction, 2026-11-12: no "assigned / unassigned" language (the app builds a plan and tracks against it); ledger layout A is the favourite; more stats on each row; the segment page redesigned with several critique rounds; the review decision weighed before mockups. Mockup: `docs/mockups/budget-page-v6.html`.

- **Hero (H1, pace bar):** month = Left to spend (everyday money) with per-day and days left, a pace bar with today's tick, a pace line, then Income, Spent, Still to pay, Saved. Plan = Monthly income, Saving rate, Debt-free date, a three-way split bar (Spending, Debt, Saving) and Spending, Debt, Saving, Safety.
- **Overview (ledger):** plan chip and Plan / This month switch on one row; seven rows, each with left and planned (month) or planned, share and 3-month average (plan), a status line in words, and a bar. Measured at 393px: 650px plan, 656px month.
- **Segment page:** back is a text link ("Budget"), "4 of 7" on the right, an icon-only strip (SegmentRail) for position and navigation, the name once inside the hero card, then lines, Recent (month), plan against history, Buddgy and a "Next" card. Measured at 393px: 924px plan, 1,176px month.
- **Review:** dropped the per-segment wizard. The review is the overview with a Buddgy summary and a state mark per segment, and the same segment page in review mode ("Looks right", Estimated tags). "Check flagged" walks only flagged segments; Activate is blocked while any remain; checks reset on rebuild; pre-checked segments can be reopened. Taps for a plan with 2 estimates: 9 before, 4 after. The manual builder keeps its stepper for now.
- **Method note:** no arena skill is installed; the council method and adversarial rounds were run by one model, not independent agents.

### Revised build order
1. `SegmentRail` (promoted `BlockStepper`): icon strip with position, marks, caption props.
2. Hero H1 as a `FlowStrip` variant.
3. `LedgerRow` and the overview page; delete chapters, `BlockShell`, `PlanChapters`, `PlanBar` ⋯, `PlanRail`, `InsightsChip`, the legend chips.
4. `SegmentPage`: `SegmentHero`, Recent, plan against history, Next card; `LineSheet` unchanged.
5. Review mode on the overview and segment page; delete the `ReviewPage` stepper path and `BuilderBlockStep` in review.
6. Plan sheet cleanup, question flow strip, delete the stress test.
7. `BudgetPlanPage` hooks refactor, `npm run verify`, diff audit, push.

### Still to confirm
Hero choice (H1 recommended), "Left to spend" versus "Left for everyday", segment page fold for Recent and history, manual builder now or later.

## 8. (superseded by section 9) Pending: page layout

The v4 summary card and rail were criticised: the rail behaves like a filter bar (only the selected segment shows stats) and the hero has no single answer. See `docs/mockups/budget-page-v5-options.html`. Recommendation: hero H2 (pace bar, "left to spend" = everyday money, still to pay, 0 unassigned) plus layout A (ledger: all seven segments as rows with status, number and bar; tap opens the segment page with prev/next), and a "Needs you" card (max 3, hidden when empty) in place of the nudge row. `SegmentRail` then serves the segment page and the review. Awaiting the owner's pick.

## 9. FINAL (2026-11-12, council-decided). Supersedes sections 1 to 8 where they conflict

Mockups: `docs/mockups/budget-page-final.html` (final design and reasons), `docs/mockups/budget-page-variations.html` (every explored version, critique). Method: design critique of all variations, then `ecc:council` (three independent subagent voices per question: Skeptic, Pragmatist, Critic).

### Owner decisions applied
No assigned/unassigned language. Pace bar. "Left to spend". Ledger layout kept but richer and not crowded; no coloured bars. Estimates only in review, not after activation. Segment page: icons on lines, richer stats, no plan-against-history, no Next card, no source badges, strip is the only navigation. Page may scroll; overview about one screen.

### Hero audit
The Flow hero already shows Left to spend (total budget minus spent), a pace tick, On track / Close / Over, Money in, Money out and Net worth. Budget's hero therefore owns: Everyday pace, Top spend, Alerts, Forecast, saving rate, spending composition.

### Final design
- **Month hero:** "Left to spend · Everyday" (big), "N a day / N days left", pace bar with today tick, status pill, Day n of 30, stats Top spend, Alerts, Forecast (from day 10). New plan: designed empty state, no pace or forecast.
- **Plan hero:** Monthly income, Saving %, Debt-free date, three-way split (Spending, Debt, Saving) with legend, stats Spending, Debt, Saving. Plan exceeding income turns the line red.
- **Ledger:** clean rows, no bars or dots. Month: status line in words, "N left / of planned". Plan: status line with share of income, "planned / vs last month" once active. Review: amber flag on estimated segments only. Measured at 393px: 614px (month), 608px (plan).
- **Segment page:** back text link and "n of 7", icon strip, hero card (name once, left or planned, pace bar for Everyday, three stats), lines with icons, one segment-specific extra card, Buddgy line only when real. 1,009px for Everyday in month view.
- **Review:** the overview in review mode plus segment pages with "Looks right"; "Check N flagged"; Activate blocked while flagged or while the plan exceeds income.
- **Manual builder (phase 2, after review ships):** same overview and segment page in build mode. Start with "Use my data" preselected; "Start here" on the first empty segment; Done goes to the next empty segment; Skip marks a segment skipped; line sheet has "Save and add another"; review flags empty segments; old stepper stays behind a flag until the new builder beats it on activation.

### Council summary
- Month hero: all three voices: HB trimmed; all three advised renaming to "Everyday left" (owner's label kept with the scope word "· Everyday"; revisit if users compare it to Flow).
- Plan hero PA (all). Ledger: no L3, dots cut (2 of 3), no bars. Segment page P1 (+ Buddgy line when real); icon tiles cut.
- Builder: nobody wants it first; Skeptic prefers a thin empty-state mode, Pragmatist and Critic accept B2 with a guided path.

### Build order
1 SegmentRail (promoted BlockStepper; aria names; RTL order). 2 Hero as FlowStrip variant (plus new-plan state). 3 LedgerRow and overview; delete chapters, BlockShell, PlanChapters, PlanBar menu, PlanRail, InsightsChip. 4 SegmentPage. 5 Review mode; remove the ReviewPage stepper path. 6 Plan sheet cleanup, question flow strip, delete the stress test. 7 BudgetPlanPage hooks refactor, `npm run verify`, diff audit, push. 8 Builder phase 2.

### QA before any native build
Arabic RTL (strip, back direction, bidi numerals), screen reader names and "n of 7", colour never alone, 650px overview on a small phone, Flow and Budget "left" explained, empty, new-plan, over-income, month-close and offline states.

### Open for the owner
1. Keep the label "Left to spend · Everyday" or use "Everyday left". 2. Forecast from day 10 or later. 3. Builder phase 2 right after review, or wait for on-device feedback.

### 9a. Update after the pro-max review and the forecast council (2026-11-12)
- **Forecast removed.** Third hero stat is **Still to pay**: unpaid due lines in Bills, Subscriptions and Debts (not Safety, Goals or Grow); shows "All paid" in green when zero. Council: Still to pay had 2 first picks and was runner-up for the other two (Critic preferred daily average vs allowed; Skeptic preferred runway, a projection like the rejected forecast). Check the Visa card is not double-counted (card spend vs the scheduled debt payment).
- **Plain-language pass:** stats are "Top category", "Over budget · 1 category", "Still to pay". The pill says "Ahead of pace" with no number (the amount is on the Everyday page as "Vs pace"). "Day n of 30" removed. Switch reads "Plan | Month" so the plan name is not truncated.
- **Ledger:** "vs last month" shows only when a segment moved 3% or more.
- **Review and builder:** one sticky button each. "Ask Buddgy to change" lives in the summary card; "Skip this segment" is in the page.
- **Type:** pills and small captions 12px.
- **Measured:** 614px (month) and 608px (plan) at 393px; 616px and 608px at 375px with no horizontal overflow.
- **Skill:** ui-ux-pro-max (nextlevelbuilder, MIT) was cloned into a scratch folder and read; its scripts only read local CSV data. The install into `~/.claude/skills` was blocked by the permission classifier, so its rules and data were applied by hand and the scripts were not run. To install it yourself: `/plugin marketplace add nextlevelbuilder/ui-ux-pro-max-skill` then `/plugin install ui-ux-pro-max@ui-ux-pro-max-skill`.

### 9b. Implementation status (2026-11-12)
- **Done:** `src/lib/budget/monthSummary.ts` + `monthSummary.test.ts` (12 tests green): `everydayPace`, `topCategory`, `overBudgetLines`, `stillToPay`. Pure functions over `PlanView`; `PlanView` already carries lines with `spent`, `paid`, `dueDay`, `average`, `status`, `extras` (subscriptions, debts, goals, safety, `debtFreeMonth`), `dayOfCycle`, `daysInCycle`.
- **Not started:** build order steps 1 to 8 in section 9 (SegmentRail, hero, ledger and overview, SegmentPage, review mode, builder, plan sheet cleanup, deletions, `npm run verify`, push). All new strings need EN and AR copy (a parity test enforces it).
- **No native build** has been run or requested.

### 9c. Review summary card (council 4, 2026-11-12)
The long Buddgy sentence ("Essentials take 52%, saving 21%. The Visa card is cleared first, by Sep 2027.") is replaced by a short, **data-generated** summary. Spec:
- **Headline** states the job and is state-driven: `N to check before you activate` (N = flagged segments); `Ready to activate` at zero; red `Over income by X · fix before activating` when the plan exceeds income (replaces the fact line).
- **One fact line:** `Debt-free by Sep 2027` (`extras.debtFreeMonth`); `Debt-free around Sep 2027` when the debts segment is flagged (the date rests on an estimate); omitted when the plan has no debts; `No debt-free date yet` when debts exist but the date is unknown. Never show a far-off date as an achievement.
- **No percentages** (the split bar and legend carry them; "Essentials 52%" clashed with "Spending 68%"). No model-written text in the card, so it works offline and for engine-only plans, and updates live as flags are fixed.
- **"Ask Buddgy to change"** stays as a small text link at the bottom of the card; the sticky bar holds one button (`Check N flagged` / `Activate plan`).
- **One shared selector** (flag count) feeds the headline, the sticky button and the amber flags so they cannot disagree.
- **Council:** all four voices agreed on data-generated, no percentages, one fact, state-driven edge states. The Skeptic wanted a verdict ("Looks balanced") to answer "can I trust this?"; rejected by the others and by me: an unbacked judgement next to unverified estimates. The rationale text (`plan.rationale`) is not shown in this card; a "Why this plan" link is left out unless it can be tied to the numbers shown.
- Mockup: `docs/mockups/budget-page-final.html`, Review tab (four states) and the Review changes tab (before/after).
