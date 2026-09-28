# Buddgy visor icon: handoff

Buddgy is the AI assistant in Buddget. This package replaces the gradient orb placeholder and the raster mascot in UI chrome with a Lucide-compatible outline icon: one helmet with ten swappable faces ("moods").

The mascot artwork (`reference/buddgy-mascot-source.jpg`) is kept for marketing and onboarding. **Do not** use it at icon sizes.

---

## 1. Package contents

| Path | What it is |
|---|---|
| `code/BuddgyIcon.tsx` | React component. **Source of truth** for geometry, moods and timing. |
| `code/buddgy-motion.css` | Keyframes and classes. Import once globally. |
| `svg/outline/*.svg` | 10 single-colour SVGs, `stroke="currentColor"`. Default for static use. |
| `svg/duo-dark/*.svg` | 10 SVGs, shell + face hex baked for dark theme. |
| `svg/duo-light/*.svg` | 10 SVGs, shell + face hex baked for light theme. |
| `png/<mode>/*.png` | 1024 × 1024 PNG of every mood in 7 modes (see §5). For stores, docs, Figma. |
| `png/motion-filmstrips/*.png` | 8-frame strips of each animation, with timestamps. |
| `png/contact-sheet.png` | All moods, dark and light, side by side. |
| `screenshots/*.png` | The handoff page at 3×, section by section, plus a full-page 2× capture. |
| `reference/buddgy-mascot-source.jpg` | Original mascot the icon was derived from. |
| `IMPLEMENTATION_PROMPT.md` | Prompt for an AI coding agent to implement this with no deviation. |

Screenshots: `00-intro`, `01-master-anatomy`, `02-moods-x-modes`, `03-color-tokens`, `04-motion`, `05-orb-states`, `99-full-page`.

---

## 2. Geometry (24 × 24 viewBox)

All strokes: `stroke-width="2"`, `stroke-linecap="round"`, `stroke-linejoin="round"`, `fill="none"`. Never fill any path.

### Shell (identical in every mood)

```
Shell    M3.5 12.5a8.5 8.5 0 0 1 17 0V16a5 5 0 0 1-5 5h-7a5 5 0 0 1-5-5z
Visor    M10 8.5h4a3.5 3.5 0 0 1 3.5 3.5v2.5a3.5 3.5 0 0 1-3.5 3.5h-4a3.5 3.5 0 0 1-3.5-3.5V12a3.5 3.5 0 0 1 3.5-3.5z
Ear R    M20.5 12h.5a1.5 1.5 0 0 1 1.5 1.5v2a1.5 1.5 0 0 1-1.5 1.5h-.5
Ear L    M3.5 12H3a1.5 1.5 0 0 0-1.5 1.5v2A1.5 1.5 0 0 0 3 17h.5
Antenna  M16.3 5.2 17.5 2.5
```

- Shell: closed dome (r 8.5, centre 12,12.5) with a chin and 5-unit bottom corners.
- Visor: x 6.5–17.5, y 8.5–18, corner radius 3.5. 1 clear unit to the shell on every side.
- Faces live inside **x 7.5–16.5, y 9.5–17** only.

### Faces

| Mood | Paths |
|---|---|
| idle | `M10.25 10.75v5` · `M10.25 10.75h2a1.25 1.25 0 0 1 0 2.5h-2` · `M10.25 13.25h2.5a1.25 1.25 0 0 1 0 2.5h-2.5` |
| small | `M9.5 13.25h.01` · `M14.5 13.25h.01` |
| listening | `M9 12.5v1.5` · `M12 11v4.5` · `M15 12v2.5` |
| thinking | `M9 13.25h.01` · `M12 13.25h.01` · `M15 13.25h.01` |
| scanning | `M8.5 13.25h7` |
| done | `M9.25 13.5 11 15.25l3.75-3.75` |
| happy | `M8.5 14a1.75 1.75 0 0 1 3 0` · `M12.5 14a1.75 1.75 0 0 1 3 0` |
| alert | `M12 10.75v2.5` · `M12 15.75h.01` |
| error | `M9.5 12.25h.01` · `M14.5 12.25h.01` · `M10 15.75a2.5 2.5 0 0 1 4 0` |
| offline | `M8.5 13.75h2.5` · `M13 13.75h2.5` |

