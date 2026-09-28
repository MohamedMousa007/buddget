# design-sync notes

- **Target project:** `Buddget Design System` (`3e84a07a-da79-472d-b487-07c93afa5f48`) — re-adopted on the
  user's explicit choice (2026-09-28). It previously held 10 hand-authored stub components
  (Badge/Button/Card/BudgetRing/Progress/ExpenseRow/KPICard/MoneyDisplay/Input/Switch) whose
  `sourcePath`s never existed in this repo. Re-adoption ⇒ **atomic upload path** (upload once at the
  end of the run, after full verification). Overwrite/delete risk was disclosed and accepted.
- **Why this project and not a fresh one:** the `_ds/buddget-design-system-3e84a07a-.../` folders bound
  into `design/design_handoff_*/prototype/` point at this project ID; a fresh project would orphan them.
- **Shape:** `package` — no Storybook anywhere in the repo (no `.storybook/`, no `*.stories.*`).
- **Package manager:** npm (`package-lock.json`) → `npm ci`. No `.nvmrc`, no `engines.node`.
- **Repo is an app, not a library:** no `exports`/`main` in package.json, no `dist/`. The synced surface is
  source under `src/components/`, bundled by the converter.
- **Scope (user choice):** primitives + finance patterns — `src/components/ui/` plus
  `transactions/TransactionRow`, `features/income/*`, and presentational `dashboard/*`.
  Excluded: components coupled to Zustand (`useFinanceStore`/`useSettingsStore`), `useT` i18n, or
  `@/lib/supabase`. 8 of 40 `ui/` files and 19 of 23 `dashboard/` files are so coupled.
- **Auth blocker hit on first run (2026-09-28):** `DesignSync` returned "needs design-system
  authorization, and /design-login cannot run in this non-interactive session". The local pipeline
  (build → validate → grade) was run anyway; upload waits on `/design-login` from an interactive
  `claude` session on this machine.

## Build findings (first sync, 2026-09-28)

- **`src/app/globals.css` cannot be `cfg.cssEntry` directly.** It opens with
  `@import "tailwindcss"` + `@import "tw-animate-css"` (npm packages, not files), so validate fails
  `[CSS_IMPORT_MISSING]` twice and — worse — **every Tailwind utility is missing from the design
  runtime**. Buddget styles everything with utility classes, so the whole DS would render unstyled.
  Fix: `.design-sync/ds-entry.css` imports globals.css + the Google-Fonts families + `@source "../src"`,
  and is compiled by the Tailwind v4 CLI to `.design-sync/compiled.css`, which IS `cfg.cssEntry`.
  **Re-sync must recompile it** (the CLI lives in `.ds-sync/node_modules`, which is gitignored):
  `node .ds-sync/node_modules/@tailwindcss/cli/dist/index.mjs -i .design-sync/ds-entry.css -o .design-sync/compiled.css`
  Output was 198 KB / ~1584 rules, incl. the arbitrary-value utilities Buddget leans on
  (`rounded-[14px]`, `text-[34px]`, `bg-[var(--color-brand-red)]` — 138 `var(--color-brand*)` rules).
- **`@source "../src"` is load-bearing.** Tailwind v4 bases auto-detection on the input file's own
  directory; without the explicit `@source`, compiling from `.design-sync/` emits almost no utilities.
- **Fonts are next/font-injected in production**, so `--font-sans`/`--font-heading`/`--font-mono`/
  `--font-sans-ar` fall back to system fonts outside Next.js. Getting the brand faces to actually
  apply took two non-obvious fixes — **both are load-bearing, don't "simplify" either away**:
  1. **The Google-Fonts `@import` must be the FIRST rule in `ds-entry.css`**, above the globals
     import. Tailwind emits this file in source order; with the import second it landed on line
     6517 of the compiled output, and CSS silently drops an `@import` that follows other rules
     (`document.fonts.size === 0` in the browser, everything rendered in system sans).
  2. **`globals.css` declares the font vars inside `@theme inline`, and `inline` BAKES the literal
     value into every generated utility** — the compiled output was
     `.font-sans { font-family: ui-sans-serif, system-ui, sans-serif }` with no `var()` anywhere, so
     a plain `:root { --font-sans: 'DM Sans' }` override had zero effect. Re-declaring the vars in a
     **later `@theme inline` block** is what re-points the baked utilities. `ds-entry.css` does BOTH
     that and a plain `:root` block, because the hand-written utilities in globals.css
     (`.font-mono-numbers`, `.font-heading`, the `html[data-locale='ar']` rules) *do* go through
     `var(--font-*)` and need the custom properties too.
  Verified in a real browser: `getComputedStyle(document.body).fontFamily` → `"DM Sans", ...` and
  `document.fonts.size` → 100 faces. Validate reports `[FONT_REMOTE]` (informational, expected —
  not a `[FONT_MISSING]` to chase).
