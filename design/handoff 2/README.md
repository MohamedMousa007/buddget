# Buddget · Subscriptions redesign · handoff

Chosen direction: **hero band version** (the no-hero variant is explored on the board but not part of this handoff).

## Contents

| Path | What |
|---|---|
| `CLAUDE_CODE_PROMPT.md` | Paste into Claude Code as the task prompt |
| `SPEC.md` | Full design spec: layout, tokens, components, states, data model, copy EN/AR, behaviours, acceptance checklist |
| `screens/*.png` | 2x full-frame screenshots, uncropped (mobile 780 px wide, desktop 2880 px wide) |
| `html/Subscriptions-prototype-standalone.html` | Working clickable prototype, one self-contained file, open offline |
| `source/Subscriptions.dc.html` | Design board: every frame, light/dark, EN/AR, spec tables |
| `source/SubScreen.dc.html` | Single-frame renderer used by the board (all markup and tokens, easiest place to read exact styles) |
| `source/Subscriptions App.dc.html` | Prototype source (state logic: add, pay, pause, cancel, SMS detection, totals) |
| `source/uploads/` | Catalog (`catalog.json`, `catalog.md`), `AUDIT.md`, `CHANGES.md`, original `PROMPT.md`, brand logo files |

The `.dc.html` files are design references (HTML + inline styles using the Buddget bundle). Re-implement in the app's React/Tailwind stack with real Buddget components; do not ship the `.dc.html` files.

## Screenshot index

| File | Screen |
|---|---|
| 01-home-light / dark / ar | Subscriptions home (hero, segmented control, nudge, timeline groups) |
| 02-empty-state-light / dark | First run: brand tiles, **Add subscription** (primary), **Scan my SMS** (secondary) |
| 02-loading-skeleton, 02-offline | Loading, offline |
| 03-sms-detection-light / dark / ar | SMS detection sheet (refined) |
| 04-add-search-light / dark / ar | Add step 1: search, category chips with icons, brand grid |
| 05-configure-light / dark / ar | Add step 2: configure, impact line, pinned CTA |
| 06-detail-light / dark / ar, 06-cancel-confirm | Detail sheet, cancel confirm |
| 07-state-* | Trial, paused, cancelled, price changed, plan changed, expected-not-seen, failed payment, shared |
| 08-row-states | Ten row variants in one list |
| 09-budget-flow-links | Committed card, Flow linked-charge rows, Budget plan row (normal and over plan) |
| 10-notifications | Digest, trial ending, price rise, SMS push, two settings switches |
| 11-budget-icon-light / dark / ar, 11-icon-spec | Subscriptions icon and its three Budget placements |
| 12-desktop-* | Desktop home with rail, add dialog, detail dialog |
