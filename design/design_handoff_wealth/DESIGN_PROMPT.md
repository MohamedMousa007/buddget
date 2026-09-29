# Design Brief — Buddget "Wealth"

**One page. Not two pages behind a switch.**

Savings and Investment are being merged into a single destination called **Wealth**
(`الثروة`), bottom-bar slot 3. Companion to
`design/design_handoff_flow/DESIGN_PROMPT.md` (Flow + Paydays) and
`design/IA_MASTER_PLAN.md` (why things live where they do).

---

## 1. The actual design problem

This is not "put two pages side by side". The hard part is that **users sit on a
spectrum of ownership**, and the page must feel complete at every point on it:

| Who | Has | Today they see |
|---|---|---|
| Most users | a few pockets, nothing else | a whole Investment page of empty tabs |
| Very common (Egypt) | pockets + some gold | two destinations for one question |
| Minority | pockets + gold + crypto/stocks/property | the only case today's design fits |

Today the Investment page opens on **four asset tabs — Gold, Crypto, Stocks,
Property** — regardless of whether you own any of them. For the majority of users
that is four empty rooms. **Design the page so that what you do not own costs no
space**, without making the page feel thin for the person who owns only pockets.

So: **no top-level tabs, no Savings/Invested segment.** One scrolling page whose
sections appear because you have something in them.

---

## 2. What the user asks this page, in order of frequency

1. **What am I worth?** — one number, trustworthy
2. **Where is it?** — the split across pockets and holdings
3. **What is gold doing today?** — see §4, this is its own answer
4. **Am I covered if something goes wrong?** — emergency fund
5. **Do I owe zakat?** — and on what base
6. **What did I move recently?**

If an element does not serve one of those six, cut it.

---

## 3. The one distinction that must survive the merge

Not savings-vs-investment. This:

| | What it is | Valued by |
|---|---|---|
| **Balance** | a pocket you hold — bank, certificate, wallet, cash vault | a number the user maintains |
| **Position** | a thing you own — gold grams, BTC, shares, m² | `quantity × live price` |

A balance is worth what it says. A position is worth what the market says **today**.
Flatten that and the page starts lying.

---

## 4. Progressive disclosure — the section rules

This table is the core of the brief. Design every row, including its absent state.

| Section | Shows when | If absent |
|---|---|---|
| **Hero — total wealth** | always | — |
| **Pockets** | always | empty state: one CTA, warm, not a dashboard of zeros |
| **Gold market** | **always** — see below | — |
| **Holdings, grouped by type** | only for types the user actually owns | the group does not exist. No empty tab, no "0 holdings" row. |
| **Add an investment** | always | one quiet affordance, not four |
| **Emergency fund** | always | when unsized, a set-up prompt (it is a safety net — never invisible) |
| **Zakat** | always, compact | it already has a "nothing due" state — design it as calm, not as an error |
| **Activity** | only when there is activity | omit entirely |

### Why the gold market card stays even at zero gold

Gold is the default savings instrument in this market. "What is gold at today?" is a
reason to open the app **before** you own any, and the app already fetches Egypt karat
pricing (21k/24k, via the Sagha rate) on a schedule. Showing it to a user with no gold
is not clutter — it is the single most likely reason they came.

Design it so it earns its place: compact, live, glanceable, and **dismissible** for
someone who genuinely does not care. If dismissed, it collapses to nothing and is
recoverable from the add-investment affordance.

This is the one deliberate exception to "hide what you do not own". Everything else
obeys the table.

---

## 5. The list — one row, two payloads

Balances and positions belong in one list, not two. Same row, different content:

**Balance row:** icon chip (pocket colour) · name · sub-line (bank · last-4 ·
maturity) · **balance**

**Position row:** icon chip (asset colour) · name · sub-line **`quantity × unit
price`** · **value** · delta chip (▲2.4%) · **price age**

Draw them adjacent and prove they read as one list while staying obviously different
kinds of thing. The delta and the age are what make a position legible — do not let
them read as decoration on a balance.

