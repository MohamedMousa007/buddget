# Buddget — Payment Methods (v4 FINAL) · Engineering handoff

**This document is the single source of truth. Build every screen to match it and the full-size screenshots in `screenshots_v4/` exactly — pixel-for-pixel.** When a number is given, use that number. Where something is unspecified, open the design file and match it; ask before deviating.

- **Design files (pixel truth), in `prototypes/`:**
  - **`Payment Methods Sheet v4.dc.html`** — the whole feature: one bottom sheet with two states (`wallet` view ↔ `setup` add/edit) + the on-card menu + the provider picker + the currency overlay. **Primary reference.**
  - **`Currency Sheet.dc.html`** — the **standalone, reusable currency picker component** (§4). Used here *and* everywhere in the app.
  - `Currency Selector.dc.html` — a page that presents the currency component on its own.
  - `Payment Methods v4.dc.html` — annotated canvas of all v4 states.
- **Screenshots:** `screenshots_v4/` — full-resolution, full-screen, uncropped (375×812). Referenced per screen below.
- **Design system:** Buddget DS. Fonts **DM Sans** (`var(--font-sans)`) for text, **JetBrains Mono** (`var(--font-mono)`) for every number (last-4, ISO code). Accent brand red **`#E50914`**.
- **Repo:** `MohamedMousa007/buddget` (Next.js 16 / React 19 / Tailwind v4 / Base UI / Lucide / Zustand).
- Mobile-first **375 × 812**, **dark theme**. Sentence case everywhere; uppercase only for 10px micro-labels. No focus rings (`outline:none`/`box-shadow:none`/`-webkit-tap-highlight-color:transparent`). Touch targets ≥44px. Respect `env(safe-area-inset-bottom)`.

---

## 0. What v4 is (and the decisions that are locked)

Payment methods is **not a settings page**. It's a **tab in the Profile menu** that opens a **bottom sheet**. That sheet has two states:

1. **Wallet** — your saved cards as a swipeable **carousel**; manage each card from a **⋯ dropdown on the card**; one **Add method** CTA.
2. **Setup** — add or edit a method, driven by a **live card preview**.

Locked decisions:
- **Cash is implicit.** Every user has Cash by default. It is **never** a card, a provider option, or a type chip.
- **No card flip, no back, no CVV.** Last-4 lives on the **front**.
- **DEFAULT is a centered watermark** on the card (like a hologram), never a corner badge.
- **⋯ opens a small dropdown popover** anchored to the card (not a full-width action sheet, no Cancel button).
- **Card top-left = the TYPE icon**; the provider is the **big name**. Provider **initials** (brand-coloured) appear only in the pickers.
- **One provider-browse pattern:** a *Popular options* grid + *Search all providers* → the picker sheet. No row-vs-dropdown duplication.
- **Currency uses the one unified `CurrencySheet` component** (§4) — the same component replaces every currency dropdown across the whole app.

---

## 1. Tokens (exact)

| Token | Value | Use |
|---|---|---|
| canvas | `#0A0A0F` | screen background behind the sheet |
| sheet / card surface | `#111118` | the main bottom sheet |
| overlay sheet fill | `#14141b` | currency sheet + provider picker sheet |
| elevated / field | `#1A1A24` | inputs, chips, icon buttons, tiles |
| field border | `#2A2A38` | field/border hairlines |
| default-row card | `#16161f` / border `#24242f` | the "Set as default" block |
| popover | `#1E1E28` / border `#34343f` | the on-card ⋯ menu |
| text primary | `#FFFFFF` | names, values |
| text secondary | `#CFCFE0` | body, toggle labels, chips |
| text muted | `#9898B0` | subtitles, idle icons |
| micro-label | `#6E6E85` | 10px uppercase labels |
| scrim | `rgba(0,0,0,.5)` (`.55` for pickers) | behind sheets |
| brand red | `#E50914` | CTAs, selected, default pill, check |
| green (set-default) | `#38D96B` (icon) / `#1DB954` | menu "set default" |
| error red-text | `#FF6B6B` | destructive/error |

**Radii:** main sheet top `26px`; currency/picker sheets top `24px`/`26px`; cards `20px`; fields/menus `12–14px`; type chips & popular chips `999px`; colour swatch `10px`; card icon chip `8px`. **Grabber:** 40×4 (38×4 on currency), `#2A2A38`, centered.

---

