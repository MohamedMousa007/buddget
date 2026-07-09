# Buddget — Expenses screen · Engineering handoff

**Status:** final design, ready to build. **This document is the single source of truth.** Build the screen to match it exactly — do not improvise layout, spacing, color, type, or behavior. Every value here is intentional; when a number is given, use that number. If something is genuinely unspecified, match `Buddget Expenses.dc.html` (the design file in this project) pixel-for-pixel and ask before deviating.

- **Design file (pixel truth):** `Buddget Expenses.dc.html` — open it and read the inline styles for anything not covered below.
- **Design system:** Buddget DS at `_ds/…`. Fonts: DM Sans (`var(--font-sans)`), JetBrains Mono (`var(--font-mono)`). Accent: brand red `#E50914`.
- **Repo target:** `MohamedMousa007/buddget` — the Expenses page, its transaction list, and the bottom nav.
- **Screenshots:** `./screenshots/` — full-resolution (2×), referenced throughout.

---

## 0. Hard constraints — read first

1. **🚫 DO NOT TOUCH the existing in-app `+` FAB — neither its UI nor its code.** The center floating `+` button and its behavior ship **exactly as they are today**. It **opens the quick-add menu** (the existing action sheet), on every screen. Do **not**:
   - re-wire it to open the Add-Expense form/modal directly,
   - restyle it, resize it, recolor it, move it, or add/remove any label around it,
   - change its press animation or its code path.
   It appears in the design (`screenshots/04-tabbar-fab.png`) only so you can see the full screen. Leave the component and its handler untouched.
2. **The Add-Expense entry point is the in-card CTA** (a red button inside the summary card, labeled `Add expense`, **no `+` glyph**). That is what opens the Add-Expense form. This is the only *new* affordance for adding an expense.
3. **The summary/hero card must not grow taller** than its previous height. The CTA occupies the vertical space the old "projected" footer row used.
4. **Amounts must never truncate or wrap.** See §7 (overflow rules) — this is the most important correctness requirement on this screen.
5. **Everything is sentence case.** Uppercase only for the 10px micro-labels (`SPENT THIS MONTH`, `AVG / DAY`) and the status pills (`REFUNDED`, `DECLINED`).

---

## 1. What changed vs. the current app (complete scope)

| # | Change | Detail |
|---|--------|--------|
| 1 | **Add-expense CTA moved into the summary card** | Full-width red button, label `Add expense`, **no icon**. Opens the Add-Expense form. |
| 2 | **`+` FAB behavior confirmed unchanged** | Opens the quick-add menu, as today. Do not modify UI or code. |
| 3 | **Spending-rate indicator relocated** | Now sits **under Avg / day** (top-right of the card): `▲ 6% faster vs June` in amber. The old bottom "projected" strip is **removed**. |
| 4 | **Transaction meta separator** | Time and payment method are separated by a **1px hairline vertical rule**, left-aligned and adjacent — not a wide space-between gap. Format: `2:47 PM │ Cash`. |
| 5 | **Month header dropdown cue** | The month/year is tappable (opens the date picker). Ship the **chevron** cue by default; four alternatives are documented (§6). |

Everything else on the screen (grouping, category chips, refund/declined logic, filters) is specified below and should be built as shown.

---

## 2. Screenshots

| File | Shows |
|------|-------|
| `screenshots/01-overview.png` | Header, month selector, summary card + CTA, filter row, first row |
| `screenshots/02-transaction-list.png` | Today group — hairline meta divider, refunded row, title ellipsis |
| `screenshots/03-refund-declined.png` | Refunded + Declined states, Yesterday & Jul 7 groups, category variety |
| `screenshots/04-tabbar-fab.png` | Bottom nav + the untouched `+` FAB |
| `screenshots/05-month-cues.png` | The five month-dropdown cue options |

---

## 3. Layout anatomy (top → bottom)

Device frame in the design is 375 × 812 (iPhone logical). Screen background = canvas token.

1. **Status bar** — 44px tall, `position:absolute; top:0`, canvas bg. `10:08` left (600 · 15px), signal/wifi/battery right. *(Native on device.)*
2. **Scroll region** — everything below the status bar scrolls; `padding-bottom:96px` so the last row clears the tab bar + FAB.
3. **App header** — `padding:14px 18px 8px`, space-between.
   - Left: wordmark `Bud`**`d`**`get` (800 · 20px · `letter-spacing:-0.02em`; the middle **d** is `#E50914`, rest = text-primary) · 1px × 16px vertical divider (border color) · `Expenses` (500 · 16px · text-secondary).
   - Right: avatar chip — 34px circle, chip bg, 1px border, initials `MA` (600 · 13px · text-secondary).
