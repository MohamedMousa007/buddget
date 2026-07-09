# Handoff: Glass Numpad (in-app numeric entry)

## Overview
A custom **bottom-sheet number pad** that slides up whenever the user enters a
numeric value, replacing the OS keyboard. It is used everywhere a number is
typed: expense & income amounts, debt / loan amounts, savings targets, budget
limits (`mode="decimal"`), and card last-4 / PIN entry (`mode="pin"`).

The chosen direction is **"glass-bare"**: the sheet reuses the app's sign-in /
loading screen treatment — a warm red-tinted radial glow over the near-black
vertical gradient, a breathing red glow blob, and a `backdrop-blur` glass
surface — with **borderless keys** (floating glyphs, no tile frames) so the
number stays the hero.

One component covers all fields; only two props change behaviour (`mode`,
`variant` is fixed to glass here) and one changes the label.

## About the Design Files
The files in `prototypes/` are **design references authored in HTML** (Design
Components — `*.dc.html`). They are prototypes showing the exact intended look
and behaviour; they are **not** production code to copy byte-for-byte.

The task is to **recreate this design in the Buddget codebase using its existing
stack and patterns** — Next.js 16 / React 19 / TypeScript, Tailwind CSS v4 +
CSS custom properties, Base UI primitives, lucide-react icons, Zustand state.
A ready, faithful React/TypeScript port is provided in `reference/` — prefer it
over re-deriving from the HTML.

- `reference/NumberPad.tsx` — drop-in glass-bare pad component (no-deviation port).
- `reference/AmountField.example.tsx` — how to wire it into a money field so the OS keyboard never appears.
- `prototypes/*.dc.html` — the original interactive prototypes for visual reference.

## Fidelity
**High-fidelity (hifi).** All colours, gradients, radii, typography, spacing,
motion and interaction are final. Recreate pixel-for-pixel. Every value in this
document and in `reference/NumberPad.tsx` is exact — do not substitute or
"improve" numbers. Where the app has an equivalent token (e.g.
`--color-brand-red` = `#E50914`), use the token; it resolves to the same value.

---

## Screens / Views

### 1. Number pad (bottom sheet) — the component
- **Purpose:** Enter a numeric value without the OS keyboard.
- **Layout:** Fixed to the bottom of the viewport, full width, sliding up from
  100% translateY. Anchored container `padding: 8px 16px 20px` (bottom padding
  extends with `env(safe-area-inset-bottom)`). Internal vertical order:
  1. Grab handle (centered)
  2. *(optional)* Display header — caption + amount (decimal) or dots (pin)
  3. Key grid — `display:grid; grid-template-columns:repeat(3,1fr); gap:4px`
  4. Done button (full width)
- **Sheet surface (glass):**
  - `background:` two stacked layers, in this order:
    - `radial-gradient(120% 82% at 50% -12%, rgba(229,9,20,.20) 0%, rgba(229,9,20,.05) 40%, rgba(20,18,26,0) 66%)`
    - `linear-gradient(180deg, rgba(30,25,34,.80) 0%, rgba(18,16,22,.86) 58%, rgba(12,10,16,.90) 100%)`
  - `backdrop-filter: blur(26px)` (+ `-webkit-` prefix)
  - `border-top: 1px solid rgba(255,255,255,.12)`
  - `box-shadow: 0 -20px 50px -20px rgba(0,0,0,.7), inset 0 1px 0 rgba(255,255,255,.06)`
  - `border-radius: 28px 28px 0 0`
  - `overflow: hidden`
  - Enter animation: `npUp .32s cubic-bezier(.22,1,.36,1)`
- **Scrim (behind sheet, above the form):** `position:absolute; inset:0;
  background: rgba(0,0,0,.25); backdrop-filter: blur(10px)`; enter
  `npFade .2s ease`. Tapping it closes the pad. This mirrors the app's sign-in
  modal scrim (`bg-black/25 backdrop-blur-md`) and keeps the form visible above.
