# Components — decision ledger and props

Every control in the screenshots maps to a row here. Paths are under `src/components/` unless shown otherwise.

| Component | Decision | Why | Change |
|---|---|---|---|
| **Wealth page**<br>`src/app/wealth/page.tsx` | Edit | The merge is structural today: a Savings/Investment SegmentedControl switches between two pages. | Remove view state, the segment and InvestmentView. One scroll: SavingsHero → actions → GoldPriceStrip → WealthStatusTiles (or ZakatBasisPrompt) → WealthList with category chips → ActivityLedger. |
| **SavingsHero**<br>`savings-v3/SavingsHero.tsx` | Edit | One number, equal height for every user, and no live status. | Props: total, netWorth, netWorthTrend {points, pct, dir}, split (by kind for pockets-only, by pricing otherwise), investReturn on the market segment, savingsRate, badges slot, compact. The state chip and refresh leave the hero; ≈ / At least stay on the total. |
| **GoldPriceStrip**<br>`savings-v3/GoldPriceStrip.tsx` | New | One ~76px bar with a symmetric expanded row, and the page’s freshness status. | Card-surface grid + IconButtons. Labels in --color-brand-gold. Age row starts with a status pill: Live (green-soft) / 2 days old (amber-soft) / Offline (amber-soft), then the source and time. |
| **GoldMarketCard**<br>`savings-v3/InvestmentView.tsx` | Replace | Pound tile, sparkline and “your X g ≈” line are cut; the gap maths moves. | Move the ounceUsd / sagha / officialUsdEgp gap computation into GoldPriceStrip’s view-model. Deleted with InvestmentView. |
| **InvestmentView**<br>`savings-v3/InvestmentView.tsx` | Replace | Opens on four asset tabs whether you own them or not. | Holdings render in WealthList. Only imported by wealth/page.tsx; delete after extraction. |
| **PocketsCarousel**<br>`savings-v3/PocketsCarousel.tsx` | Replace | A carousel hides every pocket after the first. | WealthList. Move PocketVM to savings-v3/types.ts first (the add and withdraw sheets import it). |
| **PocketCard**<br>`savings-v3/PocketCard.tsx` | Replace | Twenty pockets would be twenty cards. | A TransactionRow in WealthList; actions move to the hero and the row menu. |
| **WealthList**<br>`savings-v3/WealthList.tsx` | New | Nothing lists balances and positions together with type headers and a category filter. | TransactionRow rows + OptionChip category chips (filled categories only, each with a count). Filter state is shared with ActivityLedger. The header holds the one Add button. |
| **TransactionRow**<br>`transactions/TransactionRow` | Reuse | Chip, title, subtitle, amount and a sub-line: exactly a balance or position row. | None. |
| **ActivityLedger**<br>`savings-v3/ActivityLedger.tsx` | Edit | Keep the ledger, compact, following the filter. | limit (3), category filter, “See all” link Button; title gains “· Gold” when filtered. |
| **WealthHeroBadges**<br>`savings-v3/WealthHeroBadges.tsx` | New | Emergency fund and zakat are status: a badge, not a block. | Button variant="secondary" size="sm" pills (28px visible, 44px hit area) in the hero’s top row. Emergency fund: shield filled green with check (secured), amber with ! and months (needs money), red with + and Set up (not set up). Zakat: moon + amount · due date, only when due. Each opens its sheet. |
| **EmergencyFundCard**<br>`savings-v3/EmergencyFundCard.tsx` | Replace | The card becomes a badge. | WealthHeroBadges + the details sheet. The inline set-up card in page.tsx goes too. |
| **EmergencyFundSheet**<br>`savings-v3/EmergencyFundSheet.tsx` | Edit | Needs a details view, and its category lines need icons. | Split into Details (status, Progress, four lines, Edit / Add money) and Set up / Edit (keep the months stepper with IconButton outlined, a simple month as OptionChips with CategoryIcon + amount, own figure AmountField, Estimate with AI, needed total). Replace the raw #7EAEF9 / #FF6B6B colours with tokens. Cover stays “all savings pockets”, as the code does today. |
| **PocketFormSheet**<br>`savings-v3/PocketFormSheet.tsx` | Edit | “Counts as cover” Switch hides cover in another sheet; Edit now also corrects the balance. | Remove the isEmergencyCover Switch. Keep the balance field editable (Correct balance is cut). Hosts the monthly repeat, only for the vault. |
| **ZakatCard**<br>`savings-v3/ZakatCard.tsx` | Replace | A card for something due once a year. | The zakat badge in WealthHeroBadges + ZakatBasisPrompt. |
| **ZakatBasisPrompt**<br>`savings-v3/ZakatBasisPrompt.tsx` | New | The basis must be asked once, with the hadith, and fall back to gold. | A BannerStack drop-down card (the Flow prompt pattern): moon icon, title, one line of context, hadith + source + jurists’ principle, SegmentedControl Silver | Gold that confirms on tap, IconButton ✕ that keeps gold. Disappears on either. |
| **ZakatSheet**<br>`savings-v3/ZakatSheet.tsx` | Edit | Basis is a paragraph; silver estimate is buried. | Basis SegmentedControl first; estimate note beside it; year start FieldButton + OptionChips; override Switch. Rules untouched. |
| **AddSavingsSheetV3**<br>`savings-v3/AddSavingsSheetV3.tsx` | Edit | Old pocket picker, quick amounts, repeat, and non-default fields. | Pocket SelectableCards; AmountField (default glass style) + CurrencyField compact side by side; source SegmentedControl + one-line tip; CTA names pocket and amount. |
| **WithdrawSheetV3**<br>`savings-v3/WithdrawSheetV3.tsx` | Edit | Same inputs as Add money should look the same. | From = the same pocket cards; same amount row; five SelectableCard purposes; debt FieldButton. |
| **AddHoldingSheet**<br>`savings-v3/AddHoldingSheet.tsx` | New | One + for everything needs one sheet. | SegmentedControl “Savings pocket | Investment”. Pocket: linked payment methods (already linked disabled) + four kinds → PocketFormSheet. Investment: four SelectableCard tiles → AssetFormSheet, plus the Gold prices on Wealth Switch. |
| **NewPocketSheet**<br>`savings-v3/NewPocketSheet.tsx` | Replace | Merged. | AddHoldingSheet, Pocket tab. Delete. |
| **AddInvestmentSheet**<br>`savings-v3/AddInvestmentSheet.tsx` | Replace | Merged. | AddHoldingSheet, Investment tab. Delete. |
| **AssetFormSheet**<br>`savings-v3/AssetFormSheet.tsx` | Edit | Local UnitInput, SourceChip and ChipRow re-implement library parts; hex ACCENT colours; “Where it is” is not needed. | Remove the location field and its state (stop writing location; keep the type field for old data). UnitInput → AmountField with a unit suffix; SourceChip → SelectableCard rows with icon and one line (This month / Already had it); ChipRow → SegmentedControl for Counted as; PriceCard stays on SelectableCard. ACCENT → --color-brand-gold / cat tokens. This month requires what you paid; Already had it makes date and price optional. |
| **V3SheetHeader**<br>`savings-v3/V3SheetHeader.tsx` | Reuse | The shared header. | None. |
| **UpdateBalanceSheet**<br>`features/savings/UpdateBalanceSheet.tsx` | Replace | Correct balance is cut; Edit changes the balance. | Not opened from Wealth. Delete if grep finds no other importer. |
| **EditSavingsAccountSheet**<br>`components/modals/EditSavingsAccountSheet.tsx` | Replace | Two edit sheets for one pocket. | PocketFormSheet in edit mode. Delete if unused elsewhere. |
| **CardActionMenu**<br>`ui/CardActionMenu.tsx` | Edit | Too wide and tall for four actions. | CardMenuItem gains disabled? and hint?; menu 216px wide, 44px rows, 10px icon gap, no hint on ordinary items. |
| **SegmentedControl**<br>`ui/SegmentedControl.tsx` | Reuse | Two to four exclusive options. | Add to Wealth bar, nisab basis, karat, unit, target months, money source. |
| **OptionChip**<br>`ui/OptionChip.tsx` | Reuse | Filters and fast picks. | Category filter, karat confirm, where kept, essentials categories, zakat year presets. |
| **SelectableCard**<br>`ui/SelectableCard.tsx` | Reuse | Choices and tappable summaries. | Pocket pick, withdraw purpose, holding kinds, cover pockets, status tiles. |
| **Button**<br>`ui/button.tsx` | Reuse | One action, one variant. | Add money default cta · Withdraw outline cta · Add pocket or asset secondary touch · Silver default / Gold outline touch · See all link · sheet CTAs. |
| **IconButton**<br>`ui/IconButton.tsx` | Reuse | Icon-only actions with 44px hit area. | Strip refresh / hide / expand, hero refresh, sheet close, profile (context). |
| **AmountField**<br>`ui/AmountField.tsx` | Edit | Every money field uses it; 52px glass is heavy in dense sheets. | Add size?: "default" | "compact" (44px, 20px mono value). Use the default everywhere in Wealth sheets; compact where two fields share a row. |
| **CurrencyField**<br>`ui/CurrencyField.tsx` | Edit | The trigger shows a country flag, which reads as a country, not a currency. | Show the currency symbol from CURRENCY_META (E£, $, SAR …) in place of meta.flag; compact trigger 44px tall, about 96px wide; CurrencySheet rows get the symbol too. |
| **FieldButton · Switch · Progress · SkeletonList**<br>`ui/` | Reuse | Library defaults fit. | Debt pick, purchase date, year start · gold prices, override · EF progress · loading. |
| **Status pill**<br>`features/dashboard/BannerStack.tsx (Flow handoff P4)` | Context, unchanged | Price-feed errors are status, not a question. | Reused exactly as in the Flow handoff: amber tint, under the status bar, swipe up to hide. |
| **BottomNav · header · FAB · OfflineBanner**<br>`layout/BottomNav.tsx, …` | Context, unchanged | Out of scope (§0). | Drawn as shipped. Wealth lives under More, which shows active. |