4. **Month selector row** — `padding:8px 18px 12px`, space-between, `align-items:center`.
   - Left: month button (§6). `July` (700 · 21px · `letter-spacing:-0.015em` · text-primary) + `2026` (500 · 14px · mono · muted) + dropdown cue.
   - Right: two 32px square buttons (prev / next month), `border-radius:10px`, chip bg, 1px border, 17px chevron-left / chevron-right in text-secondary, `gap:6px`.
5. **Summary (hero) card** — §4.
6. **Filter row** — §5.
7. **Transaction groups** — §6 date header + a card block of rows. Groups in the design: **Today (Jul 9)**, **Yesterday (Jul 8)**, **Jul 7**.
8. **`+` FAB** — untouched (§0.1). In the design: 60px red circle, `position:absolute; left:50%; bottom:44px; transform:translateX(-50%)`, 3px border in canvas color, `box-shadow:0 14px 30px -8px rgba(229,9,20,0.6)`, 28px white `+`.
9. **Bottom nav** — §8.
10. **Home indicator** — 134 × 5px pill, text-primary @ 40% opacity, centered `bottom:8px`.

---

## 4. Summary (hero) card — exact spec

Container: `margin:0 16px; background:<card>; border:1px solid <border>; border-radius:14px; padding:18px;`

Top row: `display:flex; justify-content:space-between; align-items:flex-start; gap:16px`.

**Left column** (`min-width:0`):
- Micro-label `SPENT THIS MONTH` — 600 · 10px · uppercase · `letter-spacing:0.08em` · muted.
- Value row (`margin-top:8px`, `align-items:baseline`, `gap:8px`): `23,870.75` (600 · 34px · **mono** · `letter-spacing:-0.02em` · `tabular-nums` · text-primary) + `EGP` (500 · 14px · sans · muted).
- Sub: `≈ $481.05` (`margin-top:5px` · 500 · 13px · mono · muted).

**Right column** (`text-align:right; flex-shrink:0`):
- Micro-label `AVG / DAY` — same style as above.
- Value `2,652.31` (`margin-top:8px` · 500 · 16px · mono · `tabular-nums` · text-secondary).
- Caption `EGP · 9 days` (`margin-top:3px` · 500 · 11px · muted · `white-space:nowrap`).
- **Spending rate** (`margin-top:9px`, inline-flex, `gap:5px`): 13px trending-up icon in amber `#FF9F0A` + text `6% faster` (600 · 11px · amber) + `vs June` (500 · muted). `white-space:nowrap`.

**CTA button** (`margin-top:16px`):
`width:100%; height:44px; border-radius:12px; background:#E50914; border:none; color:#fff; font:600 15px var(--font-sans); letter-spacing:-0.005em; box-shadow:0 10px 24px -10px rgba(229,9,20,0.55); cursor:pointer;`
Label: **`Add expense`** — text only, no icon, no `+`.
States: hover → `--color-brand-red-hover`; active press → `transform:translateY(1px)` (per DS press convention). Opens the Add-Expense form.

**Height rule:** the CTA replaces the removed bottom "projected" strip. Do not add rows or increase padding; the card's total height stays as before (~166px in the design).

---

## 5. Filter row

`margin-top:14px; padding:0 18px; display:flex; align-items:center; gap:8px`.

- **Sliders button** (pinned, does not scroll): 38 × 38px, `border-radius:11px`, chip bg, 1px border, 17px sliders-horizontal icon, text-secondary. Opens the advanced-filter sheet.
- **Scrolling chip track** (`position:relative; flex:1; min-width:0`): a horizontally-scrollable row (`display:flex; gap:8px; overflow-x:auto`, hidden scrollbar) of pill chips, each: `height:38px; padding:0 14px; border-radius:999px; chip bg; 1px border; font:500 13px sans; text-secondary; gap:7px`, with a 15px leading icon.
  - `Category` (grid icon), `Payment` (card icon), `Amount` (dollar icon). Trailing 24px spacer.
  - **Right fade + chevron** overlay: `position:absolute; right:0; width:44px`, `linear-gradient(90deg, transparent, <canvas> 62%)`, `pointer-events:none`, holding a 16px chevron-right (muted, opacity 0.9) — signals more chips scroll horizontally.

Active/selected chip state (when a filter is applied): use the DS selected-chip treatment (red border/tint) — follow `Button`/chip conventions in the DS.

