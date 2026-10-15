# Claude Code prompt — implement Buddget Wealth v3

Paste everything below the line into Claude Code, run from the root of `MohamedMousa007/buddget` (branch `main`), with this handoff folder copied to `design/design_handoff_wealth_v3/`.

---

You are implementing the **Wealth** page (`/wealth`) of Buddget from a high-fidelity design handoff in `design/design_handoff_wealth_v3/`. Read `README.md`, `COMPONENTS.md` and `SCREENS.md` there in full, and look at every PNG in `screenshots/` before writing code. The screenshots are the acceptance target, in light **and** dark, EN **and** AR (RTL).

## Ground rules
1. **Read before you change.** Before touching a file, read it and every component it imports. Before creating anything, search `src/components/ui/`, `src/components/features/`, `src/components/dashboard/` and `src/components/layout/` for something that already does the job. The code is the source of truth for what exists; the handoff is the source of truth for how it should look and behave. If they disagree about what exists, say so in your summary.
2. **Zero visual deviation, fully reusable structure.** Every control on the page must be a library component (`src/components/ui/*`) or a feature component composed only of library components. No raw styled `<button>` (the `noStyledRawButtons.test.ts` guard must pass). No hex colours or `rgba()` literals in feature code: use the CSS variables from `globals.css`. If matching a screenshot needs a variant the library lacks, add the variant to the library component (with a story/test where the repo has them), then use it. Never fork a component locally inside a feature file.
3. **Audit and fix existing components as you go.** For each component in `COMPONENTS.md` marked Edit / Replace / New, do exactly that. Also fix any deviation you find in a reused component that would make the page differ from the screenshots, in the component itself so every screen in the app benefits. List each such fix in your summary.
4. **Do not change** Flow, Paydays, the income add sheet, the FAB, BottomNav, the header/profile, BannerStack behaviour (you may add a new prompt type to it), the offline alert, or the zakat and valuation rules in `src/lib/savings/*`.
5. **Tokens and type:** amounts, dates and percentages use `font-mono-numbers`; logical properties only (`ms-/me-/ps-/pe-`, `text-start`); touch targets ≥ 44 px; inputs 48–52 px.
6. **Arabic:** add every new string to both dictionaries (`src/lib/i18n/dictionaries/en.ts`, `ar.ts`). `SCREENS.md` lists the copy. Arabic drafts in the design must be reviewed by a native speaker; mark them `// TODO(ar-review)`.

## Work order (each step must build, lint and pass tests)
1. **Data + settings.** `AppSettings.wealthGoldStrip: 'collapsed' | 'expanded' | 'hidden'` (synced). `ZakatConfig` gains a flag recording that the user explicitly chose a nisab basis (e.g. `nisabBasisChosen: boolean`); when unset, compute with **gold** (fallback). Add selectors for: net-worth 30-day trend (points + pct), investment return since the first purchase (from cost basis), savings rate this month, emergency-fund state (`unset | needsMoney | secured`).
2. **Library edits.**
   - `AmountField`: the glass style hard-codes dark colours (`#26262f` border, `#fff` value, `#5A5A72` prefix, `#3F3F4D` placeholder). Replace with tokens (`--color-brand-border`, `--color-brand-text-primary`, `--color-brand-text-muted`) so it works in light mode (the screenshots, e.g. `screenshots/light/12-add-money.png`, show the target: dark value text on a light field). Add `size?: 'default' | 'compact'` (compact = 44 px tall, 20 px value).
   - `CurrencyField`: show the currency **symbol** from `CURRENCY_META` (E£, $, SAR, …) instead of the country flag; add it to `CURRENCY_META` if missing. Compact trigger: 44 px tall, about 96 px wide. Update `CurrencySheet` rows to lead with the symbol too.
   - `CardActionMenu`: `CardMenuItem` gains `disabled?: boolean` and `hint?: string`; menu 216 px wide, 44 px rows, 10 px icon gap, 14 px label; hints only where given.
3. **New feature components** in `src/components/features/savings-v3/`: `GoldPriceStrip`, `WealthList` (with category chips), `WealthHeroBadges`, `ZakatBasisPrompt` (rendered through BannerStack as a drop-down prompt), `AddHoldingSheet`. Props are in `COMPONENTS.md`.
4. **Edits:** `SavingsHero`, `ActivityLedger`, `EmergencyFundSheet` (split into Details and Set up / Edit), `ZakatSheet`, `AddSavingsSheetV3`, `WithdrawSheetV3`, `AssetFormSheet`, `PocketFormSheet`.
   - `AssetFormSheet`: **remove the “Where it is” field and its `where` state; stop writing `location`** (keep the type field for old data). Replace the local `UnitInput`, `ChipRow` and `SourceChip` with `AmountField`, `SegmentedControl` and `SelectableCard`. Replace `ACCENT` hex values with tokens. Keep the money-source logic (`budget | had`) and redesign it as two `SelectableCard` rows with icon and one line; “This month” requires what you paid, “Already had it” makes date and price optional.
5. **Rewrite `src/app/wealth/page.tsx`** as one scroll per `README.md` → Page structure. Remove the Savings/Investment `SegmentedControl` and view state.
6. **Delete dead files** only after `grep` shows no importer: `PocketsCarousel`, `PocketCard`, `InvestmentView` (after moving the gold-gap maths into `GoldPriceStrip`), `EmergencyFundCard`, `ZakatCard`, `NewPocketSheet`, `AddInvestmentSheet`, `UpdateBalanceSheet`, `EditSavingsAccountSheet`. Move `PocketVM` to `savings-v3/types.ts` first.

## Acceptance
- Put the running page next to each screenshot (390×844, light and dark, EN and AR) and fix every difference you can see: spacing, radius, colour, weight, truncation. The amount and currency fields in the screenshots show the **target** look after step 2: amount value in text-primary on the elevated surface with a 1px border, unit suffix (oz, m², %) at the end in text-muted, and the currency trigger as `E£ EGP` with a chevron and no flag. In the design file they are drawn with FieldButton only because the bundled library still has the old AmountField/CurrencyField; build them with AmountField and CurrencyField.
- `npm run lint`, `npm run typecheck` (or `tsc --noEmit`), and the test suite pass, including `noStyledRawButtons.test.ts`.
- No hex or rgba literals added under `src/components/features/` or `src/app/wealth/`.
- Every acceptance question in `SCREENS.md` → “Acceptance” can be answered from the running page.
- Finish with a summary: files changed, components added/edited/deleted, deviations you could not remove and why, and any place the code and the handoff disagreed.
