# Buddget — Savings & Investment (v3 FINAL) · Engineering handoff

**Source of truth:** `prototype/Buddget Savings v3.dc.html` (runnable: open `prototype/Savings-v3-OFFLINE.html`) + the full-size screenshots in `screens/`.
Build every screen to match them **pixel-for-pixel**. Where a number or colour is written here, use exactly that. Where something is not written here, open the DC file and copy it — **do not invent, do not "improve", do not round**.

- **Run the prototype before you start.** It is clickable end to end; sheet heights, press states, scroll-snap and motion are only observable there.
- **`prototype/reference/`** holds the shipped Expenses, Debt, Income, Expense-form and Currency-sheet designs. Every ♻ in this document points into one of those files — open it and lift the component.

- Mobile-first **375 × 812**, dark-first, Capacitor iOS/Android. Sentence case; uppercase only on the 8.5–10px micro-labels. Touch targets ≥ 44 px. Safe-area insets respected. No focus rings (`outline:none; -webkit-tap-highlight-color:transparent`).
- Fonts: **DM Sans** (`--font-sans`) for words, **JetBrains Mono** (`--font-mono`, `font-variant-numeric: tabular-nums`) for **every** number, price, date-code and currency. **IBM Plex Sans Arabic** for Arabic.
- **Shariaa-conscious — non-negotiable:** no interest rate, no APR, no "loan", no riba-adjacent framing anywhere in this tab. Growth is shown as realised/unrealised value change only. Zakat follows the majority (jumhūr) position and is always presented as guidance, never a ruling.
- **Reuse, don't rebuild.** Everything marked ♻ below already exists elsewhere in the app and must be imported, not re-implemented.

---

## 0. Screen map

| # | File | Screen / state |
|---|---|---|
| 01 | `01-savings-overview.png` | Savings page, full scroll, populated |
| 02 | `02-pocket-kebab-menu.png` | Pocket ⋮ menu open |
| 03 | `03-add-savings-picker.png` | **Add savings** — opened from FAB/hero (read-only pocket carousel, nothing selected) |
| 04 | `04-add-savings-from-pocket.png` | **Add savings** — opened from a pocket's Add (locked row) |
| 05 | `05-add-savings-note-open.png` | Add savings, note field opened |
| 06 | `06-withdraw-spending.png` | **Withdraw** — reason: Spending |
| 07 | `07-withdraw-pay-debt.png` | Withdraw — reason: Pay a debt (+ inline debt picker) |
| 08 | `08-withdraw-investment.png` | Withdraw — reason: Investment (+ inline asset picker) |
| 09 | `09-withdraw-move-to-pocket.png` | Withdraw — Move to another pocket branch |
| 10 | `10-new-pocket-source.png` | **New pocket** — payment methods + start from scratch |
| 11 | `11-pocket-form-new.png` | New pocket form — bank account, from scratch |
| 12 | `12-pocket-form-linked-method.png` | New pocket form — linked to an existing payment method |
| 13 | `13-pocket-form-edit.png` | Edit pocket |
| 14 | `14-emergency-fund.png` | **Emergency fund** sheet |
| 15 | `15-zakat-due.png` | **Zakat** sheet — due |
| 16 | `16-zakat-manual-override.png` | Zakat — gold nisab, trading stocks, manual override on |
| 17 | `17-currency-sheet.png` | Currency picker ♻ |
| 18 | `18-activity-filter.png` | Activity filter ♻ |
| 19 | `19-savings-empty.png` | Savings — empty state (no pockets, no activity, no FAB) |
| 20 | `20-zakat-below-nisab.png` | Zakat — below nisab, nothing owed |
| 21 | `21-savings-light-theme.png` | Savings — light theme |
| 22 | `22-activity-swipe-delete.png` | Activity row swiped open ♻ |
| 23 | `23-investment-gold.png` | Investment — Gold (holdings + market) |
| 24 | `24-investment-crypto.png` | Investment — Crypto |
| 25 | `25-investment-stocks.png` | Investment — Stocks |
| 26 | `26-investment-property.png` | Investment — Property |
| 27 | `27-investment-empty.png` | Investment — nothing held (market only) |
| 28 | `28-add-investment-list.png` | **Add investment** — type list |
| 29 | `29-add-gold-form.png` | Add gold |
| 30 | `30-add-crypto-form.png` | Add crypto |
| 31 | `31-add-stock-form.png` | Add stock |
| 32 | `32-add-property-form.png` | Add property |