---

## 6. Transaction groups & rows

### Date group header
`display:flex; align-items:baseline; justify-content:space-between; padding:22px 18px 8px` (first group) / `20px 18px 8px` (subsequent).
- Left: relative label `Today` / `Yesterday` / else the date `Jul 7` (700 · 15px · `letter-spacing:-0.01em` · text-primary) + when relative, the absolute date beside it `Jul 9` (500 · 12px · mono · muted, `gap:8px`).
- Right: **group total** — signed sum of that day's *effective* spend (500 · 11px · mono · `tabular-nums` · muted · nowrap), e.g. `−22,035.25 EGP`. **Refunded and declined rows contribute 0 to this total** (see logic below).

### Row card block
Wraps the group's rows: `background:<card>; border-top:1px solid <border>; border-bottom:1px solid <border>`. Between rows: a 1px divider `background:<border>; margin-left:82px` (inset past the icon column). No divider after the last row.

### Row
`display:flex; align-items:center; gap:12px; padding:12px 16px; min-height:72px`.

**A. Icon column** (`flex-shrink:0; width:54px; column, align-items:center; gap:5px`):
- 40px rounded square (`border-radius:11px`), background = category color @ **14% alpha**, holding a 20px Lucide glyph in the **full category color**.
- Category label under it: 600 · 9.5px · category color · `max-width:54px` · single line · ellipsis · centered.

**B. Middle column** (`flex:1; min-width:0`):
- **Title** — 600 · 15px · sans · text-primary, single line, `white-space:nowrap; overflow:hidden; text-overflow:ellipsis`. (When a status pill is present, title + pill sit in a `display:flex; align-items:center; gap:8px; overflow:hidden` row; the pill is `flex-shrink:0`, the title ellipsizes.)
- **Meta line** (`margin-top:6px; white-space:nowrap`): time (600 · 12px · mono · text-secondary), then payment method (500 · 12px · mono · muted) with `margin-left:9px; padding-left:9px; border-left:1px solid <border>`. **That left border is the hairline separator** — do not use a gap, do not right-align the method.

**C. Amount column** (`flex-shrink:0; text-align:right`):
- Primary amount — 500 · 15px · mono · `tabular-nums`. Color = text-primary normally; text-secondary + `text-decoration:line-through` when net-zeroed (refunded/declined).
- Secondary line (`margin-top:3px`, 500 · 11.5px · mono): FX estimate `≈ −$399.42` (muted) in the normal case, **or** a status note in the net-zero cases (see below).

### Category → color / icon map (as used in the design)
| Category | Color | Lucide icon |
|----------|-------|-------------|
| Transfers | `#AFA9EC` | `arrow-left-right` / `landmark` |
| Groceries | `#1DB954` | `shopping-cart` |
| Shopping | `#7EAEF9` | `shopping-bag` |
| Transport | `#7EAEF9` | `car` |
| Food | `#FF9F0A` | `utensils` |

Use the app's real `CategoryIcon.tsx` mapping in production; the table above documents what the mock shows. Icon chip bg = same color at 14% alpha.

### Row state logic (important — build these states)
- **Normal expense:** primary amount in text-primary; secondary = FX estimate in muted. Counts fully toward the day/month totals. *(Examples: Currency exchange, Scanned receipt, Transfer to 4151, Sandwich.)*
- **Refunded** *(net-zero)*: the purchase was returned. Show a `REFUNDED` pill (800 · 9.5px · uppercase · `letter-spacing:0.05em` · `padding:2.5px 8px` · `border-radius:999px` · bg `rgba(29,185,84,0.16)` · text `#1DB954`) after the title. Primary amount is **struck through** and dimmed to text-secondary. Secondary line becomes `↩ Returned <date>` (600 · 10.5px · mono · green `#1DB954`). Icon chip dimmed to `opacity:0.5`. **Excluded from day/month spend totals.** *(Example: Noon order.)*
- **Declined / blocked** *(net-zero)*: the charge never cleared. Show a `DECLINED` pill (same shape; bg `rgba(229,9,20,0.14)` · text `#F76D74`). Primary amount **struck through**, text-secondary. Secondary line becomes `✕ Blocked <date>` (600 · 10.5px · mono · muted). Icon chip `opacity:0.5`. **Excluded from totals.** *(Example: Careem ride.)*
- **Scanned/parsed origin:** rows created by receipt-scan or SMS parse read like any normal row (e.g. title `Scanned receipt`); no special chrome beyond the normal layout.