## Props for Edit and New components

### GoldPriceStrip (New)

```ts
interface GoldPriceStripProps {
  karats: { k: 24 | 21 | 18; egpPerGram: string; delta?: Delta }[]
  world: { ounceUsd: string; ounceDelta?: Delta
           gramUsd: string; gramDelta?: Delta
           saghaUsdEgp: string; saghaGapPct: string }   // "+7.6%" vs banks
  freshness: "fresh" | "stale" | "unavailable"
  ageLabel: string
  expanded: boolean; onExpandedChange(v: boolean): void
  onRefresh(): void; onHide(): void
}
// labels: --color-brand-gold · settings.wealthGoldStrip = collapsed | expanded | hidden
```
Used on: Every Wealth phone; section 2.

### WealthList (New)

```ts
interface WealthListProps {
  rows: WealthRowVM[]          // balance | position | selfValued
  groupHeaders: boolean        // All, more than one type
  categories: { key: CatKey; label: string; count: number; color: string }[]
                               // filled only; hidden when fewer than 2
  filter: CatKey | null; onFilter(k: CatKey | null): void
  onRowPress(id: string): void
  onAdd(): void                // opens AddHoldingSheet
}
type CatKey = "bank" | "vault" | "cash" | "certificate" | "wallet"
  | "gold" | "crypto" | "stock" | "property"
```
Used on: 01–04, 03b, 05–10, 22–24.

