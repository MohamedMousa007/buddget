# Buddget — Payment methods · Engineering handoff

**Status:** final design, ready to build. **This document is the single source of truth.** Build to match it exactly — don't improvise layout, spacing, color, type, or behavior. Every value here is intentional; when a number is given, use that number. Where something is unspecified, match the prototypes pixel-for-pixel and ask before deviating.

Two screens, mobile-first at **375 × 812** (iPhone logical), **dark theme default** (light spec'd in §10). Capacitor app — respect safe-area insets, ≥44×44px touch targets.

- **Design system:** Buddget DS at `_ds/…`. Fonts: **DM Sans** (`var(--font-sans)`), **JetBrains Mono** (`var(--font-mono)`, for numbers / last-4). Accent: brand red `#E50914`.
- **Design files (pixel truth), in `prototypes/`:**
  - `Payment Method Form.dc.html` — Screen 1, the Add/Edit bottom-sheet modal. Props: `country` (EG/SA/AE), `mode` (add/edit), `lang` (en/ar), `theme` (dark/light), `demo` (jumps to a state).
  - `Payment Methods Settings.dc.html` — Screen 2, the management page. Props: `variant` (populated/empty), `lang`, `theme`, `affordance` (none/menu/swipe).
  - `Payment Methods Showcase.dc.html` — a canvas laying **every state side-by-side**, each with a stable id badge (`1a`…`4b`) referenced throughout this doc.
- **Screenshots:** `./screenshots/` — full-resolution references, dark unless noted.
- **Repo target:** `MohamedMousa007/buddget` (Next.js 16 / React 19 / Tailwind v4 / Base UI / Lucide / Zustand).

> **About the design files.** They are HTML design references (Buddget "Design Components"), not production code to copy verbatim. Recreate them in the codebase with the app's existing tokens and primitives. They reference the DS token variables that already exist at `src/app/globals.css`.

---

## 0. Hard constraints — read first

1. **The last-4 renders exactly ONCE.** This handoff fixes a current bug where the last-4 shows twice on the settings list. The composed **name** carries `••••1234`; the **subtitle** is `{type label} · {currency}` and **never** repeats the digits. See §7.
2. **The user never free-types the whole method name.** Naming is strict/auto-composed from `provider` + an optional discriminator (see §6 name rule). The user only edits the parts.
3. **Progressive disclosure.** The catalogue is large; the modal must never dump it all at once. Quick-add (≤9 tiles) is the headline; everything else is search / type / browse (§5). See §11 for the "uncluttered at scale" strategy.
4. **One main type per method** drives all logic. Picking a brand auto-resolves its type. Types are the 8-value enum in §3 — **migrate** from the app's current 6-value enum per the mapping table.
5. **Sentence case everywhere.** Uppercase only for the 10px micro-labels (`TYPE`, `PROVIDER`, `POPULAR IN EGYPT`…) and the `DEFAULT` pill.
6. **No focus rings, ever.** `outline:none` / `box-shadow:none` on `:focus`/`:focus-visible`, `-webkit-tap-highlight-color:transparent`. Fields show focus only via the caret.
7. **Brand icons are legal-safe.** No proprietary logos are used. Each brand tile is a **type glyph tinted in the brand's colour** (§4). This is both the "known-brand" affordance and the generic fallback in one. If the team later licenses real logos, drop them into the same swatch chip.

---

## 1. Design tokens

### Colors — dark (default) / light
| Token | Dark | Light | Use |
|---|---|---|---|
| canvas | `#0A0A0F` | `#F5F5F7` | screen background / scrim base |
| card / sheet | `#111118` | `#FFFFFF` | sheet + page surface, list cards |
| elevated / chip | `#1A1A24` | `#F0F0F4` | inputs, chips, icon buttons, tiles |
| border | `#2A2A38` | `#D4D4DC` | hairline borders, dividers |
| text primary | `#FFFFFF` | `#1A1A24` | titles, values, names |
| text secondary | `#CFCFE0` | `#5A5A72` | body, toggle labels |
| text muted | `#9898B0` | `#8A8AA0` | meta, subtitles, idle icons |
| micro-label | `#6E6E85` | `#8A8AA0` | 10px uppercase field labels |
| scrim | `rgba(0,0,0,.5)` | `rgba(0,0,0,.5)` | behind the sheet |

Semantic (theme-independent): brand red `#E50914` (hover `#F40612`), green `#1DB954` (set-default / positive), amber `#FF9F0A` (warning), error red-text `#FF6B6B`, info blue `#7EB3F5` / `#B9D3F5`.

> In the prototypes the light theme is applied by overriding these as `--pm-*` CSS variables on the screen root; child styles use `var(--pm-token, <dark fallback>)` so dark paints instantly and light is a root override. In production, drive it off the app's existing `.dark` class / theme.

### Typography
- **DM Sans** for all UI, labels, names. **JetBrains Mono** for every numeral — last-4, currency code, counts — with `tabular-nums`.
- Micro-labels: 10px / 600 / `text-transform:uppercase` / `letter-spacing:.08em` / micro-label color.
- Sheet title 18/600. List name 15/600. Subtitle 12/500. Section header 10px micro. Type/currency name 13/500.

### Radius, spacing, sizing
- Bottom sheets: **top corners 26px** with a **40×4 grabber** centered. List cards & fields **12–14px**. Quick tiles **15px**. Pills / badges **999px**. Icon buttons **34px** round.
- Field height 48px; segmented control 36px inner; CTA 52px; quick tile 86px; list row `min-height:66px`; icon chip 40px (radius 11), tile glyph swatch 42px (radius 12).
- Sheet body padding `0 16px 20px`; field group gap 16–17px. List: card `padding 13px 12px 13px 14px`; row divider inset `margin-inline-start:62px`.

---

## 2. Domain model

Every payment method has exactly **one main type** and an auto-composed **name**. Optional bits: a **discriminator** (last-4 OR label/tag OR neither), a **currency**, a **default** flag, and — for `bnpl`/`credit_card` — an optional **settles-from** link to another method.

The app is **EG/SA/UAE-first**: the user's **base currency** derives their country (`EGP→Egypt`, `SAR→Saudi`, `AED→UAE`), which selects the Quick-add set and prefills currency. Every other country stays reachable through Search and Browse-all.

---

## 3. Type model (8 types) + migration

`cash · bank_account · debit_card · credit_card · prepaid_card · wallet · bnpl · other`

| type | label | plural (section header) | Lucide | swatch colour | last-4 field? | default discriminator |
|---|---|---|---|---|---|---|
| `cash` | Cash | Cash | `Banknote` | `#C9C9D4` | no | none |
| `bank_account` | Bank account | Bank accounts | `Landmark` | `#22C55E` | **yes** | last-4 |
| `debit_card` | Debit card | Debit cards | `CreditCard` | `#A855F7` | **yes** | last-4 |
| `credit_card` | Credit card | Credit cards | `CreditCard` | `#3B82F6` | **yes** | last-4 |
| `prepaid_card` | Prepaid card | Prepaid cards | `Ticket` | `#2DD4BF` | **yes** | none |
| `wallet` | Wallet | Wallets | `Wallet` | `#FB923C` | no | none |
| `bnpl` | BNPL | Buy now, pay later | `Split` | `#EC4899` | no | none |
| `other` | Other | Other | `Shapes` | `#9CA3AF` | no | none |

- **last-4 field** — the segmented "Last 4" option is only offered for `bank_account / debit_card / credit_card / prepaid_card`. Wallets, BNPL, cash, other get **Label / None** only.
- Credit and debit share the `CreditCard` glyph, differentiated by colour (blue vs purple) — matches the app's existing card treatment.

### Migration from the current app enum
The app today ships `cash · bank_transfer · card_credit · card_debit · nol · other`. Map on read/write:

| old | → new | note |
|---|---|---|
| `cash` | `cash` | — |
| `bank_transfer` | `bank_account` | rename only |
| `card_credit` | `credit_card` | rename only |
| `card_debit` | `debit_card` | rename only |
| `nol` | `prepaid_card` | Nol becomes a **brand** whose type is `prepaid_card`; keep the gold-name heuristic as a brand colour override |
| `other` | `other` | — |
| *(new)* | `prepaid_card` | Meeza-prepaid, gift/meal/fuel, Hafilat, Sayer… |
| *(new)* | `wallet` | Vodafone Cash, STC Pay, InstaPay, Apple/Google/Samsung Pay, Fawry, Telda, Wise/PayPal/Payoneer… |
| *(new)* | `bnpl` | Tabby, Tamara, valU, Sympl |

Write a one-time data migration + a compat shim in `paymentMethodDefaults.ts` so existing rows resolve to the new enum. `mada`/`Meeza-debit` → `debit_card`.

---

## 4. Brand catalogue

Picking a brand **auto-resolves type, icon and colour**; the user only confirms the discriminator + save. Brand tiles/rows use a **type glyph tinted in the brand colour** on a `rgba(colour,.16)` chip — no proprietary logos (see §0.7).

### Quick-add sets (the headline grid, per country — `POPULAR IN {country}` + flag)
- **Egypt 🇪🇬** — Cash, InstaPay, Vodafone Cash, NBE, CIB, Meeza, valU, Fawry, Telda
- **Saudi 🇸🇦** — Cash, mada, STC Pay, urpay, Al Rajhi, Apple Pay, Tabby, Tamara
- **UAE 🇦🇪** — Cash, Emirates NBD, ADCB, FAB, Careem Pay, e& money, Nol, Apple Pay, Tabby

### Brand → type resolution (representative — the production catalogue is exhaustive EG+GCC)
| brand | type | brand | type |
|---|---|---|---|
| Cash | `cash` | mada | `debit_card` |
| InstaPay | `wallet` | STC Pay / urpay | `wallet` |
| Vodafone Cash | `wallet` | Al Rajhi | `bank_account` |
| NBE / CIB | `bank_account` | Apple Pay | `wallet` |
| Meeza | `prepaid_card` | Tabby / Tamara | `bnpl` |
| valU / Sympl | `bnpl` | Emirates NBD / ADCB / FAB | `bank_account` |
| Fawry / Telda | `wallet` | Careem Pay / e& money | `wallet` |
| Nol | `prepaid_card` | Visa / Mastercard / Amex | `credit_card` |
| Wise / PayPal / Payoneer | `wallet` | HSBC / Wio / Liv | `bank_account` |

**Browse-all** groups these by country → 🇪🇬 Egypt / 🇸🇦 Saudi / 🇦🇪 UAE / 🌐 International, each a labelled list of brand rows (icon chip · name · `{type} · {full name}` subtitle · chevron).

---

## 5. Screen 1 — Add / Edit payment method (bottom-sheet modal)

**Shell:** bottom sheet, `background:card`, top corners 26px, top hairline `border`. **Content-height** (`max-height:94%`, scrolls if taller). 40×4 grabber. Enter: slide up 340ms `cubic-bezier(.22,1,.36,1)` over the scrim. Two steps: **Choose** → **Details**.

**Header:** back arrow (34px round, only on Details in add-mode) · title · X (34px round). Titles: **"Add payment method"** (choose), **"Set up method"** (details, add), **"Edit payment method"** (edit).

### 5a. Choose step *(showcase 1a–1e)*
Top → bottom inside the scroll region:

1. **Search box** (persistent, top) — 46px, `search` icon inset-start, placeholder "Search all banks & wallets…". Typing filters the **entire** catalogue (all countries) → replaces the browse area with a **Results** list. Empty query → browse mode.
2. **Quick-add** *(browse mode, the FIRST thing the user sees)* — micro-header `POPULAR IN {COUNTRY}` + flag, then a **3-column grid** of 86px tiles: tinted glyph swatch (42px) + short label. One tap → Details, prefilled (type/provider/icon/colour/currency). *(1a EG, 1b SA, 1c AE.)*
3. **Or pick a type** — a horizontally-scrolling row of the **8 type chips** (glyph + label). Tap → Details with that type set, provider blank.
4. **Browse all** — grouped by country → brand rows (see §4). Tap a row → Details prefilled.
5. **Custom / Other** — a persistent dashed row at the bottom ("Set it up manually") → Details with `type:other`, blank provider.

**Search results** *(1d)*: `RESULTS` label + brand rows. **No matches** *(1e)*: a centered empty block ("No matches / We couldn't find that in the catalogue. Add it as a custom method.") + a red **Add "{query}" as custom** button → Details with `type:other`, `provider = query`.

### 5b. Details step *(showcase 1f–1k)*
A **brand banner** (when arrived via a brand): tinted swatch + brand name + `{type} · {full name}`. Then the field stack (gap 16–17px):

- **Type** — the 8 type chips, current one selected (tinted). Changeable. Required for custom. Changing to a type that disallows last-4 auto-switches the discriminator to Label.
- **Provider** — text input, prefilled from the brand, editable. Placeholder "e.g. HSBC, Wio, my wallet". Required (Save disabled until non-empty).
- **Detail (optional)** — a **segmented control**: for card/bank types `[ Last 4 | Label | None ]`; otherwise `[ Label | None ]`.
  - **Last 4** → a 4-digit numeric field (mono, `letter-spacing:.32em`, `dir="ltr"`, `maxlength=4`). Invalid (1–3 digits) → red border + "Enter exactly 4 digits" and Save disabled *(1j)*.
  - **Label** → a short text field (`maxlength=18`, e.g. "Personal", "Salary", "Gold").
  - **None** → no extra field.
- **Currency** — a selector button (mono code + name) opening a bottom-sheet list of `FIAT_CURRENCIES` (`AED USD EGP EUR GBP SAR KWD QAR BHD OMR MAD TND JOD`) with code + name + red check. Prefilled to the user's base currency.
- **Settles from** *(only `bnpl` / `credit_card`)* — a selector opening a picker of **eligible methods** (the account that pays the installments) + a "None" option, with the helper line *"The account that pays these installments. Used to reflect the real outflow when a bill settles."* *(1h.)*
- **Name preview** — a READ-ONLY line (sparkle icon + composed name + `AUTO` pill). See §6.
- **Set as default** — a red-track toggle ("Use for new expenses").
- *(Edit only)* a **Delete method** outline button.

**Footer (pinned):** full-width CTA — **"Save method"** (add) / **"Save changes"** (edit), 52px, red, radius 14. Disabled (elevated bg, muted text) until valid (§0.2 / last-4 rule).

### 5c. Edit mode *(1k)*
Same Details layout, **prefilled** from the method, title "Edit payment method", CTA "Save changes", plus the Delete button. No back arrow (edit opens straight to Details).

---

## 6. Name-composition rule (strict / auto)

Compose the display name from `provider` + discriminator — the user never types the whole thing:

```
last-4 present   →  "{provider}  ••••{last4}"      e.g. "mada  ••••7781"
tag present      →  "{provider}  ·  {tag}"         e.g. "Vodafone Cash  ·  Personal"
neither          →  "{provider}"                    e.g. "InstaPay"
```

The Name-preview line shows this live and read-only. The **settings list** renders this exact string as the row name (§7).

---

## 7. Screen 2 — Settings › Payment methods *(showcase 2a–2d)*

A management page listing all saved methods **grouped by main type**.

**Chrome:** status bar → header (back button + "Payment methods" title). Below, a scroll region.

**Add CTA:** a prominent full-width red **"Add payment method"** button (52px, radius 14, red glow) at the top → opens Screen 1.

**Groups:** one section per **present** type, in the §3 order. Header = plural label (`BANK ACCOUNTS`) + a mono **count**. Each group is a card (`card` bg, `border`, radius 14) of rows separated by a hairline inset `margin-inline-start:62px`.

**Row** (`min-height:66px`, `padding 13px 12px 13px 14px`):
- **Icon chip** — 40px, radius 11, `rgba(brandColour,.16)` bg, glyph tinted brandColour (falls back to the type colour).
- **Name** — the composed name (§6), 15/600, single-line ellipsis. Followed by a red **`DEFAULT`** pill when default.
- **Subtitle** — `{type label} · {currency}`, 12/500 muted. **NO last-4 here** — the name already carries it (this is the bug fix).
- **Trailing** — a `⋮` menu button.

**Affordances:**
- **Menu** *(2c)* — the `⋮` opens a popover: **Edit** · **Set as default** (green star) · **Delete** (red). Row tap → Edit.
- **Swipe** *(2d)* — swiping a row reveals two full-height actions behind it: **Set default** (green, star) and **Delete** (red, trash). Mirrors under RTL (`inset-inline-end`, `translateX` flips sign).

**Empty state** *(2b)*: only the Cash group (Cash · EGP · `DEFAULT`) plus a blue info card — *"You only have cash so far. Add a bank, card, or wallet to track where each expense is paid from."*

---

## 8. State inventory (→ showcase ids + screenshots)

**Every state below is mounted, live and labelled, in `prototypes/Payment Methods Showcase.dc.html`** (open it and pan/zoom — each carries the id badge shown here). Individual PNGs in `screenshots/` cover the primary states (1a–1i); to regenerate any single state as a PNG, open the matching prototype with the props in the right-hand column.

| id | State | Screenshot / repro props |
|---|---|---|
| 1a | Quick-add · Egypt (default) | `01-quickadd-eg.png` |
| 1b | Quick-add · Saudi | `02-quickadd-sa.png` |
| 1c | Quick-add · UAE | `03-quickadd-ae.png` |
| 1d | Brand search · results | `04-search-results.png` |
| 1e | Search empty → add custom | `05-search-empty.png` |
| 1f | Details · card (last-4) | `06-details-card.png` |
| 1g | Details · wallet (tag, no digits) | `07-details-wallet.png` |
| 1h | Details · credit + settles-from | `08-details-settles.png` |
| 1i | Custom / Other (Save disabled) | `09-custom.png` |
| 1j | Last-4 validation error | Form `demo="error"` (showcase 1j) |
| 1k | Edit existing (prefilled) | Form `mode="edit"` (showcase 1k) |
| 2a | Settings · populated, grouped | Settings `variant="populated"` (showcase 2a) |
| 2b | Settings · empty (only Cash) | Settings `variant="empty"` (showcase 2b) |
| 2c | Settings · row menu | Settings `affordance="menu"` (showcase 2c) |
| 2d | Settings · swipe actions | Settings `affordance="swipe"` (showcase 2d) |
| 3a | Add modal · light | Form `theme="light"` (showcase 3a) |
| 3b | Settings · light | Settings `theme="light"` (showcase 3b) |
| 4a | Add modal · Arabic RTL | Form `lang="ar"` (showcase 4a) |
| 4b | Settings · Arabic RTL | Settings `lang="ar"` (showcase 4b) |

---

## 9. Interactions & behavior

- **Search** filters the whole catalogue by name/full-name substring, case-insensitive; replaces browse; empty result → add-as-custom.
- **Quick-add / brand tap** jumps straight to Details prefilled; the user typically only confirms discriminator + Save.
- **Type change** re-evaluates the discriminator options and resets to a legal default if the current one is now disallowed.
- **Last-4** accepts 0–4 digits; **exactly 4** to be valid; 1–3 shows the error and disables Save.
- **Save disabled** when provider is empty OR last-4 is partially entered.
- **Currency / settles-from** open as bottom-sheet pickers (`efUp`, 280ms) over a scrim; the sheet closes on select or X.
- **Default** is a single-select across the whole list — setting one clears the others (enforce in the store).
- **Delete / set-default** available via row menu or swipe on Screen 2 (and Delete inside Edit).

---

## 10. Light theme

Dark is the default and every state above is spec'd in dark. Light is a **full token swap** (§1) — same layout, radii, type. Reference pair: **3a** add modal (`16-light-add.png`), **3b** settings (`17-light-settings.png`). Drive it off the app's existing theme class; do not hand-tune per element.

---

## 11. Uncluttered at scale · touch · safe-area

- **Progressive disclosure** keeps the catalogue calm: ≤9 Quick-add tiles up front resolve the ~90% case in one tap; Search is the escape hatch to the long tail; Type chips and Browse-all are secondary; Custom is always last. No screen ever renders the full catalogue at once.
- **Touch targets ≥44px:** quick tiles 86px, list rows 66px, chips/segments/toggles/icon-buttons ≥34px hit area with padding to 44px. The CTA is 52px.
- **Safe-area:** the modal footer uses `padding-bottom: calc(16px + env(safe-area-inset-bottom))`; the settings page reserves the top status-bar area. Sheets pin to the bottom edge.

---

## 12. Internationalization (Arabic / RTL) *(4a, 4b)*

Every surface is bilingual and driven off the app locale / `useT()` — **do not hardcode strings**; the table below is the reference translation.

When `ar`: `dir="rtl"` on the screen root (the whole sheet, tiles, rows, segmented control, toggle, and pickers mirror automatically via **logical properties** — `text-align:start`, `padding-inline`, `inset-inline-*`). Text uses `var(--font-sans-ar)` (IBM Plex Sans Arabic); **numerals stay Western** in `--font-mono` (last-4, currency codes). Number inputs keep `dir="ltr"`.

| Key | English | Arabic |
|---|---|---|
| Screen 1 titles | Add payment method / Set up method / Edit payment method | إضافة طريقة دفع / إعداد الطريقة / تعديل الطريقة |
| Search placeholder | Search all banks & wallets… | ابحث في كل البنوك والمحافظ… |
| Section | Popular in {country} / Or pick a type / Browse all / Results | الأكثر شيوعًا في {الدولة} / أو اختر نوعًا / تصفّح الكل / النتائج |
| No matches | No matches / We couldn't find that in the catalogue. Add it as a custom method. | لا نتائج / لم نجد ذلك في الكتالوج. أضِفه كطريقة مخصّصة. |
| Add custom | Add "{q}" as custom | أضِف «{q}» كطريقة مخصّصة |
| Custom row | Custom / Other · Set it up manually | مخصّص / أخرى · إعداد يدوي |
| Fields | Type / Provider / Detail (optional) / Currency / Name preview / Settles from | النوع / المزوّد / تفصيل (اختياري) / العملة / معاينة الاسم / يُسدَّد من |
| Segments | Last 4 / Label / None | آخر ٤ / وسم / بلا |
| Provider ph | e.g. HSBC, Wio, my wallet | مثال: HSBC، محفظتي |
| Tag ph | e.g. Personal, Salary, Gold | مثال: شخصي، الراتب، ذهبي |
| Last-4 error | Enter exactly 4 digits | أدخل ٤ أرقام بالضبط |
| Settles helper | The account that pays these installments. Used to reflect the real outflow when a bill settles. | الحساب الذي يدفع هذه الأقساط. يُستخدم لعكس التدفّق الحقيقي عند سداد الفاتورة. |
| Set as default | Set as default · Use for new expenses | تعيين كافتراضي · استخدمها للمصروفات الجديدة |
| CTAs | Save method / Save changes / Delete method | حفظ الطريقة / حفظ التغييرات / حذف الطريقة |
| Screen 2 | Payment methods / Add payment method / Default | طرق الدفع / إضافة طريقة دفع / افتراضي |
| Row actions | Edit / Set as default / Delete | تعديل / تعيين كافتراضي / حذف |
| Empty hint | You only have cash so far. Add a bank, card, or wallet to track where each expense is paid from. | لديك النقد فقط حتى الآن. أضِف بنكًا أو بطاقة أو محفظة لتتبّع مصدر دفع كل مصروف. |

**Type labels (AR):** نقد (cash), حساب بنكي (bank_account), بطاقة خصم (debit_card), بطاقة ائتمان (credit_card), بطاقة مسبقة (prepaid_card), محفظة (wallet), قسّط (bnpl), أخرى (other).
**Currency names (AR):** درهم إماراتي (AED), دولار أمريكي (USD), جنيه مصري (EGP), يورو (EUR), جنيه إسترليني (GBP), ريال سعودي (SAR), دينار كويتي (KWD), ريال قطري (QAR), دينار بحريني (BHD), ريال عماني (OMR), درهم مغربي (MAD), دينار تونسي (TND), دينار أردني (JOD).

---

## 13. Files in this bundle
- `prototypes/Payment Method Form.dc.html` — Screen 1 (all states via `demo`/`mode`/`country`/`lang`/`theme` props). **Primary reference.**
- `prototypes/Payment Methods Settings.dc.html` — Screen 2 (`variant`/`affordance`/`lang`/`theme`).
- `prototypes/Payment Methods Showcase.dc.html` — canvas of every state (ids 1a–4b).
- `screenshots/` — rendered references (see §8).
- `README.md` — this document.

---

## 14. ⬇️ COPY-PASTE PROMPT FOR CLAUDE CODE

> You are implementing **Payment methods** in the Buddget app (Next.js 16 / React 19 / Tailwind v4 / Base UI / Lucide / Zustand). Read `design_handoff_payment_methods/README.md` in full and the three prototypes in `prototypes/` — they are the source of truth for look and behavior. Recreate them **pixel-perfect** with the app's tokens (`--color-brand-*`, `--font-sans`, `--font-mono`) and primitives.
>
> 1. **Type model:** migrate the payment-method type enum to the 8-value model (`cash · bank_account · debit_card · credit_card · prepaid_card · wallet · bnpl · other`) using the mapping in §3; add a compat shim + data migration so existing rows resolve. Keep per-type icon/colour from the §3 table.
> 2. **Brand catalogue:** add an exhaustive EG+GCC catalogue keyed by brand → `{type, colour}`; brand icons are **type glyphs tinted in the brand colour** (no proprietary logos). Provide Quick-add sets per country (§4) selected from the user's base currency.
> 3. **Screen 1 — Add/Edit modal** (`AddPaymentMethodSheet.tsx` + a new details form): content-height bottom sheet, two steps. Choose step = search box + Quick-add grid + type chips + Browse-all + Custom row. Details step = type chips, provider, segmented discriminator (Last 4 / Label / None with the §3 last-4 rule + validation), currency picker, settles-from (bnpl/credit only) with helper, read-only auto **name preview** (§6 rule), set-as-default toggle, pinned Save CTA. Edit mode prefills + adds Delete; disable Save until valid.
> 4. **Screen 2 — Settings › Payment methods** (`app/settings/payment-methods` + list components): grouped by type with counts, rows = tinted icon chip + composed name + `{type} · {currency}` subtitle + `DEFAULT` pill. **Render last-4 once** (in the name only) — fix the current double-render bug. Add CTA opens Screen 1. Implement row menu + swipe (edit / set-default / delete), single-select default enforced in the store, and the Cash-only empty state.
> 5. **i18n / RTL:** route all copy through the dictionary using §12; `dir="rtl"` + `--font-sans-ar` for Arabic, logical properties for mirroring, Western numerals in mono. **Light theme** via the app's theme class (token swap in §1) — verify the 3a/3b pair.
> 6. Verify every state in §8 against the screenshots; ≥44px touch targets, safe-area insets, no focus rings, sentence case. Introduce no colours/fonts/radii outside §1.

---

## 15. v3 — the card-first direction (chosen)

`v1` (§§5–12) stays as the token/logic reference. **v3 is the chosen visual direction** and supersedes v1's grid modal for the *Add* flow and the settings list. The card metaphor drives the whole feature — a live card preview during setup, and a card wallet as the management page. Everything below reuses the §1 tokens, the §3 8-type model, and the §6 name rule.

Presented together in **`prototypes/Payment Methods v3.dc.html`** (canvas, ids `s1`–`s5`, `w1`–`w5`). Files:
- `Payment Method Setup v3.dc.html` — the Add/Setup screen.
- `Payment Methods Wallet v3.dc.html` — the management page.

### 15.1 Decisions locked in
1. **No flip.** The card never turns over. **Last-4 renders on the front** — nothing implies a CVV, so it reads as secure.
2. **Card colour = brand palette, user-editable.** Each catalogue brand carries **two primary brand colours** (`colors: [primary, secondary]`); the card defaults to `primary`, and a swatch row (brand primary + secondary + 5 curated neutrals) lets the user recolour a card. Custom/typed providers fall back to neutral swatches. *(This is the "add brand colours to the catalogue" option from the brief — preferred over a free colour picker because it keeps cards on-brand by default.)*
3. **Unified currency dropdown.** One searchable control used everywhere: **flag + ISO code (mono) + full name**, filterable by code or name. Build once, reuse app-wide (expense, income, debts, savings…). Same visual for the provider dropdown.
4. **No country switcher in the UI.** The app derives country from the user's base currency (`EGP→EG`, `SAR→SA`, `AED→AE`); "Popular in {country}" follows. Tweak `popularScope` = `user` (that country) or `all` (blended across EG/SA/UAE) — default `user`; show `all` only if no country is set.

### 15.2 Setup screen (`Payment Method Setup v3`) — `s1`–`s5`
Full-screen, top → bottom: **live card preview** → **colour swatches** → **Popular in {country}** quick-fill chips → **Provider** dropdown (searchable list of popular + all + **Add a custom provider** text field) → **Type** chips (auto-set from provider, changeable) → **Identifier** segmented (Last 4 / Label / None per §3) → **Currency** dropdown (searchable, flags) → **Set as default** → **Save**. The card fills **live** as each field changes (name, type glyph/initials, last-4, colour, currency). Provider browsing is chips + dropdown, **not** a card swipe — you can't skim 60 providers as cards. Props: `country`, `lang`, `providerIcon`, `popularScope`, `demo` (empty / filled / providerOpen / currencyOpen / custom). Screenshots `24`–`26`.

### 15.3 Payment methods page (`Payment Methods Wallet v3`) — `w1`–`w5`
The management page. **Card wallet** (default): a swipeable carousel of the saved methods as brand-coloured cards; the focused card gets an action bar (**Set default** — hidden when already default — / **Edit** / **Delete**), a page-dot indicator, an add-tile at the end of the deck, and a pinned **Add payment method** CTA. A header toggle switches to **List** (tweak `browseStyle`): grouped by type with counts, brand-tinted chip + composed name (single last-4) + `{type} · {currency}` subtitle + `DEFAULT` pill + row menu (edit / set default / delete). **Empty** state = only the Cash card. Props: `browseStyle` (carousel / list), `variant` (populated / empty), `providerIcon`, `lang`, `demo` (default / menu). Screenshots `27`–`28`.

### 15.4 Tweaks (compare in-place)
- **`providerIcon`: glyph ↔ initials** — glyph = Lucide type icon tinted in brand colour; **initials** = first 3 letters of the provider (e.g. `CIB`, `VOD`, `MAD`) in the brand colour. Applies to the card chip, popular chips, provider rows, and wallet chips. *(For handoff: the catalogue should carry both — the type glyph AND a 2–3-letter short code — plus the `colors` pair; pick the icon mode by flag.)*
- **`browseStyle`: carousel ↔ list** — on the methods page (and reusable on the expense "select payment method" screen).
- **`popularScope`: user ↔ all**.

### 15.5 Catalogue shape for handoff (add to `paymentMethodDefaults.ts`)
Extend each brand entry so the UI is data-driven:
```ts
{ id, name, short /* 2–3 letters */, type,
  colors: ['#primary', '#secondary'],   // card gradient defaults
  country /* EG|SA|AE|undefined */, full? }
```
The card gradient is `linear-gradient(140deg, lighten(primary), primary, darken(primary))`; the icon chip tint is `rgba(primary,.16)`. Currency rows need a `flag` per ISO (emoji or asset).

### 15.6 Still open (say the word)
Not yet re-spec'd in v3: **edit mode** (Setup prefilled + Delete — wired visually via the wallet's Edit), **light theme**, **Arabic/RTL** (the DCs accept `lang="ar"` and mirror via logical properties, but AR strings aren't finalised for v3), and the **expense "select payment method"** surface (would reuse the same carousel/list). v1's §§1–12 remain the reference for tokens, migration, name rule, and i18n strings.

---

## 16. v4 — FINAL (supersedes v3). Sheet-based, from the Profile tab

**Build this.** v4 keeps v3's card metaphor and every token/rule from §§1–6, and locks the remaining decisions. v3 files stay as a backup only. Presented in **`prototypes/Payment Methods v4.dc.html`** (canvas, ids `v1`–`v6`, `b1`–`b4`).

Files:
- `Payment Methods Sheet v4.dc.html` — the whole feature as **one bottom sheet** with two states (`wallet` view ↔ `setup` add/edit). Props: `country`, `browseMode`, `popularScope`, `lang`, `demo`.
- `Currency Sheet.dc.html` — the **unified currency selector** (reused here and app-wide; §16.4).

### 16.1 Entry point & structure
- **Not a settings page.** Payment methods is a **tab inside the Profile menu**; tapping it opens a **bottom sheet**.
- **Sheet 1 — your cards** (`v1`): saved methods as a **card carousel** (exactly the v3 wallet carousel). One CTA at the bottom: **Add method**. **No list view** (removed).
- **Manage on the card** (`v2`): each card has a **⋯** button (top-inline-end). It opens an action sheet: **Edit** · **Set as default** (hidden when already default) · **Delete** · Cancel. This replaces the separate action bar — saves vertical space.
- **Sheet 2 — add / edit** (`v3`–`v6`): the setup sheet (also a bottom sheet). Back arrow returns to the carousel. Edit opens it prefilled from the card.

### 16.2 The card
- **Top-inline-start = the TYPE icon** (Lucide: `Landmark` bank, `CreditCard` debit/credit, `Ticket` prepaid, `Wallet` wallet, `Split` bnpl, `Shapes` other). Not the provider mark — the provider is the **big name** below, so nothing is duplicated.
- **Provider = initials** (first 3 letters, brand-coloured) — used in the **pickers** (popular tiles, provider sheet), never on the card (would duplicate the name).
- Last-4 on the **front**; no flip, no back, no CVV.
- **DEFAULT is a watermark.** On a default card, `DEFAULT` is a faint centred emboss (like a card hologram) — **not** a top badge (which used to collide with the type). The ⋯ button is **bare** (no background circle).
- **Manage = a dropdown popover, not a sheet.** Tapping ⋯ opens a small menu **anchored to the card** (card name + **X** to close · Edit · Set as default (hidden if already default) · Delete). No full-width action sheet, no Cancel button.

### 16.3 Setup screen — the fixes
- **Cash is implicit.** Every user owns Cash by default; it is **never** a card, a provider row, or a type chip. Types drop `cash` → 7 chips.
- **Card colour = a slider** of ~25 popular colours; the card **defaults to the brand primary**, recolourable.
- **One browse pattern (grid).** The old "Popular in EG" chips *and* a dropdown that re-listed popular is gone. The finalized flow is: a compact **popular grid** (brand-initial tiles) + a **"Search all providers"** button opening the full picker sheet — popular appears once. The label is generic **"Popular options"** (no country flag), so it reads for one country or all three. The **picker sheet** (`v5`) mirrors the currency sheet: search, Popular, All providers, **Add a custom provider**.
- **Identifier.** Segment renamed **"4-digits"** (was "Last 4"). The input is **numeric-only** (pulls the numpad), placeholder `e.g. 1234`, with a helper line *"Enter the last 4 digits of your card or account."* The box is now the **same size** as every other field (52px) — no longer taller/looser.
- **Currency** opens the **unified currency sheet** (§16.4), not a bespoke dropdown.
- Type chips, name rule (§6), and Set-as-default are unchanged. `popularScope` tweak: `user` / `all`.

### 16.4 Unified currency selector (also its own page: `Currency Selector.dc.html`)
A separate reusable bottom sheet — **build once, replace every currency dropdown in the app** with it (expense, income, debts, savings, subscriptions, payment methods…). It matches the existing expense-modal sheet (bold ISO code + full name, red-tint selected row + check) and adds:
- **Country flag** on every row (flag · `CODE` mono · full name).
- A **search** field (code or country name) — needed for the full list.
- **Common** pinned at top (base currency + AED/USD/EGP/EUR/GBP/SAR), then **all currencies A→Z**.
- **Compact:** tight rows and paddings so the sheet is **≤ half the screen** (`max-height:50%`) and never crowds the screen. **No `ILS`** in the list.
- The **full world set** (ISO-4217): Gulf/Levant/North-Africa, Asian (JPY, CNY, INR, PKR, IDR, MYR, SGD, THB, PHP, KRW, …), European, African, and American currencies — not just the MENA shortlist.
Props: `value`, `onSelect(code)`, `base`, `lang`. In the payment sheet it's mounted as an overlay via the same component.

### 16.5 Add-to-Claude-Code prompt (v4)
> Implement Payment methods as a **Profile-tab bottom sheet** (not a settings page), per `Payment Methods Sheet v4.dc.html`. Sheet state 1 = a **card carousel** of saved methods (Cash is implicit — never shown), each card = **type icon** top-start + provider **name** + front last-4 + a **⋯ action sheet** (edit / set default / delete). One **Add method** CTA. State 2 = the setup sheet: **live card preview**, a **~25-swatch colour slider** (default = brand primary), a **provider picker** (choose one of `browseMode` grid/sheet/search — no popular/search duplication; picker sheet mirrors the currency sheet with a custom-provider option; providers shown as **brand-coloured initials**), 7 **type** chips (no cash), a **consistent** Last-4/Label box, the **unified currency sheet**, and Set-as-default. Extend the brand catalogue with `colors:[primary,secondary]` + `short` initials. **Build `CurrencySheet` once** (flag + code + name, search, Common pinned, full ISO-4217 list) and **replace every currency dropdown across the whole app** with it.
