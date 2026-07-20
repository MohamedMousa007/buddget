# Buddget — Debt tab (FINAL) · Engineering handoff

**Source of truth:** `Buddget Debt.dc.html` (project root) + the full-size screenshots in `design_handoff_debt/screens/`. Build every screen to match them **pixel-for-pixel**. Where a number/color is given here, use exactly that. Where something is unspecified, open the DC file and match it — do not invent.

- Mobile-first **375 × 812**, dark-first, Capacitor iOS/Android. Sentence case; uppercase only for 10px micro-labels. Touch targets ≥ 44 px. Respect safe-area insets. No focus rings (`outline:none;box-shadow:none;-webkit-tap-highlight-color:transparent`).
- Fonts: **DM Sans** (`--font-sans`) for text/headings, **JetBrains Mono** (`--font-mono`, `tabular-nums`) for **every** number/currency, **IBM Plex Sans Arabic** for Arabic.
- **Shariaa-conscious — non-negotiable:** never show or ask for an interest rate, APR, amortization split, or the word **"loan"** anywhere. Only fixed agreed amounts, counts (paid/remaining), and dates. Tone: calm, encouraging, non-judgmental; celebratory on payoff.

## Screens (see `screens/`)
| File | Screen |
|---|---|
| `01-borrow-tab.png` | Borrow tab — hero, ring, segmented, borrow card **with payoff-goal strip** |
| `02-creditcard-tab.png` | Credit-card tab — compact card, 3 stat boxes, over-limit, Pay/Charges inside |
| `03-installments-tab.png` | Installments tab — **green** assign banner, card-linked plan |
| `04-add-credit-card.png` | Add credit card — floating card preview + PM-style sheet |
| `05-charges.png` | Charges — expenses-style grouped ledger, swipe-to-delete |
| `06-cleared-vault.png` | Cleared vault sheet — wax-seal stamps + payment history |

---

## 1. Tokens (exact — CSS custom props `--color-brand-*`, never hex in code)
| Role | Dark | Light |
|---|---|---|
| canvas / page | `#0A0A0F` | `#F5F5F7` |
| card | `#111118` | `#FFFFFF` |
| elevated / field | `#1A1A24` (inputs use `#16161f` / border `#26262f`) | `#F0F0F4` |
| border | `#2A2A38` | `#D4D4DC` |
| text primary / secondary / muted | `#FFFFFF` / `#CFCFE0` / `#9898B0` | `#1A1A24` / `#5A5A72` / `#8A8AA0` |
| micro-label | `#6E6E85` | `#8A8AA0` |

**Accent semantics:** Red `#E50914` = primary CTA / FAB / active nav / destructive (only). **Focus ring is neutral gray** (never red). Green `#1DB954`/`#35D46F` = paid/success/on-track. Gold `#F5C842` = gold-backed borrow. Amber `#FFB13D`/`#FF9F0A` = warning / behind / mid-utilization. Over-limit / error text `#FF6B6B`/`#FF8A8F`.

**Two hero surfaces (reused from Income/Expenses — do not reinvent):**
- Opaque dark-gradient hero: `linear-gradient(150deg,#1d1416,#121017)` — the fixed portfolio hero.
- Accent-tinted glass card: `linear-gradient(158deg, rgba(accent,.14), rgba(255,255,255,.045) 55%), #0f0f15`, 1px `rgba(255,255,255,.08)` border, inset top highlight, radius 18. Used for every carousel hero card (Borrow/Card/Installment) and payment-method cards. No backdrop-blur (keeps swipe smooth).

**Radii:** cards/sheets `18–20px`, sheet top `26px`, inputs/buttons `12–15px`, chips `999px`. Inputs `h-12` (48px). Sheet grabber 40×4 `#2A2A38`.

**Family accent colors:** Borrow-owe `#E50914`/`#F76D74`; Borrow-owed-to-me `#1DB954`/`#35D46F`; gold-backed `#F5C842`; Credit card (default) `#8A5CF6`; Installments teal `#00C2A8`/`#2CE0C6`. Provider brand colors: valU `#F04E23`, Tabby `#2FCFA5`, Tamara `#E0A400`, Sympl `#7A6CF0`.

---

## 2. Layout (top → bottom)

