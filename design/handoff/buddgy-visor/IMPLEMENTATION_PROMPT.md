# Implementation prompt: Buddgy visor icon

Paste everything below the line into your coding agent (Claude Code, Cursor, etc.) with this folder attached.

---

You are implementing the **Buddgy visor icon system** in the Buddget codebase (Next.js 16, React 19, Tailwind v4, Framer Motion, Lucide React). A complete spec and reference implementation are in `handoff/buddgy-visor/`. Your job is to integrate them **exactly**. This is a pixel-exact handoff: do not redesign, simplify, or "improve" anything.

## Sources of truth, in order

1. `code/BuddgyIcon.tsx`: geometry (every `d` string), mood list, colour mapping, animation class assignment.
2. `code/buddgy-motion.css`: keyframes, durations, easings, delays, reduced-motion rule.
3. `README.md`: usage rules, orb spec, transitions, placement, accessibility.
4. `screenshots/*.png`, `png/contact-sheet.png`, `png/motion-filmstrips/*.png`: visual reference to check your output against.

If anything conflicts, the higher item wins. If something is not specified, **stop and ask**. Do not guess.

## Hard rules (zero deviation)

1. **Path data is immutable.** Copy every `d` string byte-for-byte. Do not round, re-optimise, run SVGO with path merging, convert to `<circle>`/`<rect>`, or combine paths.
2. SVG root is always `viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`. Never fill a path. Never use `absoluteStrokeWidth`.
3. Exactly **10 moods**: `idle, small, listening, thinking, scanning, done, happy, alert, error, offline`. No additions, no renames.
4. At `size <= 16` with mood `idle`, render `small`. This is already in the component. Keep it.
5. **Colours.** Teal is the brand; red is only for `error`. Use these hex values; map them to the repo's CSS variables if equivalents exist, otherwise add the variables:
   - brand teal `#12B0A0` (dark) / `#0E9384` (light)
   - positive `#18A349` · gold `#D4A017` · warning `#E0A126` · negative `#E5484D`
   - ink `#FFFFFF` / `#1A1A24` · muted `#9898B0` / `#8A8AA0`
   Mood → face colour: idle/small = ink; listening/thinking/scanning = teal; done = positive; happy = gold; alert = warning; error = negative; offline = muted (shell also muted).
   Do not introduce any other colour. Do not use the old brand red `#E50914` anywhere in this feature.
6. **Motion values are exact.** Durations, easings, delays, keyframe percentages, transform origins and `transform-box` must match `buddgy-motion.css`. Do not switch to Framer Motion for the icon's internal animations; keep them in CSS. Framer Motion is used **only** for the orb container (press, drag-snap, enter), with the springs given in README §7.
7. Loops (`listening`, `thinking`, `scanning`) run only while the underlying task is in progress. One-shots (`done`, `happy`, `alert`, `error`) play **once** per state entry. Re-key the face group on mood change so they restart.
8. Mood change: shell stays fixed; only the face crossfades (out 120ms ease-in, in 180ms ease-out with scale 0.7 → 1). Orb ring colour transitions 200ms.
9. `prefers-reduced-motion: reduce` disables all icon animation and renders the check fully drawn. Verify this.
10. Accessibility: SVG `aria-hidden="true"`; the container (orb button, avatar) carries `aria-label`. Announce state changes in an `aria-live="polite"` region.

## Tasks

1. Copy `code/BuddgyIcon.tsx` to `src/components/ai/BuddgyIcon.tsx`. Copy `code/buddgy-motion.css` and import it once from `src/app/globals.css` (or the root layout).
2. Replace the CSS variable fallbacks in `BuddgyIcon.tsx` (`--color-brand-teal`, `--color-negative`, `--color-positive`, `--color-gold`, `--color-warning`) with the repo's real token names if they exist. Keep the hex fallbacks.
3. Add a `buddgyMood` field to the existing store (next to `buddgyOrb`) with the priority rule from README §3: `offline > error > listening > scanning > thinking > alert > done > happy > idle`. Add auto-return timers: done 1.6s, happy 2s, error 2s → idle.
4. Update `src/components/ai/AIChatBubble.tsx`:
   - Replace the `<img src="/buddgy/buddgy-square.png">` with `<BuddgyIcon mood={buddgyMood} size={24} />`.
   - Orb: 44 × 44, background `--color-brand-elevated`, border 1.5px, ring and glow per README §6 (colour at 55% alpha; offline = plain border, no glow). Transition `border-color, box-shadow` 200ms.
   - Keep the existing drag/snap/persist logic. Add Framer Motion `whileTap={{ scale: 0.92 }}` with spring 400/22 and the enter animation.
5. Wire moods to real events:
   - Voice capture open → `listening`; release → `thinking`; cancel → `idle`.
   - Chat request pending → `thinking`; success → `idle` (or `done` if an action was confirmed); failure → `error`.
   - Receipt OCR / SMS parse → `scanning` → `done` | `error`.
   - Nudge queued → `alert` until seen.
   - Goal reached / debt cleared / cycle closed under plan → `happy`.
   - `window` `offline`/`online` events → `offline` / previous.
6. Replace every other Buddgy avatar in UI chrome (chat header, chat empty state, nudge chip, budget-builder chip, voice overlay, receipt status) using the sizes and containers in README §9. Leave the mascot raster only in marketing/onboarding.
7. Add `svg/outline/*.svg` to `public/buddgy/icons/` for non-React uses (emails, push notification icons).

## Verification (all must pass before you finish)

- Render every mood at 16, 20, 24 and 64px in dark and light mode on a scratch route. Compare side by side with `screenshots/02-moods-x-modes.png` and `png/contact-sheet.png`. Stroke weight, face position and colours must match.
- Record each animation and compare against `png/motion-filmstrips/<mood>.png` at the listed timestamps.
- Toggle OS reduced-motion and confirm nothing animates and the check is fully drawn.
- `grep -R "E50914" src/components/ai` returns nothing.
- `git diff` shows no edits to any `d="…"` string compared with `code/BuddgyIcon.tsx`.
- TypeScript, ESLint and existing tests pass.

When done, list every file you changed and attach screenshots of the scratch route (dark and light) and a short screen recording of the orb cycling through: idle → listening → thinking → done → idle → scanning → error → alert → happy → offline.