`h.01` paths are dots, drawn by the round cap. Keep them as paths, not circles.

---

## 3. Moods: when to use each

| Mood | Trigger | Returns to |
|---|---|---|
| **Idle** | Default. Orb at rest, chat avatar, entry buttons ("Build it with Buddgy"). | — |
| **Idle · small** | Automatically replaces Idle when rendered at ≤ 16px (the B is illegible). | — |
| **Listening** | Mic open (voice capture, press-and-hold on FAB). | Release → Thinking. Cancel → Idle. |
| **Thinking** | AI request / parse pending. | Reply → Idle, Done or Error. |
| **Scanning** | Receipt OCR or SMS parse running. | Result → Done. Unreadable → Error. |
| **Done** | User confirms an action card; transaction added. | Hold 1.6s → Idle. |
| **Happy** | Milestones: goal reached, debt cleared, cycle closed under plan. | Hold 2s → Idle. |
| **Alert** | A nudge is queued: over pace, bill due, multi-intent hint. | Stays until the nudge is seen, then Idle. |
| **Error** | Parse or request failed ("Couldn't read that receipt"). | Hold 2s → Idle. |
| **Offline** | `navigator.onLine === false`. Composer disabled. | Back online → Idle. |

Priority when several apply: **Offline > Error > Listening > Scanning > Thinking > Alert > Done > Happy > Idle**.

---

## 4. Colour

Teal leads the identity. Red is reserved for Error only.

| Role | Token (suggested name) | Dark | Light | Used by |
|---|---|---|---|---|
| Ink (shell) | `--color-brand-text` | `#FFFFFF` | `#1A1A24` | Shell in all moods except Offline; Idle and small faces |
| Brand teal | `--color-brand-teal` | `#12B0A0` (500) | `#0E9384` (600) | Listening, Thinking, Scanning faces; orb ring for Idle/active moods |
| Positive | `--color-positive` | `#18A349` | `#18A349` | Done face |
| Gold | `--color-gold` | `#D4A017` | `#D4A017` | Happy face |
| Warning | `--color-warning` | `#E0A126` | `#E0A126` | Alert face and orb ring |
| Negative | `--color-negative` | `#E5484D` | `#E5484D` | Error face and orb ring |
| Muted | `--color-brand-text-muted` | `#9898B0` | `#8A8AA0` | Offline: shell **and** face |

Other palette values used: Teal 700 / brand ink `#0B7568` (link hover), Brand soft `#E3F6F3` (light-mode tinted chip backgrounds).

Rules:
- At most two colours per icon: shell + face.
- Token names are suggestions. Map to your real variables; keep the hex values.

---

## 5. Modes

| Mode | Shell | Face | Use |
|---|---|---|---|
| **Outline** | `currentColor` | `currentColor` | Menus, lists, docs, anywhere static and single-colour |
| **Duo · dark** | Ink dark | Mood token (dark) | Default in the dark app |
| **Duo · light** | Ink light | Mood token (light) | Default in the light app |
| **On teal** | `#FFFFFF` | `#FFFFFF` | On Teal 600 `#0E9384`: app icon, primary buttons, solid orb |

PNG export folders: `outline-white`, `outline-ink`, `duo-dark`, `duo-light`, `on-teal` (tile), `on-dark-tile`, `on-light-tile`.

### Sizes

| Size | Stroke | Notes |
|---|---|---|
| 14–16px | 2 (scales) | Use **small** face instead of idle. Nudge chip, inline labels. |
| 20px | 2 | Chat header avatar (in 36px circle), buttons. |
| 24px | 2 | Orb (in 44px circle), tab-level usage. |
| 48–64px | 2 | Chat empty state, voice capture overlay. |

Stroke scales with size like Lucide (do not use `absoluteStrokeWidth`). A 1.5 or 1.75 stroke is allowed only if the whole Lucide set in the app uses it.

---

## 6. Orb

- 44 × 44 circle, background `--color-brand-elevated` (`#1A1A24` dark / `#F0F0F4` light), border 1.5px, icon 24px centred.
- Ring colour = mood colour at 55% alpha; glow `box-shadow: 0 4px 14px -4px <mood colour @ 55%>`.
  - Idle, small, Listening, Thinking, Scanning → teal
  - Done → positive · Happy → gold · Alert → warning · Error → negative
  - Offline → border `#2A2A38` (dark) / `#D4D4DC` (light), **no glow**
