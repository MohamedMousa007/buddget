# Handoff: SMS Auto-Tracking Setup Guide

## Overview
An in-app onboarding guide that walks a Buddget user through creating an **iOS Shortcuts
Automation** that forwards bank SMS messages into Buddget's `Catch Bank SMS` action, so
transactions are logged automatically. It is a two-panel flow:

1. **Intro panel** — a branded hero explaining the value (a bank SMS becomes a logged expense).
2. **Guided setup panel** — a 15-step carousel. Steps 1–14 each show a real iOS screenshot with
   a pulsing underline + arrow pointing at the exact control to tap; one step (the 5th) is a
   "Think of a keyword" teaching screen (no screenshot); the final step is a success state.

This guide is intended to run **inside the Buddget iOS app** (Capacitor WKWebView), not the web PWA.

## About the Design Files
The files in this bundle are **design references created in HTML** — a working prototype that shows
the intended look, copy, motion, and behavior. They are **not** production code to drop in directly.
They use a lightweight in-house template runtime (`*.dc.html` with a `renderVals()` method) that is
**not** part of your app.

**Task:** recreate this design as a normal **React/TSX component** in the existing Buddget codebase
(`MohamedMousa007/buddget`, Next.js 16 / React 19 / Tailwind v4 / Base UI / Framer Motion), reusing
the app's existing components and patterns. The HTML is the spec; the implementation should be idiomatic
to the codebase.

## Fidelity
**High-fidelity.** Colors, typography, spacing, radii, motion, and copy are final. Recreate pixel-for-pixel
using the app's design system (the values below already match `src/app/globals.css` tokens). Where this
doc names a token (e.g. `--color-brand-card`), use the codebase token, not a hard-coded hex.

---

## How to view the reference

| File | How to open | What it is |
|---|---|---|
| **`annotated-reference.html`** | **Double-click — opens in any browser.** | The canonical visual spec: all 15 steps on one page with the exact arrow/underline annotations and a **dark/light toggle**. Start here. |
| `reference/screen-01…14.png` | Image viewer | Crisp, full-frame render of each guided step (device bezel + annotations). Drop these into tickets/PRs. |
| `StarterComponent.tsx` | Read in your editor | The faithful React/TSX port to adapt (see "Handing off"). |
| `SMS Tracking Setup.dc.html` / `(Light).dc.html` | **Will NOT render by double-click.** | The original interactive source. It loads a preview-tool runtime (`support.js`) and the `_ds/` component bundle via relative paths that aren't in this folder, so opening it standalone shows a blank page. It's included only as the exact behavioral/source reference — read the logic class at the bottom for the precise `STEPS` array and render logic. To see it *running*, view it inside the design tool.

> TL;DR — to **see** the design, open `annotated-reference.html`. To **build** it, work from `StarterComponent.tsx` + this README. Ignore the `.dc.html` unless you want to diff exact logic.

---

## Screens / Views

The whole experience is a single 390×844 frame (one mobile screen). Internally it is a horizontal
slider with two 390-wide panels; navigation slides between them with
`transform: translateX(...)` and `transition: transform .44s cubic-bezier(.4,0,.2,1)`.