Rule of thumb: **any net-zero transaction** (refunded, declined, reversed) → struck-through primary amount + a status note in place of the FX line + dimmed icon + excluded from totals. Any settled expense → normal treatment, included in totals.

---

## 6b. Month dropdown cue (`screenshots/05-month-cues.png`)

The month/year opens the unified date picker on tap. Signal tappability with **one** of these — **ship `chevron`** unless product chooses otherwise:

| Option | Treatment |
|--------|-----------|
| **none** | No affordance. |
| **chevron** *(default)* | 14px chevron-down after `2026`, muted. |
| **underline** | 2px dashed underline under `July` (muted), `padding-bottom:3px`. |
| **chip** | Wrap `July 2026 ⌄` in a chip: chip bg, 1px border, `border-radius:12px`, `padding:6px 12px`, 13px chevron. |
| **badge** | A separate 24px rounded-square button (`border-radius:7px`, chip bg, 1px border) holding a 13px chevron, next to the label. |

*(In the design this is the `monthCaret` prop. Pick the final value in code.)*

---

## 7. ⚠ Text overflow & long-content rules — MUST implement

Real data varies wildly in length. Handle it deterministically. **Priority when horizontal space is tight: `amount` > `time` > `payment method` > `description`.** The amount is sacred; the description is the release valve.

1. **Amounts — never cut, never wrap, never abbreviate.**
   The amount column is `flex-shrink:0`, right-aligned, and sized to its content (`width` intrinsic). A very large value (e.g. `−1,238,450.00`) makes the amount column grow and the **middle (description) column shrink** — the amount always renders in full on one line. Use `font-variant-numeric:tabular-nums`. Do **not** apply compact notation (`1.2M`) to row amounts — compact notation is only for the summary/hero and projection figures where explicitly designed. The secondary `≈` line obeys the same rule (full, one line, right-aligned).
2. **Description / title — the only field allowed to visibly truncate.**
   `white-space:nowrap; overflow:hidden; text-overflow:ellipsis;` inside the `flex:1; min-width:0` middle column. **Never wrap to two lines** — row height must stay uniform (`min-height:72px`). The full title is available on tap (row → detail view). *(See `Currency exchange — …` in `screenshots/02-transaction-list.png`.)*
3. **Payment method — keep the identifying tail.**
   Method is short by contract: `Cash`, `Wallet`, or `{Bank} ••••{last4}`. Render after the hairline divider. If a bank name is unusually long, build the method as **two spans** — a shrinkable bank-name span (`overflow:hidden; text-overflow:ellipsis; min-width:0`) + a `flex-shrink:0` `••••1234` span — so the **last 4 digits are always visible** and only the bank name ellipsizes. Time never truncates (fixed short content). Method must never overlap or collide with the amount column.
4. **Category label** (under the icon): `max-width:54px`, single line, ellipsis.
5. **Extreme narrow width:** the secondary `≈` line may hide before the primary amount is ever touched. The primary amount is the **last** element permitted to be affected — and it must never truncate. If forced, drop the FX sub-line first.
6. **Status pill priority:** when both a status pill and a long title exist, the pill stays full width (`flex-shrink:0`) and the title ellipsizes around it.

**Verify against this test data** before sign-off:
- Merchant/title 40+ chars: `Annual subscription renewal — Adobe Creative Cloud` → title ellipsizes, one line, 72px row.
- Large amount: `−1,238,450.00 EGP` → shown in full, tabular, one line; description shrinks.
- Long method: `Commercial International Bank ••••7788` → bank name ellipsizes, `••••7788` stays visible.

---

## 8. Bottom navigation

`position:absolute; left:0; right:0; bottom:0; background:<tabBarGlass>; border-top:1px solid <border>; backdrop-filter:blur(12px); padding-bottom:20px` (safe-area bottom).

Row of five equal slots (`display:flex`, each `flex:1`, column, `align-items:center; gap:4px; padding:11px 0 7px`):
`Home` · `Expenses` (active) · **empty flex spacer (the FAB gap)** · `Debts` · `More`.
- Icons 23px Lucide (`home`, `receipt`, `landmark`, `menu`).
- Labels 10.5px (active 600, others 500).
- **Active item = `Expenses`**, colored red `#E50914`; all others muted.
- The center gap is a real empty `flex:1` slot the FAB floats over — **do not** place a nav item there.

---

## 9. Theme tokens (dark default; light in parentheses)

