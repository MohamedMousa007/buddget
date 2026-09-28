# Buddget — Savings & Investment v3 · README

Everything an engineer needs to ship this tab, and nothing they have to guess.

## What is in this folder

```
design_handoff_savings_v3/
├── README.md                 ← you are here: how to read and use the package
├── HANDOFF.md                ← the specification. Exact tokens, geometry, copy, logic
├── IMPLEMENTATION_PROMPT.md  ← paste-ready brief for a developer or a coding agent
├── screens/                  ← 32 full-size 2× PNGs, one per screen and state
└── prototype/                ← the runnable design, source of truth
    ├── Savings-v3-OFFLINE.html          ← double-click this. One file, no server, no deps
    ├── Buddget Savings v3.dc.html       ← the editable source of the design
    ├── support.js                       ← runtime the .dc.html needs
    ├── _ds/…                            ← the bound Buddget design-system tokens + bundle
    └── reference/                       ← the shipped screens this design must match
        ├── Buddget Expenses.dc.html     ← filter bar + ledger rows + swipe-to-delete (the ♻ source)
        ├── Buddget Debt.dc.html         ← segmented control, add-type list, hero slider
        ├── Buddget Income v3.dc.html    ← hero-card slider + dots the pockets copy
        ├── Expense Form.dc.html         ← amount+currency pair, note ♻, sheet shell
        ├── Currency Sheet.dc.html       ← the currency picker ♻
        ├── support.js
        └── _ds/…
```

## The prototype is the source of truth

Order of authority, highest first:

1. **`prototype/Buddget Savings v3.dc.html`** — every value in the spec was read out of this file. Open it in an editor and search the inline styles for any number you need.
2. **HANDOFF.md** — the same values, organised and explained, plus all the logic the file can only imply.
3. **`screens/*.png`** — evidence, and the pixel target for review.

If any two disagree, the higher one wins.

**To run it:** open `prototype/Savings-v3-OFFLINE.html` in any browser — it is fully self-contained (fonts, tokens, runtime inlined), works offline, and needs no install. Every sheet, tab, reason, radio, switch, kebab menu and picker in the 32 screenshots is reachable by clicking. Use it to check motion, press states, sheet heights and scroll behaviour — the things a PNG cannot show.

**To edit it:** open `prototype/Buddget Savings v3.dc.html` (needs the sibling `support.js` and `_ds/`, both included). Change it, then re-export the offline file if you want to reshare.

**`prototype/reference/`** holds the already-shipped screens this design reuses. Every ♻ in HANDOFF.md points at one of them. Before you write a filter bar, a ledger row, a currency picker, a note field or a segmented control, open the reference file and lift it — do not re-implement from the spec text.

## How to read the package

1. Skim **HANDOFF.md §0** to see all 32 screens and what each one is.
2. Read **§1 Tokens** and **§12 Rules** before writing any code. §12 is the list of things reviewers will reject the PR for.
3. Build in this order — it matches how the data layers on top of each other:
   1. tokens, hero shell, tab bar/FAB
   2. pockets carousel + ⋮ menu + empty state
   3. Add savings, Withdraw (the two money sheets share a shell)
   4. New pocket + pocket form
   5. Emergency fund
   6. Zakat
   7. Investment page: segmented control → holdings table → market
   8. Add investment + the four asset forms
   9. Activity (import, do not rebuild)
4. Every ♻ in the spec means **an existing app component**. Import it. If you find yourself writing a currency picker, a filter sheet, a ledger row or a note field from scratch, stop.

## What changed in v3 (review checklist)

| # | Change | Screens |
|---|---|---|
| 1 | Pocket Add/Withdraw are the app's solid green and red fills — no glass, no icons | 01 |
| 2 | Hero cell reads `This month`, not `Saved this month` | 01 |
| 3 | Pace pill shortened to `Ahead +9%` / `On pace` / `Behind −12%` | 01 |
| 4 | Add-savings pocket picker **is the page's pocket carousel, read-only** — same 339-wide card, one per swipe, ⋮ and Add/Withdraw stripped, green check on tap; `Source` label shortened; source is two radio cards; note copied verbatim from the expense form | 03, 05 |
| 5 | Nothing is preselected in the picker and the order is never re-sorted — the CTA stays inert (`Choose a pocket`) until a card is tapped. Opened from a pocket's own Add, the carousel is replaced by a locked row with `Change` | 03, 04 |
| 6 | Withdraw sheet height is fixed; title is just `Withdraw`; four logic-bearing reasons in a 2×2; `Move to another pocket` is its own section | 06–09 |
| 7 | Zakat card and sheet added under the emergency fund — auto-calculated, explained, editable, overridable | 15, 16, 20 |
| 8 | Investment tabs use the Debt segmented control; ownership dots removed | 23–26 |
| 9 | Holdings are a table merged into the value card, with purchase dates and per-row editing; gold's third stat is the live price of the karat you actually own | 23–26 |
| 10 | Investment hero cell reads `All time` with a growth arrow | 23 |
| 11 | Add investment is the Add-debt style list, not a grid | 28 |
| 12 | Every back chevron removed from every sheet | 11, 13, 29–32 |
| 13 | Karat / coin / ticker are now price-carrying cards; purchase date added to every asset form | 29–32 |
| 14 | The emergency-cover warning strip inside Withdraw is gone — cover lives on its own card and sheet, and no withdrawal is annotated or blocked | 06–09, 14 |

## Data the client needs

| Feed | Used by | Cadence |
|---|---|---|
| Local gold buy/sell per karat (24k, 21k, 18k) + Sagha USD rate | gold market card, gold valuation, gold nisab | hourly |
| Global gold ounce + official USD rate | global comparison row, local-vs-global premium | hourly |
| Silver gram price | silver nisab (the zakat default) | daily |
| Crypto spot (USD) | crypto market + valuation | 1–5 min |
| EGX 30 level + per-ticker last close, halted flag | stocks market + valuation | on close |
| Area price per m² | property estimate | monthly |

All conversions to EGP for **gold and crypto** use the **parallel/Sagha** rate, because that is the rate the user would actually get. The official rate appears only in the explanatory footnote.

## Acceptance criteria

- Every one of the 32 screens is reproducible in the built app and matches its PNG at 375 pt.
- The withdraw sheet does not change height when any reason is selected.
- With zero pockets: no FAB, no activity header, no filter bar, no `Infinity%`, no `+-100%`, no `−0`.
- With an unpriceable holding: `—` / `Not counted`, and it is absent from every total, including zakat.
- Zakat below nisab shows `—` and the shortfall line, never a negative or zero-value "due".
- Light theme renders every surface from the light column of §1 — no hard-coded dark hexes.
- No string in the tab contains "interest", "APR" or "loan".