### Panel 1 — Intro
- **Purpose:** sell the feature and start the flow.
- **Layout:** vertical flex column, full height.
  - **Brand row** (top, padding 24/26): 30×30 rounded-9px red square with white bold "B"
    (`box-shadow: 0 4px 14px rgba(229,9,20,.35)`) + "Buddget" 16px/800.
  - **Hero** (fixed height 360px, centered): animated stack —
    1. A **bank-SMS notification card** (302px wide, `--color-brand-card`, 1px `--color-brand-border`,
       radius 18, shadow `0 10px 26px rgba(0,0,0,.4)`): 34×34 rounded-9 green (#34C759) Messages glyph,
       "MyBank" 12.5/700 + "now" 10.5 muted, body 12.5 `--color-brand-text-secondary` with the amount
       `EGP 45.00` in JetBrains Mono.
    2. A **connector**: 2px vertical line (`--color-brand-border`), with an 8px red dot that travels
       top→bottom on a 2.6s loop (`heroDot`).
    3. A **parsed expense card** (302px, `--color-brand-card`, radius 18): label "LOGGED IN BUDDGET"
       (10px/700 uppercase muted) + a green **Badge** "Auto-logged" (check icon), then an **ExpenseRow**
       (coffee icon chip `rgba(255,159,10,.14)`/`#FF9F0A`, "Starbucks" / "Coffee", `EGP 45.00`, "Card ••4821").
    - The whole stack gently floats (`heroFloat`, translateY ±4px, 5.5s).
  - **Copy block** (padding 0/26): a pill badge "AUTOMATIC TRACKING" (red, with pulsing 6px dot);
    H1 "Every bank SMS, logged for you" (29px/800, line-height 1.16, letter-spacing -.6px);
    paragraph 14px/1.65 `--color-brand-text-secondary`, max-width 310.
  - **Trust + CTA** (margin-top auto, padding 14/26/44): green shield-check icon + "Runs entirely on
    your iPhone. Buddget never sees your bank login." (12px muted); primary CTA button "Set up
    auto-tracking →"; sub-caption "Takes about 2 minutes · one-time setup".
- **Interaction:** CTA → slide to Panel 2 at step 1.

### Panel 2 — Guided setup
- **Purpose:** step-by-step instructions.
- **Layout** (vertical flex, full height):
  1. **Header** (padding 18/20/11):
     - Row: 28px round back button (chevron) → returns to Panel 1; title "Set up auto-tracking" 15/800.
     - "Step {n} of {total}" 11px muted, tabular figures.
     - **Progress bar**: 3px track (`--color-brand-card`), fill = `(stepIndex / (total-1)) * 100%`,
       `linear-gradient(90deg,#E50914,#ff6a6a)`, width transitions .4s.
  2. **Stage** (`flex:1`, min-height:0, centered): either a phone mock or the keyword screen (below).
  3. **Caption card** (`--color-brand-card`, radius 15, padding 13/15): a 20×20 red-tint index chip
     with the step number, the step **title** (13.5/700), and the **description** (12.5/1.55
     `--color-brand-text-secondary`). Keywords/buttons inside the description are emphasized in
     **brand red `#E50914`, weight 700** (see "Keyword highlighting").
  4. **Nav row**: 38px round prev button (chevron, dimmed at step 1), a row of **dots** (one per step:
     current = 20px-wide red pill; completed = 6px green `#1DB954`; upcoming = 6px `--color-brand-border`;
     each is tappable to jump), 38px round next button (red on the last step, else `--color-brand-card`).
  5. **Footer action** (padding 6/20/26): varies by step (see "Bottom action").

#### Phone mock (steps 1–4, 6–14)
A device frame centered in the stage: `height:100%`, `aspect-ratio: 1290 / 2581`, background `#050507`,
radius 30, 5px padding, `box-shadow: 0 20px 55px rgba(0,0,0,.6), 0 0 0 1px #1A1A24`. Inside: the step
screenshot (`object-fit: cover`, radius 25). Overlaid annotations (see "Annotations").

#### Keyword screen (step 5 — "Think of a keyword", no screenshot)
A column inside the stage:
- Label "A MESSAGE YOUR BANK SENDS" (10/700 uppercase muted).
- **English example bubble** (received iMessage style): 26px green avatar + bubble
  (`--color-brand-elevated`, 1px border, radius `15 15 15 4`, 12.5/1.5): "Your card #2016 was charged
  **EGP** 20.00 at \*\*\*\*.COM." — the keyword `EGP` highlighted (red tint bg `rgba(229,9,20,.16)`,
  `#E50914`, mono).
- **Arabic example bubble** (RTL, avatar on the right, radius `15 15 4 15`, IBM Plex Sans Arabic):
  "تم خصم 20.00 **جنيه** من بطاقتك لدى \*\*\*\*.COM" — `جنيه` highlighted.
- Label "COMMON KEYWORDS · TAP TO COPY".
- **Copy chips**, two rows. English: `EGP USD charged debited purchase` (JetBrains Mono). Arabic
  (RTL row): `جنيه دولار خصم شراء عملية` (IBM Plex Sans Arabic). Each chip:
  `--color-brand-elevated` bg, 1px border, radius 10, 13/700, with a small copy icon; hover →
  `border-color:#E50914`. Tapping copies the word and shows a toast "Copied "…"" (see Interactions).

