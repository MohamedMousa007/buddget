# Design Brief — Buddget "Wealth"

**One page. Not two pages behind a switch.**

Savings and Investment are being merged into a single destination called **Wealth**
(`الثروة`), bottom-bar slot 3. Companion to
`design/design_handoff_flow/DESIGN_PROMPT.md` (Flow + Paydays) and
`design/IA_MASTER_PLAN.md` (why things live where they do).

---

## 0. Already redesigned — do not touch

These have **already been redesigned and shipped**. They are out of scope. Do not
restyle them, do not re-lay them out, do not "harmonise" them with your work, and do
not include them in deliverables:

- **The Flow screen**, including **Paydays** and everything in it
- **The income add sheet**
- **The FAB** (quick-add button)
- **Alert banners** — including the new-payment-method / SMS detection banners
- **The offline alert**

If Wealth needs one of these — a banner, the FAB overlapping the list, the offline
state — **reuse the existing component exactly as it is** and design around it. Show it
in your screens only as context, never as something you have changed.

The header, the profile placement and the menu structure are likewise fixed.

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

## 1b. Where you are free — and where you are not

This brief is specific about **constraints and truths**. It is deliberately quiet about
**form**. Read the difference.

### Fixed, because breaking it breaks the product

These are not style opinions. Each is here because the data, the market or an actual
shipped bug says so.

- **One page.** No top-level tabs, no Savings/Invested segment. *Reason:* most users own
  pockets and nothing else, and today they meet four empty asset tabs.
- **What you do not own costs no space** (§4), with one exception — the gold market card.
- **A position is never shown without its price age**, and never blanked when the price
  is missing (§6). *Reason:* this app shipped 80-hour-stale prices presented as fact.
- **Property never looks live-priced.**
- **Balance ≠ position** (§3). The two are valued by different things and must stay
  legible as different kinds of thing.
- **The library components, the tokens, and accessibility** (§10). The build fails on a
  raw styled button; a chosen state never differs by hue alone; nothing under 44×44.
- **Everything in §8 survives** the merge.

### Entirely yours

Do not ask permission for any of this — it is the actual design work:

- **The hero.** What the number looks like, what sits beside it, how it behaves on
  scroll, whether there is a chart, a delta, a sparkline, nothing. One number must be
  the hero; how it earns that is your call.
- **The visual language of balance vs position.** §5 says they must read as one list
  while staying distinguishable. *How* — icon treatment, typography, a delta chip, a
  sub-line, something we have not thought of — is yours.
- **The gold market card.** Its whole shape, weight and personality. It is the most
  likely reason someone opens this page; make it worth opening.
- **Section order, grouping and rhythm.** The §4 table says what shows *when*. It does
  not say in what order, how they are separated, or whether they are cards, bands or a
  continuous list.
- **Every empty state.** The brand-new user, the pockets-only user, the dismissed gold
  card. These are the screens most people live in — treat them as primary, not as
  fallbacks.
- **The sheet family.** Layout, flow, how many steps, what is progressive.
- **Motion**, density, and how the page feels at 375px with one pocket vs twenty.

### How to disagree

Every constraint above carries its reason. **If you can beat the reason, the constraint
moves** — propose it in the handoff with the argument, and we will take it seriously.
What we will not take is a constraint quietly ignored.

Two honest invitations:

1. If you think the ownership problem (§1) has a better answer than progressive
   disclosure — a different model entirely — show it. We chose this because it is the
   simplest thing that serves all three users; we are not attached to it.
2. If something in §8's must-keep list is, in your judgement, not worth the space it
   costs, put it on the cut list (§11.13) with the reason. Do not remove it in the
   design — propose it and let us decide.

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
- **Property** — value (user-typed) · size (m²) · your share %

Gold's karat and unit are **not** complexity to remove — gold pounds are a real unit
here and karat changes the price. Design them as fast, not as a form.

Property is the outlier only in that it has **no live price**: its value is typed by
the user and must never be presented as if a market produced it. Its form is already
down to three fields; do not add a fourth.

### Changing a pocket's balance — one door, two meanings

Both of these already exist and both write to the ledger, so neither is a silent
override:

- **Add money / Withdraw** — a *movement*. Money actually went in or out.
- **Correct balance** — a *reconciliation*. The pocket drifted from the real account;
  the difference is recorded as a movement so history stays honest.

Correction lives on the **pocket's own ⋮ menu**, not as a top-level affordance — you
reach for it while looking at the pocket that is wrong. Design that menu and the
correction sheet. Do not invent a third way to change the number.

---

## 7b. Emergency fund and Zakat — two features that need design help

You asked for the complicated things to be examined. These are the two, and each has a
real fault. Neither should be removed — both are differentiating — but both are
currently *presented* in a way that is quietly wrong.

### Emergency fund — the number is derived invisibly, and sometimes wrongly

"Months covered" = **cover ÷ monthly essentials**. The maths is fine. The inputs are not.