- **No library build exists** (Buddget is a Next.js app: no `dist/`, no `exports`/`main`). The synced
  surface comes from `.design-sync/entry.tsx`, a hand-authored barrel passed as `--entry`, plus an
  enumerated `componentSrcMap` (59 components). Synth-entry mode was rejected deliberately: it
  `export *`s every `.tsx` under the source root, which would drag in `admin/`, `auth/`, Supabase
  clients and `next/*` importers. **Adding a component means editing both `entry.tsx` and
  `componentSrcMap`.**
- **i18n and Zustand are NOT provider-blockers.** `LocaleContext` has a real default
  (`t: en`, `src/lib/i18n/index.tsx:19`), so `useT()` returns the full English dictionary with no
  wrapper, and the Zustand store is a plain `create()` with safe-localStorage persistence. So
  i18n-coupled and store-coupled components bundle and render standalone. `LocaleProvider` is
  exported from the barrel anyway, in case a preview ever needs a non-default locale.
- **Genuine exclusions:** `AppLink` + `DashboardSearchParamsSync` (`next/link`, `next/navigation`),
  `DebtSnapshot` (`@/lib/supabase`), and 9 pure store-readers with no props that would render as
  empty states (`ExpenseDayList`, `DashboardTransactions`, `DashboardSummaryCards`,
  `DashboardSummaryTrio`, `DashboardGoalsStrip`, `GoalsWidget`, `RecentExpenses`, `SavingsCard`,
  `DashboardCategoryBars`).
- **`ui/` groups as `general`.** `ui` is in the converter's `GENERIC_DIR` set, so
  `src/components/ui/*` gets no group from its directory. Regroup later with `cfg.docsMap` stubs
  (`---\ncategory: Core\n---`) if the DS pane's grouping matters.
- **Build is fast:** ~30 s for build, seconds for validate. `--skip-dts` was never needed.

## Preview-authoring learnings (solo set: Button, TransactionRow, RecurringIncomeCard)

- **Previews import from `'buddget'`**, never `@/...`. They compile against the bundle, so every
  component and helper used must be a barrel export in `.design-sync/entry.tsx`.
- **`variant="default"` is the solid brand-red CTA; `variant="destructive"` is a soft red-TINTED
  style.** This is the opposite of the usual shadcn reading and cost a full iteration — the first
  Button preview and its prop doc both had it backwards. Same for `Badge`. Both prop docs in
  `cfg.dtsPropsFor` now state it explicitly, because the design agent codes against them.
- **The glass cards (RecurringIncomeCard and friends) style their footer CTAs as raw brand fills**
  (`background: var(--color-brand-red)` + white text), NOT as DS Button variants — `destructive`
  disappears against dark glass. Port the app's inline styling, don't "correct" it to a variant.
- **Row components need their list context to read correctly.** A bare `TransactionRow` looks
  broken; wrap in the card surface + top/bottom border + the `margin-inline-start: 82px` hairline,
  exactly as `ExpenseDayList` does. Wrapper width **440px** — at the app's true 390px the titles
  truncate to "Monthly…" and the card reads as a bug rather than as authentic narrow-screen behaviour.
- **Never write unicode escapes in a heredoc-authored preview.** `·` reached the `.tsx`
  literally and rendered as the text `·` in the card. Write the real character (·).
- Syntax-check a preview before rebuilding — it is much faster than a failed capture cycle:
  `node -e "require('./.ds-sync/node_modules/esbuild').transformSync(require('fs').readFileSync('.design-sync/previews/X.tsx','utf8'),{loader:'tsx'})"`