Group positions by asset type with a quiet header (**Gold**, **Crypto**…) only when
there is more than one type. One type = no header, it is just part of the list.

---

## 6. Live rates — the freshness rule

Gold, crypto and stocks all have real feeds (spot consensus + Egypt karat pricing;
CoinGecko; Finnhub converted at the Sagha USD→EGP rate). Property is **user-valued** —
it has no feed and must never look like it does.

This app has already shipped a bug where prices went **80 hours stale** and the UI
presented them as fact.

**Never show a market number without its age.** Three states, designed in situ:

1. **Fresh** — "as of 14:02", quiet, in the sub-line
2. **Stale** — visibly degraded, and the hero total flips to its estimate state
   (`netWorthIncomplete` already exists in the store and is under-expressed today)
3. **Unavailable** — the row still shows the quantity. You still own 40g of gold when
   the API is down. **Never blank the row. Never show 0.**

A refresh affordance is required — pull-to-refresh plus something explicit. A stale
price must be fixable without guessing.

---

## 7. The sheets — in scope, and where the real complexity is

Thirteen sheets serve this one page. Simplify the set, not just the page. Redesign
these as one coherent family (they share `V3SheetHeader` today):

| Sheet | Job |
|---|---|
| **Add money** | into a pocket — amount, which pocket, note, recurring |
| **Withdraw** | out of a pocket — including "pay a debt" and "move to another pocket" |
| **New pocket** | create — from a real payment method, or from a kind |
| **Pocket form** | name, colour, icon, currency, linked payment method |
| **Add investment** | pick a type, then the form |
| **Asset form** | per-type fields — see below |
| **Emergency fund** | months to cover, what counts |
| **Zakat** | base, nisab, hawl date, manual override |

### Asset form — the per-type fields that exist today

- **Gold** — karat (18/21/24) · unit the user enters in (**grams / gold pounds /
  ounces**) · quantity · where it is kept
- **Crypto** — symbol · quantity
- **Stock** — ticker · shares
- **Property** — value (user-typed) · size · share % · rented-out · area price per m²

Gold's karat and unit are **not** complexity to remove — gold pounds are a real unit
here and karat changes the price. Design them as fast, not as a form.

Property is the outlier: four fields, no live price, and an area estimator that must
never override the user's own number. See §10 — its scope is an open question.

### Two entry points that should probably be one

A pocket balance can be changed by **Add money / Withdraw** (a movement, which lands in
the ledger) *and* by **Update balance** (a correction, which does not). Two doors to
one number. Design the correction as a mode *inside* the pocket, not a separate sheet —
unless you can show why a user would look for it on its own.

---

## 8. Must-keep — do not lose these in the merge

- Pockets: create, edit, delete, colour, icon, linked payment method
- The **Monthly Savings vault** — the carry destination, never deletable
- Add / Withdraw, including withdrawals that pay a debt or fund an investment
- Recurring savings deposits
- Holdings: gold (karat + entered unit), crypto, stocks, property
- Emergency fund sizing and target months
- Zakat, including the manual-amount override
- Multi-currency with FX sub-lines; base-currency totals
- The activity ledger
- Goals that link to a pocket surface **on the pocket** ("feeds New car · 62%").
  No Goals section, tab or hub on this page — goals also link to debts and spending
  limits and live at `/goals`. See `IA_MASTER_PLAN.md`.

---

## 9. Known traps — design around these

1. **`netWorthIncomplete` is under-expressed.** The flag exists; the UI barely says it.
2. **Gold unit vs stored unit.** `quantity` is always grams; `goldUnit` records what
   they typed. Show what they entered, value what you stored.
3. **`karatUnconfirmed`** marks a backfilled row assumed 24k — design the confirm prompt.
4. **Property value is the user's.** The area estimate never overrides it.
5. **A pocket can be linked to a real payment method** — the same money must not read
   as two things.
6. **`/savings` and `/investment` still resolve** as aliases. Nothing should imply two
   destinations still exist.

---

## 10. Design system — non-negotiable