1. **App header:** `Buddget | Debt`, right side = **Cleared-vault pill** (award icon + cleared count, green-tinted) then avatar. The vault pill opens the Cleared vault sheet (§8) — it lives here (not in the hero) to stay one tap away and save hero space.
2. **Fixed portfolio hero (dark gradient, NOT tab-scoped):** "Total still owed" big mono + EGP + ≈USD; an **overall cleared donut ring** (green arc, % in center, `paidOff / (paidOff+owed)` across the lifetime — not "this year"); a 3-cell family-count strip (Borrow / Cards / Installments active counts); a "{paidOff} of {lifetime} ever borrowed, cleared" line; full-width red **Add debt** CTA.
3. **3-tab pill segmented control:** **Borrow · Credit Card · Installments** (fixed names; never rename or add "loan"). App auto-selects the first non-empty tab in that order on open.
4. **Tab-scoped swipe carousel** (one card per swipe, page dots below; active dot widens to 18px & turns red `#E50914`). Each card is fixed-height, glass, with a **top-right round edit-pin** (pencil) that opens the Edit sheet, and its **CTA(s) inside the card** (border-top divider), matching Income. See §3.
5. **All debt payments feed (fixed, cross-tab):** newest-first, day-grouped ledger; filter chips **All / {current family}**. Row = 54px column (40px colored icon tile + tiny category/tag label) + name + `time · method` sub-line + right mono amount + green "✓ Paid". **Swipe row ← to delete** (red delete bg behind, threshold ~56px) — identical gesture/markup to Expenses & Income.
6. **Cleared vault** — behind the header pill (§8). Not an inline bottom section.

---

## 3. The three hero card anatomies (shared fixed height, CTA inside, top-right edit-pin)

**Borrow card** — avatar (initial, tinted), name + relation sub-line, direction badge (**"I owe"** ↗ red vs **"Owed to me"** ↘ green), big remaining mono + "EGP left"/"EGP owed to you", progress bar (paid/total), optional **gold badge** (`{g}g · {karat}`). If a **payoff goal** is set (borrow-only): a gold-tinted strip — "Goal · clear by {month}", "{n} payments left · {per}/mo · next {date}", and an **On track / Behind** chip. CTA inside: "Pay {name}" (red) for owe, "Log receipt from {name}" (green outline) for owed-to-me.

**Credit-card card (compact, card-like)** — bank **3-letter mark** chip (brand gradient) + bank name + `•••• {last4} · Debt`. "OUTSTANDING" big mono + "{util}% used" and free/over line. Utilization bar (green <30 / amber ≤100 / red >100, **capped at 100% width**; over-limit shown ONLY as "over by {x}" text under the bar — **no separate over box**). **Three stat boxes:** ① `Due {date}` / "{n} days left"  ② `All due` / {amount} (+ small teal "incl. {installment}" when a plan bills to it)  ③ `After payment` / {outstanding − allDue}. CTAs inside: **Pay now** (red) + **Charges** (neutral). Reinforce a card is a *debt*, never "available to spend".
  - **All due = the full amount due this cycle** = regular statement charges + this cycle's installment(s). **Never a minimum payment or a % — remove min due entirely.**

**Installment card** — provider **brand mark** chip (lettermark now → **replace with real logo**, see §9) + name; a **"Card ••••{last4}"** tag when the plan bills to a credit card. Segmented progress bar (one segment per installment; filled = paid, next = outlined). Lead stat = **remaining outstanding** = `(count−paid) × per` + "{n} × {per} left" breakdown + "{paid} of {count} paid". Right: next-cycle date + payment method. CTA inside: **"Pay next · {per} EGP"**.