### SavingsHero (Edit)

```ts
interface SavingsHeroProps {
  total: string; netWorth: string; currency: string
  totalPrefix?: "≈" | "At least"
  split: { label; value; color; ret?: string }[]  // kinds or pricing
  netWorthTrend?: { points: number[]; pct: string; dir: "up" | "down" }
  savingsRate?: string          // "Saving 14% of income"
  badges: React.ReactNode       // WealthHeroBadges
  compact?: boolean
  onAdd(); onWithdraw(); onAddHolding()
}
// trend colour: --color-brand-green up, --color-brand-red down
```
Used on: Every Wealth phone.

### WealthHeroBadges (New)

```ts
interface WealthHeroBadgesProps {
  emergency: { state: "secured" | "needsMoney" | "unset"; months?: string }
  zakat?: { amount: string; due: string }   // only when due
  onOpenEmergency(); onOpenZakat()
}
// secured = cover >= essentials × target; needsMoney = set up, below target
// shield fill: green / amber / red; mark: check / ! / + in --color-brand-card
```
Used on: Every Wealth phone; 18a–c.

### ZakatBasisPrompt (New)

```ts
interface ZakatBasisPromptProps {
  context: "none" | "silverOnly" | "both"   // drives the one-line sub
  silverNisab: string; goldNisab: string
  onPick(basis: "silver" | "gold"): void    // confirms immediately
  onDismiss(): void                           // = onPick("gold")
}
// rendered through BannerStack; shown while no basis was ever chosen
```
Used on: 04, 21, 21b, 25.