- **Red glow blob (decorative, behind content):** `position:absolute; top:8%;
  left:50%; width:320px; height:320px; border-radius:50%; background:
  radial-gradient(circle, rgba(229,9,20,.30), transparent 68%); filter:
  blur(10px)`; animation `npGlow 8s ease-in-out infinite`; `z-index:0;
  pointer-events:none`. Content sits in a `position:relative; z-index:1` wrapper
  so the glow stays behind the keys. **Disable the animation under
  `prefers-reduced-motion: reduce`** (hold at `opacity:.7`), matching the
  WelcomeScreen behaviour.
- **Grab handle:** `width:40px; height:4px; border-radius:999px; background:
  rgba(255,255,255,.22); margin:2px auto 8px`.

- **Keys (glass-bare — borderless):**
  - Each key: `display:flex; align-items:center; justify-content:center;
    height:60px; border:none; border-radius:16px; cursor:pointer;
    user-select:none; background:transparent; transition:background .12s`.
  - Digit glyph: `color:#FFFFFF; font: 500 28px var(--font-mono)`.
  - Backspace key: same, `color:#C9C9D6`, renders the lucide **`Delete`** icon
    (backspace/erase-left) at `size=26, strokeWidth=2` — not a digit.
  - Pressed / `:active` state: `background: rgba(255,255,255,.12)`.
  - **Grid order (decimal):** `1 2 3 / 4 5 6 / 7 8 9 / . 0 ⌫`.
  - **Grid order (pin):** `1 2 3 / 4 5 6 / 7 8 9 / (empty) 0 ⌫` — no decimal key;
    bottom-left is an empty (hidden) cell.

- **Display header (optional — `showDisplay`):**
  - Wrapper `padding: 6px 6px 14px`.
  - Caption: `font: 600 10px var(--font-sans); letter-spacing:.09em;
    text-transform:uppercase; color:#8E8EA6; text-align:center;
    margin-bottom:9px`. Default text: `"Amount"` (decimal) / `"Card last 4
    digits"` (pin).
  - **Decimal readout:** flex, `align-items:baseline; justify-content:center;
    gap:9px`.
    - Currency: `font: 600 17px var(--font-mono); color:#8A8AA0`.
    - Amount: `font: 700 42px var(--font-mono); letter-spacing:-0.02em;
      line-height:1`; colour `#FFFFFF` when non-empty, `rgba(255,255,255,.32)`
      when empty. The amount is formatted with thousands separators (see
      Interactions).
  - **PIN readout:** four dots, flex `gap:16px`. Each dot `width:14px;
    height:14px; border-radius:999px; transition:all .15s`.
    - Filled (index < length): `background:#E50914; transform:scale(1);
      box-shadow:0 0 12px rgba(229,9,20,.5)`.
    - Empty: `background:rgba(255,255,255,.16); transform:scale(.82)`.

- **Done button:** `width:100%; height:54px; margin-top:10px; border:none;
  border-radius:16px; background: linear-gradient(160deg,#F40612,#C5070F);
  color:#fff; font: 600 16px var(--font-sans); box-shadow:
  0 10px 26px -10px rgba(229,9,20,.7); transition:filter .15s`. Hover:
  `filter: brightness(1.08)`. Label `"Done"` / `"تم"` (RTL).

### 2. Amount field (the trigger) — integration, not part of the component
- **Purpose:** Show the current amount and open the pad. Replaces the numeric
  `<input>`.
- **Critical:** render it as a **`<button>`**, never a focusable `<input>` — a
  native input opens the OS keyboard, defeating the pad. (If an `<input>` is
  unavoidable, set `readOnly`, `inputMode="none"`, and blur on focus.)