---

## 1. Tokens (exact)

| Role | Dark | Light |
|---|---|---|
| canvas / page | `#0A0A0F` | `#F5F5F7` |
| card | `#111118` | `#FFFFFF` |
| chip / elevated | `#1A1A24` | `#F0F0F4` |
| border | `#2A2A38` | `#D4D4DC` |
| field | `#16161f` | `#F7F7FA` |
| field border | `#26262f` | `#E2E2E9` |
| track (bars) | `rgba(255,255,255,.08)` | `#E6E6EC` |
| text primary / secondary / muted | `#FFFFFF` / `#CFCFE0` / `#9898B0` | `#1A1A24` / `#5A5A72` / `#8A8AA0` |
| micro-label | `#6E6E85` | `#8A8AA0` |
| tab bar | `rgba(10,10,15,.86)` | `rgba(255,255,255,.9)` |

**Accents.** Brand red `#E50914` — primary CTA, FAB, active nav, active segment, destructive, radio/check fills. Income green `#1DB954` — the **solid** positive button fill (Add). Positive value green `#35D46F` — gains, "in" amounts, tints. Gold `#F5C842` — gold asset, zakat-due, auto badge. Blue `#7EAEF9` — emergency cover, bank pockets, move-between-pockets. Purple `#B79CFF` — crypto, cash pocket. Teal `#2CE0C6` — property, certificates. Amber `#FFB13D` — warnings. Negative `#FF6B6B`.

**Radii:** cards 18–20, sheet top 26, hero 20, pocket card 20, fields/buttons 12–15, chips/pills 999. **Shadows:** red CTA `0 10px 24px -10px rgba(229,9,20,.6)`; green CTA `0 9px 20px -11px rgba(29,185,84,.85)`; hero `0 18px 40px -24px rgba(0,0,0,.85)`; menu `0 20px 40px -14px rgba(0,0,0,.7)`.

**Motion:** sheets `bsUp .3s cubic-bezier(.22,1,.36,1)` (translateY 100%→0); menus `bsPop .14s ease-out` (translateY −6px + scale .97 + fade); segment/pill state `all .14s`; carousel dot width `.2s`.

---

## 2. Two pages, one bridge

Savings and Investment are **separate pages** on the same tab. A user who never invests never sees an investment control on the Savings page. The only door between them is the third hero cell.

### 2.1 Hero (shared skeleton, two skins)

```
padding 16 · radius 20 · margin 0 16px · overflow hidden
shadow 0 18px 40px -24px rgba(0,0,0,.85)
glow: 190×190 radial, top:-60 right:-40, rgba(accent,.20–.22) → transparent 68%
```

| | Savings | Investment |
|---|---|---|
| background | `linear-gradient(152deg,#141b28,#0f1017)` | `linear-gradient(152deg,#1e1a10,#111017)` |
| border | `1px rgba(126,174,249,.18)` | `1px rgba(245,200,66,.2)` |
| label | `NET WORTH` · `#8FA6C7` | `VALUE OF WHAT YOU HOLD` · `#B8A87C` |
| big number | savings + investments | investments only |
| pill | pace vs your own last 3 months | annualised growth |
| cells | Total saved · **This month** · **Investment ›** | Put in · **All time ↗** · Net worth |
| CTA | `Add savings` | `Add investment` |

