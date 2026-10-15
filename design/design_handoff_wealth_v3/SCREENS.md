# Screens

Each screen is 390×844 (captured at 2×, 780 px wide). Sheets are captured at full length. Light in `screenshots/light/`, dark in `screenshots/dark/` with the same file name.

**Fields in the sheets show the target, not today’s component.** Amount fields show the value in text-primary on the elevated surface (the fixed AmountField in light mode) with any unit at the end; the currency trigger shows the symbol, `E£ EGP`, with no flag (the CurrencyField change).

Sample data: Cairo, 29 Sep 2026, 14:02. Karat prices 24k 6,846 · 21k 5,990 · 18k 5,135 EGP/g. World ounce $4,063.50, gram $130.64, Sagha dollar 52.40 (banks 48.70, +7.6%). Car loan 48,000.

## Gold price strip
`screenshots/gold-strip/1-collapsed.png` … `5-dismissed.png`: each file shows light/dark × 390/375 and light/dark RTL.
- Collapsed ≈ 76 px: three segments (label in `--color-brand-gold` 11/700, ▲ delta 10.5 mono in green, price 15 mono 600), then the age row: status pill (Live · green-soft / 2 days old · amber-soft / Offline · amber-soft), “Sagha rate · as of 14:02”, refresh IconButton, expand chevron.
- Expanded: second row on the same grid, same height: World oz $4,063.50 ▼ 0.3% · World g $130.64 ▼ 0.3% · Sagha $ 52.40 +7.6% (gap over the banks’ rate). Hide (✕) appears only in the expanded age row. Expanded state persists per user.
- Stale: figures ≈ and secondary, deltas hidden, refresh becomes tinted. Unavailable: last known figures + date. Dismissed: renders nothing; Add to Wealth → Investment has the switch that brings it back.

## 3 · The ownership spectrum

Four users, one page.

**Decision:** One scrolling page: hero (total, badges, split bar, net worth trend) → Add money / Withdraw → gold strip with its status → Where it is with category chips and one Add button → recent moves.

### 01 · Pockets only
`light/01-pockets-only.png` · `dark/01-pockets-only.png`

Same hero size as the investment case: a bar split by kind of pocket, net worth with its 30-day trend, and savings rate. Badges top right: emergency fund (amber, 3.1 of 6 months) and zakat due.

### 02 · Pockets + gold
`light/02-pockets-gold.png` · `dark/02-pockets-gold.png`

The return since the first purchase sits right after Market-priced. This user chose silver, so zakat is due: 8,300.

### 03 · Everything
`light/03-everything.png` · `dark/03-everything.png`

Emergency fund secured: a green shield with a check, like a verified badge, no text. Zakat is due on either line.

### 03b · Filtered · Gold
`light/03b-filtered-gold.png` · `dark/03b-filtered-gold.png`

Category chips carry their icon and count; the list and Recent moves follow the filter.

### 04 · Brand new
`light/04-brand-new.png` · `dark/04-brand-new.png`

Hero at zero, same size. Red emergency-fund badge says Set up. The zakat basis prompt drops in once; until the user picks, gold is used.

## 4 · Price states in situ, and scroll

The hero carries no live status. Freshness sits with the prices: the strip’s status pill and each position’s time.

### 05 · Fresh · strip expanded
`light/05-fresh-strip-expanded.png` · `dark/05-fresh-strip-expanded.png`

Status lives with the prices: a green Live pill in the strip, times on every position.

### 06 · Stale
`light/06-stale.png` · `dark/06-stale.png`

Amber “2 days old” pill in the strip, ≈ on figures, refresh in the strip. Net worth trend shown falling in red for reference.

### 07 · Unavailable
`light/07-unavailable.png` · `dark/07-unavailable.png`

Offline pill in the strip, the Flow status pill for the error, “At least” in the hero.

### 08 · Scrolled · sticky hero
`light/08-scrolled-sticky.png` · `dark/08-scrolled-sticky.png`

Past 150px the band collapses to a 52px strip with the total.

## 5 · A pocket’s own actions

