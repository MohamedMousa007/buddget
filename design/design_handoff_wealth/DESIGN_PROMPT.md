# Design Brief — Buddget "Wealth"

**Merging the Savings and Investment pages into one.**
Companion to `design/design_handoff_flow/DESIGN_PROMPT.md` (Flow + Paydays) and
`design/IA_MASTER_PLAN.md` (why things live where they do). Same app, same design
system, same component library — read §9 of this brief before drawing anything.

---

## 1. What we are doing

Buddget has `/savings` and `/investment` as two destinations. They are not two
domains. In the data model they are **one entity with a flag**
(`SavingsAccountCategory = 'savings' | 'investment'`), and `/investment` is a 37-line
route whose own code comment says it *"renders the same InvestmentView the savings page
shows"*. The savings page already holds an internal `'savings' | 'investment'` switch.

So this is not really a merge. It is **making one page admit it was always one page**,
and designing the control that was missing.

The merged page is called **Wealth** — `الثروة` in Arabic.
It is bottom-bar slot 3, between the FAB and Debts.

### The one distinction that must survive

Not savings-vs-investment. This:

| | What it is | How it is valued |
|---|---|---|
| **Balance** | a pocket you hold — bank, certificate, wallet, cash vault | a number the user maintains |
| **Position** | a thing you own — gold grams, BTC, shares, m² of property | `quantity × live price` |

A balance is worth what it says. A position is worth what the market says **today**.
Flatten that and the page starts lying. Everything below follows from it.

---

## 2. What the user actually asks this page

In order of frequency:

1. **What am I worth?** — one number, trustworthy
2. **Where is it?** — the split across pockets and holdings
3. **Is my gold/crypto up or down?** — and *as of when*
4. **Am I covered if something goes wrong?** — emergency fund
5. **Do I owe zakat?** — and on what base
6. **What did I move recently?** — the deposit/withdrawal ledger

Design the hierarchy in that order. If an element does not serve one of those six,
it is decoration.

---

## 3. Structure

### 3.1 Hero — one number

Total wealth = pockets + holdings at live value. Secondary line: change since last
month. Keep the existing hero's information but apply §9b of the Flow brief — simpler,
more informative, fewer numbers.

**Two states you must design:**
- **Complete** — every holding has a fresh price
- **Incomplete** — one or more prices are stale or missing, so the total is an
  estimate and must say so. The store already carries `netWorthIncomplete`; today
  that state is under-expressed. It should be quiet but unmistakable.

### 3.2 Segment — All / Cash / Invested

A `SegmentedControl` directly under the hero. Same component and placement as Flow's
direction segment, so the pattern repeats across the app rather than being learned twice.

- **All** — everything, in one list
- **Cash** — balances only (`category: 'savings'`)
- **Invested** — positions only (holdings) + investment-category accounts

The hero total does **not** change with the segment; the segment filters the list
below. Changing the hero on a filter is how people lose trust in the number.

### 3.3 The list — one row type, two payloads

This is the core of the design. One visual row, two kinds of content:

**A balance row:** icon chip (pocket colour) · name · sub-line (bank · last-4 ·
maturity) · **balance**.

**A position row:** icon chip (asset colour) · name · sub-line **`quantity × unit
price`** · **value** + a delta chip (▲2.4%) + **price age**.

Draw them adjacent in the All segment and prove they read as one list while still
being obviously different kinds of thing. The delta chip and the price age are what
make a position legible; do not let them look like decoration on a balance.

### 3.4 Live rates — the freshness rule

Gold and crypto are priced from a live source (`useAssetPricesStore`,
`/api/prices/refresh`). This app has already shipped a bug where prices went **80
hours stale** and the UI showed them as fact.

**Never show a market number without its age.** Design three states:

1. **Fresh** — "as of 14:02" — quiet, in the row's sub-line
2. **Stale** — visibly degraded, and the hero flips to its estimate state
3. **Unavailable** — the position still shows its quantity (you still own 40g of gold
   even when the price API is down). Never blank the row; never show 0.