- Label `600 10px`, uppercase, `.08em`. Number `600 32px` mono, `-0.025em`. `EGP` `500 13px` sans. `≈ $x` `500 12.5px` mono.
- **Pace pill (Savings) — deliberately short**, three states only: `Ahead +9%` (`#35D46F`, ≥ +8%), `On pace` (`#7EAEF9`, between), `Behind −12%` (`#FFB13D`, ≤ −8%), plus `Nothing saved yet` (`#9898B0`) when this month is 0. Pill: `h26 · radius 999 · padding 0 10 · bg rgba(c,.14) · border rgba(c,.3) · 700 11px mono`, 12px trend glyph. Hidden entirely in the empty state.
- Cell strip: `bg rgba(255,255,255,.05)`, `border rgba(255,255,255,.08)`, radius 13. Cell = `flex:1 · padding 10px 11px`, `border-right rgba(255,255,255,.07)` except the last. Label `600 8.5px` uppercase `.07em`; value `600 14.5px` mono.
- `Investment ›` cell has a 10px chevron after the label and navigates to the Investment page. `All time` shows an 11px `#35D46F` trend glyph **before** the value when the figure is positive.
- CTA `h46 · radius 13 · #E50914 · 600 15px`, no icon.

### 2.2 Bottom bar & FAB ♻
App tab bar unchanged. Centre FAB 60px `#E50914`, 3px page-bg ring, bottom 44. **The FAB is hidden whenever the page is empty** — on both pages, whenever the user holds nothing yet — so the empty-state CTA is never blocked. It returns the moment there is a pocket or a holding.

---

## 3. Pockets (Savings)

Header `Pockets` `700 15px` + count chip (`min-w 21 · h20 · radius 999 · chip bg · 600 11px mono`).

**Carousel:** `gap 12 · padding 10px 16px 6px · scroll-snap-type: x mandatory`, each card `scroll-snap-align: center`, width **343**. Page dots under it: 5px, active widens to 16px and turns `#E50914`.

**Card:** radius 20, `padding 15px 16px 14px`, card bg + border, top glow `linear-gradient(160deg, rgba(pocketColour,.13), transparent 78%)` 82px tall.
1. 40px icon tile radius 12 `rgba(colour,.14)` · name `600 15px` (+ `Auto` badge `700 8px` on `rgba(245,200,66,.16)` when the month-end remainder lands here) · sub `500 11.5px` mono = the **account identity** (`CIB · Bank account ••••2016`, `Safe`, `NBE · matures Nov 2027`) · ⋮ button 32px.
2. Balance `600 28px` mono + currency `500 12px`.
3. One 6px bar, three segments in order: **emergency cover** `#7EAEF9`, **committed to goals** pocket colour, remainder = free (track). Under it: `Free 28,432` (`600 11px` mono, left) and the goal line (`500 11px`, right, ellipsised) — one goal name, or `{top goal} + n more`, or `Emergency cover`, or `No goal attached`.
4. Divider, then two buttons, `flex:1 · h42 · radius 12 · 600 13.5px`, **no icons**:
   - **Add** — solid `#1DB954`, white text, `shadow 0 9px 20px -11px rgba(29,185,84,.85)`
   - **Withdraw** — solid `#E50914`, white text, `shadow 0 9px 20px -11px rgba(229,9,20,.85)`
   These are the app's standard confirm/destructive fills. No glass, no tint, no outline variant.

**⋮ menu** (screen 02): absolute `top 44 · right 12`, min-width 186, chip bg, radius 14, `bsPop`. Items: **Edit** · **Send remainder here** (hidden on the pocket that already owns it) · **Delete** (red). Delete lives only here.

**Empty state** (screen 19): dashed 18px-radius block, 46px vault glyph on `rgba(126,174,249,.14)`, "No pockets yet", one line of explanation, red `Create a pocket` button. Activity header, filter bar and swipe hint are all hidden; a single "Nothing here yet" line replaces them; the FAB is suppressed.

---

## 4. Emergency fund

**Card** (`margin 14 16 0 · padding 14 · radius 18`): 36px shield tile `rgba(126,174,249,.14)`, `Emergency fund`, sub `of {n} months · {covered} EGP`, right `{x.x} mo` `600 17px` mono — `#35D46F` at or above target, `#7EAEF9` below — chevron, then a 6px progress bar. If below target, an amber strip appears: *"You've dipped {gap} EGP below your cover. Nothing is blocked — worth topping back up when you can."*