#### Success state (step 14)
The step-14 screenshot with a centered 74px green (#1DB954) circle + white check
(`box-shadow: 0 10px 34px rgba(29,185,84,.5)`) and a dark pill "Automation active". Caption title
"You're all set"; description: *"Each keyword only catches SMS that contain it. A 2nd automation with
another keyword (e.g. **USD** or **جنيه**) catches messages worded differently — so nothing slips through."*

---

## Annotations (the underline + arrow system)
Each guided step (except the keyword & success screens) points at one control on its screenshot using
**percentage coordinates relative to the screenshot image** (so they scale with the device mock).

- **Underline** (`r`): a 3px-tall red (`#E50914`) rounded bar, width = `r.w * 0.92`, centered at `r.x`,
  positioned just *below* the target at `top = r.y + r.h/2 + 0.4%`. Soft glow
  `0 0 7px rgba(229,9,20,.55)`, gentle opacity pulse `.55↔1` over 1.8s (`ulPulse`). Some steps have a
  second underline (`r2`, e.g. step 6 marks both "Run Immediately" and "Next").
- **Arrow** (`a`): a hand-drawn red curved arrow (~36×50), drop-shadow, bobbing ±5px over 1.5s
  (`arrowBob`). `dir:'down'` sits above the target pointing down; `dir:'up'` sits below pointing up
  (used when the empty space is below the target, e.g. step 9).

**Per-step target coordinates** (x, y, w, h are % of the screenshot; a = arrow x, y, dir). These were
hand-tuned against the real screenshots — preserve them:

| # | Image | Title | Target r (x,y,w,h) | Arrow a (x,y,dir) | Notes |
|---|-------|-------|--------------------|-------------------|-------|
| 1 | 01.jpg | Open the Automation tab | 50, 96.3, 24, 4.2 | 50, 93.6, down | |
| 2 | 02.jpg | Start a new automation | 50, 60.7, 42, 5 | 50, 57.6, down | underline sits below the button |
| 3 | 03.jpg | Pick the Message trigger | 34, 88, 56, 5 | 34, 85, down | |
| 4 | 04.jpg | Open Message Contains | 84, 27.5, 24, 4.4 | 84, 24.8, down | |
| 5 | — | Think of a keyword | (keyword screen, no annotation) | | |
| 6 | 05.jpg | Enter your bank keyword | 50, 39, 58, 5 | 50, 35.5, down | |
| 7 | 06.jpg | Confirm and continue | 91, 5.6, 17, 3.6 | 88, 8, up | + r2 = 50, 43.2, 80, 4.6 (Run Immediately) |
| 8 | 07.jpg | Create a blank automation | 24.5, 37, 44, 14 | 24.5, 29.5, down | |
| 9 | 08.jpg | Search for an action | 50, 56.5, 84, 4.2 | 50, 53.9, down | |
| 10 | 09.jpg | Add Catch Bank SMS | 48, 41.6, 84, 6 | 53, 47, up | arrow rises from empty space below |
| 11 | 10.jpg | Open the message field | 44, 33, 40, 4.6 | 44, 30, down | |
| 12 | 11.jpg | Choose Select Variable | 17, 63, 30, 3.8 | 17, 60, down | |
| 13 | 12.jpg | Pick Shortcut Input | 49, 34.5, 36, 3.8 | 49, 31.5, down | |
| 14 | 13.jpg | Save the shortcut | 91, 6.5, 16, 3.6 | 88, 9, up | |
| 15 | 14.jpg | You're all set | (success overlay, no annotation) | | |

(Step numbers above are the 1-based positions shown to the user; image filenames keep the original
1–14 numbering.)

### Exact step copy (keyword/button emphasis shown in **bold** = render in brand red)
1. In the Shortcuts app, tap **Automation** at the bottom of the screen.
2. Tap **New Automation** to begin — you only do this once.
3. Scroll the trigger list and choose **Message** — it fires whenever an SMS arrives.
4. Leave Sender empty, then tap **Choose** next to **Message Contains**.
5. (keyword screen) First pick a word your bank **always** includes in its SMS — usually the currency. You'll type it on the next screen.
6. Type the keyword you picked, then tap **Done**.
7. Make sure **Run Immediately** is ticked, then tap **Next**.
8. Tap **New Blank Automation** so you can add the Buddget action.
9. Tap the **Search Actions** bar at the bottom.
10. Type "Catch", then tap **Catch Bank SMS** — the Buddget action.
11. Tap the blue **Bank Message** field to choose what gets passed in.
12. In the options bar above the keyboard, tap **Select Variable**.
13. Tap **Shortcut Input** so Buddget receives the full SMS text.
14. Tap **Done** — your automation is now ready.
15. (success) Each keyword only catches SMS that contain it. A 2nd automation with another keyword (e.g. **USD** or **جنيه**) catches messages worded differently — so nothing slips through.

---

## Interactions & Behavior
- **Panel slide:** `step` state (1 = intro, 2 = setup). Track `transform: translateX(-(step-1)*390px)`,
  transition .44s `cubic-bezier(.4,0,.2,1)`.
- **Step paging:** `subStep` state (0…14). Prev/next buttons clamp at ends; dots jump directly.
  Next button turns solid red on the last step.
- **Copy chip:** writes the keyword to the clipboard and shows a centered toast "Copied "{word}""
  (dark pill, fades in, auto-dismiss after 1.5s). In the web prototype this uses
  `navigator.clipboard` with an execCommand fallback. **In the iOS app, use the Capacitor Clipboard
  plugin** (`@capacitor/clipboard` → `Clipboard.write({ string })`) for reliability inside WKWebView.
- **"Open Shortcuts app" button** (footer on steps 1–4, 6–13): opens the iOS Shortcuts app. Prototype
  uses `window.open('shortcuts://')`. **In the app, use the `shortcuts://` deep link** via
  `window.location.href = 'shortcuts://'` or `@capacitor/app`/`AppLauncher` (`App.openUrl` /
  `AppLauncher.openUrl({ url: 'shortcuts://' })`).
- **Final step footer:** two side-by-side buttons — **"+ Add keyword"** (red; restarts the guide at
  step 1 of the carousel, i.e. `step=2, subStep=0`) and **"Finish"** (outline; closes the guide —
  prototype calls `history.back()`; wire to your router/modal dismiss).
- **Close (✕, top-right):** dismiss the guide.
- **Motion:** `heroFloat` (5.5s), `heroDot` (2.6s), `ulPulse` (1.8s), `arrowBob` (1.5s), `pulseDot`
  (2s), toast fade-in (.2s). All are subtle/looping; reproduce with CSS keyframes or Framer Motion.

## State Management
- `step: 1 | 2` — which panel is showing.
- `subStep: 0..14` — current guided step.
- `copied: string | null` — last-copied keyword (drives the toast; cleared on a 1.5s timer).
- **Theme:** the prototype exposes a `theme: 'dark' | 'light'` prop and applies/omits a `.dark` class on
  the root. **Do NOT add an in-app theme toggle** — the app already has dark/light in Settings. Hook the
  root to the app's existing theme/`.dark` context so it follows the user's setting automatically. The
  component is already token-driven, so it adapts with no other change.
- No data fetching. Everything is static guidance.

## Design Tokens (match `globals.css`)
- **Brand red** `--color-brand-red` `#E50914` (hover dark `#F40612`); used for CTAs, underline, arrow,
  active dot/progress, highlighted keywords.
- **Green** `#1DB954` (success/completed dots/Auto-logged), Messages glyph green `#34C759`.
- **Amber** `#FF9F0A` (expense icon chip).
- **Surfaces (dark):** bg `#0A0A0F`, card `#111118`, elevated `#1A1A24`, border `#2A2A38`.
  **(light):** bg `#F5F5F7`, card `#FFFFFF`, elevated `#F0F0F4`, border `#D4D4DC`. Use the tokens, not hexes.
- **Text:** primary / secondary / muted via `--color-brand-text-*`.
- **Radii:** buttons 13–14, cards 15–18, device frame 25–30, pills/dots 9999.
- **Type:** DM Sans (UI/headings), JetBrains Mono (amounts + Latin keyword chips), IBM Plex Sans Arabic
  (Arabic text/chips — set `direction: rtl` on Arabic content).
- **Shadows:** card `0 10px 26px rgba(0,0,0,.4)` (dark) / lighter in light mode; CTA glow
  `0 10px 30px rgba(229,9,20,.28)`.

## Components to reuse from the codebase
- **Button** (primary red + outline/ghost), **Badge** (green variant), **ExpenseRow**, **MoneyDisplay** —
  all exist in `src/components/` and are used as-is in the hero. Lucide icons for chrome.
- The custom pieces to build: the slider/stepper shell, the device-frame + percentage-positioned
  annotation overlay, the keyword screen, and the toast.

## Assets
`assets/steps/01.jpg … 14.jpg` — **real iOS Shortcuts screenshots** captured by the product owner,
upscaled ~1.6× and lightly sharpened (now ~2064px wide, 1:2 ratio). These are the source of truth for
the device mocks; bundle them as static assets (e.g. `public/guides/sms/` or imported modules). Map:
`01`=All Shortcuts, `02`=Automation tab (empty), `03`=trigger list, `04`=When/Choose, `05`=keyword
dialog, `06`=Run Immediately/Next, `07`=choose-shortcut, `08`=blank automation, `09`=search Catch,
`10`=Catch Bank Message field, `11`=Select Variable bar, `12`=Shortcut Input, `13`=save/Done,
`14`=automation created. No icons are external — the small glyphs in the hero/keyword screens are inline SVG.

## Localization note
The app is bilingual (EN/AR, `IBM Plex Sans Arabic` is already in the stack). Run all copy through the
app's i18n. The keyword examples intentionally include Arabic; keep both languages. Mirror layout for RTL
where appropriate (the keyword screen already demonstrates RTL bubbles/chips).

## Files in this bundle
- `SMS Tracking Setup.dc.html` — full prototype (dark default; the logic class at the bottom contains the
  exact `STEPS` array, coordinates, copy, and all render logic).
- `SMS Tracking Setup (Light).dc.html` — light-theme render of the same component.
- `assets/steps/01.jpg … 14.jpg` — the screenshots.
