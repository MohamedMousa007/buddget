# Implementation prompt — Buddget Savings & Investment v3

> Paste this whole file to the developer or coding agent that will build the tab. It assumes the Buddget codebase, its design tokens, and the already-shipped Expenses, Income, Debt and Payment-methods screens.

**Before writing a line of code, do these two things:**

1. Open `design_handoff_savings_v3/prototype/Savings-v3-OFFLINE.html` in a browser and click through every sheet, tab, reason, radio, switch, kebab menu and picker. It is self-contained — no server, no install.
2. Open `design_handoff_savings_v3/prototype/reference/` and keep the Expenses, Debt, Income, Expense-form and Currency-sheet files open beside you. Every ♻ in the spec is in one of them; you are lifting those components, not rewriting them.

---

## Brief

Build the **Savings** and **Investment** pages of Buddget exactly as designed in `prototype/Buddget Savings v3.dc.html` and documented in `HANDOFF.md`, matching the 32 reference screenshots in `screens/` pixel-for-pixel at 375 × 812.

**Deviation budget is zero.** If a value is in the spec, use that value. If it is not, open the DC file and copy the inline style. Do not substitute a "close enough" token, do not round radii or font sizes, do not re-order fields, do not reword copy. If something looks wrong to you, ship it as designed and raise it separately.

## Reuse before you write

These already exist. Import them; do not re-implement, re-style or fork them:

| Component | Where it comes from | Used here for |
|---|---|---|
| Amount + Currency field pair | Expense / Debt forms → `prototype/reference/Expense Form.dc.html` | both money sheets, pocket form, asset forms |
| Currency picker sheet | shared → `prototype/reference/Currency Sheet.dc.html` | every currency button |
| **Note field** | Expense form → `prototype/reference/Expense Form.dc.html` — closed state is a red `＋ Add note` text link, open state is an `h46` input with an inline X | Add savings, Withdraw |
| `Today` date chip | Expense form → `prototype/reference/Expense Form.dc.html` | both money sheets |
| Segmented control | **Debt tab** → `prototype/reference/Buddget Debt.dc.html` (`#E50914` fill, white label, `radius 10`, `h38` → use `h36` here) | Investment asset tabs |
| Type-picker list rows | **Add debt** step 1 → `prototype/reference/Buddget Debt.dc.html` (46px icon, name, sub, chevron) | Add investment |
| Ledger + filter + swipe-to-delete | Expenses → `prototype/reference/Buddget Expenses.dc.html` | Activity section |
| Hero-card slider + page dots | **Income** → `prototype/reference/Buddget Income v3.dc.html` | pockets carousel geometry + snap behaviour |
| Pocket carousel card | this page's own Pockets section | reused **read-only** as the Add-savings pocket picker (⋮ and Add/Withdraw removed, select-check added) |
| Payment-method rows | Payment methods | New pocket → "from your payment methods" |
| Bottom tab bar + FAB | shell | both pages |
| Sheet shell, grabber, X button, switches, chips | shared | everywhere |

## Build order

1. Tokens + hero shell + tab bar/FAB (hide the FAB when the page is empty).
2. Pockets carousel, ⋮ menu, empty state.
3. Money sheets — one shell, two modes (`add`, `out`).
4. New pocket + pocket form.
5. Emergency fund card + sheet.
6. Zakat card + sheet.
7. Investment page: segmented control → holdings card+table → market blocks.
8. Add investment list + four asset forms.
9. Activity (import).

## The twelve things a reviewer will check first