- **Style:** `display:flex; align-items:center; gap:8px; width:100%; height:52px;
  background:#16161f; border:1px solid #26262f; border-radius:14px;
  padding:0 14px; cursor:pointer`. While the pad is open, the border becomes
  `#E50914` (red focus ring).
  - Currency prefix: `font: 600 18px var(--font-mono); color:#5A5A72`.
  - Value: `font: 700 24px var(--font-mono); letter-spacing:-0.02em`; colour
    `#fff` when set, `#3F3F4D` for the `0.00` placeholder.
  - Caret: a `2×26px`, `#E50914`, `border-radius:2px` bar shown only while the
    pad is open, blinking via `@keyframes npBlink { 0%,50%{opacity:1}
    51%,100%{opacity:0} } 1.1s steps(1) infinite`.

See `reference/AmountField.example.tsx` for the complete wiring.

---

## Interactions & Behavior

### Typing rules (the input reducer — `nextValue(value, key, mode)`)
Ported verbatim in `reference/NumberPad.tsx`. The pad is **controlled**: each
key press computes the full next string and calls `onChange`. Rules:
- **Backspace:** remove the last character.
- **Decimal `.`** (decimal mode only): insert once; if the field is empty it
  becomes `"0."`. Ignored if a `.` already exists or in PIN mode.
- **Digit, decimal mode:** max **2** digits after the decimal point;
  leading-zero runs collapse (typing `0` then `5` → `"5"`, not `"05"`).
- **Digit, PIN mode:** appended, hard-capped at **4** characters.
- **Display formatting** (decimal): integer part grouped with
  `Number(int).toLocaleString('en-US')`; decimals shown exactly as typed;
  empty → `"0"`. (Grouping is display-only — the stored `value` stays a plain
  numeric string like `"1250.5"`.)

### Done / close
- **Done** and **scrim tap** both dismiss the pad. There is no separate confirm
  — the value is already live in the field via `onChange`.

### Animations & motion
| Name | Keyframes | Timing |
|---|---|---|
| `npUp` | `translateY(100%) → translateY(0)` | `.32s cubic-bezier(.22,1,.36,1)` (sheet) |
| `npFade` | `opacity 0 → 1` | `.2s ease` (scrim) |
| `npGlow` | `translate(-50%,0) scale(1) opacity .7 → scale(1.16) opacity 1 → back` | `8s ease-in-out infinite` (glow blob) |
| `npBlink` | `opacity 1 → 0` at 50% | `1.1s steps(1) infinite` (field caret) |
| key press | — | `background .12s`, active `rgba(255,255,255,.12)` |
| Done hover | — | `filter .15s` → `brightness(1.08)` |

`prefers-reduced-motion: reduce` → freeze the glow blob at `opacity:.7`.

### Behavior notes
- **OS keyboard is never shown.** The trigger is a button; the pad has no text
  input. This is the whole point of the feature.
- **Form stays visible.** The scrim is only 25% black + blur, so the field and
  form read through it. Position the pad so the active field remains above the
  sheet (the sheet occupies roughly the bottom half of a phone screen).
- **RTL:** pass `dir="rtl"` for Arabic; the pad is layout-symmetric, the Done
  label becomes `"تم"`, and the font switches to `var(--font-sans-ar)` at the
  call site. (English-only is fine for the first ship; the component already
  accepts `dir`.)

---

## State Management
- **`value`** — the numeric string. Owned by the field / form, not the pad. In
  Buddget this lives in the relevant form state (React `useState` or the
  appropriate Zustand slice for the add/edit-expense flow). The pad is a
  controlled component: `value` in, `onChange(next)` out.
- **`open`** — boolean, local to the field, toggles the pad. Set `true` on field
  tap, `false` on Done / scrim / close.
- **`mode`** — `'decimal'` for money fields, `'pin'` for card last-4.
- No data fetching. No global pad state needed; one `<NumberPad>` instance per
  open field, rendered via portal.

---

## Design Tokens