## 2. Screen 1 — Wallet (view & manage) · `screenshots_v4/01-wallet.png`, `02-wallet-card-menu.png`

Bottom sheet, `#111118`, top corners 26, `isolation:isolate` (so overlays stack above the cards). Content-height (sits at the bottom). Enter: slide up 340ms `cubic-bezier(.22,1,.36,1)` over the scrim.

**Header:** grabber; then row `padding:8px 18px` — title **"Payment methods"** (600·18) left, **X** (34px round `#1A1A24`, muted icon) right.

**Card carousel** (`height:224`, `margin-top:10`): saved methods as brand-coloured cards; the focused card is centred at scale 1, neighbours peek at `translateX(±132px) scale(.82) opacity .4`, hidden past ±2. Card `252×158`, radius 20, `padding:16px 18px`, `background: linear-gradient(140deg, shade(color,1.18), color 48%, shade(color,0.6))`, `box-shadow:0 18px 40px -14px shade(color,.5), inset 0 1px 0 rgba(255,255,255,.16)`, plus a top-right radial sheen.
- **Top-left:** TYPE icon in a `42×32` chip, radius 8, `rgba(255,255,255,.2)`, `padding:7px`, white Lucide glyph.
- **Top-right:** **⋯** button — `28×28`, **`background:transparent`** (no circle), `color:rgba(255,255,255,.92)`, `padding:3px`, nudged `margin:-2px -6px 0 0`.
- **Center (default only):** watermark `DEFAULT` — `font:800 32px DM Sans; letter-spacing:.2em; text-transform:uppercase; color:rgba(255,255,255,.15)`, absolutely centered, `pointer-events:none`.
- **Bottom:** provider **name** (700·20, ellipsis); a row with `•••• {last4}` (mono 14, `letter-spacing:.14em`) or the tag/`—`, and the currency ISO (mono 12, `rgba(255,255,255,.82)`) right.

**Dots** (`margin-top:6`): active `18×6` red `#E50914`, others `6×6` `#2A2A38`, radius 999. **Hint** (600·12.5 muted, centered): "Swipe your cards · tap ⋯ to manage".

**Footer CTA** (`padding:16px 18px calc(16px+safe-area)`): **Add method** — full-width, height 52, `#E50914`, radius 14, white 600·16, leading `+` icon. Opens Setup (§3).

### On-card ⋯ menu — a dropdown popover *(02)*
Tapping ⋯ opens a **small popover anchored to the card** (top-right), NOT a bottom sheet:
- A transparent full-sheet click-catcher (`z-index:30`) closes on outside tap.
- Popover: `z-index:31`, `top:92px; inset-inline-end:50px; width:200px`, `background:#1E1E28; border:1px solid #34343f; radius:14`, shadow `0 18px 44px -10px rgba(0,0,0,.7)`.
- **Header row:** the card's composed name (600·11.5 muted, ellipsis) + a **X** button (26px, bare) to close. *(No Cancel button.)*
- **Rows** (`padding:12px 14`, font 500·14, 1px `#2A2A38` dividers): **Edit** (pencil, `#CFCFE0` icon) · **Set as default** (star, `#38D96B` icon — **hidden when the card is already default**) · **Delete** (trash, `#FF6B6B` text+icon).
- Actions: Edit → opens Setup prefilled from the card. Set default → sets this method default (single-select; clears others). Delete → removes it.

---

## 3. Screen 2 — Setup (add / edit) · `03-setup-empty`, `04-setup-filled`, `05-provider-picker`, `06-currency-in-context`, `07-setup-popular-all`

Same bottom sheet, `max-height:96%`, scrolls. **Header:** back arrow (34px round, returns to wallet) + title (**"Add method"** / **"Edit method"**) + X. Footer: **Save method** CTA (height 52, radius 14; enabled `#E50914`/white, disabled `#1A1A24`/`#6E6E85`, `cursor:not-allowed`). Save is enabled when a provider name exists and (if 4-digits chosen) exactly 4 digits are entered.

Body top → bottom:

**1. Live card preview** (`262×164`, radius 20, centered). Empty state: `#161620`, `1px dashed #33333f`, a `+` chip, "NEW METHOD" (top-right micro), "Add a method" (muted). Once a provider/type is set it becomes the brand gradient with: **type icon** top-left, **type label** top-right (uppercase micro), provider **name** (700·22), `•••• {last4}` / tail (mono 15) + currency ISO. It fills **live** as every field changes (name, type glyph, last-4, colour, currency).