**Sheet** (screen 14): months stepper (1–24, 32px ± buttons), the **simple month** breakdown (rent, food, transport, bills, debt minimums — explicitly *not* the user's full budget), which pockets count as cover (checkbox rows, blue), `Needed for n months`, and a reassurance strip. Cover money is subtracted **before** any goal can claim a pound.

---

## 5. Zakat — new

Sits directly under the emergency fund. **Auto-calculated from data the user already entered.**

### 5.1 The rule implemented
```
zakatable = cash&savings + gold + crypto + (stocks × factor) − debtsDueThisYear     (floored at 0)
factor    = 0.30 when stocks are held long-term   |   1.00 when held for trading
nisab     = 595 g × silver gram price      (default — the lower line)
          | 85 g × 24k gold sell gram price (option)
due       = zakatable ≥ nisab  →  zakat = zakatable × 2.5%
          otherwise            →  nothing owed
```
- **Property principal is never counted** — only rent the user actually kept, which is already inside cash.
- Every input is **user-editable**; an edited row gets a red border and stops tracking the live figure until cleared.
- A master **"Set the amount myself"** switch overrides the final number entirely.
- Hawl (lunar year) date is shown, never enforced silently.

### 5.2 Card (compact, one row + one line)
`margin 12 16 0 · padding 14 · radius 18 · card bg · border 1px rgba(accent,.28)`, radial glow `rgba(accent,.17)` 150px at `top:-46 right:-34`.
36px balance-scales glyph on `rgba(accent,.14)` · title `600 13.5px` · sub `500 11px` mono · amount `600 17px` mono in the accent · chevron · foot line `500 10.5px`.

| | Due | Not due |
|---|---|---|
| accent | `#F5C842` | `#35D46F` |
| title | `Zakat is due` | `No zakat due` |
| sub | `2.5% of {base} EGP` | `Nisab is {nisab} EGP` |
| amount | `{zakat}` | `—` |
| foot | `Above nisab for a full lunar year · due by {date}` | `You are {gap} EGP under the line, so nothing is owed.` |

### 5.3 Sheet (screens 15, 16, 20)
Fixed-shell sheet (header / scrolling body / pinned footer).
1. **Verdict card** — accent-tinted, radius 18: glyph + verdict, amount `600 30px` mono, formula line, progress bar of base ÷ nisab, then `Nisab · {x} EGP` (left) and `Hawl ends {date}` (right).
2. **What counts** — one bordered list, six rows, each `30px` glyph + name + one-line explainer + an **inline editable mono input** (`h36 · radius 11 · chip bg`, 74px, right-aligned). Property is the one fixed row: a dashed `Not counted` pill. Debts row is negative — leading `−` and `#FF6B6B` text. Footer row: `Zakatable wealth` + total on the chip background.
3. **Nisab** — two cards: `Silver · 595 g` / `Gold · 85 g`, each with its EGP value; selected = gold tint + border.
4. **How you hold stocks** — `Long-term / 30% counted` vs `For trading / 100% counted`; selected = green tint.
5. **Set the amount myself** — switch; when on, a red-bordered `h52` amount field appears below.
6. **Explainer** — chip-background strip with a book glyph: *"Zakat is 2.5% of the wealth you have held for one lunar year above nisab. A home you live in and land you rent out are not counted — only the rent you kept. Buddget follows the majority view; check anything unusual with someone you trust."*
7. Footer: `Remind me` (ghost) + `Log zakat payment` (red) — the second becomes `Save` when nothing is due.

---

## 6. Add savings sheet (screens 03–05)

**Shell:** `height: auto`, `max-height 90%`, flex column — header block / scrolling body / pinned footer with the CTA. Grabber 40×4. Title **`Add savings`** (never "Add savings to X"). Right side: `Today` chip ♻ + round X. **No back chevron anywhere in this tab** — X, swipe-down and the OS back gesture are the three ways out.

1. **Amount + Currency** ♻ — the expense/debt pair. Amount `h56 · radius 14`, input `700 24px` mono, placeholder `0.00`, caret `#E50914`. Currency `w104 h56`, `600 15px` mono + chevron, opens the shared currency sheet.
2. **Destination** — two mutually exclusive presentations:
   - **Opened from the FAB or the hero CTA →** label `POCKET`, then **the pocket carousel from the page itself, in read-only form**. Same card: width **339** (exactly the width of the amount field above it), radius 20, `padding 15px 16px 14px`, field bg when unselected / card bg when selected, top glow `linear-gradient(160deg, rgba(colour,.13), transparent 78%)`, 40px icon tile, name + `Auto` badge, account sub, balance `600 26px` mono, the three-segment cover/goal bar, `Free …` and the goal line. **Removed versus the page card:** the ⋮ button and the Add / Withdraw buttons — nothing in this carousel is actionable except selecting it.
     Rail: `gap 12 · padding 2px 0 4px · scroll-snap-type: x mandatory`, each card `scroll-snap-align: start` — **one card per swipe**, identical behaviour to Income and Payment methods. Page dots underneath (5px → 16px active `#E50914`), counting the trailing `New pocket` card.
     Selection: tapping a card drops a **26px `#1DB954` circle with a white check** into the top-right corner where the ⋮ sits on the page card; unselected cards show an empty `1.5px` border ring in the same spot, so the target never moves. Selected card also takes a `rgba(29,185,84,.55)` border + `0 0 0 1px rgba(29,185,84,.2)` ring.
     **Nothing is preselected and the order is never re-sorted.** Until a pocket is tapped the CTA reads `Choose a pocket` and is inert (`chip` bg, `border`, `textMuted`, `cursor:default`). Pinning the selected item first is only done in sheets that open on an existing selection.
     Last card = dashed `New pocket`, same 339 width and 20 radius, `＋` in a 34px ring.
   - **Opened from a pocket's own Add button →** the carousel is **removed**. In its place a single locked row: 34px icon, pocket name, `{account} · {balance} {ccy}`, and a ghost **`Change`** pill that brings the carousel back.
3. **Source** — label is just `SOURCE`. Two **radio cards** in a 2-column grid: 30px glyph top-left, 20px radio circle top-right (1.5px border, 10px red dot when on), name `600 13px`, sub `500 10.5px` mono.
   `This month` → `Leaves {remaining} EGP` (live) · `Already had it` → `Budget untouched`.
4. **Note ♻ — copied verbatim from the expense form.** Closed: a red text link `＋ Add note`, `600 14px`, 14px plus glyph, no chrome. Open: `h46 · radius 12` field, placeholder `What was it for?`, with a 32px X inside the trailing edge that clears and closes it.
5. **CTA:** `Add {amount} to {pocket}` — or the inert `Choose a pocket` while no pocket is selected.

---

## 7. Withdraw sheet (screens 06–09)

**Title is exactly `Withdraw`.** Never "Withdraw from Certificate".

**The sheet height is fixed at 78% of the screen** and never changes as the user picks a reason. Header and CTA are pinned; only the middle scrolls. This is the specific defect this design fixes — selecting a reason must not resize the sheet.

1. Amount + Currency (identical to §6.1).
2. **Pocket row** — same locked row as §6.2, without the Change pill; sub-line = `Free {free} of {balance} EGP`.
3. **`REASON`** — a 2 × 2 grid of horizontal rows (`min-height 62 · radius 15 · gap 9`), 32px glyph tile + name `600 12.5px` + sub `500 10px`. **Exactly four reasons, all of which change downstream data:**

   | Reason | Colour | Sub | Effect | CTA verb |
   |---|---|---|---|---|
   | Spending | `#FF6B6B` cart | Counts as an expense | writes an expense | `Spend` |
   | Pay a debt | `#E50914` card | Lowers what you owe | reduces that debt | `Pay` |
   | Investment | `#F5C842` gem | Buys an asset | creates or tops up a holding | `Invest` |
   | Income | `#35D46F` trend | Back into this month | writes income | `Add as income` |

   Gift/zakat, Emergency, Something else and "To a pocket" are **removed** — they were labels, not logic.
4. **Inline picker** — Pay a debt and Investment unfold a picker in place (`radius 15 · field bg`): prompt `Which debt?` / `Which asset?` then horizontally scrolling option chips (glyph + name + sub).
5. **`or` rule**, then **Move to another pocket** as its own row (blue): 32px move glyph, title, sub that reads `Stays inside your savings` → `Pick a pocket below` → `Going to {pocket}`, and a 22px mark that fills blue with a white check when active. Turning it on clears the reason selection; the pocket chips appear beneath it; the CTA becomes `Move {amount} to {pocket}`.
6. Note ♻ (same component as §6.4). No emergency-cover warning strip — cover is explained on the emergency-fund card and sheet, and a withdrawal is never annotated or blocked.

---

## 8. New pocket & pocket form (screens 10–13)

**New pocket** — "Where does this money actually sit?"
- `FROM YOUR PAYMENT METHODS`: rows of the user's real methods; ones already used as a pocket are dimmed to `.55` with an `ALREADY A POCKET` pill; free ones show a chevron and, when picked, pre-fill and **link** the pocket.
- `OR START FROM SCRATCH`: 2-column grid — Bank account, Mobile wallet, Cash, Certificate, Stablecoin, Something else.

**Pocket form** — title `New {type}` or `Edit pocket`, **no back chevron**. Live preview row at the top (tinted by the chosen colour, `LINKED` pill when it came from a payment method), then type-specific fields (provider chips / last 4 / name / maturity / yearly return / coin / venue), balance + currency, colour swatches, icon picker (custom type only), and two switches: **Also add as a payment method** (bank + wallet only) and **Counts as emergency cover**.

---

## 9. Investment page

### 9.1 Segmented control ♻ — identical to the Debt tab
```
container: margin 16 16 0 · chip bg · 1px border · radius 13 · padding 4 · gap 3
button:    flex 1 · h36 · radius 10 · 600 12px · transition all .14s
active:    background #E50914 · color #fff · shadow 0 4px 12px -6px rgba(229,9,20,.7)
idle:      transparent · color textMuted
```
Four segments only: **Gold · Crypto · Stocks · Property**. **No ownership dots** — what you own is obvious the moment the tab opens.

### 9.2 Your holdings — one card, value → stats → table
```
card: radius 18 · border · overflow hidden
head: padding 15 16 · bg linear-gradient(150deg, rgba(assetColour,.12), transparent 72%)
      label 600 9px uppercase · value 600 26px mono · secondary "≈ $x · y put in" 500 10.5px mono
      right: delta pill h26 · 700 12px mono · green/red tint
stats: 3 cells, border-top, padding 11 12, border-right between
       label 600 8.5px uppercase · value 600 13px mono
table header: padding 12 16 8 · chip bg · border-top
       columns: name flex:1 · qty 66px right · worth 92px right · 28px spacer
rows:  padding 11 16 · border-top
       name 600 13.5px mono · date 500 9.5px mono muted
       qty 500 12.5px mono · worth 600 13.5px mono · foot 600 9.5px mono
       pencil button 28px, opens the matching edit form
footer: full-width red text row "＋ Add more gold / a coin / a position / a property"
```
Foot colour: `+` → `#35D46F`, `−` → `#FF6B6B`, anything else → micro. An unpriceable holding shows `—` in micro plus `Not counted` and is excluded from every total.

| Tab | Columns | Three stats |
|---|---|---|
| Gold | Karat · Grams · Worth | Since you bought · This month · **{karat} right now** |
| Crypto | Coin · Amount · Worth | Since you bought · Last 24 hours · Best holding |
| Stocks | Position · Shares · Worth | Since you bought · Dividends {year} · Priced *n* of *m* |
| Property | Property · Size · Worth | Since you bought · Rent this year · Yearly yield |

**Gold's third stat is live and adaptive** (this replaced the useless "your average cost"):
> Show the live sell price of **24k** if the user owns any 24k. Otherwise fall to the karat they own **the most grams of**, breaking ties by higher purity. Label `{karat} right now`, value `{price} /g`, colour `#F5C842`.

Every row carries **when it was bought** and a pencil, so the whole portfolio is editable from the table — no separate management screen.

### 9.3 Market block
Unchanged from v2 and still shown even when nothing is held (screen 27): Gold today · Egypt (24k headline, buy/sell per karat, global ounce + global gram + the local-vs-global premium, Sagha-rate footnote), Crypto market, EGX 30, Area estimates. When a tab has no holdings the market comes first and a single dashed `Add {type}` button sits beneath it.

---

## 10. Add investment (screens 28–32)

**Type picker ♻ — the Add-debt list pattern, not a grid.** Title `Add investment`, sub `What did you invest in?` `500 13px`. Four rows:
```
row: padding 15 · radius 16 · field bg · 1px field border · gap 14
     icon 46px radius 13 on rgba(colour,.15), 23px glyph
     name 600 15px · sub 500 12px muted · chevron 18px micro
```
Gold · *Bars, coins, jewellery · priced by karat* — Crypto · *Coins and tokens · live price* — Stocks & funds · *EGX, US markets, ETFs* — Real estate · *Flat, land, shop · area estimate*.

**Forms — no back chevron, X only.** Three field kinds:
- **Price cards** (the upgrade over plain chips): horizontally scrolling, `flex:1 · min-width 88 · padding 11 12 · radius 14`, title `700 15px` mono, sub `500 10px` mono **carrying the live number**, selected = `rgba(assetColour,.10)` fill + `rgba(assetColour,.5)` border. Used for **karat**, **coin** and **ticker** so the choice is made with the price in view.
- **Chips** `h36 · radius 999 · 600 12.5px`, selected `rgba(229,9,20,.13)` / `rgba(229,9,20,.45)`.
- **Inputs** `h50 · radius 14 · 600 16px` mono with a muted unit suffix.

| Form | Fields, in order |
|---|---|
| Gold | Karat **cards** (`24k 999 pure · 6,846/g` / `21k 875 pure · 5,990/g` / `18k 750 pure · 5,135/g`) → Counted as (Grams / Gold pounds / Ounces) → How much → Where it is → When you bought it → What you paid · optional |
| Crypto | Coin **cards** with live `$` price (+ Other) → How much (unit = coin) → Held on → When you bought it → Average buy price · optional |
| Stocks | Market chips → Ticker **cards** with last price or `Halted` → Shares → When you bought → Average cost · optional |
| Property | Type chips → Area → Size (m²) → Your share (%) → Rented out → When you bought → What you paid |

Unit maths: **1 gold pound = 8 g**, **1 oz = 31.1035 g**. Gold is valued at the **sell** (what-a-shop-pays-you) price, never the buy price. Crypto converts at the **parallel/Sagha** rate, not the official one. A halted ticker values to `Not priced` and stays out of the total. A property's area estimate **never overrides a number the user typed**.

Every form ends with a tinted **live value card** (label / big mono value / one line of provenance) and a two-button `Where did the money come from?` (This month · Already had it).

---

## 11. Activity ♻
Byte-for-byte the Expenses ledger: 38px funnel button, horizontally scrolling filter chips with an edge fade, day groups with a right-aligned signed total, 54px icon column (40px tile + 9.5px coloured tag), title + `time | meta`, right-aligned mono amount with `≈ USD` beneath, and swipe-left-to-delete (reveal max 110px, commit at 56px). The Savings page shows saved/withdrawn/month-end rows; the Investment page shows invested rows. Zeroes print unsigned.

---

## 12. Rules that must not be broken

1. Two solid button fills only: `#E50914` (primary/destructive) and `#1DB954` (positive). No tinted-glass buttons anywhere in this tab.
2. No back chevron in any sheet. X, swipe-down, OS back.
3. Withdraw sheet height is constant across reason changes.
4. `Add savings` and `Withdraw` are the complete sheet titles.
5. Opening Add from a pocket removes the pocket picker; opening it from the FAB shows it with that pocket first.
6. Only four withdraw reasons, and each one writes to a different ledger.
7. Only four asset types, no dots on the tabs.
8. Every holding row is editable in place and carries its purchase date.
9. Zakat is computed, explained, editable and overridable — and never phrased as a fatwa.
10. Property principal never enters zakat; unpriceable holdings never enter a total.
11. Every number is mono with tabular figures. Every currency amount that isn't EGP shows the `≈ $` line.
12. Nothing in this tab mentions interest, APR or a loan.