A refresh affordance is required. Pull-to-refresh plus an explicit control in the
Invested segment header — a stale price must be fixable without the user guessing.

Freshness is not an edge case here. It is the feature that makes the number worth
trusting, and it is a differentiator.

### 3.5 Emergency fund and Zakat

Both stay. They are cross-asset summaries, not list items, and they are genuinely
differentiating — zakat especially.

- **Emergency fund** — months covered vs target, with the set-up state when there is
  no spending data yet to size a month
- **Zakat** — due / not due, the zakatable base, the hawl date

Place them so they do not compete with the list for the top of the page, and so that
neither disappears when a segment is active — they describe the whole, not the filter.

### 3.6 Activity ledger

Deposits, withdrawals and transfers. Keep it, filtered by the active segment. It
answers question 6 and nothing else does.

### 3.7 Goals appear here, but do not live here

Goals that link to a savings account surface **on the pocket** — "feeds New car ·
62%". Design that inline treatment.

Do **not** design a Goals section, tab or hub on this page. Goals also link to debts
and to spending limits; the full list lives at `/goals` off the profile dropdown. See
`IA_MASTER_PLAN.md`. A goal appears here only where it is attached to something here.

---

## 4. Must-keep — do not lose these in the merge

Everything below exists today and must survive:

- Pockets: create, edit, delete, colour, icon, linked payment method
- The **Monthly Savings vault** — the carry destination, never deletable
- Add to savings · Withdraw, including the withdraw flows that pay down a debt or
  fund an investment
- Recurring savings deposits
- Holdings: gold (with karat and the entered unit — grams/pounds/ounces), crypto,
  stocks, property (with share % and rented-out)
- Emergency fund sizing and its target-months control
- Zakat calculation, including the manual-amount override
- Multi-currency with FX sub-lines; base-currency totals
- The activity ledger
- Empty states for: no pockets, no holdings, neither

---

## 5. Known traps — design around these, do not inherit them

1. **`netWorthIncomplete` is under-expressed.** The flag exists; the UI barely says
   it. When any price is stale or missing, the hero total is an estimate and must read
   as one.
2. **Gold has a unit problem.** `quantity` is always grams, but the user may have
   entered pounds or ounces (`goldUnit`), and `karatUnconfirmed` marks a backfilled row
   assumed 24k. Show what they entered, value what you stored, and design the prompt
   that asks an unconfirmed row to confirm its karat.
3. **Property is user-valued.** `propertyValue` is typed by the user and the area
   estimate must never override it. Design it so it is obvious which number is theirs.
4. **A pocket can be linked to a real payment method.** Do not let the same money read
   as two things.
5. **The two routes are being collapsed.** Anyone deep-linking `/savings` or
   `/investment` must land somewhere sensible — design the Invested segment as
   directly addressable.

---

## 6. Navigation

Wealth is bottom-bar slot 3. Design the tab icon, active and inactive. It replaces
**two** existing entries (Savings in the More sheet, Investment in the More sheet),
so the More sheet loses both.

The header, the profile placement and the menu structure do not change.

---

## 7. Design system — non-negotiable

Read §9 of `design/design_handoff_flow/DESIGN_PROMPT.md` in full. It applies here
unchanged: tokens only, teal is every primary action, red is destructive-only,
48px controls, no tap target under 44×44, `font-mono-numbers` on every amount, logical
properties for Arabic, light **and** dark.

### Build it from these components

The app has a unified component library and a test that **fails the build** when a raw
`<button>` re-declares a fill, border, radius or its own size. If your design needs a
control that is not here, say so in the handoff instead of drawing a one-off.

