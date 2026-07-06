# Handoff: Add & Edit Expense redesign + Unified Date Picker (Buddget)

## Overview
A full redesign of Buddget's **Log a Purchase** modal, delivered as three connected pieces:

1. **Add Expense** — a content-height bottom sheet (dark theme) with amount-first layout, a 2-row swipeable **category icon grid**, non-spend indicators, an **account dropdown** (with an inline "Add payment method" flow), a lightweight optional note, and a date pill.
2. **Edit Expense** — the exact same form pre-filled from an existing expense, CTA reads **Save changes**, and the close (X) prompts a **Save / Discard** confirmation only when there are unsaved changes.
3. **Unified Date Picker** — a compact, framed calendar **popup** (centered, not a bottom sheet) with tap-to-pick, adjacent-month days for a constant frame size, a month grid, and a **searchable year dropdown**. It is intended to **replace every date surface across the app** (see the dedicated rollout prompt at the bottom).

The old modal (screenshot in the original brief) used "Log a Purchase", "WHAT WAS IT FOR?", a full-width date select, single-row category chips, and pill payment chips. All of that is replaced.

---

## About the design files
The files in `prototypes/` are **design references authored in HTML** (Buddget "Design Components" — `.dc.html`). They show the intended look and behavior. **They are not production code to copy verbatim.** Your job is to **recreate them inside the Buddget codebase** (Next.js 16 / React 19 / Tailwind v4 / Base UI) using the app's existing patterns, tokens, and primitives.

- `prototypes/Add Expense Redesign.dc.html` — the canvas that mounts everything (two phones: add + edit, plus the standalone calendar). Parent chrome only.
- `prototypes/Expense Form.dc.html` — **the real thing**: the entire sheet + all overlays (category grid, payment dropdown, add-payment modal, currency dropdown, note, calendar popup, discard/save confirm). Takes a `mode: 'add' | 'edit'` prop.
- `prototypes/Unified Calendar.dc.html` — the date picker component (`onConfirm(label)`, `onClose()`).

These reference the Buddget design-system tokens (`--color-brand-*`, `--font-sans`, `--font-mono`) which already exist in the repo at `src/app/globals.css`.

## Fidelity
**High-fidelity.** Every color, size, radius, font, spacing, and interaction below is exact and should be reproduced pixel-for-pixel, then mapped onto the repo's existing tokens/components where equivalents exist. Where a mock value differs slightly from an existing token, the token is noted — **prefer the token**.

---

## Target codebase (what to change)
GitHub: `MohamedMousa007/buddget` (main). Relevant existing files:

| Area | Existing file | Change |
|---|---|---|
| Add sheet shell | `src/components/modals/AddExpenseSheet.tsx` | Sheet becomes content-height; submit label unchanged ("Log it" → **"Save expense"**). |
| Edit sheet shell | `src/components/modals/EditExpenseSheet.tsx` + `EditExpenseForm.tsx` | CTA **"Save changes"**; X → discard/save confirm when dirty. |
| Field stack | `src/components/features/expenses/AddExpenseForm.tsx` | New layout: amount+currency row, description, category grid, payment dropdown, optional note, date pill in header. |
| Category + payment pickers | `src/components/features/expenses/ExpenseFormPickers.tsx` | Replace `ExpenseCategoryChips` with a **2-row icon grid slider**; replace `PaymentMethodChips` with a **dropdown + Add CTA**. |
| Sheet motion/shell | `src/components/modals/ModalShell.tsx` | Keep; sheet height driven by content (`max-height:82%`), not fixed. |
| State hook | `src/hooks/useAddExpenseSheet.ts` | Keep the shape; add nothing for time (time is auto-set server-side, see below). |
| Non-spend rule | `src/lib/constants/categoryMeta.ts` (`NON_SPEND_CATEGORIES`) | Drive the non-spend indicator + hint. |
| Currencies | `src/lib/constants/finance.ts` (`FIAT_CURRENCIES`) | Currency dropdown list. |
| Payment types | `src/lib/constants/finance.ts` (`PAYMENT_METHOD_TYPE_OPTIONS`), `src/lib/payment/paymentMethodDefaults.ts` | Payment swatch color + icon + Add-method form. |
| Add payment | `src/components/modals/AddPaymentMethodSheet.tsx` | Reuse as-is; open it from the new payment dropdown's "Add payment method" row. |
| Icons | `src/components/dashboard/CategoryIcon.tsx` (Lucide) | Reuse these exact glyph mappings for the category grid. |
| **New** | `src/components/ui/UnifiedDatePicker.tsx` | The calendar (see spec + rollout prompt). |