1. Pocket **Add** is solid `#1DB954` and **Withdraw** is solid `#E50914`, both `h42 · radius 12 · 600 13.5px`, **no icons, no glass, no outline**.
2. No **back chevron** exists in any sheet in this tab. X, swipe-down and the OS back gesture are the only exits.
3. The **Withdraw sheet is a fixed 78% of the screen height** and does **not** resize when a reason is selected. Header and CTA are pinned; only the middle scrolls.
4. Sheet titles are exactly **`Add savings`** and **`Withdraw`**.
5. Opening **Add** from a pocket's own button replaces the pocket carousel with a **single locked row + `Change`**; opening it from the FAB shows the **read-only page carousel** — one card per swipe, **nothing preselected, order never re-sorted**, CTA inert (`Choose a pocket`) until a card is tapped, and the green check lands in the corner the ⋮ occupies on the page card.
6. Exactly **four withdraw reasons** — Spending, Pay a debt, Investment, Income — each writing to a different ledger, in a 2×2 of icon-and-two-line rows. **Move to another pocket** is a separate section under an `or` rule with its own picker, and it rewrites the CTA to `Move`.
7. Investment tabs are the **Debt segmented control**, red fill + white label, **with no ownership dots**, four tabs only.
8. Holdings render as a **table merged into the value card** — name, quantity, worth, purchase date, per-row pencil — never as tiles.
9. Gold's third stat is **live**: the sell price of 24k if any 24k is held, otherwise the karat with the most grams (ties → higher purity). Labelled `{karat} right now`.
10. The **zakat** card and sheet exist under the emergency fund, compute from live data, expose every input as an editable field, and offer a full manual override.
11. Add-investment is a **vertical list** in the Add-debt idiom; karat, coin and ticker are **cards carrying live prices**.
12. Every number uses `--font-mono` with `tabular-nums`.

## Zakat — implement exactly this

```ts
const stockFactor = holdsForTrading ? 1 : 0.30;

const zakatable = Math.max(0,
    cashAndSavings          // every pocket balance
  + goldValue               // at today's SELL price
  + cryptoValue             // at the parallel rate
  + stocksValue * stockFactor
  - debtsDueThisYear        // short-term liabilities only
);                          // property principal is NEVER included

const nisab = nisabBasis === 'gold'
  ? 85  * gold24kSellPerGram   // ~85 g of 24k
  : 595 * silverPerGram;       // ~595 g of silver — the DEFAULT, it is the lower line

const due   = zakatable >= nisab && zakatable > 0;
const zakat = due ? zakatable * 0.025 : 0;   // 2.5%, lunar year
```

Rules:
- **Silver nisab is the default.** The user can switch to gold nisab in the sheet.
- **Long-term stocks default to 30% counted**; a "for trading" toggle takes it to 100%.
- A home the user lives in, and land or a flat they rent out, are **not** zakatable. Only rent they actually kept, which already sits in cash.
- Every line in "What counts" is an editable numeric input. An edited line takes a red border and stops following the live figure until it is cleared.
- A master switch replaces the final figure with a number the user types.
- Show the hawl (lunar-year) date. Never block, never nag, never present the result as a religious ruling — the sheet's closing paragraph is required copy.
- Below nisab: amount renders `—`, and the card reads `You are {gap} EGP under the line, so nothing is owed.`

## Market data and valuation rules

- Gold is valued at the **sell** price (what a shop pays the user), never the buy price. Per-karat prices come from the local market; the global ounce and global gram are shown only for comparison, with the **local-vs-global premium** as a third figure.
- Gold and crypto convert to EGP at the **parallel/Sagha** rate. The official rate appears only in the footnote sentence.
- `1 gold pound = 8 g`, `1 oz = 31.1035 g`.
- A **halted or unpriceable** holding shows `—` plus `Not counted`, is excluded from the asset total, the net worth and zakat, and says when it was last priced.
- A property's **area estimate never overrides a value the user typed**. The estimate is labelled as an estimate every time it appears.
- Every non-EGP figure carries an `≈ $` line underneath.

## Empty and edge states

- **No pockets:** dashed empty card with `Create a pocket`; **FAB hidden**; Activity header, filter bar and swipe hint hidden, replaced by one "Nothing here yet" line; hero pill hidden.
- **No holdings on a tab:** the market block renders first, with a single dashed `Add {type}` button beneath it.
- Guard every division. No `Infinity%`, no `+-100%`, no `−0` — zeroes print unsigned.
- Long pocket and asset names ellipsise; they never wrap a row or push a number off-screen.

## Definition of done

- All 32 screenshots reproducible and matching at 375 pt, dark and light.
- Withdraw sheet height constant across all four reasons and both picker states.
- Zakat figures reconcile by hand against the formula above for: populated, below-nisab, gold-nisab, trading-stocks and manual-override cases.
- Accessibility: ≥ 44 pt touch targets, no focus rings, VoiceOver labels on every icon-only control (⋮, X, pencil, funnel, radio, switch).
- RTL: the whole tab mirrors; mono numbers stay LTR; `inset-inline` used throughout instead of left/right on directional properties.
- No string in the tab contains "interest", "APR" or "loan".