**2. Card colour** — micro-label `CARD COLOUR`, then a **horizontal slider** of ~25 swatches (`34×34`, radius 10, `box-shadow:0 0 0 1px rgba(255,255,255,.12)`; selected adds `border:2px solid #fff`). Default = the brand's **primary** colour; user can pick any. Palette (in order): `#2E5AAC #3B82F6 #0E86C0 #0EA5E9 #12A594 #1FA98A #2E8B57 #5E8B00 #84BD00 #C6A24E #E8A200 #F59E0B #F04E23 #E60000 #CF1F2E #B23A6B #EC4899 #D946A6 #8B7BF0 #7C3AED #5B3FA0 #4F008C #3A4256 #5A5A66 #22232E`.

**3. Provider — the one browse pattern.** Micro-label **`POPULAR OPTIONS`** (generic — **no country flag**, so it reads for one country or all three). Then a **4-column grid** of popular tiles (`74px`, radius 13, `#1A1A24`/`#2A2A38`; selected `rgba(brand,.14)`/`rgba(brand,.5)`): a `34×34` chip (radius 10, `rgba(brand,.18)`) with the provider's **initials** (`800 11px`, brand colour) + the provider name (600·10.5, ellipsis). Below the grid, a full-width **"Search all providers"** button (height 46, `#1A1A24`/`#2A2A38`, radius 12, search icon) → opens the **provider picker sheet**. Tapping a tile fills the card and jumps focus to the fields.
- `popularScope`: `user` → the user's country set (derived from base currency); `all` → a blended cross-country set (`07`). Default `user`; use `all` only when the user has no country.

**Provider picker sheet** *(05)* — bottom sheet, `#14141b`, radius 26. Header "Choose provider" + X. Search input ("Search banks, wallets, cards…") filters the **entire** catalogue. Grouped **POPULAR OPTIONS** then **ALL PROVIDERS**; each row = `38×38` initials chip (radius 11, `rgba(brand,.18)`) + provider name (600·14.5) + `{type} · {full name}` subtitle (muted). Selected row = red-tint + red border + check. Pinned bottom: **"Add a custom provider"** (red-tinted; when a search term exists, label becomes `Add "{term}" as custom`) → sets a custom provider with the typed name.

**4. Type** — micro-label `TYPE`, a horizontally-scrolling row of **7 chips** (no Cash): Bank account · Debit card · Credit card · Prepaid card · Wallet · BNPL · Other. Chip: height 38, radius 999; selected `rgba(color,.15)`/`rgba(color,.5)`/text = type colour, idle `#1A1A24`/`#2A2A38`/muted; leading 15px Lucide glyph. Type colours: bank_account `#22C55E`, debit_card `#A855F7`, credit_card `#3B82F6`, prepaid_card `#2DD4BF`, wallet `#FB923C`, bnpl `#EC4899`, other `#9CA3AF`. Type auto-sets from a brand and is changeable. Card top-left icon: `Landmark` (bank), `CreditCard` (debit/credit), `Ticket` (prepaid), `Wallet` (wallet), `Split` (bnpl), `Shapes` (other).

**5. Identifier** — micro-label `IDENTIFIER` + "optional". A 3-tab segmented control (each `flex:1`, height 44, radius 12; selected `#E50914`/white, idle `#1A1A24`/`#CFCFE0`/border `#2A2A38`): **4-digits** · **Label** · **None**. (For non-card/bank types only **Label** · **None** show — 4-digits is card/bank only: credit_card, debit_card, prepaid_card, bank_account.)
- **4-digits** field: **same box as every other field** — height 52, `#1A1A24`/`#2A2A38`, radius 12, `margin-top:10`. Mono 15, `letter-spacing:.1em`, **numeric only** (`inputmode="numeric" pattern="[0-9]*" maxlength="4" dir="ltr"` → pulls the number pad), placeholder **`e.g. 1234`**. Below it, a helper line (400·11.5 muted): **"Enter the last 4 digits of your card or account."** Invalid if 1–3 digits → Save disabled.
- **Label** field: same box, text, `maxlength=18`, placeholder "e.g. Personal, Salary, Gold".