---

## Design tokens (exact values used)

### Colors — dark theme (this product is dark-first)
| Token | Hex | Use |
|---|---|---|
| Brand red (primary) | `#E50914` | CTAs, selected states, focus, FAB |
| Brand red hover | `#F40612` | CTA hover (dark) |
| Canvas | `#0A0A0F` | App background / phone screen |
| Card / sheet | `#111118` | Sheet + modal surface |
| Elevated | `#1A1A24` | Chips, icon buttons, secondary surface |
| Border | `#2A2A38` | Hairline borders |
| Text primary | `#FFFFFF` | Titles, values |
| Text secondary | `#CFCFE0` | Body |
| Text muted | `#9898B0` | Meta, icons idle |
| **Input fill (mock)** | `#16161f` | Amount/description/note/currency fields |
| **Input border (mock)** | `#26262f` | Field borders |
| **Micro-label** | `#6E6E85` | 10px uppercase field labels |
| Overlay sheet fill | `#14141b` | Payment / currency dropdown sheets |
| Calendar card | `#12121b` (border `#2E2E3C`) | Date picker card |
| Non-spend hint bg / border / text | `rgba(77,163,255,.10)` / `rgba(77,163,255,.28)` / `#B9D3F5` | Info banner |
| Backdrop scrim | `rgba(0,0,0,.52–.68)` | Behind sheets/dialogs |

> Map `#16161f`/`#26262f` onto the nearest DS tokens (`--color-brand-elevated #1A1A24` / `--color-brand-border #2A2A38`) if you prefer strict token usage — the mock uses a slightly deeper input fill for contrast; either reads correctly.

### Category accent colors (dark)
Icon color when a category is selected (idle icon = `#8A8AA0`, idle label = `#B7B7C8`). Icons are **Lucide** (match `CategoryIcon.tsx`).

| Category | Lucide icon | Accent |
|---|---|---|
| Rent | `Home` | `#FF6B6B` |
| Transport | `Car` | `#4DA3FF` |
| Food | `UtensilsCrossed` | `#F5A623` |
| Groceries | `ShoppingCart` | `#6FD48A` |
| Fuel | `Fuel` | `#38BDF8` |
| Enjoyment | `Sparkles` | `#A78BFA` |
| Shopping | `ShoppingBag` | `#F472B6` |
| Health | `HeartPulse` | `#34D399` |
| Education | `GraduationCap` | `#FBBF24` |
| Utilities | `Plug` | `#FCD34D` |
| Subscription | `RefreshCw` | `#C084FC` |
| Debt | `Landmark` *(matches the Debts tab)* | `#FF5C5C` |
| Remittance | `Send` | `#60A5FA` |
| Other | `Layers` | `#9898B0` |
| ATM Cash Withdrawal *(non-spend)* | `Banknote` | `#C7C7D6` |
| Transfer *(non-spend)* | `BanknoteArrowUp` | `#93A7CE` |
| Currency Exchange *(non-spend)* | `BadgeDollarSign` *(distinct FX glyph)* | `#6FD4C0` |
| CC Payoff *(non-spend)* | `CreditCard` | `#F0A0A0` |
| Savings *(non-spend)* | `Coins` *(matches the Savings tab)* | `#F5C842` |

Selected tile: `background: rgba(accent, .15)`, `border: 1px solid rgba(accent, .55)`. Idle tile: `background:#16161f`, `border:1px solid #24242f` (spend) or **`1px dashed #34343f`** (non-spend). Non-spend tiles also carry a tiny `ArrowLeftRight` badge (13px, `#8A8AA0`) in the top-inline-end corner.

