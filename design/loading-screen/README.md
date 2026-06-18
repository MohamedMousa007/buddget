# Handoff: Buddget — Post-sign-in Welcome screen

## Overview
A calm, branding-led **welcome / splash moment** shown right after a returning user signs in, while the app silently pulls and syncs their data in the background.

It is deliberately **not** a loading screen: no spinner, no progress bar, no percentage, no "syncing…" copy, no buttons. The user should never be aware that a sync is happening, and nothing here blocks entry into the app. Treat it as a premium "welcome back" beat that the app can show instantly and dismiss the moment the home screen is ready.

This is **design 6 — "Wordmark hero"**: the Buddget wordmark dominates as the hero, a time-aware greeting sits beneath it, and a small, generalized brand statement cycles along the bottom.

## About the design files
The files in this bundle are **design references created in HTML** — self-contained prototypes that show the intended look, motion, and copy. They are **not** production code to drop in as-is.

Your task is to **recreate this screen in the target codebase using its established environment and patterns** (the Buddget app is Next.js / React 19 / Tailwind v4 with a Capacitor iOS + Android shell — see the design-system notes below). If you are implementing in a different stack (SwiftUI, Compose, etc.), reproduce the same layout, type, color, motion, and behavior using that platform's idioms.

Open `welcome-screen-en.html` and `welcome-screen-ar.html` in a browser to see the exact intended result (including the time-aware greeting and the cycling statement). Fonts load from Google Fonts; in the real app, use the bundled font files.

## Fidelity
**High-fidelity (hifi).** Colors, typography, spacing, sizes, and motion are final. Recreate the screen pixel-for-pixel using the codebase's existing libraries. Exact values are documented under **Design tokens**.

---

## Screen: Welcome (Wordmark hero)

- **Name:** Welcome / post-sign-in splash
- **Purpose:** Greet the returning user by name and hold their attention for a beat while data syncs in the background. No interaction required or offered.
- **Canvas:** 390 × 844 (iPhone, design reference). **Full-bleed in the app** — the screen fills the device; the rounded corners in the comparison mockups came from the device frame only. Respect iOS safe areas (`viewport-fit=cover`; the OS status bar and Dynamic Island sit at the top — do **not** rebuild them, they are shown in the prototype for layout context only).

### Layout (top → bottom)
1. **Background** — a single fixed mid-tone vertical gradient that fills the screen.
2. **Ambient glow** — one soft red radial bloom anchored above the top edge, slowly breathing. Atmosphere only; it is not a loader indicator.
3. **Hero (vertically + horizontally centred)** — the **wordmark** with the **greeting line** directly beneath it.
4. **Statement ticker** — pinned near the bottom, horizontally centred; one short brand statement visible at a time, cross-fading on a loop.

### Components

**1. Background gradient**
- `linear-gradient(180deg, #2C2C35, #222229)` — top → bottom.
- Full screen, behind everything.

**2. Ambient glow (decorative)**
- Circle 400 × 400, positioned `top: -110px; left: 50%` (centred horizontally, mostly above the top edge).
- Fill: `radial-gradient(circle, rgba(229,9,20,.28), transparent 68%)`, `filter: blur(8px)`.
- Animation `wmBreathe`, 8s, `ease-in-out`, infinite (see **Interactions**).

**3. Wordmark (hero)**
- Text: **Buddget** rendered as `Bud` + `d` + `get`, where the **second "d" is brand red** — this is the canonical Buddget logotype.
  - `Bud` and `get`: `#FFFFFF`
  - `d`: `#E50914`
- Font: **DM Sans**, weight **800**, size **60px**, `letter-spacing: -2px`, `line-height: 1`.
- Always Latin / LTR, including in the Arabic layout (brand mark is not localized).

**4. Greeting line**
- Format: `<greeting>, <Name>` — e.g. "Good evening, Layla".
- Font: DM Sans, weight 400, size **18px**, color `rgba(255,255,255,.60)`; `margin-top: 22px` below the wordmark.
- The **name** is emphasized: weight 600, color `#FFFFFF`.
- The greeting word is **time-aware** — see **Greeting** section below.

**5. Statement ticker (cycling)**
- Container: `position:absolute; left:36px; right:36px; bottom:70px;` height ~54px (EN) / ~60px (AR), text centred.
- Three statements, each `position:absolute; bottom:0` (stacked in the same spot), only one visible at a time.
- Font: DM Sans, weight 400, size **19px**, `letter-spacing:-.3px`, `line-height:1.25`, color `rgba(255,255,255,.78)`.
- A key phrase in each is emphasized: weight 700, color `#E50914`.
- Copy (generalized to the app — **no user data**, so nothing to fetch):
  1. "Track your money **without trying.**"
  2. "Every expense, **caught** on its way."
  3. "**Private** by design, always."
- Cross-fade via `rotHead3` animation (below).

There are **no hover/active/focus states** — the screen is non-interactive.

---

## Greeting (time-aware) — keep it instant
The greeting word must adapt to **the user's local time and timezone, at the moment the screen is shown**. Because this screen sits in front of a background sync and must paint immediately, keep the computation trivial:

- **Synchronous, on first render. No network, no async, no i18n/date library required for the bucket.**
- Read the device's local hour (`new Date().getHours()` already resolves in the device timezone) and map to a bucket:
  - `hour < 12` → **Good morning** / **صباح الخير**
  - `hour < 18` → **Good afternoon** / **مساء الخير**
  - else → **Good evening** / **مساء الخير**
  - (Arabic commonly uses صباح الخير before noon and مساء الخير otherwise; refine buckets only if product wants a distinct "ظهر/afternoon" form.)