Row tap → menu. Four actions; the vault’s Delete stays visible and disabled.

### 09 · Tap a pocket
`light/09-pocket-menu.png` · `dark/09-pocket-menu.png`

Compact menu, 216px wide, 44px rows: Add money, Withdraw, Edit, Delete.

### 10 · The vault’s menu
`light/10-vault-menu.png` · `dark/10-vault-menu.png`

Delete disabled with a one-line reason.

## 6 · The sheet family

Add money and Withdraw share the pocket cards and the app’s amount + currency row. Add to Wealth merges New pocket and Add investment behind one bar.

### 12 · Add money
`light/12-add-money.png` · `dark/12-add-money.png`

AmountField (app default) and CurrencyField (app default, compact) side by side.

### 13 · Withdraw
`light/13-withdraw.png` · `dark/13-withdraw.png`

Same pocket cards and amount row.

### 14 · Add to Wealth · pocket
`light/14-add-to-wealth-pocket.png` · `dark/14-add-to-wealth-pocket.png`

One sheet behind the Add button; the bar switches pocket and investment.

### 15 · Add to Wealth · investment
`light/15-add-to-wealth-investment.png` · `dark/15-add-to-wealth-investment.png`

Four types and the gold-prices switch.

### 16 · Gold · bought this month
`light/16-gold-bought-this-month.png` · `dark/16-gold-bought-this-month.png`

Existing AssetFormSheet parts, restyled: karat price cards, Counted as, amount, live value, then where the money came from. This month asks what you paid and records it as savings. “Where it is kept” is removed.

### 16b · Gold · already had it
`light/16b-gold-already-had.png` · `dark/16b-gold-already-had.png`

Already had it: purchase date and price are optional and only feed the return.

### 17 · Property
`light/17-property.png` · `dark/17-property.png`

Same source choice; defaults to Already had it.

## 7 · Emergency fund badge and sheets

A verification-style badge in the hero. Three states; each opens the details, which lead to edit.

### 18a · Badge · secured
`light/18a-ef-badge-secured.png` · `dark/18a-ef-badge-secured.png`

Green shield with a check. Tap for details.

### 18b · Badge · needs money
`light/18b-ef-badge-needs-money.png` · `dark/18b-ef-badge-needs-money.png`

Set up but nothing saved: amber shield with “!” and 0/6 mo.

### 18c · Badge · not set up
`light/18c-ef-badge-not-set-up.png` · `dark/18c-ef-badge-not-set-up.png`

Red shield with “+” and Set up.

### 19 · Details · building
`light/19-ef-details-building.png` · `dark/19-ef-details-building.png`

Status, progress, the four numbers, Edit and Add money.

### 19b · Details · secured
`light/19b-ef-details-secured.png` · `dark/19b-ef-details-secured.png`

Secured, with how far above target.

### 19c · Details · nothing saved
`light/19c-ef-details-nothing-saved.png` · `dark/19c-ef-details-nothing-saved.png`

Set up with no money yet; Add money is the main action.

### 20 · Set up / edit
`light/20-ef-set-up-edit.png` · `dark/20-ef-set-up-edit.png`

The real sheet’s parts: months stepper, a simple month from categories (now chips with their category icon and amount), your own figure, AI estimate, needed total.

## 8 · Zakat badge and the basis prompt

A badge only when due. A one-time drop-down prompt for the basis; gold until they choose.

### 21 · Basis prompt · existing user
`light/21-zakat-basis-prompt.png` · `dark/21-zakat-basis-prompt.png`

Drops in like the Flow prompts. Tapping Silver or Gold confirms it and the prompt disappears; ✕ keeps gold, the fallback.

### 21b · Basis prompt · new user
`light/21b-zakat-basis-prompt-new.png` · `dark/21b-zakat-basis-prompt-new.png`

Same prompt before anything is due.

### 22 · Zakat sheet
`light/22-zakat-sheet.png` · `dark/22-zakat-sheet.png`

Tap the zakat badge for the details.

## 9 · Arabic RTL

Arabic strings are drafts for review. Sheets stay English in this pass.