**Money-movement (non-spend) categories:** marked with a dashed tile border + a tiny corner `ArrowLeftRight` badge, and selecting one shows the blue per-selection banner. *(No always-on ⇄ explainer text in the modal — that guidance lives in the onboarding tutorial, not the form.)*

**No focus rings, ever.** Inputs and buttons must never show a browser focus ring, blue highlight box, or tap-highlight — set `outline:none` / `box-shadow:none` on `:focus` and `:focus-visible`, and `-webkit-tap-highlight-color:transparent`. Fields indicate focus only through the caret (and, at most, an existing border color). Do not add a focus outline anywhere in this flow.

> **Every category glyph is unique.** `CC Payoff` uses `CreditCard`, `Transfer` uses `BanknoteArrowUp`, `Currency Exchange` uses `BadgeDollarSign`. No two categories share a glyph.

> **Match tab icons.** Any category that corresponds to a top-level tab must reuse that tab's Lucide glyph (from `src/lib/navigation/bottomNavConfig.ts`), not a lookalike: **Savings → `Coins`** (gold), **Debt → `Landmark`**, **Subscription → `RefreshCw`**. Do **not** use `PiggyBank` for Savings. **Every category glyph must be unique** — `CC Payoff` uses `CreditCard` (not Landmark), `Transfer` uses `BanknoteArrowUp`, `Currency Exchange` uses `BadgeDollarSign` (distinct FX glyph). Tab glyphs for reference: home `LayoutDashboard`, expenses `Receipt`, debts `Landmark`, income `Wallet`, savings `Coins`, subscriptions `RefreshCw`, reports `BarChart3`, budget-setup `SlidersHorizontal`.

### Typography
- **Body/UI/labels:** DM Sans (`--font-sans`).
- **All numerals** (amount, currency code, dates, years): JetBrains Mono (`--font-mono`), tabular.
- Field micro-labels: 10px, weight 600, `text-transform:uppercase`, `letter-spacing:.08em`, color `#6E6E85`.
- Sheet title: 18px/600. Amount input: 24px/700 mono. Description: 15px/400. Note: 14px/400.

### Radius & spacing
- Sheet top corners `30px`; overlay sheets `26px`; calendar card `22px`; fields `14px`; note field `12px`; category tiles `15px`; pills/badges full.
- Field height 52px (amount/currency), 46px (description/note); CTA 54px; category tile 66×60px; icon buttons 34px.
- Sheet body padding `14px 20px 6px`, gap `14px` between field groups.

---

## Screen 1 — Add Expense (bottom sheet)

**Purpose:** log a new purchase fast, with enough detail. **Copy is clean & minimal.**

**Shell:** bottom sheet, `background:#111118`, top corners 30px, top hairline `#23232f`. **Content-height** (`max-height:82%` of viewport, scrolls if taller) — it should reach ~mid screen, not fill it. Drag handle (40×4, `#2A2A38`) centered at top. Enter: slide up + fade, 400ms `cubic-bezier(.22,1,.36,1)`.