- The **name** comes from the already-signed-in user's **cached profile in the local store** — it is **not** fetched here. Inject it directly.
- Do not await anything before showing this screen. If for any reason the name isn't ready, fall back to the greeting alone (e.g. "Good evening").

Reference implementation is inline at the bottom of both HTML files (~10 lines of vanilla JS).

---

## Interactions & behavior
- **Entry/exit:** This screen is shown immediately on sign-in and dismissed (cross-fade or instant) as soon as the home screen is ready. It is time-boxed by the background sync, not by user action. Consider a minimum display (~0.8–1.2s) so it doesn't flash, and a maximum so a slow sync never traps the user — both controlled by the host, not this view.
- **No user input.** No buttons, links, or gestures.

### Animations
All motion is **CSS-only** and **looping** — there is no animation state to manage and nothing user- or data-driven.

- **`wmBreathe`** (ambient glow), 8s, ease-in-out, infinite:
  - `0% / 100%`: `transform: translateX(-50%) scale(1); opacity:.7`
  - `50%`: `transform: translateX(-50%) scale(1.14); opacity:1`
- **`rotHead3`** (statement cross-fade), 13.5s, ease-in-out, infinite, **`animation-fill-mode: backwards`** (critical — without it all three statements show at base opacity and overlap on first paint):
  - `0%`: `opacity:0; translateY(14px)`
  - `4%`: `opacity:1; translateY(0)`
  - `29%`: `opacity:1; translateY(0)`
  - `33%`: `opacity:0; translateY(-14px)`
  - `100%`: `opacity:0`
  - Three instances share the keyframe with staggered delays: **0s, 4.5s, 9s** (= 13.5s ÷ 3), so exactly one is visible at a time and they loop seamlessly.
- Respect `prefers-reduced-motion`: it's fine to drop the glow breathing and statement movement (show the statements as a simple fade, or hold one).

---

## State management
Minimal by design:
- **Greeting bucket** — derived once from the device clock at render. No stored state.
- **User name** — read from the existing signed-in-user profile in the local store. No fetch.
- **Statement cycling** — pure CSS; no JS timer, no state.
- **Background sync** — owned by the app shell, not this view. This screen only observes "sync done → dismiss".

---

## Design tokens

**Colors**
| Token | Hex | Use |
|---|---|---|
| Brand red | `#E50914` | the "d" in the wordmark, emphasized words, glow tint |
| Text / white | `#FFFFFF` | wordmark (Bud/get), user name |
| Greeting muted | `rgba(255,255,255,.60)` | greeting word |
| Statement | `rgba(255,255,255,.78)` | cycling statements |
| Screen gradient top | `#2C2C35` | background |
| Screen gradient bottom | `#222229` | background |
| Dynamic Island / OS | `#000000` | OS chrome (not built) |

These map to the Buddget palette (brand red `--color-brand-red: #E50914`). The mid-tone screen gradient is specific to this welcome moment (a single in-between shade, intentionally neither the near-black product canvas nor the light surface, so it reads identically without a light/dark variant).

**Typography**
- Latin: **DM Sans** — 800 (wordmark), 600 (name), 400 (greeting + statements).
- Arabic: **IBM Plex Sans Arabic** — same weights — for greeting + statements; the wordmark stays DM Sans.
- Numbers elsewhere in Buddget use JetBrains Mono (not needed on this screen).

**Spacing / sizing**
- Screen 390 × 844; horizontal padding for hero 36px; ticker inset 36px L/R, 70px from bottom.
- Wordmark 60px / `-2px`; greeting 18px, `margin-top:22px`; statements 19px / `-.3px` / `line-height 1.25`.

**Radius / shadow**
- None on the screen itself (full-bleed). The only radius in the prototype is the OS Dynamic Island (16px), which you do not build.

---

## Localization (Arabic / RTL)
`welcome-screen-ar.html` is the Arabic version:
- `dir="rtl"` on the screen; greeting and statements use **IBM Plex Sans Arabic**.
- The **wordmark stays Latin and LTR** (`direction: ltr` on that element).
- The OS status bar mirrors (time on the right) — handled by the OS in-app.
- Copy:
  - Greeting: صباح الخير (morning) / مساء الخير (afternoon + evening), name e.g. **ليلى**.
  - Statements: 
    1. "تتبَّع أموالك **دون عناء.**"
    2. "كل عملية شراء **تُرصَد** لحظة حدوثها."
    3. "**خصوصيتك** مصونة بالتصميم، دائمًا."
- Same gradient, glow, sizes, and animation timing as EN.

---

## Assets
- `assets/logo-wordmark-black-red.png` — Buddget wordmark, **dark text + red "d"**, transparent PNG (for light surfaces). 926 × 272.
- `assets/logo-wordmark-white-red.png` — Buddget wordmark, **white text + red "d"**, transparent PNG (for dark surfaces). 926 × 272.
- These reproduce the canonical logotype and are provided for reuse. **On this screen the wordmark is live text (DM Sans 800), not an image** — render it as text so it stays crisp and the "d" recolors cleanly. The PNGs are for places where an image mark is needed.
- No other imagery. Icons elsewhere in Buddget are Lucide (none on this screen).

## Files
- `welcome-screen-en.html` — English (LTR) reference, self-contained, with the time-aware greeting snippet inline.
- `welcome-screen-ar.html` — Arabic (RTL) reference, self-contained.
- `assets/logo-wordmark-black-red.png`, `assets/logo-wordmark-white-red.png` — brand wordmark PNGs.
- Source prototype (full set of explorations, design 6 = "Wordmark hero"): `Welcome Moment Minimal.dc.html` in the project root.