- **Playwright cache on macOS lives at `~/Library/Caches/ms-playwright/`**, not `~/.cache/ms-playwright/`.
  A cache was already present (chromium-1200); the render check needs the **headless shell** build
  matching the installed playwright (`npx playwright install chromium-headless-shell` → 1243), which
  `npx playwright install chromium` does NOT provide. Checking the wrong path led to an unnecessary
  full chromium download.

### Known render warns (checked and accepted)
- `[FONT_REMOTE]` for DM Sans / JetBrains Mono / IBM Plex Sans Arabic — by design, see the font
  section above.
- `[RENDER_BLANK]` on `CategoryIcon`, `ColorSwatchRow`, `Progress`, `IncomeTypeIcon` and
  `[RENDER_THIN]` on `TransactionRow` were floor-card artefacts of unauthored previews, not
  component faults; they clear as each gets an authored preview.

## Scope decision: dashboard is deliberately excluded (2026-09-28)

The user is mid-way through a minimalist redesign and told us **the dashboard has not been
refactored yet**. All 13 dashboard components were therefore dropped from `componentSrcMap` —
BudgetRing, BudgetRingNoBudget, CategoryBar, CategoryBarExpenseRows, CategoryBarSpendingBlock,
CategoryIcon, DashboardHero, DashboardHeroMinimal, DashboardNetWorthHero, DashboardPaceBadge,
DashboardStatsRow, KPICard, SectionHeader — taking the synced surface from 59 to **46**.

Rationale: a preview card teaches the design agent what "a Buddget dashboard" looks like, and
these are about to change. Shipping them would bake the pre-refactor look into every design built
from this DS.

`CategoryIcon` is still exported from `.design-sync/entry.tsx` (so it is importable and the
TransactionRow preview can compose it as an expense glyph) but has **no preview card**. That split
is intentional: `entry.tsx` controls bundle exports, `componentSrcMap` controls cards.

**To bring the dashboard back after its refactor:** re-add the names to `componentSrcMap`, re-add
the exports to `entry.tsx`, re-run `npx tsc -p .design-sync/tsconfig.dts.json`, then
`node .design-sync/gen-dts-props.mjs`, then the normal build → validate → capture loop.

## Remote project state at first import (2026-09-28)

`list_files` on the target showed hand-made content this build does NOT produce. It is preserved —
the upload plan deletes ONLY the stub component folders:

- **Deleted:** `components/core/**`, `components/feedback/**`, `components/finance/**`,
  `components/forms/**` — the 10 hand-authored stubs. Eight of them (Badge, Button, BudgetRing,
  Progress, KPICard, MoneyDisplay, Input, Switch) collide by name with real components, so leaving
  them would show duplicate cards, one real and one fake.
- **Preserved:** 15 hand-authored guideline cards (`guidelines/*.card.html`), `tokens/*.css`,
  `SKILL.md`, `assets/**`, `uploads/**`. Our own guidelines output is markdown under
  `guidelines/docs/` + `guidelines/index.md`, so the filenames do not collide.
- `_ds_manifest.json` and `_adherence.oxlintrc.json` are regenerated server-side by the app's
  self-check from the uploaded source — do not hand-maintain them.

## Wave 1 learnings — primitives (Input, Badge, Switch, Tabs, Sheet, Select, Progress, EmptyState, SkeletonList)

All 9 authored and graded good (33 cells). No `cfg.overrides` were needed.

- **Overlays do NOT need `cardMode:"single"`.** `package-capture.mjs` renders one cell per page load
  (`?story=<label>`) at 900×700, so a portalled `position:fixed` Sheet or Select owns its whole cell
  and cannot bleed into neighbours. But they MUST be authored **open** (`defaultOpen`) — closed they
  render nothing at all.
- **A preview can only use utility classes that already appear somewhere in `src/`.** Tailwind scans
  `@source "../src"`, not `.design-sync/previews/`, so a novel class lands in the DOM with no matching
  rule and silently does nothing (cost one iteration: `after:h-0.5` computed to `height: 0`). Reuse an
  existing class or use inline `style`. If a future batch genuinely needs new utilities, add the
  preview dir as a second `@source` in `ds-entry.css` and recompile.
- **The card html renders LIGHT** (`:root` is light, card background `#fff`), so wrappers need
  `1px solid var(--color-brand-border)` to be visible at all.