- Draggable, snaps to left/right edge, position persisted (existing `AIChatBubble` behaviour).

---

## 7. Motion

All values are exact. Units in `px` inside the SVG are **viewBox units** (1 = 1/24 of icon size).

### Per-mood

| Mood | Plays | Element | Keyframes | Duration / easing | Notes |
|---|---|---|---|---|---|
| Idle, small, Offline | — | — | none | — | Static |
| **Listening** | Loop while mic open | Each bar | `scaleY: 0.4 → 1 (50%) → 0.4` | 900ms `ease-in-out` infinite | `transform-box: fill-box; transform-origin: center`. Delays 0 / 120 / 240ms (left→right). Optionally drive scaleY from mic level instead. |
| **Thinking** | Loop while pending | Each dot | `opacity: 0.25 → 1 (35%) → 0.25` | 1200ms `ease-in-out` infinite | Delays 0 / 160 / 320ms. |
| **Scanning** | Loop while parsing | Line | `translateY: -2.25 → +2.25` | 1400ms `ease-in-out` infinite **alternate** | fill-box. |
| **Done** | Once | Check | `stroke-dashoffset: 10 → 0` | 400ms `cubic-bezier(.2,.9,.25,1)` | `pathLength="10"`, `stroke-dasharray: 10`. |
| **Happy** | Once | Face group | `translateY: 0 → -1.5 (40%) → 0` | 520ms `cubic-bezier(.34,1.56,.64,1)` | |
| **Alert** | Once | **Whole icon** | `rotate: 0 → -8° (20%) → 7° (45%) → -4° (70%) → 0` | 600ms `ease-out` | `transform-box: view-box; transform-origin: 12px 20px` (chin). |
| **Error** | Once | Face group | `translateX: 0 → -1.5 (25%) → 1.5 (50%) → -1 (75%) → 0` | 360ms `ease-out` | |

The handoff page loops the one-shot animations so they can be watched. **In the app they play once** per state entry.

### Transitions & orb

| Event | Spec |
|---|---|
| Mood change | Old face `opacity → 0`, 120ms ease-in. New face `opacity 0 → 1` + `scale 0.7 → 1`, 180ms ease-out (fill-box, centre). **Shell never moves.** Re-key the face group on mood change so one-shots restart. |
| Orb ring change | `border-color` and `box-shadow` transition 200ms ease. |
| Orb press | `scale 0.92`, spring stiffness 400, damping 22 (matches FAB). |
| Orb drag release | Snap to nearest edge, spring stiffness 300, damping 30. |
| Orb enter | `scale 0.6 → 1`, `opacity 0 → 1`, spring 400 / 22, after the tab bar mounts. |

### Reduced motion

Under `prefers-reduced-motion: reduce`: every loop and one-shot is off, the check renders fully drawn (`stroke-dashoffset: 0`), and a mood change is an opacity crossfade of 120ms only. The static face must still communicate the state.

Filmstrips of each animation are in `png/motion-filmstrips/`.

---

## 8. Accessibility

- Icon is decorative: `aria-hidden="true"`. The **container** carries the label.
  - Orb: `aria-label="Ask Buddgy"`; add `aria-describedby` / live text for state ("Buddgy is listening", "Buddgy is thinking", "Couldn't read that receipt").
  - Announce state changes via an `aria-live="polite"` region, not by relying on the face.
- Colour is never the only signal: every mood has a distinct face shape.
- Min tap target 44 × 44 (orb already is).

---

## 9. Placement map

| Surface | Mood(s) | Size / container |
|---|---|---|
| Floating orb | All | 24px in 44px circle |
| Chat header | Idle / Thinking / Offline | 20px in 36px circle, `Brand soft` / teal 13% bg |
| Chat empty state | Idle | 48px in 88px circle |
| Voice capture overlay | Listening → Thinking | 56px in 104px circle |
| Receipt / SMS parsing | Scanning → Done / Error | 18px in 28px circle next to status text |
| Nudge card | Alert | 22px in 36px circle, warning 14% bg |
| Confirmation row | Done / Happy | 22px inline |
| Budget builder chip | Idle | 16px (small face) |
| App icon | Idle, on teal | 52px on 80px tile, radius 22 |