**6. Currency** — micro-label `CURRENCY`, then a field (height 52, `#1A1A24`/`#2A2A38`, radius 12) showing **flag + ISO (mono 15) + full name (muted 13)** and a chevron. Tapping opens the **unified `CurrencySheet`** (§4) as an overlay; selecting sets the currency and reflects on the card. Prefills to the user's base currency.

**7. Set as default** — a `#16161f`/`#24242f` card, radius 14: "Set as default" (600·14) + "Use for new expenses" (muted 11.5), with a red toggle (46×28, knob 22). Single-select across the account.

**Name composition (unchanged, strict/auto):** display name = `Provider ••••1234` (with 4-digits) · `Provider · Tag` (with label) · else `Provider`. The user never free-types the whole name.

---

## 4. Unified Currency Sheet — a **separate reusable component** · `06-currency-in-context`, `08-currency-standalone`

> ⚠ **Build this once as `CurrencySheet` and use it for EVERY currency selection in the entire app** — expense, income, debts, savings, subscriptions, payment methods, settings/base-currency, reports. **Delete all other currency dropdowns.** It is a shared component, not a payment-methods-only widget.

Reference component: `prototypes/Currency Sheet.dc.html`. Props:

| Prop | Type | Purpose |
|---|---|---|
| `value` | `string` (ISO) | currently-selected code (red-tint row + check) |
| `onSelect` | `(code:string)=>void` | fired on row tap; caller sets state + closes |
| `base` | `string` (ISO) | user's base currency — pinned first under **Common** |
| `lang` | `'en'\|'ar'` | direction/copy |

**Presentation.** A bottom sheet, `#14141b`, top radius 24, grabber 38×4. **Compact by design — it must never exceed half the screen** (`max-height:50%`; the host wraps it in a bottom-anchored, full-width, `max-height:50%` container). It fills the container **full width** (the component root is `width:100%`).

**Anatomy** (top → bottom, `padding:8px 14px 12px`):
- Header: **"Currency"** (600·17) + **X** (30px round `#20202a`).
- **Search** input (height 40, `#0F0F16`/`#26262f`, radius 11, magnifier icon), placeholder "Search currency or country…". Filters by ISO code OR country/name.
- **List** (scrolls): section headers (9px uppercase muted, `padding:8px 6px 3px`). **Common** first = `base` + `AED, USD, EGP, EUR, GBP, SAR` (de-duped), then **All currencies** A→Z. Each row (`min-height:40`, `padding:4px 10`, radius 10, gap 11): **flag** (18px, 26px column) · **ISO code** (mono 700·14, 44px column) · **full name** (500·13.5 muted, ellipsis) · **check** (18px `#E50914`) when selected. Selected row = `background:rgba(229,9,20,.10)` + `border:1px solid rgba(229,9,20,.45)`.

**Currency data.** Full ISO-4217 world set with flag + English name — Gulf/Levant/North-Africa, Asian (JPY, CNY, INR, PKR, BDT, IDR, MYR, SGD, THB, PHP, VND, KRW, HKD, TWD, LKR, NPR, AFN, KZT, UZS, MMK…), European (EUR, GBP, CHF, SEK, NOK, DKK, PLN, CZK, HUF, RON, RUB, UAH…), African (ZAR, NGN, KES, GHS, ETB, UGX, TZS…), American (USD, CAD, BRL, MXN, ARS, CLP, COP, PEN…). **Exclude `ILS`.** Extend to the complete list in production.

---

## 5. Data / catalogue (extend `paymentMethodDefaults.ts`)

Make the UI data-driven — each brand entry:
```ts
{ id, name, short /* 2–3 letter initials, e.g. "CIB","VOD","MAD" */, type,
  colors: ['#primary', '#secondary'],   // card gradient defaults (card = primary)
  country /* 'EG'|'SA'|'AE'|undefined */, full? /* long name for subtitles */ }
```
- Card gradient = `linear-gradient(140deg, lighten(primary), primary, darken(primary))`; picker chip tint = `rgba(primary,.16–.18)`; provider initials colour = `primary`.
- **Popular sets** per country (examples): EG `InstaPay, Vodafone Cash, NBE, CIB, Meeza, valU, Fawry, Telda`; SA `mada, STC Pay, urpay, Al Rajhi, Tabby, Tamara, Apple Pay`; AE `Emirates NBD, ADCB, FAB, Careem Pay, e& money, Nol, Apple Pay`. `all` = a blended list.
- **8-type model** (Cash implicit): `cash · bank_account · debit_card · credit_card · prepaid_card · wallet · bnpl · other`. If migrating an older enum: `bank_transfer→bank_account`, `card_credit→credit_card`, `card_debit→debit_card`, `nol→prepaid_card` (as a brand), keep `cash`/`other`.
- Currency rows need a `flag` per ISO (emoji or asset).

