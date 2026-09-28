---
name: buddget-design
description: Use this skill to generate well-branded interfaces and assets for Buddget, either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping the personal finance app.
user-invocable: true
---

Read the `readme.md` file within this skill, and explore the other available files.

If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and create static HTML files for the user to view. Load `styles.css` for all tokens. Load `_ds_bundle.js` for React components.

If working on production code, read the guidelines here to become an expert in designing with this brand — use the token names, component patterns, and visual rules documented in the README.

If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions, and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.

Key reminders:
- Dark-first UI. Default to `<html class="dark">` in mockups.
- Brand red `#E50914` is the one primary accent — don't invent new accent colors.
- All currency figures use JetBrains Mono + `font-variant-numeric: tabular-nums`.
- Cards are glass surfaces (`backdrop-filter: blur(12px)`), `--radius-2xl`.
- Icons are Lucide (stroke, 1.75–2px, never filled).
- Source repo for deeper reference: https://github.com/MohamedMousa007/buddget