| Token | Dark | Light |
|-------|------|-------|
| canvas (page bg) | `#0A0A0F` | `#F5F5F7` |
| card | `#111118` | `#FFFFFF` |
| chip / elevated | `#1A1A24` | `#F0F0F4` |
| border | `#2A2A38` | `#D4D4DC` |
| text primary | `#FFFFFF` | `#1A1A24` |
| text secondary | `#CFCFE0` | `#5A5A72` |
| text muted | `#9898B0` | `#8A8AA0` |
| tab-bar glass | `rgba(10,10,15,0.86)` | `rgba(255,255,255,0.86)` |

Semantic: brand red `#E50914` (+ `--color-brand-red-hover`), income/refund green `#1DB954`, warning amber `#FF9F0A`, declined red-text `#F76D74`. Category colors per §6 table. Use the DS CSS variables in production rather than hard-coding these.

---

## 10. Do / Don't

**Do**
- Keep the `+` FAB and its quick-add-menu behavior byte-for-byte identical to today (UI and code).
- Put the icon-less `Add expense` CTA inside the summary card; it opens the Add-Expense form.
- Separate time and method with the 1px hairline `│`, left-aligned and adjacent.
- Keep the hero card at its existing height.
- Use tabular mono for every number; sentence case for copy; uppercase only for micro-labels/pills.
- Exclude refunded & declined rows from day/month totals; strike their amounts.

**Don't**
- Don't modify the `+` FAB's UI or code, and don't make it open the Add-Expense form.
- Don't add a `+` to the card CTA, and don't add any floating label near the FAB.
- Don't ever let the primary amount (or its `≈` line) truncate or wrap.
- Don't wrap transaction titles to two lines or change the 72px row height.
- Don't put a nav item in the center FAB gap.
- Don't invent colors, radii, or fonts outside the tokens above.

---

## 11. Implementation prompt (paste to the engineer / coding agent)

> Implement the Buddget **Expenses** screen per `design_handoff_expenses_screen/README.md` (single source of truth) and match `Buddget Expenses.dc.html` pixel-for-pixel. Use the existing Next.js 16 / React 19 / Tailwind v4 / Base UI stack and Buddget design tokens (DM Sans, JetBrains Mono, brand red `#E50914`). Scope, exactly:
>
> 1. **Do NOT touch the bottom-nav `+` FAB — neither UI nor code.** It keeps opening the existing quick-add menu on every screen. Do not re-wire it to the Add-Expense form, restyle/resize/move it, or change its handler. It's in the mock only for completeness.
> 2. **Summary/hero card:** add a full-width primary red button labeled `Add expense` (text only, **no `+` icon**; `height:44px`, `border-radius:12px`, `box-shadow:0 10px 24px -10px rgba(229,9,20,0.55)`) below the stats; it opens the Add-Expense form. Move the spending-rate indicator (`▲ 6% faster vs June`, amber `#FF9F0A`) to sit **under Avg / day** in the top-right. Remove the old bottom "projected" row. The card's total height must not increase.
> 3. **Transaction rows** (`min-height:72px`, uniform): icon column (40px chip @14% category color + 20px Lucide glyph + 9.5px category label). Middle column `flex:1; min-width:0` with a single-line ellipsizing title and a meta line `time │ method` where the method is separated by a **1px hairline left border** (`margin-left:9px; padding-left:9px; border-left:1px solid var(--border)`), left-aligned and adjacent — not a space-between gap. Amount column `flex-shrink:0`, right-aligned, mono tabular.
> 4. **Row states:** implement Refunded and Declined as net-zero — struck-through primary amount, a `REFUNDED` (green) / `DECLINED` (red) pill after the title, a status sub-line (`↩ Returned <date>` / `✕ Blocked <date>`) replacing the FX estimate, icon chip at `opacity:0.5`, and **exclude them from the day/month spend totals**.
> 5. **Month header:** month/year opens the unified date picker; render a **chevron-down** cue after the year (alternatives in README §6b).
> 6. **Overflow handling (critical):** amounts never truncate/wrap/abbreviate — the amount column is `flex-shrink:0`, tabular-nums, intrinsic width, and wins space over the description. Titles truncate to a single line with ellipsis inside a `flex:1; min-width:0` column (no 2-line wrap; keep 72px). Payment method: split into a shrinkable bank-name span + a `flex-shrink:0` `••••{last4}` span so the last 4 digits always stay visible; time never truncates. Verify with: a 40-char title, `−1,238,450.00 EGP`, and `Commercial International Bank ••••7788`.
>
> Match all spacing, radii, and type from README §§3–9 and the design file. Do not restyle anything outside this scope. Sentence case everywhere except the 10px micro-labels and status pills.