### AddHoldingSheet (New)

```ts
interface AddHoldingSheetProps {
  open: boolean; onOpenChange(v: boolean)
  tab: "pocket" | "investment"; onTabChange(t)
  paymentMethods: { id; label; linkedPocket?: string }[]
  showGoldPrices: boolean; onShowGoldPricesChange(v: boolean)
  onPickPocketKind(kind); onPickMethod(id); onPickAsset(type)
}
```
Used on: 14, 15 → 16, 17.

### AmountField · CurrencyField (Edit)

```ts
AmountField { …; size?: "default" | "compact" }   // compact 44px
CurrencyField { …; compact } → trigger shows CURRENCY_META[code].symbol
  (E£, $, SAR) instead of the flag; 44px compact trigger
Row layout in sheets: grid minmax(0,1fr) 108px, gap 10
```
Used on: 12, 13, 16, 17.

### CardActionMenu · ActivityLedger · Add / Withdraw sheets (Edit)

```ts
CardMenuItem { …; disabled?: boolean; hint?: string }
ActivityLedger { …; limit?: number; filter?: CatKey; onSeeAll?() }
AddSavingsSheetV3 / WithdrawSheetV3: pocket list = SelectableCard rows;
  amount = AmountField + currency FieldButton (grid 1fr / 120px,
  as IncomeSheetForm); no quick amounts; no repeat.
```
Used on: 09, 10 · every phone · 12, 13.

## Where this prompt and the code disagree

The code wins on what exists.

- **Bottom-bar slot 3** — bottomNavConfig puts the FAB in slot 3; Wealth is a More-sheet item (Coins). The screens show More active; the tab icon is delivered for later.
- **The segment** — wealth/page.tsx still has a Savings/Investment SegmentedControl, marked temporary. Removed.
- **Emergency cover** — The page defaults cover to all savings pockets; the type says an empty list falls back to isEmergencyCover. The sheet writes an explicit list.
- **Hero binding** — The page binds nw.netWorth. The hero now shows both: what you hold as the big number, net worth after debts beneath it.
- **Emergency cover** — EmergencyFundSheet.save() writes no per-pocket list: cover is all liquid savings. The design follows that; drop coverPocketIds from the v1 proposal.
- **Gold location** — AssetFormSheet writes location from “Where it is”. Remove the field and stop writing it.
- **Gold karats** — GoldKarat is 24 | 22 | 21 | 18. The form offers all four; the strip shows three.
- **Button and Switch sizes** — touch / cta follow the Flow handoff; the bundled d.ts lists default/xs/sm/lg/icon.
- **The hadith** — Sahih al-Bukhari 1459 and Muslim: no zakat on less than five awaq of silver. The preference for silver comes from the jurists’ rule that zakat is valued by what is most beneficial to the poor (al-Quduri), not from the hadith’s wording; some contemporary scholars prefer gold. The copy keeps the two apart and falls back to gold. Have the wording checked.
- **Zakat basis stored** — If ZakatConfig has no field that says the user chose a basis, add nisabBasisChosen so the prompt shows once.

