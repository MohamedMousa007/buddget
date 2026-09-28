# Design system backup — v1 (pre-teal-revamp)

Snapshot taken **2026-09-28**, immediately before the "Buddget Revamp Kit v1" teal revamp.
Source: Claude Design project `3e84a07a-da79-472d-b487-07c93afa5f48` ("Buddget Design System").

## What the OLD system was

Brand red `#E50914` as the single primary accent, dark-first, glass card surfaces
(`backdrop-filter: blur(12px)`), radius `--radius: 0.75rem` (cards ~22px / inputs ~17px),
Lucide icons at 1.75–2px stroke. DM Sans + JetBrains Mono + IBM Plex Sans Arabic.

## Coverage — read this before trusting the backup

| Layer | Where it is backed up | Complete? |
|---|---|---|
| All design-sync inputs: `.design-sync/` config, entry barrel, `compiled.css`, `conventions.md`, all 22 authored previews | git tag **`backup-design-system-v1`** (pushed to origin) | ✅ |
| Token source of truth: `src/app/globals.css`, `tailwind.config.ts` | same git tag | ✅ |
| Written spec: `docs/DESIGN_SYSTEM.md` | same git tag | ✅ |
| The 46 synced components | reproducible from the tag — rebuild + re-upload | ✅ |
| `SKILL.md` (hand-authored in Claude Design, no git source) | **this directory** | ✅ |
| `tokens/*.css` (5 files, hand-authored in Claude Design) | **this directory** — `colors.css` + `typography.css` only | ⚠️ partial |
| `guidelines/*.card.html` (15 hand-authored guideline cards) | **not copied** | ❌ |

### Why the gaps are acceptable

- `tokens/*.css` were **derived from `globals.css`**, which the git tag captures in full. The two
  copied here are the ones carrying commentary worth keeping; `effects/fonts/radius.css` add nothing
  beyond what the tag already has.
- The 15 `guidelines/*.card.html` cards are **hand-made HTML visualisations of tokens that live in
  `globals.css`** — they lose presentation, not information. More importantly they are **not at
  risk**: the design-sync upload plan deletes only paths it explicitly names, and no sync so far has
  named `guidelines/`. They survive in the project untouched unless someone deliberately deletes them.
  If a true offline copy is wanted, fetch them with `DesignSync(get_file)` — the tool is only
  available to the main session, not to subagents.

## How to revert

```sh
git checkout backup-design-system-v1 -- .design-sync docs/DESIGN_SYSTEM.md src/app/globals.css tailwind.config.ts
node .design-sync/gen-dts-props.mjs   # after regenerating ds-types/
# then rebuild + re-upload per .design-sync/NOTES.md
```

To restore `SKILL.md` or the token files into the Claude Design project, include their paths in a
design-sync plan's `writes` and upload them from this directory.