`monthly essentials` is assembled from four hidden sources: rent from the profile,
food/transport/bills **string-matched against the user's own budget category names**,
and debt minimums. Then there is a manual override, and an AI estimator that can set it
too. Cover, the numerator, comes from a per-pocket "counts as cover" flag buried in the
pocket form.

Two faults:

1. **The matching is English-only.** Categories are free text. A user who names a
   category "طعام" or "Supermarket" matches nothing, so food, transport and bills all
   compute as **zero**, essentials shrink, and the app confidently reports **more**
   months of cover than they have. In a bilingual app this is not an edge case.
2. **Nobody can see why the number is what it is.** Four invisible sources, two
   override paths, and a flag in another sheet.

**Design ask:** make the essentials figure **one number the user owns and can see**.
Derivation becomes a *starting suggestion* — "we think about 8,400/mo, based on your
rent and bills — change it" — not a hidden computation. **Keep the AI estimate** — it earns its place, but only as the thing that *fills that
field*: one tap that puts a sensible local figure into the number the user owns, which
they then edit. It is not a second, parallel way to size the fund. And surface what counts as cover
**on the emergency-fund card itself** ("covered by Main pocket + Vault · change"),
rather than as a toggle hidden in each pocket's form.

Getting this right turns a number people cannot trust into one they can.

### Zakat — the rules are right, the confidence is overstated

Do **not** simplify the rules. They are correctly specified and tested: property
excluded, stocks 30% long-term / 100% for trading, short-term debts subtracted, silver
nisab as the default lower line, gold nisab as the alternative, 2.5%. This is a genuine
differentiator and it is done well.

Two places where the UI claims more certainty than the data supports:

1. **There is no silver price feed.** The silver nisab — the *default* line — is
   derived by dividing the gold price by a fixed 85:1 ratio. The real ratio moves a
   lot. So the default threshold is an estimate that can be materially off, and nothing
   says so. Design the nisab so its basis and its estimate-ness are visible, and make
   switching to the gold basis a first-class choice rather than a buried setting.
2. **The hawl date — already fixed in code, now design it.** It used to be 354 days
   from the user's app signup, which is an install date, not a religious one. There is
   now a **zakat-year anchor** the user sets (`ZakatConfig.yearStartDate`), with
   precedence: the date they set → when they last paid → account creation as a
   *labelled* guess. When it is the guess, the card no longer claims a due date; it asks
   for the anchor instead.
   **Your job is the presentation, not the mechanism:** where setting the year start
   belongs in the sheet, how the unset state reads on the card without nagging, and how
   to make "1 Ramadan" — the anchor many people actually keep — fast to pick.

Zakat guidance should feel careful. Where it is estimating, it should say so — that is
what makes the rest of it trustworthy.

---

## 8. Must-keep — do not lose these in the merge

- Pockets: create, edit, delete, colour, icon, linked payment method
- The **Monthly Savings vault** — the carry destination, never deletable
- Add / Withdraw, including withdrawals that pay a debt or fund an investment
- **Correct balance** on a pocket — reconciling against the real account
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

1. **The ownership spectrum — the most important screens** (dark + light, 390×844).
   **Start with the first one.** It is the screen most of your users live in and the one
   today's design serves worst; the others are variations on it, not the other way round:
   - **Pockets only, no investments** — the majority case. Prove it feels complete,
     not like a page with things missing.
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
8b. **Emergency fund, redesigned per §7b** — the card, the sheet, the editable
    essentials figure with its suggestion, and where cover is chosen
8c. **Zakat, redesigned per §7b** — the card, the sheet, the nisab basis choice with its
    estimate disclosed, and the zakat-year anchor: where it lives, how the unset state
    reads on the card, and how to make a fixed Hijri date fast to pick
9. **The Wealth tab icon** SVG, active and inactive
10. **Annotated spec**: tokens, px, sticky threshold, tap targets, RTL, motion
11. **One self-contained HTML prototype** on the real CSS custom properties
12. **Component ledger**: every control → its library component; justify anything that
    maps to nothing
13. **A cut list**: anything you believe should be removed to make this simpler, with
    the reason. Do not remove it in the design — propose it.

---

## 12. Do not

These are failure modes, not taste. Each traces to a reason stated earlier — §1b says
how to challenge one if you think the reason is wrong. Silently ignoring one is the
only thing that is off the table.

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
- Touch anything in §0 — Flow, Paydays, the income add sheet, the FAB, the alert and
  detection banners, the offline alert. They are done. Reuse, never restyle.
- Simplify the zakat *rules*. Only its presentation is in scope.

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
13. I opened the app with three pockets and nothing else. What is the first thing I see,
    and what is the first thing I can do?
14. Where does my "months covered" number come from, and how do I change it when it is wrong?
15. Why is the zakat threshold what it is, and how would I know it is an estimate?
15b. I have never set my zakat year. What does the card tell me, and how do I fix it in
    one step?
16. What did you do here that we did not ask for, and why is the page better for it?
