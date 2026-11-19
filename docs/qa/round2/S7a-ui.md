# S7a: UI/UX QA round 2 (2026-11-19)

Cloud session on branch `claude/clever-mendel-3nivs1`. Live Frankfurt project, synthetic users only (`qa-e2e-ui-*`, created with `createConfirmedUser`, no UI sign-up, all deleted at the end with `cleanup.ts --all`). Dev server `next dev -p 3100` (Turbopack, see Caveat). Output and screenshots are in `e2e/ui/out/` (git-ignored).

## What was swept

| Run | Count |
|---|---|
| `sweep.mjs`: 24 routes × 375, 768, 1024 landscape, 1440 × light, dark × en, ar, with axe | 384 captures (2 timed out and stayed unverified: `profile` dark en mobile, `settings/sms` dark en desktop) |
| `tap.mjs` (new): real 44 px hit test of every control, scrolled into view, 375, en and ar, 20 routes | 770 controls, 40 route captures |
| `tapSheets.mjs` (new): hit test of Quick add, the seven sheets and the Buddgy chat | 8 dialogs |
| `sheets.mjs`: 7 viewport/theme/locale combos × 8 sheets | 56 records (18 script errors, see "What is left") |
| `focus.mjs`: focus trap and Escape on 8 sheets | 8 |
| `misc.mjs`: switch thumb position, en and ar | 2 |
| `states.mjs` (new): empty user (en, ar), every Supabase and `/api` call answering 500, offline | 40 route states |
| `offline.mjs` (new): tab navigation after `setOffline(true)`, and the `/offline` page | 4 navigations + 1 page |
| `recheck.mjs` (new): add-expense category, tablet and desktop column, Buddgy clearance | 20 checks |
| Arabic completeness (en vs ar dictionaries) | 3,190 strings: 0 missing, 0 Latin-only; 8 identical on purpose (Buddgy, buddget, `DELETE`, a keyword example) |

467 screenshots. Read only the flagged ones.

## Findings and fixes

Severities are P2 or P3. Each fix is one commit with a test.

| # | Sev | Finding | Reproduce | Status |
|---|---|---|---|---|
| 1 | P2 | Reports scrolls sideways on a phone: the visually hidden chart table (`sr-only` on a `<table>`) sized to its columns, page 513 px wide at 375 px (446 in Arabic) | `/reports` at 375, `scrollWidth` 513 > 375 | Fixed: the clip is on a wrapper `<div>` (`ChartDataTable`) |
| 2 | P3 | Settings sub-pages: back control 38 px wide (`px-2` overrode the 44 px) | `/settings/security`, measure Back | Fixed: `min-w-11`, same look (`SettingsSubPageShell`) |
| 3 | P3 | Account balance decimals at 45% opacity: 2.93:1 on the white card (axe serious, Accounts) | `/accounts` light | Fixed: `opacity-60` in `AccountRow` |
| 4 | P3 | Two unnamed complementary landmarks at lg+ (sidebar and page rail) on 8 routes; screen-reader h1 of Flow and Paydays outside any landmark on mobile | axe `landmark-unique`, `region` | Fixed: the sidebar `<aside>` is named, the hidden h1 sits in a `<header>` |
| 5 | P3 | Wealth hero cell "BANK ACCOUNTS" cut to "BANK ACCOU…" at 375 | `/wealth`, no assets | Fixed: shorter labels "Banks", "Market value" (en), "البنوك" (ar); length guard test |
| 6 | P3 | Wealth row shows the pocket name twice (the system vault: "Monthly Savings / Monthly Savings"), and in English on an Arabic screen, because `pocketIdentity` falls back to the stored name | `/wealth` with the default vault | Fixed in `WealthList.subtitle` (exported for the test) |
| 7 | P3 | `/offline` page has no `<main>` landmark (axe landmark-one-main) | open `/offline` | Fixed |
| 8 | P3 | Switch thumb travel used `rtl:` classes; Turbopack lowers them to `:lang(ar)`, so the "on" thumb left the track in Arabic (QA-44 hardening) | Arabic settings under `next dev` | Fixed: classes removed (default look unchanged, layout stays LTR) |

Everything above was re-run after the fix on a fresh session (axe clean on Reports, Paydays, Budget history, Flow, Accounts, Wealth at 375; sidebar routes clean at 1440; thumbs inside the track in Arabic).

## QA fixes re-checked (no redo)