- `Tabs`, `Sheet` and `Select` have **no call site in `src/`** — they are vendored primitives, so their
  previews are the first canonical compositions rather than ports. Input, Badge, Switch, EmptyState,
  SkeletonList and Progress previews ARE ported from real app code.

### Component faults found while authoring (real, not preview problems)
- **`data-horizontal:` selectors are dead in `tabs.tsx`, `separator.tsx`, `scroll-area.tsx`.** Tailwind
  v4 compiles `data-horizontal:` to `[data-horizontal]`, but the elements carry
  `data-orientation="horizontal"`. Verified: 10 such rules in the compiled CSS, 0 `data-orientation`
  selectors. Tabs never stacks, TabsList loses its 32px height, the `line` underline has zero size,
  Separator gets no size. **`.design-sync/previews/Tabs.tsx` carries a documented `data-horizontal=""`
  shim** so the card renders the component's own CSS — delete the shim when the source is fixed.
  Spawned as a separate task.
- `SheetContent`'s close button asks for Button `size="icon-sm"`, which is not a real size
  (`default | xs | sm | lg | icon`) — latent mismatch in `sheet.tsx`.
- `Progress` advertises `value={null}` as indeterminate but defines no animation for it; `ProgressValue`
  prints the raw value, not a percentage of `max`. Both now stated in the `cfg.dtsPropsFor` contract
  rather than papered over.
- `Badge` has no green variant — the app fakes "received/linked" pills with `variant="secondary"` plus
  brand-green tokens. If that is a real pattern it belongs in the variant set.
- Base UI `Select` needs an `items` map for `SelectValue` to show labels, and its default
  `alignItemWithTrigger` overlays the trigger. Both added to the `Select` contract.

### Non-static states skipped (cannot be captured)
Hover fills, `focus-visible` rings, sheet open/close transitions, `SkeletonList`'s `animate-pulse`.

## Re-sync risks — read this first on the next run

1. **The `Tabs` preview carries a shim that MUST be removed once the source is fixed.**
   `.design-sync/previews/Tabs.tsx` passes `data-horizontal=""` to compensate for the dead
   `data-horizontal:` selectors in `tabs.tsx` / `separator.tsx` / `scroll-area.tsx` (see the wave-1
   section above). A separate session was fixing those three files in its own worktree on
   2026-09-28. **Check whether that landed**: if `src/components/ui/tabs.tsx` now uses
   `data-[orientation=horizontal]:`, delete the shim and its comment block from the preview and
   re-run preview-rebuild + capture for `Tabs`. Left in place after the fix, the shim is harmless but
   misleading; left in place while the bug survives, it is the only reason that card renders.
2. **`.design-sync/compiled.css` is generated and easy to forget.** It is `cfg.cssEntry` and IS
   committed, but it goes stale the moment any component's classes change. Recompile every re-sync —
   the Tailwind CLI lives in the gitignored `.ds-sync/node_modules`, so on a fresh clone reinstall it
   first. Command is in the build-findings section above.
3. **`ds-types/` must be regenerated before the build** or `.d.ts` contracts silently revert to
   `[key: string]: unknown` stubs: `npx tsc -p .design-sync/tsconfig.dts.json`, then
   `node .design-sync/gen-dts-props.mjs`. The generator never overwrites hand-written
   `cfg.dtsPropsFor` entries, so the 18 hand-authored primitive contracts survive.
4. **18 `dtsPropsFor` entries are hand-written and will rot.** They describe Base UI primitives whose
   props were not extractable. If Base UI is upgraded, re-check them against the emitted declarations
   in `ds-types/components/ui/`. The ones carrying corrections learned from renders — Button/Badge
   variant semantics, `Select.items`, `Progress`'s non-existent indeterminate state — matter most:
   they are not mechanical restatements of the types and a regeneration would lose them.
5. **The dashboard is excluded on purpose** (see the scope-decision section). Re-including it is a
   deliberate act after its redesign, not an oversight to "fix".
6. **Fonts load from Google Fonts at runtime**, so previews depend on network access at render time.
   `[FONT_REMOTE]` is the expected, accepted warn.