### Colours
| Token | Value | Use |
|---|---|---|
| Brand red (`--color-brand-red`) | `#E50914` | filled PIN dot, caret, focus ring |
| Red gradient top | `#F40612` | Done button start |
| Red gradient bottom | `#C5070F` | Done button end |
| Glow / tint red | `rgba(229,9,20,.20 / .05 / .30 / .50 / .7)` | sheet tint, glow, shadows |
| Sheet gradient stops | `rgba(30,25,34,.80)`, `rgba(18,16,22,.86)`, `rgba(12,10,16,.90)` | glass fill |
| Sign-in gradient (standalone bg) | `#1A1720 → #121016 → #0E0C12` (180deg) + red radial | PIN screen background |
| Key glyph | `#FFFFFF` | digits |
| Backspace glyph | `#C9C9D6` | delete key |
| Key press | `rgba(255,255,255,.12)` | `:active` |
| Handle | `rgba(255,255,255,.22)` | grab bar |
| Hairline | `rgba(255,255,255,.12)` | sheet top border |
| Caption | `#8E8EA6` | header micro-label |
| Currency (header) | `#8A8AA0` | display |
| Amount empty | `rgba(255,255,255,.32)` | placeholder in header |
| Empty PIN dot | `rgba(255,255,255,.16)` | dots |
| Field bg | `#16161f` | amount field |
| Field border | `#26262f` / `#E50914` (open) | amount field |
| Field currency | `#5A5A72` | prefix |
| Field placeholder | `#3F3F4D` | `0.00` |
| Scrim | `rgba(0,0,0,.25)` + `blur(10px)` | overlay |

### Typography
- **Figures / keys / amount:** `var(--font-mono)` = **JetBrains Mono**,
  `font-variant-numeric: tabular-nums` where columns must align.
  - Keys `500 / 28px` · header amount `700 / 42px / -0.02em` · header currency
    `600 / 17px` · field value `700 / 24px / -0.02em` · field prefix `600 / 18px`.
- **UI / labels / Done:** `var(--font-sans)` = **DM Sans**.
  - Caption `600 / 10px / .09em / uppercase` · Done `600 / 16px`.
- **Arabic:** `var(--font-sans-ar)` (IBM Plex Sans Arabic) at the call site.

### Spacing, radius, sizing
- Key height **60px**; grid gap **4px**; 3 columns.
- Done **54px** tall, `margin-top:10px`.
- Sheet padding `8px 16px 20px` (+ safe-area bottom); radius **28px** top corners.
- Key radius **16px**; field radius **14px**; field height **52px**.
- Glow blob **320×320**, `blur(10px)`; sheet `backdrop-blur(26px)`; scrim
  `blur(10px)`.

### Shadows
- Sheet: `0 -20px 50px -20px rgba(0,0,0,.7), inset 0 1px 0 rgba(255,255,255,.06)`.
- Done: `0 10px 26px -10px rgba(229,9,20,.7)`.
- Filled PIN dot: `0 0 12px rgba(229,9,20,.5)`.

---

## Accessibility
- Sheet is `role="dialog" aria-modal="true"` with an `aria-label` from the
  caption; scrim button is `aria-label="Close number pad"`.
- Digit keys `aria-label` = the digit; backspace `aria-label="Delete"`.
- Respect `prefers-reduced-motion` for the glow (freeze it).
- Hit targets: keys are 60px tall (≥44px min). Keep them so on small screens.
- Consider trapping focus within the sheet while open and returning focus to the
  field on close (standard modal behaviour with your Base UI / dialog patterns).

## Assets
- **Backspace icon:** lucide-react `Delete`. No other image assets — the pad is
  pure CSS. Fonts already exist in the app (DM Sans, JetBrains Mono, IBM Plex
  Sans Arabic).

## Files
### Reference implementation (use these)
- `reference/NumberPad.tsx` — the glass-bare pad, faithful port.
- `reference/AmountField.example.tsx` — trigger field + portal wiring.

### Prototypes (visual reference)
- `prototypes/Numpad.dc.html` — the component; `variant="glassBare"` is the
  chosen direction (also contains `bare`, `tiles`, `glass` for context).
- `prototypes/Expense Form Numpad.dc.html` — the pad integrated into the
  add/edit-expense form (amount field trigger).
- `prototypes/Numpad Showcase.dc.html` — side-by-side of all four directions.
- `prototypes/support.js` — runtime for the `.dc.html` prototypes (reference only).