## Migration note

Change files in this order; each step builds.

- **1** — store/types.ts + settings sync: AppSettings.wealthGoldStrip; ZakatConfig basis-chosen flag. lib/prices: priceAgeLabel helper. Investment return since first purchase (from asset cost basis).
- **2** — GoldPriceStrip.tsx; move gap maths out of InvestmentView.
- **3** — savings-v3/types.ts with PocketVM; WealthList.tsx (+ category chips); ActivityLedger filter.
- **4** — SavingsHero; WealthStatusTiles; ZakatBasisPrompt; EmergencyFundSheet and ZakatSheet edits; drop the cover Switch from PocketFormSheet.
- **5** — AddHoldingSheet (from NewPocketSheet + AddInvestmentSheet); AddSavingsSheetV3 and WithdrawSheetV3 edits; CardActionMenu disabled + hint.
- **6** — Rewrite wealth/page.tsx as one scroll.
- **7** — Delete: PocketsCarousel, PocketCard, InvestmentView, EmergencyFundCard, ZakatCard, NewPocketSheet, AddInvestmentSheet, and UpdateBalanceSheet / EditSavingsAccountSheet if grep finds no importer.

## Cut list

- **Gold-pound tile, sparkline, “your X g ≈”** — Strip space; gold pounds stay an entry unit.
- **Strip explanation line and sub-lines** — The +7.6% on the Sagha dollar carries it.
- **Live chip and refresh in the hero** — Freshness lives in the strip and the rows.
- **Status tiles** — Hero badges.
- **“Where it is kept” (gold)** — Not needed; remove from AssetFormSheet and stop writing location.
- **Hero stale/unavailable banner** — Refresh icon + status pill.
- **Emergency fund and zakat cards** — Status tiles.
- **“Add gold, crypto, stocks or property” button** — One Add button.
- **Correct balance** — Edit.
- **Quick amounts, Repeat every month** — Not needed; repeat lives in vault set-up.
- **Hero USD line and pace** — Competes with the total; pace is computed against itself today.
- **“Counts as cover” Switch** — Cover is chosen on the emergency fund.
- **Asset tabs and the segment** — Required by the brief.

## Annotated spec

- **Tokens** — Page --color-brand-bg; cards and sheets --color-brand-card; chips inside sheets --color-brand-elevated; band = Flow’s teal gradient with on-primary text; strip labels --color-brand-gold; ▲ green; ▼ text-secondary; tile states amber-soft / green-soft / primary-soft; status pill amber tint; red only on Delete.
- **Type** — Hero total 34 mono 600; return badge 12 mono 700; net worth line 12.5. Strip labels 11/700 gold, prices 15 mono 600, indicators 10.5 mono 700. Tile label 11.5/600, value 13.5/700.
- **Spacing** — Gutter 16. Strip 76px collapsed, about 122px expanded. Tiles 56px, gap 8, 10 below the strip. Chips row 36px, gap 8, scrolls sideways.
- **Targets** — Buttons 44/48. IconButton sm 32 visible with 44 hit area. Tiles 56. Chips 36 visible, spaced 8.
- **Motion** — Strip expand 200ms ease-out. Filter swaps the list without animation. Status pill enters translateY(−100%) 220ms. Reduced motion: none.
- **RTL** — dir=rtl; logical properties; strip and chips mirror; numbers isolated LTR.