## Wave 2 learnings — income + inputs (IncomeTypeIcon, AccountChip, PaydayTimeline, IncomeTypeChipSlider, SwipeToDelete, MoneyDisplay, AmountField, NumberPad, MonthYearPicker)

All 9 authored and graded good (38 cells).

- **The capture shell renders the DS LIGHT theme** (`--color-brand-card` is near-white). Anything the
  app paints as dark glass (the income hero, RecurringIncomeCard, AccountChip's `paymentLine` slot)
  must carry an explicit dark wrapper in its preview, or it renders as dark-on-white and reads wrong.
- **`NumberPad` is `position: fixed; inset: 0`** and escapes its card unless wrapped in a frame with
  `transform: translateZ(0)` (which makes the frame the containing block). Any future full-screen
  overlay component needs the same treatment.
- **`incomeTypeColors`, `GLASS_CARD` and `heroCardStyle` are now exported from `entry.tsx`** (no
  preview cards — they are not components). They are the canonical accent/tint pair and glass surface
  for the income surfaces; four wave-2 previews had to re-hardcode the accents before this. Prefer
  them over literal hex in any new preview or design.
- **`MoneyDisplay` reads the store, not only its props** — `settings.baseCurrency` (default `EGP`,
  from `src/lib/store/defaultFinanceData.ts:45`) and `settings.showSecondaryCurrency`. Outside the app
  the store is empty, so it always formats in EGP and `variant="card"`'s secondary-currency line is
  unreachable. Now stated in its `cfg.dtsPropsFor` contract.
- Two cells needed a second pass and are worth remembering as authoring traps: a selected chip that
  sat outside the visible scroll area read as unselected (widen the card until the variant axis is
  actually visible), and a bare `NumberPad` left half the frame empty (compose it with the field it
  drives).

### Non-static states skipped
The SwipeToDelete drag, MonthYearPicker's Popover month grid (no prop opens it), AmountField's
open-pad caret/focus border, NumberPad's hold-backspace and `:active` key highlight, and
IncomeTypeChipSlider's horizontal scroll position.

## Known render warns (triaged and accepted — a warn NOT on this list is new, look at it)

- `[FONT_REMOTE]` for DM Sans / JetBrains Mono / IBM Plex Sans Arabic — by design.
- `[RENDER_THIN] Sheet` — `cfg.overrides.Sheet = {cardMode:"single", primaryStory:"BottomSheet"}`, so
  only one story renders and the "multiple variants" heuristic has nothing to compare. The card itself
  is correct (a full open bottom sheet with amount/destination/note and the red CTA).
  **Why the override exists:** the per-cell `?story=` captures used for grading looked fine, but the
  COMBINED card — which is what a human browses in the DS pane — stacked three `position:fixed`
  portalled sheets on one page and was unreadable. Grading per-cell is not evidence that the card is
  good; look at `_screenshots/<group>__<Name>.png` (the combined card), not only
  `_screenshots/review/`. `Select` was checked the same way and needed NO override — its popups anchor
  to their own triggers and sit side by side.
- 18 components ship the typographic floor card (unauthored previews, not failures):
  ExpenseFilters, CardActionMenu, CountrySelect, CurrencySheet, Dialog, DropdownMenu, Label,
  OfflineBanner, Popover, ScrollArea, Separator, Tooltip, UnifiedDatePicker, UpdateToast,
  IncomePaydayGrid, IncomeSourceTypePicker, IncomeTemplatePicker, RecurringIncomeCarousel.
  These are the standing offer for incremental authoring on any later re-sync.

## Authoring trap that cost three iterations (ColorSwatchRow) — worth remembering

A preview cell can be "rendering correctly" and still be worthless because the variant axis is
invisible:
1. The control marks selection with a WHITE ring and sits on a white capture background → invisible.
   It needs an explicit dark wrapper (it lives in a dark sheet in the app).
2. The `value` hexes must be **real members of the palette** (`CARD_COLORS` in
   `src/lib/payment/paymentMethodDefaults.ts`) or nothing is ever ringed and every cell looks the same.
3. The row scrolls horizontally: a selected swatch past roughly the 8th entry is off-frame, so the
   cell is indistinguishable from the unselected one. Keep the demonstrated selection in view.
The general rule: after capturing, ask "can I tell these cells apart?" — not just "did it render?".