| You need | Component |
|---|---|
| The All/Cash/Invested switch | `SegmentedControl` |
| A text action | `Button` (`touch` 44px · `cta` 48px · `cta-block`) |
| An icon-only action | `IconButton` (44px hit area at every size) |
| A filter chip | `OptionChip` (`surface="elevated"` inside a sheet) |
| A pocket / holding / asset-type choice | `SelectableCard` |
| An asset-type tile | `AccentTile` |
| A trigger shaped like an input | `FieldButton` |
| A tap-to-dismiss backdrop | `Scrim` |
| A money figure | `MoneyDisplay` · `AmountField` |
| A KPI tile | `StatTile` |
| A ⋮ card menu | `CardActionMenu` |
| A colour picker | `ColorSwatchRow` |

Two rules designs keep getting wrong:

1. **Sheets are `--color-brand-card`.** A card-filled chip inside a sheet is white on
   white. Chips and cards inside sheets use the elevated fill.
2. **One action, one variant.** Chosen by what the action *is*: primary → `default` ·
   Cancel / secondary → `outline` · delete or discard → `destructive` · the
   irreversible commit → `destructive-solid` · money received → `success` · inline
   text action → `link`.

**Selection is never colour alone** — a chosen chip or card changes fill **and** border.

---

## 8. Deliverables

1. **Screens** (dark + light, 390×844):
   - Wealth / All — hero expanded, balances and positions interleaved
   - Wealth / All — scrolled, compact sticky hero
   - Wealth / Cash
   - Wealth / Invested — with a delta, and with one stale price
   - Wealth — the incomplete-total hero state
   - Wealth — empty (no pockets, no holdings)
   - Emergency fund sheet · Zakat sheet
   - A pocket with a linked goal
2. **Row anatomy**: balance row and position row, annotated, side by side, showing
   exactly what differs and what does not.
3. **The three price states**: fresh, stale, unavailable — in situ, not as a legend.
4. **The Wealth tab icon** SVG, active and inactive, in the bar.
5. **Annotated spec**: tokens per surface, px sizes, sticky-hero threshold, tap
   targets, RTL notes, motion for segment change and hero collapse.
6. **One self-contained HTML prototype** on the real CSS custom properties, with the
   segment and the hero collapse working.
7. **Component ledger**: every control in the design → the library component it is
   built from. Anything that maps to nothing, justify.
8. **Migration note**: which existing components survive unchanged
   (`SavingsHero`, `PocketsCarousel`, `EmergencyFundCard`, `ZakatCard`,
   `InvestmentView`, `ActivityLedger`, `SavingsAccountIcon`), which gain a prop,
   which are new.

---

## 9. Do not

- Keep two pages, two tabs, or a "go to investments" link.
- Change the hero total when the segment changes.
- Show a market value without its age.
- Blank a holding when its price is unavailable — the quantity is still true.
- Give Goals a section, tab or hub on this page.
- Put a card-filled chip inside a sheet.
- Design a selected state that differs only by hue.
- Invent accent colours, radii or font sizes outside the system.
- Use `--color-brand-primary` as a text colour — it fails contrast. Use `-ink`.
- Use red for anything that is not destructive or an alert. A falling asset is **not**
  destructive; use the ▼ delta treatment, not the destructive token.
- Use a pig for savings. Ever. The savings glyph is Lucide `Coins`.
- Change the header contents, profile placement or menu structure.

---

## 10. Acceptance test

Answer each in one line in the handoff:

1. What am I worth, and how do I know that number is current?
2. My gold is 40g — where do I see the grams, the price per gram, and when it was priced?
3. The price API has been down for two days. What does the hero say, what does the gold row say, and how do I fix it?
4. How many taps from opening the app to adding 500 to a pocket?
5. I have pockets but no investments — what does Invested look like, and does the page still feel whole?
6. Which of my pockets is feeding my "New car" goal?
7. Am I covered for three months, and where did that number come from?
8. Do I owe zakat, and on what base?
9. I entered my gold in ounces — what do I see?
10. Name every control on the page and the library component it is built from.