---

## 6. States to verify (against `screenshots_v4/`)
| File | Screen |
|---|---|
| `01-wallet.png` | Wallet · carousel, default watermark, bare ⋯ |
| `02-wallet-card-menu.png` | On-card ⋯ dropdown (Edit / Delete; Set-default hidden when default) |
| `03-setup-empty.png` | Setup empty · colour slider + "Popular options" grid + Search all |
| `04-setup-filled.png` | Setup from CIB · card fills live |
| `05-provider-picker.png` | Provider picker sheet (search + Popular + All + custom) |
| `06-currency-in-context.png` | Currency sheet opened from Setup (compact, ≤½ screen) |
| `07-setup-popular-all.png` | `popularScope=all` blended providers |
| `08-currency-standalone.png` | The reusable Currency Sheet on its own |

---

## 7. ⬇️ COPY-PASTE PROMPT FOR CLAUDE CODE

> Implement **Payment methods (v4)** in the Buddget app (Next.js 16 / React 19 / Tailwind v4 / Base UI / Lucide / Zustand). Read `design_handoff_payment_methods/HANDOFF.md` in full and match `prototypes/Payment Methods Sheet v4.dc.html` + the full-size shots in `screenshots_v4/` **pixel-for-pixel**, using the app's tokens (`--color-brand-*`, `--font-sans`, `--font-mono`) and Base UI primitives. No new colours/fonts/radii outside §1. Scope:
>
> 1. **Entry point:** a **tab in the Profile menu** that opens a **bottom sheet** — not a settings page, no list view. The sheet has two states: `wallet` and `setup`.
> 2. **Wallet state:** saved methods as a **card carousel** (peek neighbours). **Cash is implicit — never render it as a card.** Each card: **type icon** top-left (Landmark/CreditCard/Ticket/Wallet/Split/Shapes), provider **name**, front `•••• last4`, currency ISO, and a **bare ⋯** (no circle) top-right. Default card shows a **centered `DEFAULT` watermark** (rgba white .15), never a corner badge. ⋯ opens a **small dropdown popover anchored to the card** (name + X · Edit · Set as default [hidden if already default] · Delete) — not a bottom action sheet, no Cancel. One **Add method** CTA. Default is single-select (enforce in the store).
> 3. **Setup state:** a **live card preview** on top that fills as fields change; a **~25-swatch colour slider** (default = brand primary, recolourable); provider browsing = a **"Popular options" grid** (brand-coloured **initials** tiles, generic label, no flag) + **"Search all providers"** → a **picker sheet** (search + Popular + All + **Add a custom provider**); **7 type chips** (no Cash); an **Identifier** segmented control **4-digits / Label / None** where the input is the **same size as other fields**, **numeric-only** (numpad), placeholder `e.g. 1234`, with helper "Enter the last 4 digits of your card or account." (4-digits only for card/bank types); a **Currency** field that opens the unified sheet; a **Set as default** toggle; and a **Save method** CTA (disabled until valid). Name is auto-composed (`Provider ••••1234` / `Provider · Tag` / `Provider`) — never free-typed. Edit opens Setup prefilled with a Delete affordance (via the card ⋯).
> 4. **Build `CurrencySheet` as a standalone, reusable component** (`prototypes/Currency Sheet.dc.html`): a compact bottom sheet (**≤ half the screen**), **flag + ISO code + full name**, searchable (code or country), **Common** pinned (base + AED/USD/EGP/EUR/GBP/SAR) then **all currencies A→Z**, red-tint selected row + check. Include the **full ISO-4217 world list** (Gulf, Levant, Asian, European, African, American), **exclude ILS**. Props `value`, `onSelect`, `base`, `lang`. **Replace every currency dropdown across the entire app with this one component** and delete the old ones.
> 5. Extend `paymentMethodDefaults.ts` so brands carry `colors:[primary,secondary]`, `short` initials, `type`, `country`. Verify each screen in §6 against the screenshots; ≥44px targets, safe-area insets, no focus rings, sentence case.