- Add-expense opens with no category selected: holds.
- Tablet 768 and desktop: column capped and centred (hero band full-bleed by design); 1024 landscape and 1440 have the sidebar and a capped body.
- Buddgy clearance: scrolled to the end on 7 screens, no text under the mascot.
- Tap areas: the real hit test found only the Back control (fixed) and false positives (controls hidden under a sticky CTA, hidden inputs, rounded-corner probes). The Buddgy chat header buttons pass.
- Headings: every route has its h1 (two in the DOM, one hidden per breakpoint; I did not count visible ones separately). Hex colours: left to the guard test that runs in `npm run verify`.
- Arabic: layout stays English-order (QA-27), html `dir` is ltr; mixed strings such as `18/يوم`, `سُدد 0%` render as designed.
- Not exercised: Flow "Not counted" chip and the Zakat prompt (the seeded user has no own-account move and no gold; covered by unit tests only).

## Left (recorded, not fixed)

- **Sync (not fixed by rule):** with every REST call returning 500, screens keep showing cached data and the failures only reach the console (`per-table flush errors`, `warm reconcile failed`). No visible "not saved" state. Belongs to the sync owner.
- Subscriptions: the YouTube tile is 4.27:1 (ink on `#FF0000`), accepted by QA-110 (4:1 for tiles); axe still reports it.
- Settings toggles in adjacent rows (`Notifications`, `Subscription reminders`): the 44 px overlays overlap neighbours by design; not worth a layout change.
- Money-in sheet: a 169 × 28 input in the hit test (probably the hidden date input); check on a device with QA-116.
- `sheets.mjs` still measures drawn boxes, so its "small" lists on chips and the Buddgy buttons are false positives; use `tapSheets.mjs`. 18 of its 56 records errored (heuristic FAB click, and one expired session in the run); the same sheets were covered by `tapSheets.mjs` and `focus.mjs`.
- `focus.mjs`: the Money-in sheet let one of 25 Tab presses leave the dialog; the "Wealth" quick-add entry opens no dialog (it navigates). Check both on a device.
- Real device only: PWA rotation (QA-77), QA-44 and QA-96 on a phone, iPad in the simulator (S7b).

## Caveat for every future UI run

`next dev` and `next build` without `--webpack` (Turbopack) lower Tailwind's `rtl:` to `:lang(ar)`, so every `rtl:` class fires in Arabic while the layout is LTR. Production uses `--webpack` (`package.json`), so chevrons and the like are correct there. Run the dev server with `--webpack` for a faithful Arabic sweep. Also: parallel contexts that share one `storageState` revoke the session (refresh-token reuse); sign in per run (`seed.ts`) and keep sweeps sequential.

## Suite changes (`e2e/ui/`)

`seed.ts` and `seedEmpty.ts` (synthetic users, state saved to `.st1.json`, `.st2.json`), `tap.mjs`, `tapSheets.mjs`, `states.mjs`, `offline.mjs`, `recheck.mjs`, `merge.mjs`; `lib.mjs` takes `PW_CHROMIUM_EXECUTABLE`, adds the 375 and 1024 landscape viewports and writes to `e2e/ui/out/`.

## S7a follow-up: UI and speed findings (branch claude/elastic-poitras-06d803)

Done in code, NOT yet run: this Mac session does not run tests, `npm run verify` or a dev server (owner rule, 2026-11-19), and no cloud `qa-runner` session exists. The cloud run, the signed-in visual check and the push to dev/main are still to do.

| Finding | Change | Check |
|---|---|---|
| S8G-07 | `billingStore.error` (set on a failed `/api/entitlements/me`, cleared on the next try); `PlanPending` shows the skeleton or "Couldn't load your plan" + Try again on Pro, Usage, Rewards, Invite, Founders | `billingStore.test.ts` (new case); J8 `test.fail` removed in `10-screens.spec.ts` |
| S8G-12 | Locked shop rows use the muted token instead of `opacity-60`; streak card title is an `h3` | rerun `e2e/ui/pro-rewards-sweep.mjs` (axe) |
| D-7 | Founders shows its title and skeleton while `me` is missing | J8 / sweep |
| S8d index | `0330_sync_probe_updated_at_indexes.sql`, applied live. `EXPLAIN` for the `sync_changed_since` probe on `expenses`: before Seq Scan cost 55.5, after Index Only Scan `idx_expenses_user_updated` cost 8.8 (user held 301 rows; the earlier 3k-row synthetic user is gone). Also income_events, savings_transactions, receipts, debt_payments | rerun `get_advisors` |
| QA-84 | `FlowChipItem` memoised on key, label, selected, aria label and budget state (the page rebuilds chips every render and mounts each twice) | `FlowChipRow.test.tsx` (new) |

Not done: Reports long tasks and the signed-out `/flow` LCP (no cheap fix identified without profiling; needs the cloud run); the signed-out Settings search icon (needs to be seen in a browser); the signed-in visual check.