### 23 · Pockets only · Arabic
`light/23-rtl-pockets-only.png` · `dark/23-rtl-pockets-only.png`

Badges sit at the start in RTL; numbers stay LTR.

### 24 · Everything · Arabic
`light/24-rtl-everything.png` · `dark/24-rtl-everything.png`

Strip and chips mirror.

### 25 · New user · Arabic
`light/25-rtl-new-user.png` · `dark/25-rtl-new-user.png`

The basis prompt and hadith in Arabic.

## Review changes (v3)

- **Hero** — Same height for every user: the bar splits pockets by kind when nothing is market-priced. Net worth carries a 30-day trend pill (green up, red down). Savings rate on the right, the most asked-for number after net worth in personal-finance research. Return since first purchase sits after Market-priced.
- **Live status** — Removed from the hero. The strip’s age row starts with a Live / 2 days old / Offline pill; positions keep their own time.
- **Emergency fund** — Badge in the hero, like a verified mark: green check, amber !, red +. Details sheet, then edit.
- **Zakat** — Badge only when due (amount · date). Basis prompt drops in once with the hadith; tapping Silver or Gold confirms, ✕ keeps gold.
- **Pocket menu** — Compact; no hint under Edit.
- **Fields** — AmountField and CurrencyField, app defaults. Handoff: currency symbol instead of flag, and a compact size.
- **Gold sheet** — “Where it is kept” removed. Parts from AssetFormSheet, restyled. Money source redesigned as two cards with a line each; each leads to the right follow-up field.
- **Categories** — Chips carry the category icon (CategoryIcon glyph) in a tinted circle and the amount.

## Acceptance

- **1 · Three pockets, no investments** — Total, net worth and +2,500 this month; Add money / Withdraw; gold prices; two status tiles; the pockets with chips; recent moves (01).
- **2 · No gold: can I see its price and hide it?** — Yes, a 76px strip, always. Expand, tap ✕ to hide; Add to Wealth → Investment brings it back.
- **3 · What am I worth, and is it current?** — The hero total and net worth with its trend; the strip’s pill says Live, 2 days old or Offline, and each position shows its time.
- **4 · 40 g: grams, price, when?** — Gold row: “40 g × 5,990”, 239,600, “▲ 0.6% · 14:02”.
- **5 · API down two days** — Status pill: “Gold prices unavailable · 40 g not counted”. Hero: At least … · Incomplete + refresh. Row: “40 g · Not priced · 27 Sep”.
- **6 · Taps to 500 in a pocket** — Add money → type 500 → Add (Main preselected).
- **7 · Entered in ounces** — “0.5 oz · 15.55 g × 6,846”.
- **8 · Which pocket feeds “New car”?** — Main account’s sub-line.
- **9 · Covered for three months?** — The hero badge: amber shield, 3.1/6 mo. Tap for the details; Edit for essentials and months.
- **10 · Do I owe zakat, on what base?** — The zakat badge shows 2,310 · 8 Feb; the sheet shows the base and the line.
- **11 · Every control and its component** — See the ledger.
- **12 · What was cut** — See the cut list.
- **13 · First thing I see and can do** — What I hold and net worth; Add money right under it.
- **14 · Where does “months covered” come from?** — Cover ÷ essentials, in the sheet behind the tile.
- **15 · Why this threshold, is it an estimate?** — Silver ≈ 47,900 (gold ÷ 85, an estimate), said in the prompt and the sheet.
- **15b · Never set my zakat year or basis** — No basis: the prompt asks once; ✕ or no answer means gold. No year: the badge says “no date”.
- **16 · What we did that you didn’t ask for** — Category filter drives Recent moves too; disabled already-linked accounts in Add to Wealth.
- **Q2 (strip) · I own no gold** — 24k / 21k / 18k per gram with the time in a 76px bar; hide from the expanded row.
- **New · How much more does Egyptian gold cost, and why?** — The expanded strip: Sagha dollar 52.40, +7.6%. Gold here is priced at a dollar 7.6% above the banks’ rate, so it costs about that much more than the world gram.