## 3b. Credit-card installments (the important model)
A card purchase split into installments **reserves the full purchase price against the available limit** (so it's inside `outstanding`), but **only the fixed monthly installment is billed each cycle**. Represent BOTH: the card shows real `outstanding` AND `all due this cycle = regularDue + installment`, with an "incl. {installment}" note. The **same plan also appears in the Installments tab**, flagged "Card ••••{last4}", provider = the bank. Applies across EG/SA/AE card programs. Never show interest — only the fixed per-cycle amount, count, and dates.

## 3c. Assign-payment banner (Installments tab)
**Green** (not gold) gentle prompt when an SMS payment likely belongs to a plan but isn't confidently matched: "Assign a payment? · {amt} · {method} · {date} · likely a plan" with one-tap **Assign** (green) + "Not now". Empty state = hidden.

---

## 4. Modals (bottom sheets, `rounded-t-3xl`, drag-to-close, slide-up 300ms, scrim `rgba(0,0,0,.6)`, `h-12` inputs, **no Back button** — X + swipe-down only, date chip beside X on step 2)

**Add debt** → step 1 family picker (Borrow / Credit Card / Installments) → step 2 family fields:
- **Borrow:** person, direction (locked in Edit), gold toggle → grams + **karat chips 24K/21K/18K only** (no free entry). **Amount is optional when gold is on** — auto-computed `grams × price[karat]` (demo prices 24K 4600 / 21K 4025 / 18K 3450 EGP/g; wire to a live gold-price source), shown as placeholder + "≈ … at …/g" line, user may override. **Received via / Paid via** = opens the **payment-method card carousel** (§5, reuse). **Set a payoff goal** toggle (borrow-only) → target-month chips + cadence chips + a live "you'd pay {x}/{cadence}" preview with a gentle income-strain bar/hint.
- **Credit card:** **Reuse the Add/Edit payment-method sheet** (see §6) — floating live card preview above a 72%-height sheet: card-colour slider, provider→bank picker, **type locked to Credit card** (lock icon), last 4, then CC-debt fields **limit, current outstanding, statement day, grace days**, currency. Save. **No minimum %, no tip line.**
- **Installment:** **Provider field → provider picker sheet** (§7). Item, total amount, # of installments (or per amount), frequency (weekly/monthly/quarterly), live "≈ per {freq}" preview + "fixed amounts only — no interest" note. **No subtype/type field** (removed entirely — provider is enough).

**Edit debt** = the **same per-type Add form, prefilled**, with fields that must not change **locked** (direction for borrow; provider/type for card & installment — read-only row with a lock icon), and a **borderless Delete** button at the bottom (text + trash, no box outline — matches the Edit-income delete).

**Pay debt** — selected-debt summary, amount (defaults: borrow = remaining, card = all-due, installment = per), date, payment-method chips, one-time/recurring toggle, notes, confirm.

---

## 5. Received-via / payment-method selector = the **card carousel**
Reuse the Payment Methods **wallet card carousel** — a horizontally-scrolling deck of the user's saved methods as brand-gradient mini-cards (type glyph, name, `•••• last4`), tap to select (white check on the chosen card), confirm button. **Do NOT build a plain list.** This is the same component used everywhere a payment method is picked.

## 6. Add/Edit credit card ↔ Add payment method (UNIFY — do not duplicate)
The Add-credit-card flow **must be the existing Add/Edit payment-method sheet** (`design_handoff_payment_methods/`, v4/v5: floating card preview + colour slider + provider picker + type chips + identifier + currency), **locked to the Credit card type**. Extend that **one** sheet so the **Credit card type also collects: limit, current outstanding, statement/due day, grace days** (these are missing today). Adding a credit card there **auto-creates a Credit-card debt** in this tab. Removing/duplicating the sheet is not acceptable — the Debt tab and Payment Methods must share it.

## 7. Provider picker (installments)
Bottom sheet, `#14141b`. Search field + **2-column grid of brand tiles** (larger than the payment-method 3-col grid — fewer providers): valU, Tabby, Tamara, Sympl, **Credit card**, Custom. Selecting **Credit card** opens a **third sheet = the credit-card carousel filtered to the user's credit cards**; picking one links the plan to that card (provider becomes the bank, "Card ••••{last4}"). If the user has **no credit cards**, that sheet shows an empty state + **"Add credit card"** CTA (opens §6). Custom → free-text provider.

## 8. Cleared vault (celebratory archive)
Opened from the header pill. Bottom sheet, deep-green tint (`#0c1610`). Header: award icon + "{n} cleared · {sum} paid off". A **grid of wax-seal stamp cards** — each: family tag ("Cleared · Installment/Borrow/Credit card"), name, dashed ✓ **seal** (rotated −12°), original amount, "Cleared {month}", and a **History** toggle. Tapping a stamp reveals its full **payment history** (dot · date · method · amount) inline. Cleared debts leave the active carousels so they never crowd. Keep it feeling like a reward.

---

## 9. ⚠ Provider brand logos (must not be skipped)
Provider marks are currently brand-colored **lettermarks** (valU→"V", Tabby→"T", etc.). In build, **replace them with the official high-resolution logos** (SVG preferred, else ≥3× PNG) on the brand-tinted chip, in **all three** places: the installment hero card, the provider-picker grid, and the Add-installment provider field. Bank marks keep the 3-letter chip unless a bank logo is supplied. Store per provider: `{ id, name, logo, brandColor, country }`.

---

## 10. Data model (make it data-driven)
```ts
Borrow      { id, name, avatarInit, relation, dir:'owe'|'owed', total, paid, gold?:{grams,karat}, method, goal?:{by,per,cadence,remaining,next,onTrack} }
CreditCard  { id, bank, initials, last4, color, limit, outstanding, regularDue, statementDay, graceDays, due, daysLeft, inst?:{item,per,paid,count} }
            // allDue = regularDue + (inst?inst.per:0) ; after = outstanding - allDue ; overLimit = outstanding>limit
Installment { id, item, providerId, brandColor, count, paid, per, freq, next, method, onCard?, cardLast4? }  // outstanding = (count-paid)*per
Payment     { id, family, name, sub, method, amount, date }   // debt payments feed, newest-first, swipe-delete
Cleared     { id, family, name, original, clearedMonth, history:[{date,method,amount}] }
```
Currencies use the unified `CurrencySheet` component. Numbers via `Intl.NumberFormat` (locale-aware, tabular, compact for large). Market data in the mockup: **Egypt / EGP**, providers valU · Tabby · Tamara · Sympl; USD ≈ ×0.0202.

---

## 11. ⬇️ COPY-PASTE PROMPT FOR CLAUDE CODE

> Implement the **Debt tab (FINAL)** in the Buddget app (Next.js 16 / React 19 / Tailwind v4 / Base UI / Lucide / Zustand). Read `design_handoff_debt/HANDOFF.md` in full and match `Buddget Debt.dc.html` + the full-size screenshots in `design_handoff_debt/screens/` **pixel-for-pixel**, using the app's existing tokens (`--color-brand-*`, `--font-sans`, `--font-mono`) and Base UI primitives. Introduce **no new colors, fonts, or radii** beyond §1.
>
> **Reuse, never rebuild.** Only reuse components/patterns from parts already fully redesigned — **Expenses, Income, Payment Methods, and their components**. Specifically:
> - Transaction **grouping + row anatomy + swipe-to-delete** for both the "All debt payments" feed and the credit-card **Charges** view — identical to Expenses/Income ledgers (day headers with day totals, 54px icon-tile column, `time · method` sub-line, red delete-behind on left-swipe).
> - The **month/period header, hero-glass card, and carousel+dots** patterns from Income.
> - The **payment-method card carousel** for every "received/paid via" and payment-method selection (§5) — do not write a plain list.
> - The **unified `CurrencySheet`** for any currency selection.
>
> **Unify Add/Edit credit card with Add payment method (§6).** Do NOT create a second card sheet. Extend the **existing** Add/Edit payment-method sheet so the **Credit card type** additionally collects **limit, current outstanding, statement/due day, grace days**; remove any minimum-% field; and make **adding a credit card auto-create a Credit-card debt** in the Debt tab. The Debt "Add credit card" entry opens that same sheet, locked to the Credit card type.
>
> **Build:** the fixed portfolio hero with the **overall cleared donut ring**; the **Borrow · Credit Card · Installments** segmented control (auto-select first non-empty; never the word "loan"); the tab-scoped carousel with the three card anatomies in §3 (edit-pin top-right, CTAs inside), including **credit-card installments** per §3b and the **green** assign banner §3c; the "All debt payments" feed with All/family filter and swipe-delete; the **Cleared vault** sheet §8; and the Add / Edit (§4, locked fields + borderless delete) / Pay / Payoff-goal (borrow-only, §4) / provider-picker (§7) sheets. Payoff goals are **borrow-only**, set in Add-borrow, and surfaced on the borrow card (on-track/behind, payments left, next due).
>
> **Shariaa compliance is mandatory:** never render or request interest, APR, amortization, or the word "loan" — only fixed agreed amounts, paid/remaining counts, and dates. Gold-backed borrows use karat chips **24/21/18** and auto-value from a live gold price (amount optional/overridable).
>
> **Provider logos (§9):** replace lettermarks with official **high-resolution** brand logos in the installment card, provider picker, and provider field.
>
> Verify every screen against `screens/`; ≥44px targets, safe-area insets, no focus rings, sentence case, tabular mono numbers.