Read §9 of the Flow brief in full; it applies unchanged. Tokens only, teal is every
primary action, red is destructive-only, 48px controls, nothing under 44×44,
`font-mono-numbers` on every amount, logical properties for Arabic, light **and** dark.

Build from the library — a test **fails the build** when a raw `<button>` re-declares
a fill, border, radius or size:

| You need | Component |
|---|---|
| A text action | `Button` (`touch` 44 · `cta` 48 · `cta-block`) |
| An icon-only action | `IconButton` (44px hit area at every size) |
| A filter / type chip | `OptionChip` (`surface="elevated"` inside a sheet) |
| A pocket / asset-type choice | `SelectableCard` |
| An asset-type tile | `AccentTile` |
| A trigger shaped like an input | `FieldButton` |
| A dismiss backdrop | `Scrim` |
| A money figure | `MoneyDisplay` · `AmountField` |
| A KPI tile | `StatTile` |
| A ⋮ card menu | `CardActionMenu` |
| A colour picker | `ColorSwatchRow` |
| An on/off | `Switch size="touch"` |

Two rules designs keep getting wrong:
1. **Sheets are `--color-brand-card`** — a card-filled chip inside one is white on
   white. Chips and cards in sheets use the elevated fill.
2. **One action, one variant** — by what the action *is*: primary `default` · Cancel
   `outline` · delete/discard `destructive` · irreversible commit `destructive-solid` ·
   money received `success` · inline text `link`.

**Selection is never colour alone** — fill **and** border change.

A falling asset is **not** destructive. Use the ▼ delta treatment, never the red token.

---

## 11. Deliverables

1. **The ownership spectrum — the most important screens** (dark + light, 390×844):
   - **Pockets only, no investments** — the majority case. Prove it feels complete.
   - **Pockets + gold** — the common case
   - **Everything** — pockets, gold, crypto, stocks, property
   - **Brand new user** — nothing at all
2. **Scrolled state** with the compact sticky hero
3. **The three price states**: fresh, stale, unavailable — in situ
4. **The incomplete-total hero**
5. **Row anatomy**: balance row vs position row, annotated side by side
6. **The gold market card**: present, and dismissed
7. **The sheet family**: add money, withdraw, new pocket, add investment, asset form
   (gold + property), emergency fund, zakat — as one coherent set
8. **A pocket with a linked goal**
9. **The Wealth tab icon** SVG, active and inactive
10. **Annotated spec**: tokens, px, sticky threshold, tap targets, RTL, motion
11. **One self-contained HTML prototype** on the real CSS custom properties
12. **Component ledger**: every control → its library component; justify anything that
    maps to nothing
13. **A cut list**: anything you believe should be removed to make this simpler, with
    the reason. Do not remove it in the design — propose it.

---

## 12. Do not

- Keep two pages, a Savings/Invested segment, or asset-type tabs at the top level.
- Show an empty group for an asset type the user does not own.
- Change the hero total when a filter changes.
- Show a market value without its age.
- Blank a holding when its price is unavailable — the quantity is still true.
- Let property look like it has a live price.
- Give Goals a section, tab or hub here.
- Put a card-filled chip inside a sheet.
- Design a selected state that differs only by hue.
- Use red for a falling asset.
- Use a pig for savings. Ever. The glyph is Lucide `Coins`.
- Change the header contents, profile placement or menu structure.

---

## 13. Acceptance test

Answer each in one line:

1. I have three pockets and no investments. What is on my screen, and does it feel finished?
2. I own no gold. Can I still see today's gold price, and can I get rid of it if I want?
3. What am I worth, and how do I know the number is current?
4. My gold is 40g — where do I see grams, price per gram, and when it was priced?
5. The price API has been down two days. What does the hero say, what does the gold row say, how do I fix it?
6. How many taps from opening the app to putting 500 into a pocket?
7. I entered my gold in ounces — what do I see?
8. Which pocket feeds my "New car" goal?
9. Am I covered for three months, and where did that number come from?
10. Do I owe zakat, and on what base?
11. Name every control on the page and the library component it is built from.
12. What did you cut, and why?
