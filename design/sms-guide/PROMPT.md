# Kickoff prompt for Claude Code

Copy–paste the block below into Claude Code as your **first message**, after placing this whole
folder inside your repo (see "Setup" at the bottom).

---

You are implementing a new screen in our existing app: **MohamedMousa007/buddget**
(Next.js 16, React 19, Tailwind v4, Base UI, Framer Motion, Lucide). It runs as a Capacitor iOS app.

I've placed a design handoff at `design/sms-guide/` in this repo. Read these first, in order:
1. `design/sms-guide/README.md` — the full spec (per-step coordinates, copy, tokens, behavior).
2. `design/sms-guide/StarterComponent.tsx` — a faithful, near-1:1 React port of the approved design.
3. `design/sms-guide/annotated-reference.html` — open it mentally as the visual ground truth.
4. `design/sms-guide/reference/screen-01…14.png` — the exact rendered guided steps.

**Your task:** port this into our codebase as a real component (suggest `src/components/onboarding/SmsTrackingGuide.tsx`).

**Hard rules — do not deviate:**
- Keep the `STEPS` array, every annotation coordinate (x/y/w/h, arrow dir), the step copy, and the
  inline styles EXACTLY as in `StarterComponent.tsx`. These are the approved design; do not "improve"
  layout, spacing, wording, colors, or motion.
- Reuse our real components for the hero: `Button`, `Badge`, `ExpenseRow`, `MoneyDisplay` from
  `src/components/`. Replace the placeholder imports at the top of the starter.
- Use our CSS variable tokens (`--color-brand-*`, etc.) — never hard-code hexes that already have a token.
- Lucide icons for chrome (Coffee for the expense, ChevronLeft/Right, Plus, X, Search, Check…).

**Three iOS integrations to wire (already stubbed in the starter):**
- Theme: do NOT add an in-app toggle. Bind the root `.dark` class to our existing theme context so it
  follows the user's Settings. Remove the `theme` prop's toggling role if our context covers it.
- "Open Shortcuts app" → `shortcuts://` deep link via `@capacitor/app-launcher` (`AppLauncher.openUrl`),
  with `window.location.href` fallback.
- Copy chips → `@capacitor/clipboard` (`Clipboard.write`), with `navigator.clipboard` fallback.

**Assets:** move `design/sms-guide/assets/steps/01…14.jpg` into `public/guides/sms/` and set
`ASSET_BASE = '/guides/sms'` (or import them as modules). They're real iOS Shortcuts screenshots.

**i18n:** run all copy through our i18n. The keyword examples intentionally include Arabic — keep both
languages and the RTL layout on the keyword screen.

**Verify before you finish:** render each of the 15 steps and visually diff against
`reference/screen-01…14.png` and `annotated-reference.html`. The arrow/underline must point at the same
control, at the same position, in both light and dark. Show me a screenshot of steps 1, 6 (two markers),
9 (arrow points up from below), and 14 (success) to confirm parity.

Start by reading the three files and outlining your component structure. Don't write code until you've
confirmed you understand the STEPS/annotation model.

---

## Setup (do this before the prompt above)

1. **Put the folder in your repo on disk.** Claude Code reads from the filesystem — it does *not* take
   attachments. Copy this entire `design_handoff_sms_tracking_guide/` folder into your cloned repo,
   e.g. rename it to `design/sms-guide/`:
   ```
   cp -R ~/Downloads/design_handoff_sms_tracking_guide  /path/to/buddget/design/sms-guide
   ```
   (You don't have to commit it — on disk is enough — but committing keeps it with the PR.)
2. **Open Claude Code in the repo root** (`claude` inside `/path/to/buddget`).
3. Paste the prompt above. Because the files are on disk at `design/sms-guide/`, Claude Code can open
   them directly.

## Model recommendation
- Use **Claude Opus** (the most capable model in the picker) for the **first implementation pass** —
  it holds long, exact specs like this far more faithfully, which is where a lighter model tends to
  drift and "reinterpret" the design.
- Switch to **Claude Sonnet** for cheap iteration once the structure matches (styling nits, i18n wiring,
  small fixes).
- Keep `/auto-compact` from trimming the spec: if the session gets long, re-point it at
  `README.md` + `StarterComponent.tsx` before each major step.