**Header row:**
- Left: title **"Add expense"** (18/600 #fff).
- Right: **date pill** + **X**.
  - Date pill: `Calendar` icon (14px, #9898B0) + label (e.g. **"Today"**), 12/600, `#1A1A24` bg, `1px #2A2A38` border, full radius, `white-space:nowrap`. Tapping opens the **Unified Date Picker** (Screen 3). Default label **"Today"** (time is NOT shown — see behavior).
  - X: 34px icon button, `#1A1A24` bg, full radius, `#9898B0` icon.

**Body (scroll), top→bottom:**
1. **Amount + Currency** — grid `1fr 108px`, `gap:12px`, `align-items:end`.
   - Amount: label "AMOUNT"; field 52px, `#16161f`/`#26262f`, radius 14; inside: currency code (18/600 mono, `#5A5A72`) + `<input inputmode="decimal" placeholder="0.00">` 24/700 mono white.
   - Currency: label "CURRENCY"; 52px button showing code (16/600) + chevron; opens **currency dropdown** (Screen 3b).
2. **Description** — label "DESCRIPTION"; `<input placeholder="What was it for?">`, 46px.
3. **Category** — label "CATEGORY". Then a **horizontally-scrolling 2-row grid**: `grid-auto-flow:column; grid-template-rows:repeat(2,60px); grid-auto-columns:66px; gap:8px`. Hide the native scrollbar. Order = the table above (spend categories first, then non-spend). **Scroll indicator (subtle):** directly under the grid, a tiny **64px centered** 2px track (`#20202a`) with a muted grey thumb (`#4A4A58`) whose width = viewport/content ratio and whose position tracks `scrollLeft` live — a barely-there hint that the row scrolls, nothing louder. No "swipe" text, no arrow. Selecting a **non-spend** category still shows the blue info banner below.
4. **Payment method** — label "PAYMENT METHOD"; a **dropdown control** (58px, `#16161f`/`#26262f`, radius 14): color swatch (38px rounded-11, `rgba(color,.16)` bg, icon tinted `color`) + name (14/600, ellipsis) + subtitle (11/500 `#8A8AA0`, `"<Type> · <CUR> · ··<last4>"`) + chevron. Opens **payment dropdown** (Screen 3c).
5. **Note** — collapsed: a red text link **"＋ Add note"** (14/600 `#E50914`). Expanded: a 46px input with the **X (clear) inside the box** on the right (`padding-right:46px` so text never overlaps it); the X removes the note and collapses.

**Footer (pinned):** full-width **"Save expense"** CTA, 54px, `#E50914` (hover `#F40612`), radius 16, 16/600 white. Top hairline `#1c1c26`.

---

## Screen 2 — Edit Expense (same sheet, edit mode)

Identical layout and controls. Differences:
- **Pre-filled** from the expense being edited (amount, currency, description, category, payment method, date, and note if present — note is expanded when a note exists).
- Title **"Edit expense"**; CTA **"Save changes"**.
- **Dirty tracking:** compare current field values against the values loaded on open.
- **Close (X) behavior:**
  - If **no unsaved changes** → close silently.
  - If **unsaved changes** → open a centered confirm dialog (see below). (The backdrop tap on the sheet may follow the same rule; the prototype only wires the X — match to your app's convention.)
- **Discard / Save confirm dialog** (centered card, `#15151f`, `1px #2A2A38`, radius 20, max-width 300, `efPop` scale-in):
  - Title **"Save your changes?"**
  - Body: "You've edited this expense. Save your changes, or discard them and keep the original."
  - Buttons (stacked): **"Save changes"** (red, 48px) then **"Discard changes"** (outline `#2A2A38`, text `#FF6B6B`, 48px).
  - Save → persist + close. Discard → revert fields to the loaded snapshot + close the dialog.

---

## Screen 3 — Unified Date Picker (popup)  ⭐ reuse app-wide

**Purpose:** pick a **date** (day granularity). **Time is captured automatically on the backend** — do not show a time control.

**Presentation:** a **centered popup** over a dim scrim (`rgba(0,0,0,.62)`), `efPop` scale-in 220–300ms. **Not** a bottom sheet. Card: `#12121b`, `1px #2E2E3C`, radius 22, shadow `0 26px 64px -14px rgba(0,0,0,.7)`, `overflow:hidden`, max-width ~300px.

**Header bar** (`padding:11px 13px 10px`, **brand-red gradient** `linear-gradient(160deg,#F40612,#C5070F)` with a soft red glow `0 6px 18px -8px rgba(229,9,20,.6)` — this is the calendar's signature accent):
- Left: **Month button** + **Year button**, each a small translucent-white pill on the red header (`rgba(255,255,255,.15)` bg, `1px rgba(255,255,255,.3)`, radius 9, 14.5/700, chevron-down). When its picker is open the pill brightens (`rgba(255,255,255,.3)`) and the chevron rotates 180°.
  - **Month label is ALWAYS the 3-letter abbreviation** (Jan, Feb, … Dec) so the header never crowds the arrows/X regardless of month length.
- Right: **‹ ›** arrows (27px, translucent white `rgba(255,255,255,.16)`, white icon) + **X** close (27px). Arrows step the month in day-view, step the **year** in month-view. Arrows are hidden in year-view. X calls `onClose`.

**Content region — fixed height (~230px)** so the frame never resizes between views/months:

- **Day view (default):** weekday row `S M T W T F S` (10/700 `#7C7C92`). Then a **fixed 6-row (42-cell) grid** including **leading/trailing days from adjacent months** (rendered muted `#4B4B58`). Current-month days `#E8E8F0`, 13/600. **Selected** day: red fill `#E50914`, white, `box-shadow:0 4px 12px rgba(229,9,20,.4)`. **Today** (not selected): `rgba(229,9,20,.12)` bg, `#FF6B6B` text, plus a 4px red dot. Tapping any day (incl. an adjacent-month day) **selects it instantly and closes** the popup (no confirm step); adjacent-month taps also switch the visible month.
- **Month view:** 3×4 grid of `Jan…Dec` (14/600, tiles `#1B1B26`/`#2A2A38` radius 12). Current month = red fill; today's month = red-tinted border. Selecting a month returns to day view.
- **Year view (searchable dropdown):** a search input at top (`Type a year…`, numeric, mono, magnifier icon) that **filters** the list; then a scrolling 3-col grid of years **1970–2035** (tiles 40px). Current year = red fill; today's year = red-tinted. Selecting a year returns to day view. This is the "search by typing the year" affordance.

**Callback:** `onConfirm(label)` where `label` is a friendly string — `"Today"` if the picked day is today, else `"Sun, 12 Jul"` (`WD, D Mon`). The host sets the date pill to this label. `onClose()` dismisses.

### Screen 3b — Currency dropdown
Bottom-sheet list (`#14141b`, top corners 26). Header "Currency" + X. Rows: **code** (15/700 mono, fixed 46px column) + **name** (13/500 `#8A8AA0`) + red check on the selected one. List = `FIAT_CURRENCIES` (`AED, USD, EGP, EUR, GBP, SAR, KWD, QAR, BHD, OMR, MAD, TND, JOD`) with full names. Selecting sets currency + closes. Default currency = user's base currency.

### Screen 3c — Payment method dropdown
Bottom-sheet list. Header "Payment method" + X. Each row: swatch (36px, `rgba(color,.16)`, tinted Lucide icon by type) + name (14/600) + optional **"Default"** pill (9px uppercase `#9898B0` on `#22222c`) + subtitle (`"<Type> · <CUR> · ··<last4>"`) + red check when selected. Selecting sets method + closes.
**Last row:** **"＋ Add payment method"** (red-tinted, `rgba(229,9,20,.08)`, border `rgba(229,9,20,.28)`, text `#FF5C5C`) → opens **Add payment method** modal.

Type → icon/color/label (from `paymentMethodDefaults.ts` + `PAYMENT_METHOD_TYPE_OPTIONS`):
| type | label | Lucide | swatch color |
|---|---|---|---|
| `cash` | Cash | `Banknote` | `#C9C9D4` |
| `bank_transfer` | Bank account | `Landmark` | `#22C55E` |
| `card_credit` | Credit card | `CreditCard` | `#3B82F6` |
| `card_debit` | Debit card | `CreditCard` | `#A855F7` |
| `nol` | Nol card | `Ticket` | `#C0C0C0` (gold `#D4AF37` if name matches gold/vip/plus/platinum/premium) |
| `other` | Other | `Wallet` | `#9CA3AF` |

### Screen 3d — Add payment method modal
Reuse the existing `AddPaymentMethodSheet.tsx`. Fields (mirrors it exactly): **Name** (text), **Type** (chips, order `cash, bank_transfer, nol, card_credit, card_debit`), **Currency** (fiat select), **Last 4 digits** (shown only for `bank_transfer | card_credit | card_debit`, exactly 4 digits), **Set as default** (switch). CTA **"Add payment method"** (disabled until name is non-empty). On add: create the method, select it in the picker, and close both overlays.

---

## Interactions & behavior (summary)
- **Time is not user-entered.** The date picker is day-only; server sets the timestamp. Remove any time UI from the flow.
- **Date default:** "Today" (don't show a date until changed; label stays "Today").
- **Non-spend hint:** when the selected category is in `NON_SPEND_CATEGORIES` (`Savings`, `ATM Cash Withdrawal`, `Transfer`, `Currency Exchange`, `CC Payoff`), show the info banner: *"Money movement — this won't be deducted from your spending or budget."* (These categories are normally excluded from the entry list; surfacing them with the indicator lets users classify money-movement without affecting spend/budget totals. Keep `isNonSpendCategory()` as the source of truth.)
- **Category grid** scrolls horizontally, 2 rows, snappy; selection is single.
- **Overlays** slide up from bottom (`efUp`, 280ms) over a scrim; tap scrim or X to dismiss. The **calendar** and **confirm** are centered popups (`efPop`), not bottom sheets.
- **Amount** accepts `^[0-9]*\.?[0-9]*$`. **Save** disabled when amount ≤ 0 or empty and (for add) description empty — mirror existing `AddExpenseSheet` disabled rule.
- **Motion tokens:** sheet rise 400ms `cubic-bezier(.22,1,.36,1)`; overlay rise 280ms; fade 160–180ms; popup pop `scale(.94)→1` 220–300ms.

## State management
Keep `useAddExpenseSheet.ts` shape (`date, description, amount, currency, category, subcategory, paymentMethodId, notes, submitError`, `paymentMethods`, `categoryChipOptions`, `creditCardOutstandingHint`, `handleSubmit`). Add UI-only state for: `datePickerOpen`, `paymentSheetOpen`, `currencySheetOpen`, `noteExpanded`. For **edit**: capture an `initialSnapshot` on open; `isDirty = shallowDiff(current, initialSnapshot)`; drive the X→confirm behavior from `isDirty`.

## Assets
No image assets. All icons are **Lucide React** (already a dependency). No SVGs to import — use `lucide-react` components listed above. Fonts (DM Sans, JetBrains Mono) already loaded by the app.

## Files in this bundle
- `prototypes/Add Expense Redesign.dc.html` — canvas (add + edit + calendar side by side).
- `prototypes/Expense Form.dc.html` — the full form + all overlays (`mode` add/edit). **Primary reference.**
- `prototypes/Unified Calendar.dc.html` — the date picker.
- `README.md` — this document.

---

# ⬇️ COPY-PASTE PROMPT FOR CLAUDE CODE (implement the redesign)

> You are implementing a redesigned Add/Edit Expense flow in the Buddget app (Next.js 16, React 19, Tailwind v4, Base UI, Lucide, Zustand). Read `design_handoff_add_edit_expense/README.md` in full and the three prototypes in `prototypes/` — they are the source of truth for look and behavior. Recreate them **pixel-perfect** using the app's existing tokens (`--color-brand-*`, `--font-sans`, `--font-mono`) and primitives.
>
> Requirements (do all, no variations):
> 1. **Add Expense** (`AddExpenseSheet.tsx` + `AddExpenseForm.tsx`): content-height bottom sheet; header with title + date pill + X; body = amount+currency row, description, 2-row swipeable category **icon grid**, payment **dropdown**, optional note (collapsed red "＋ Add note" link → expands to an input with a **clear-X inside the box**); pinned "Save expense" CTA. Match all hex/size/radius/typography in the README.
> 2. **Category grid** (replace `ExpenseCategoryChips`): horizontal 2-row grid, 66×60 tiles, Lucide icon + label, accent colors per README, using `CategoryIcon.tsx` mappings. Selecting a `NON_SPEND_CATEGORIES` item shows the blue info banner and marks non-spend tiles with a dashed border + ArrowLeftRight badge.
> 3. **Payment dropdown** (replace `PaymentMethodChips`): a select control + bottom-sheet list of accounts (swatch/name/Default pill/subtitle/check) + a red "＋ Add payment method" row that opens the existing `AddPaymentMethodSheet`.
> 4. **Currency dropdown**: bottom-sheet list of `FIAT_CURRENCIES` with code + name + check.
> 5. **Edit Expense** (`EditExpenseSheet.tsx` + `EditExpenseForm.tsx`): same form, pre-filled, CTA "Save changes"; track dirty vs. the loaded snapshot; X (and, if it matches app convention, backdrop) opens a centered "Save your changes?" dialog with Save changes / Discard changes when dirty, else closes silently.
> 6. **Unified Date Picker** (new `src/components/ui/UnifiedDatePicker.tsx`): build exactly per README Screen 3 — centered popup, fixed-size 6-row grid with adjacent-month days, month grid, **searchable year dropdown**, abbreviated long month names, X close, `onConfirm(dateISO)`/`onClose()`. **No time control** (backend sets time). Wire it to the date pill in both add and edit.
> 7. Keep `useAddExpenseSheet.ts` behavior; add only UI open/close + edit dirty state. Preserve existing validation and `creditCardOutstandingHint`.
> 8. Verify against the prototypes with a screenshot pass; do not introduce new colors, fonts, or spacing outside the README/tokens.

---

# ⬇️ COPY-PASTE PROMPT: roll out the Unified Date Picker EVERYWHERE

> After building `src/components/ui/UnifiedDatePicker.tsx` (see README Screen 3), **replace every date-entry surface in the Buddget app** with it so all calendars look and behave identically.
>
> 1. **Find them all.** Search the codebase for date inputs and ad-hoc pickers: `grep -rn 'type="date"' src`, `grep -rn 'type="month"' src`, and review these known date surfaces:
>    - `src/components/features/expenses/AddExpenseForm.tsx` & `EditExpenseForm.tsx` (expense date)
>    - `src/components/modals/AddIncomeSheet.tsx` & `EditIncomeSheet.tsx` (income date)
>    - `src/components/modals/AddDebtSheet.tsx`, `EditDebtSheet.tsx`, `DebtGoalSheet.tsx`, `AddRecurringDebtPaymentSheet.tsx` (debt dates, due dates, payment dates)
>    - `src/components/modals/AddGoalSheet.tsx` (goal target date)
>    - `src/components/modals/AddSubscriptionSheet.tsx` (next billing / renewal date)
>    - `src/components/modals/HouseholdRentSheet.tsx`, `LifestyleSheet.tsx` (any date fields)
>    - `src/components/features/savings/AddToSavingsSheet.tsx`, `WithdrawFromSavingsSheet.tsx`, `UpdateBalanceSheet.tsx` (transaction dates)
>    - `src/components/expenses/ExpenseFilters.tsx` (date **range** filter — see note below)
>    - Reports/analytics date-range selectors, if present.
> 2. **Replace** each native/custom date input with a trigger (the app's date "pill": calendar icon + friendly label) that opens `UnifiedDatePicker` as a centered popup. Keep each surface's existing state/handler; just swap the UI. Convert `onConfirm` output to the ISO string each caller expects.
> 3. **Ranges** (filters/reports): compose two `UnifiedDatePicker` instances (Start / End) using the identical component; do not fork a second calendar. Optionally support a lightweight range mode later, but visuals must stay identical.
> 4. **Consistency rules:** one component, one style. No other calendar/date-input implementations may remain. Selected = brand red fill; today = red tint + dot; day-only (no time UI anywhere — timestamps are server-set); long month names abbreviate; year is a searchable dropdown; the popup is centered over a scrim. Remove now-dead date-input styling.
> 5. **Verify:** open each affected screen and confirm the same picker appears and returns correct values; run the app's tests (`npm run test`) and lint (`npm run lint`).

---

## Internationalization (Arabic / RTL)
Every component is bilingual. The prototypes take a `lang: 'en' | 'ar'` prop; in the real app, drive this off the existing `useT()` / locale (the app already ships `IBM Plex Sans Arabic` as `--font-sans-ar` and an Arabic locale). **Do not hardcode strings** — route all copy through the app's i18n dictionary; the Arabic below is the reference translation.

When `ar`:
- **Direction:** `dir="rtl"` on the root; the whole sheet, category grid, payment rows, and calendar mirror automatically.
- **Font:** `var(--font-sans-ar)` (IBM Plex Sans Arabic) for text; **numerals stay Western** in `--font-mono` (amounts, dates, years) — matching the app's tabular-figure convention.
- **Auto-flipping CSS:** use **logical properties** so nothing needs a second stylesheet — `text-align:start`, `padding-inline`, `inset-inline-end`/`inset-inline-start` (used for the note's clear-X, the non-spend badge, and the "set as default" toggle knob). Keep number inputs `dir="ltr"`.
- **Calendar:** Arabic month names (يناير…ديسمبر) and single-letter Arabic weekday heads (ح ن ث ر خ ج س); the red header, tap-to-pick, searchable year, and constant size are identical.

Reference strings (EN → AR):

| Key | English | Arabic |
|---|---|---|
| Title (add / edit) | Add expense / Edit expense | إضافة مصروف / تعديل المصروف |
| CTA (add / edit) | Save expense / Save changes | حفظ المصروف / حفظ التغييرات |
| Labels | Amount / Currency / Description / Category / Payment method | المبلغ / العملة / الوصف / الفئة / طريقة الدفع |
| Description placeholder | What was it for? | على ماذا صُرِف؟ |
| Category hint | (subtle scroll-position bar, no text) | (مؤشر تمرير خفي، بلا نص) |
| Note | Add note / Add a note | إضافة ملاحظة / أضف ملاحظة |
| Non-spend hint | Money movement — this won't be deducted from your spending or budget. | تحويل أموال — لن يُخصم هذا من إنفاقك أو ميزانيتك. |
| Add payment | Add payment method | إضافة طريقة دفع |
| Add-payment fields | Name / Type / Last 4 digits / Set as default / Default | الاسم / النوع / آخر ٤ أرقام / تعيين كافتراضي / افتراضي |
| Confirm | Save your changes? / Discard changes | حفظ التغييرات؟ / تجاهل التغييرات |
| Confirm body | You've edited this expense. Save your changes, or discard them and keep the original. | لقد عدّلتَ هذا المصروف. احفظ تغييراتك، أو تجاهلها واحتفظ بالأصل. |

**Category names (AR):** إيجار (Rent), مواصلات (Transport), طعام (Food), بقالة (Groceries), وقود (Fuel), ترفيه (Enjoyment), تسوّق (Shopping), صحة (Health), تعليم (Education), مرافق (Utilities), اشتراكات (Subs), ديون (Debt), تحويلات (Remittance), أخرى (Other), سحب نقدي (ATM), تحويل (Transfer), صرافة (Exchange), سداد بطاقة (CC Payoff), ادّخار (Savings).

**Payment type labels (AR):** نقد (cash), حساب بنكي (bank_transfer), بطاقة ائتمان (card_credit), بطاقة خصم (card_debit), بطاقة نول (nol), أخرى (other).

**Currency names (AR):** درهم إماراتي (AED), دولار أمريكي (USD), جنيه مصري (EGP), يورو (EUR), جنيه إسترليني (GBP), ريال سعودي (SAR), دينار كويتي (KWD), ريال قطري (QAR), دينار بحريني (BHD), ريال عماني (OMR), درهم مغربي (MAD), دينار تونسي (TND), دينار أردني (JOD).

### Prompt: add Arabic / RTL
> Make the Add/Edit Expense flow and the Unified Date Picker fully bilingual (English LTR + Arabic RTL), driven by the app's existing locale/`useT()`. Set `dir` on the modal roots, switch the font to `--font-sans-ar` for Arabic, and route every string through the i18n dictionary using the EN→AR reference table in `README.md` (labels, CTAs, placeholders, category names, payment-type labels, currency names, confirm dialog). Use CSS **logical properties** (`text-align:start`, `padding-inline`, `inset-inline-*`) so layout mirrors with no duplicated styles; keep numeric inputs and figures LTR/Western. In the calendar, show Arabic month + weekday names and keep the red header, searchable year, and constant frame identical. Verify both locales visually and confirm the toggle flips instantly.

---

## Screenshots (`screenshots/`)
Rendered references of the built prototypes:
- `01-add-en.png` — Add sheet (English).
- `02-edit-en.png` — Edit sheet, pre-filled (English).
- `03-calendar-en.png` — Date picker, day view (red header).
- `04-year-search-en.png` — Date picker, searchable year dropdown (filtered to "203").
- `05-payment-dropdown-en.png` — Payment-method account dropdown with "Add payment method".
- `06-discard-confirm-en.png` — "Save your changes?" discard/save dialog (edit).
- `07-add-ar.png` — Add sheet, Arabic RTL.
- `08-edit-ar.png` — Edit sheet, Arabic RTL.
- `09-calendar-ar.png` — Date picker, Arabic RTL, red header.
