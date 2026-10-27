# QA Round 2 - Plan review C (UI / UX side)

Read-only review of `QA_ROUND_2_FIX_PLAN.md`, `QA_ROUND_2_DECISIONS.md` (binding), `qa-round-2/LEDGER.md` (sections 3, 6, B2, B9, B10a-c, B11), `design.md`, `ui.md`, `i18n.md`, checked against the live code in `src/`. Severity: H = fix the plan before B2 starts, M = fix the plan before the batch it touches, L = note.

Counts: 26 issues (H 5, M 17, L 4), 12 accessibility risks (section 2), about 65 on-screen change rows (section 3). Owner approval gates: 11 (section 5).

---

## 1. Issues

### Component-reuse (CLAUDE.md rules)

**C1 (H) - U9 EmptyState extension does not fit the six "bespoke empties"; `cta` duplicates the existing `action` prop**
- Evidence: `ui/EmptyState.tsx` (27 lines) already takes `icon, title, description, action, className`, so the planned `cta` prop is the same as `action`. The six migration targets are not icon+title+body+CTA clones: `GoalsEmpty` is a Buddgy prompt form plus six life-moment cards plus a checkpoint bar; `SubscriptionsEmpty` is a 3x2 / 6-col grid of price tiles plus two CTAs; `AIChatEmptyState` is a greeting plus four suggestion cards; `FlowSetupState` (158 lines) is a stateful setup checklist; `DebtsEmptyFamilies` is a three-row list that starts forms. `EmptyState` also renders `role="status"` (a live region), `py-8 text-center`.
- Problem: to render them "exactly" `EmptyState` needs a `children`/layout slot, which makes it a wrapper with no shared markup (the "3rd/4th variant" case) and would turn whole first-run screens into live regions that announce on mount (accessibility regression).
- Plan change: U9 = add only `illustration` (one new prop, `cta` dropped, use `action`). Migrate only screens that really are icon+title+body+action. Keep the five rich screens as compositions (CLAUDE.md: a composition of existing parts is not a new component). Use `EmptyState` for the new 404 and the offline page (genuine fits). Tell the owner the "six copies, ~150 lines" saving is mostly not real.

**C2 (H) - U4 sheet header: 4 new props on `ModalSheetHeader`, three existing looks, API mismatch, step 2 reshapes 22 sheets**
- Evidence: `ModalSheetHeader` today has `title, onClose, titleRowClassName` (h3 text-base, ghost X). `V3SheetHeader` is a compound (`.Title` 22px bold h2, `.Subtitle`, `.Extra`, tinted X, own `px-5 pt-4`), hard-coded `aria-label="Close"` (15 sheets). `SheetTitleBar` is a third look (h2 text-lg, round `sm` tinted X, `leading`), no title id. `CurrencySheet` hand-rolls a fourth (text-lg, locale ternary). Plan adds `size, subtitle, leading, extra` (4 props) to `ModalSheetHeader`.
- CLAUDE.md: 3rd/4th variant => propose promotion, and never reshape an existing component to fit a new design. Step 1 "variants, no visible change" is three looks in one component; step 2 then changes 18 + 4 sheets visibly (title 16px to 22px, h3 to h2, X style, spacing; callers that use `ModalShell padContent` would double-pad with V3's built-in `px-5`).
- Plan change: make the existing compound `V3SheetHeader` the single target (it is already the DS-named one and already has the slots). Step 1 = `V3SheetHeader` fixes only (`useT().common.close` instead of the literal, `useModalTitleId` already there) and the ~22 hand-rolled titles get `useModalTitleId` (U30, no look change). Step 2 = migrate callers one family per commit with before/after screenshots, `ModalSheetHeader`/`SheetTitleBar` then re-export or are deleted. No 4-prop bag. Ask the owner to confirm that the "V3 target" decision counts as the explicit bypass for the step 2 visible change.

**C3 (M) - U5 `CurrencySheet` `dual` prop is a different component, not a prop**
- Evidence: `CurrencyDualSheet` has `base, second, rates, onPickMain, onPickSecond, initialTab, footer`, a Main/Second `SegmentedControl`, an explicit Off choice and a live preview; `CurrencySheet` has `value, onSelect, base, includeGold, codes, zIndexClassName`. The two share only the list (already `CurrencyList`).
- Plan change: model `dual` as a discriminated union or keep `CurrencyDualSheet` as a thin wrapper over a shared sheet shell + `CurrencyList`. Do not add 7 optional props to the single-currency API (every one of the many `CurrencyField` consumers would see them). B9 must first move the two `COPY` tables (Egyptian dialect) to dictionaries, as the ledger already orders.

**C4 (M) - Pay-debt currency picker: reuse `DebtCurrencyField`, do not wire `CurrencySheet` by hand**
- Evidence: `CurrencyField` already opens `CurrencySheet`; `DebtCurrencyField` = `CurrencyField` with `includeGold`; `AmountCurrencyRow` in `MoneySheetParts` is the app's amount+currency row but has no `includeGold`/`zIndexClassName`. `PayDebtForm` shows `AmountField currency={d.paymentCurrency}` with no picker. `CurrencySheet` defaults to `z-[110]`, so a picker opened from inside a sheet needs the existing `zIndexClassName`.
- Plan change: D9 = put `AmountCurrencyRow` (add additive `includeGold` + `zIndexClassName` props, defaults unchanged) into `PayDebtForm`, default value = debt currency, XAU via `includeGold`. Gold quantity must go through the T1 quantity formatter (grams, not currency decimals).

**C5 (M) - "From account" row: only 3 of the 6+ deposit/withdraw sheets share `MoneySheetParts`**
- Evidence: `MoneySheetParts` is imported by `AddSavingsSheetV3`, `WithdrawSheetV3`, `ZakatSheet` only. Money into pockets also goes through `GoalAddMoneySheet`, `NewGoalFlow` (`useNewGoalForm` initial deposit), `useRecurringSavingsScheduler` (no UI), `EmergencyFundSheet`, `AddHoldingSheet`/`AssetFormSheet`/`PocketFormSheet` (opening balance). The existing control is `accounts/AccountPicker` (documented in DESIGN_SYSTEM "Collapsing From list"), but its label is fixed to `t.accountsPage.from` and it lives outside `MoneySheetParts`. B2 (build the row) runs before B10b (merge blocks into `MoneySheetParts`), so each sheet would get its own copy and B10b would redo it.
- Plan change: in B2 add one `AccountLegRow` to `MoneySheetParts` wrapping `AccountPicker` (additive `label` prop, default "From"; "To" for Withdraw), hidden when there are no tracked accounts, default = primary tracked account (DECISIONS Addendum 2). Use it in every sheet that moves pocket money. List the sheets in the batch notes. Show a one-line "Moves from <account>" read-only text when only one account exists instead of a one-option picker.

**C6 (L) - Pattern review admin page reuse**
- Evidence: admin has `ui/Panel, DataTable, Kpi, Pill, Field, AdminSheet, StepUp, Charts` and `views/sms/{KeywordPool,Promotion,SmsLog,Templates}Panel`; `adminRouter` routes by `?s=section`. There is no admin banner primitive.
- Plan change: add "Pattern review" as a new panel/tab inside `SmsView` (same pattern as the four panels), countdown banner built from `Panel` + `Pill` (not the app's `PromptBanner`, which is an app-token component), "Mark reviewed" behind `StepUp`, permission `sms.view`/`sms.manage`. Admin is exempt from the 44px/h-12 rules (desktop density) so no DS conflict. "Copy review prompt" must copy only the masked pack; raw examples only for the owner id, enforced server-side. Fine as planned.

**C7 (M) - SettingsToggleRow to SettingsSwitchRow: `tag` and store binding must move, not vanish**
- Evidence: `SettingsToggleRow` has `tag` (e.g. "This device only") and reads `useSettingToggle(id)` + `copy.items[id].label`; `SettingsSwitchRow` has neither `tag` nor the store binding.
- Plan change: add additive `tag` to `SwitchRow`; keep `ToggleRow` as the 10-line wrapper (store-bound) rather than removing it, otherwise 10 callers repeat the binding. DECISIONS says "then removed": adjust to "wrapper stays".

**C8 (L) - Variant/prop count summary (CLAUDE.md "3rd/4th variant" rule)**

| Component | Today | Plan adds | Rule hit? |
|---|---|---|---|
| ModalSheetHeader | 1 prop beyond title/onClose, 0 variants | size, subtitle, leading, extra (+3 looks in play) | YES, propose promotion (see C2) |
| EmptyState | 5 props | illustration, cta (dup of action), layout slot to fit the rich screens | YES (3rd), see C1 |
| CurrencySheet | 6 props | dual + ~6 dual-only props | YES, see C3 |
| Button | xs/sm/default/lg/touch/cta... | invisible 44px hit area on every size (default behaviour, a11y fix) | Allowed only "with tests, no default look change, note to user" |
| ActionToast | 2 options | pause, longer undo, stacking (U39/U31) | Same exception as Button |
| AmountCurrencyRow, AccountPicker | no variants | `includeGold`, `zIndexClassName`, `label` | Additive, OK |
| HeroBand | n/a | fit-text prop (X1), FlowSummaryBand through slots (U8) | Count HeroBand props before B11; U8 is the last item and screenshot-gated, fine |

### Consistency problems the plan creates

**C9 (H) - Confirm + Undo (D4, L9, W20, L25): Undo works but is hidden under sheets and cannot be reached or kept**
- Evidence: `ActionToast` supports `undo`/`undoLabel` (used already by expense delete via `restoreExpense`, payday actions, Buddgy). So wiring a debt-payment delete is possible, but: (1) the toast is `z-[100]`, sheets are `z-[110]`, so a delete done inside a sheet shows the toast under it (U31 is in B10a, after B2); (2) one toast slot: a second `show()` clears the first, so two quick deletes lose the first Undo; (3) Undo lasts 5 s, no pause (U39 is B10a), the button is `min-h-9` (36px) and sits at the end of the DOM, so keyboard/screen-reader users cannot reach it in time (WCAG 2.2.1 / 2.5.8); (4) default label falls back to the English literal "Undo" when `undoLabel` is omitted; (5) an Undo of a debt payment must restore the payment, its paired expense, and the reactivated schedule with the ORIGINAL ids (L25), and clear any tombstone already pushed by sync inside the 5 s window.
- Plan change: move U31 (toast z-index) and U39 (pause on hover/focus, 8-10 s for undo toasts, error toasts `role="alert"`) into B2, ahead of D4/L9/W20. Make `restoreDebtPayment(snapshot)` one store action (payment + expense + schedule) and add a test that sync after delete-then-undo does not resurrect a tombstone. Use `useConfirm()` (exists in `ui/dialog/DialogProvider`) for the confirm step, destructive style; do not stack confirm + Undo for the same action without the owner's call (pocket delete asks confirm AND Undo per Addendum 2: acceptable, but the confirm must show the balance and the Undo toast is the second chance).

**C10 (M) - Zakat "Mark as paid" placement**
- Evidence: `ZakatSheet` already persists every change immediately (`save()` runs `updateProfile` on each toggle/blur). Its footer has two buttons: outline "Remind me" (only closes the sheet, schedules nothing) and primary "Log zakat payment" (when due) or "Save", which stamps `lastPaidDate = now`. So "Save stores the calculation only" is already true for everything except that one stamp.
- Plan change: footer = outline "Done" (replaces "Remind me"/"Save", both misleading) + primary "Mark zakat as paid" shown only when `result.due`, guarded by `useConfirm` (it starts the next hawl) and an Undo toast. When not due, show only "Done". Rename keys in en+ar. Owner gate (copy).

**C11 (M) - Week-start setting placement**
- Evidence: settings are registered in `lib/settings/registry.ts` (id, group, kind, route, icon) and also drive Settings search (`SettingsSearch`), `settingsHubCopy` and `SETTING_ICONS`. The five quick tiles are a fixed set. `UnifiedDatePicker` hard-codes Sun..Sat, `expenses/dateRange.ts` uses default `startOfWeek`.
- Plan change: add `weekStart` to `SETTING_IDS` as kind `value` in the `quick` group next to `baseCurrency`/`showCents`, opening a small sheet with `SegmentedControl` (Saturday / Sunday / Monday), copy in `settingsHubCopy` en+ar, search entry, icon key. Apply it in picker, week preset, and any week-bucketed chart. DT7 default is by timezone, but all existing `user_settings.timezone` are NULL until the 0192 client reports (ledger section 7, O9), so "applied once to existing users" cannot work on day one; use `language === 'ar'` + device timezone at first launch after update, store the result, and show a one-time toast "Week now starts on Saturday. Change in Settings" so the calendar does not silently shift for existing users.

**C12 (M) - Push pre-prompt sheet duplicates an existing pattern**
- Evidence: onboarding `StepAutomate` already has Allow / Later (`push: 'allowed' | 'later'`, `pushLaterAt`); `NotificationsCard` registers on toggle; `NativeBootstrap` calls `registerPushNotifications` at boot, which calls `PushNotifications.requestPermissions()` directly (the un-primed OS prompt).
- Plan change: one `PushPrimer` sheet (ModalShell + `V3SheetHeader` + `Button cta-block` Allow / `outline` Later) reused by StepAutomate, NotificationsCard and the boot path; `NativeBootstrap` must stop requesting unless state is `allowed`. Respect `pushLaterAt` (do not re-ask for N days). Ledger C25 still says "NOT in DECISIONS": it is approved in Addendum 2 (see C25 below).

**C13 (M) - 404 page inside the app shell**
- Evidence: no `src/app/not-found.tsx` exists. `AppViewRouter` renders the real App Router `children` for any path not in `VIEW_MAP`, so Next's default 404 shows inside `AppShell`, English-only, two h1 (X7/X11).
- Plan change: add `app/not-found.tsx` (client component; `LocaleProvider` is above `AppShell` so `useT` works): `EmptyState` (title, description, `action`) with `AppLink` "Back to Flow" (never `next/link` or `href` full load: the nav shell exists to avoid segment-fetch wedges), one h1, ar+en keys. `global-error.tsx` sits outside providers and needs the no-provider locale read (T3). `/offline` can use the same `EmptyState` + a `Button size="touch"` "Try again" (X12); set `lang="en"` on legal page wrappers instead of changing the document language.

**C14 (H) - Focus-ring change (U25/U32): changing the token alone does not reach 3:1**
- Evidence: 30 files use `ring-ring/50|55` or `ring-[var(--color-brand-focus)]/30|50|55` (Button, Input, Switch, IconButton, select, textarea, ...). The rendered ring is the token at 50-55% alpha, which is why light measures 1.57-1.64:1. Darkening `--color-brand-focus` from `#12B0A0` to `#0B7568` still gives about 2.2:1 at 50% alpha on white. `--color-brand-focus` is also read directly as a border colour by `AmountField` (active state) and `--ring` feeds shadcn `border-ring`/`outline-ring/50`. DECISIONS says "same neutral hue", but `globals.css:257-261` says the ring is now brand teal (the "neutral" memory is stale). Rings on controls inside `overflow-hidden` cards/rows (Settings rows, divided Cards) are clipped at the card edge.
- Plan change: introduce a single focus class set (full alpha, 2px, optional 2px offset or inset ring inside overflow-hidden rows) applied to Button, Input, IconButton, Switch, Textarea, Select, SelectableCard, OptionChip, and replace the 28 bare `outline-none` sites (U32). Token: light `#0B7568` (5.6:1), dark keep `#1FC3B2` (full alpha already 7+:1). State the real hue (teal, darker) to the owner; "neutral" is not what ships. Note the visible side effect: the `AmountField` active border and every input focus ring get darker in light mode. Add a Playwright/axe or computed-style test for the contrast, not only a snapshot.

**C15 (M) - Hit-area expansion (U18/X5/U19/U44) vs Button, IconButton and DESIGN_SYSTEM**
- Evidence: `IconButton` already has the `after:` 44px technique and `Switch` has `after:-inset-x-3 -inset-y-2`; `Button` (xs 24, sm 28, default 32, lg 36) has none and no `relative`. DESIGN_SYSTEM says `xs`/`sm` are "admin only" and every `<button>` must be `min-h-[44px]`; ledger U18 lists 40 non-admin call sites on xs/sm/default.
- Problems: (1) the plan keeps those 40 sites on small sizes with an invisible target, which contradicts the DS text; update the DS wording and `noStyledRawButtons` guard in the same commit, or migrate call sites to `touch` where there is room. (2) Pseudo-element targets are clipped by `overflow-hidden` ancestors (every `Card divide overflow-hidden` row). (3) Adjacent small controls overlap: debt carousel dots (8px, "Go to n" 18x8), `WealthHeroBadges` (two `sm`), month arrows (32px), `FlowChipRow` clear link: a 44px target on an 8px dot centered 8px from the next dot makes mis-taps; dots need larger spacing or an indicator that is not a button. (4) Inline links in prose (legal pages, 16 links at 33x16) cannot take a block hit area: declare them exempt under WCAG 2.5.8 (inline exception) in the plan. (5) The audit method (bounding rect height) never sees `::after`, so B12's re-measure will still report the same 40 controls as "<44px"; measure with `elementFromPoint` at the 44px box corners instead. (6) `ActionToast`'s Undo button is a raw `min-h-9` (36px) button.
- Plan change: add `relative` + the `after:` rule to `button.tsx` base via an `after` class only for sizes below 44 (`xs`, `sm`, `default`, `lg`, `icon*`); test with a computed-style assertion; keep `touch`/`cta` untouched.

**C16 (M) - Chip colour tokens (U28) and chart palette (R12)**
- Evidence: `--color-cat-1..6` are read in 33 files (SettingsChip hue, icon tints, charts); `--cat-*-bg` are 12-13% alpha tints. Contrast failures (U28) are for chip TEXT on tint (2.7-4.3:1).
- Plan change: add separate `--cat-*-ink` text tokens (additive) used only by chip labels; do not nudge the base `--color-cat-*` or every icon/chart/settings chip shifts hue. R12 (pie palette to tokens) is a visible colour change on Reports: include before/after in the commit notes (Addendum already approves notes for visible fixes).

**C17 (M) - Glossary sweep scale and ordering (U46-U49, U41, T17)**
- Evidence: 3021 dictionary keys per language, 175 inline `isAr`/`COPY` sites, `settingsHubCopy` and other copy files outside `lib/i18n/dictionaries`, ~345 aria/placeholder/title literals (U41), 11 spots that reference `aria-label="Close"|"Delete"`. B9 (new/missing Arabic strings, plurals, aria) runs BEFORE B11 (U46-U49 glossary sweep), and en/ar are shared hot files.
- Problems: strings authored in B9 will be re-worded in B11, and the owner reviews the Arabic list twice. Persisted English names ("Monthly Savings" vault) are data, not copy (T16 handles). "Savings the area" conflicts with navigation: the tab is **Wealth** (Savings + Investment merged; `/savings` resolves to WealthPage; DS bottom bar: Flow, Accounts, add, Wealth, Debts). "Delete = permanent" conflicts with delete-with-Undo flows (the user sees it as recoverable for 5-10 s): decide that "Delete" still applies, with the Undo toast.
- Plan change: get the glossary approved BEFORE B9 and make every B9 string follow it; move U46-U49 into B9 (same files, one pass over en.ts/ar.ts). Define "Savings/Wealth" explicitly. Run the sweep as codemod-assisted with a parity test (already exists for keys) plus a test that fails on forbidden words ("Oops", "transaction" outside mixed lists, "Remove" on a permanent delete).

**C18 (M) - T11 (bidi plaintext) contradicts X14 (un-mirror settings rows)**
- Evidence: T11 plan = `unicode-bidi: plaintext`/`dir="auto"` on text blocks. Under plaintext an Arabic paragraph's `text-start` resolves to the RIGHT edge, so Arabic row titles/subtitles would be right-aligned again next to a left icon and a right chevron: the exact half-mirrored look X14 removes. Today's right-alignment comes from `locale === 'ar' && 'text-end'` in 3 row components plus flipped chevrons in 6 places.
- Plan change: write one rule in DESIGN_SYSTEM "Arabic locale rules": inside list rows and controls (icon-chip + text + chevron), text aligns to the start (left) and the chevron points right; in prose/paragraph blocks (descriptions, empty states, tooltips, Buddgy messages) use `plaintext` so punctuation lands correctly. Exclude `[data-row]`/row text from the plaintext rule.

**C19 (M) - LTR un-mirroring: what mirrors today and why**
- Evidence (all from `locale === 'ar'` branches): `SettingsRow` (chevron right to left; title+subtitle `text-end`), `SettingsSwitchRow` and `SettingsToggleRow` (`text-end` on the label block), `ProfileBanner` (chevron flip + `text-end`), `SettingsSearch` (two chevron flips + `text-end` on result rows), `SettingsSubPageShell` (back chevron flipped to point right). They exist because the first Arabic pass assumed RTL while `<html dir="ltr">` is forced. The Switch has `rtl:` translate variants that are inert under forced LTR. Icon chips and switches do not move in code (the X14 claim that they do was a visual observation under the right-aligned text; re-verify on a screenshot before editing).
- Plan change: remove the six `locale === 'ar'` branches (chevron always `ChevronRight`, back always `ChevronLeft`, no `text-end`), delete the dead `rtl:` Switch variants only if no `dir=rtl` surface exists, and keep a before/after Arabic screenshot of Settings, Security, Notifications, SMS and Profile. 36 files use `text-end`; audit the others for the same half-mirroring (do not blanket-remove: many are numeric/right-aligned columns).

**C20 (M) - Date entry (U6): replacing three native date inputs with `DatePickerField`**
- Evidence: native `<input type="date">` gives the OS picker, keyboard entry and screen-reader semantics for free; `UnifiedDatePicker` is a custom grid with a fixed 1970-2035 year list (T9) and a hard-coded Sun-first grid (T8).
- Plan change: order T9 and T8 before U6 (the ledger already lists T9; add T8). Add a keyboard/ARIA check (arrow keys across days, `aria-selected`, labelled month/year) to the B10b gate; pocket/asset purchase dates in the past must be pickable, and the max year must be now+50.

**C21 (H) - B8 "sheets via dynamic import" vs offline/native architecture**
- Evidence: `AppViewRouter` imports every view statically on purpose ("zero network fetch ... segment-fetch wedge structurally impossible"); the app has an offline fast-path and native WebView. A dynamic-imported sheet chunk is fetched on first open; offline or on a flaky native network the sheet will not open, and the first-open path shows a blank/skeleton flash.
- Plan change: keep the add-expense / quick-add / pay-debt / confirm sheets static (offline-critical), lazy-load only rarely used heavy sheets (zakat, asset form, voice, receipt, admin), prefetch them on idle after `dataReady`, give the `import()` an error fallback with a retry toast, and add this to B12 (open every lazy sheet offline). Tell the owner that heavy sheets may show a short skeleton on first open.

**C22 (M) - Validation UI built in B2 before the error primitive in B10a**
- Evidence: D6 (card statement day/min%), L16 (BNPL), W6 (delete clamps balance), R27 (toast) add inline validation messages in B2; U38 (aria-invalid, announced errors) and U50 (validation timing) land in B10a/B11.
- Plan change: define one `FieldError` behaviour first (id, `aria-describedby`, `aria-invalid`, `role="alert"` on submit-time errors, show on blur/submit not per keystroke) and use it in B2; otherwise B2 ships inconsistent errors that B10a/B11 rewrite.

**C23 (M) - U21 input heights and the inline fields**
- Evidence: ZakatSheet has `h-9`, plus two `h-9 w-[84px]` inline inputs inside factor rows; `EditSavingsAccountSheet` `h-10`. DS: inputs `h-12`.
- Plan change: moving them to `h-12` changes row layout; needs a screenshot decision (keep `w-[84px]` but h-12, or use `Input size="brand"` full-width in its own row). Flag in the B10a notes.

**C24 (L) - Hero fit-text (X1/X3)**
- Evidence: HeroBand additive prop is allowed; "default look unchanged" must hold for all six HeroBand users, so the clamp must only apply above 10 digits.
- Plan change: test with a 98.7M seed at 375 for Flow, Reports, Accounts.

### Ledger / decision consistency

**C25 (M) - Stale notes in LEDGER section 6 and in DT6 vs Addendum 2**
- Items marked "NOT in DECISIONS" that Addendum 2 now approves: C25 (push pre-prompt), X11 (404), L19 (Flow ordered by `occurredAt`), W20 (pocket delete confirm + Undo), R16 (hero "grow"), R8 (Over-pace false fire), U46-U49 (glossary), I19 (Buddgy asks once before navigating), C13 (2FA off re-auth), W2 (From account, hidden when no tracked accounts; the "picker may be needed" note is resolved), I20 (memory proposals default OFF for new users: the ledger note says "default stays unless owner asks", which now contradicts the decision).
- DT6/T3 say "Arabic ships only after owner review" and ledger section 7 flags the conflict with auto-push; Addendum 2 (later) says **ship with the batch, owner reviews after**. Plan v1 still carries the older rule.
- Plan change: update section 6 and the Note cells (a status column "approved in Addendum 2" so the owner sees what is still undecided), delete the "hold Arabic keys for sign-off" option, and keep "Arabic review list" as a post-ship deliverable.

**C26 (L) - New UI not covered by any decision (must be shown to the owner before building)**
- Evidence/ids: L8 (locked amount/currency on linked income events), L16 (BNPL validation message), L20 (visible Delete button in expense/income edit sheets), D6/D11/D12 (card form validation, locked fields, relabelled "Outstanding"), W6 (delete tx message), W25, R27 (moveBuffer toast), X12 (offline retry button), X15 (Add sheet subtitles / orphan tile), C10 (balance privacy: wire or hide two dead options), C21 (re-lock after background timeout), V13 (quota banner), U50 (CTA visible while keyboard is up). Each is small, but they are visible flow changes. They are in the table below flagged "(not decided)".

---

## 2. Accessibility regressions the plan could introduce

| # | Risk | Where | Guard |
|---|---|---|---|
| A1 | Rich first-run screens become live regions | U9 migrating into `EmptyState role="status"` | Keep them out of `EmptyState` (C1) |
| A2 | Overlapping 44px hit areas cause mis-taps; clipped hit areas give a false sense of fix | U18, carousel dots, WealthHeroBadges, Cards with `overflow-hidden` | C15 |
| A3 | Focus ring clipped by `overflow-hidden` rows, or still below 3:1 at /50 alpha | U25/U32 | C14 |
| A4 | Undo unreachable by keyboard / SR within 5 s, hidden under sheets | D4/L9/W20 | C9 |
| A5 | Native date input (OS picker, SR-friendly) replaced by a custom grid | U6 | C20 |
| A6 | `inert` on the background + focus trap rewrite (U37) can also inert the toast host or a nested `useConfirm` dialog | U37 | Apply `inert` to the shell wrapper only, never to the toast/provider siblings; test sheet-on-sheet + confirm-on-sheet focus return |
| A7 | Heading changes: sheet h3 to h2 (step 2), sr-only h1 per view (U42) in a nav shell that never changes `document.title` | U4, U42 | One h1 per view, update `document.title` per view; do not nest a second h1 inside 404/offline |
| A8 | Hard-coded English accessible names remain after the T3/U41 sweep if the sweep only touches `aria-label`: `placeholder`, `title`, `alt`, `aria-valuetext`, `sr-only` text | U41 | Sweep all five attribute kinds with an AST test (as `i18n.md` did) |
| A9 | Letter-spacing reset (T10) and `plaintext` can break the uppercase micro-labels' layout | T10/T11 | Screenshot Settings section captions and `micro` labels in Arabic |
| A10 | Toast text role: success toasts `role="status"`, but errors must be `role="alert"` and not auto-dismiss in 2 s | U39 | C9 |
| A11 | Arabic amounts: new Arabic-digit input normalisation must not re-announce digits differently for SR (value kept Latin) | T7/L2 | Keep value Latin; add `lang="en"` or `dir="ltr"` on numeric fields only if already the case |
| A12 | Reduced motion: toast pause/Undo timing and sheet animations (U33) | U33/U39 | Honour `prefers-reduced-motion` in toast slide as well |

---

## 3. What changes on screen (by screen, with batch id)

"Decided" = covered by DECISIONS (incl. Addendum 2). "(not decided)" = follows the report; the owner has not approved it.

| Screen | Batch | What the user sees differently |
|---|---|---|
| **Flow** | B11 (L19) | Rows inside one day are ordered by when the money moved, not by when it was entered. Decided. |
| Flow | B5 (R5, R6, R9) | "Left to spend" is one number (budget minus spent), same as Buddgy and the savings sheet; month arrows never go past the current cycle when the month starts after the 1st; hero stats no longer mix range and month. Decided. |
| Flow | B5 (R7) | Screen refreshes its month/day when the app comes back after midnight. |
| Flow | B11 (X1) | Very large amounts shrink so the big number no longer overlaps the "per day" figure. |
| Flow | B10a (U18/X5) | Header Budget/Profile buttons, "Set budget", All/In/Out, month arrows, filter and chips keep their look but are easier to tap. |
| Flow | B10a (L20) | Expense and income edit sheets get a visible Delete button (until now only a hidden swipe). (not decided) |
| Flow | B2 (D4, L9, L25) | Deleting an income row shows an Undo toast; undo restores the same row. Decided. |
| **Add / Edit expense** | B2 (L10, DT11) | Expense with a receipt shows the receipt breakdown and photo; deleting the expense deletes the photo. Decided. |
| Add expense | B2 (L14, I13) | Editing an expense moves it to the new day; double-tapping Save on a receipt no longer duplicates. |
| Add expense | B11 (U6, U50) | Date field uses the same date picker as everywhere (3 forms); validation hints appear on blur/submit and Save stays visible above the keyboard. Date picker decided; validation timing (not decided). |
| Add sheet (FAB) | B11 (X15) | Menu subtitles wrap to two lines; the last tile no longer sits alone. (not decided) |
| **Income / Paydays** | B1 (L1, R3) | Income events that were hidden after a source was deleted come back. |
| Paydays | B2 (L8) | Amount/currency of an event created by savings or debt can no longer be edited (shown locked). (not decided) |
| Paydays | B4 (N1) | A salary "confirm" now posts the income (12 earlier ghost rows are listed for owner approval first). (not decided) |
| **Debts** | B2 (D9) | Pay-debt sheet has a currency picker, defaulting to the debt's currency (gold for gold debts). Decided. |
| Debts | B2 (D4) | Deleting a debt payment also removes its paired expense (and the reverse); money moves ask to confirm and show Undo. Decided. |
| Debts | B2 (D5, D28) | "Confirm paid" hides after success and ignores a second tap; inbox buttons are 44px. Decided. |
| Debts | B2 (D6, D11, D12) | Card forms reject statement day outside 1-31 and minimum % outside 0-100 with an inline message; currency/gold locked once payments exist; "Outstanding" relabelled. (not decided) |
| Debts | B1 (D1, D2) | 21 expenses that were not linked to their debt payments get linked (backup first). |
| Debts | B10b (U8) | Debt carousel cards share one component; pixel-identical or the card reverts. Decided. |
| Debts | B11 (X20) | Clipped "Plan a clear-by..." text fixed; lent vs borrowed grouping checked. |
| **Wealth / Savings** | B1 (W2) | Adding to a pocket now takes the money from the primary tracked account (net worth stops inflating); a "From account" row appears in every deposit sheet, hidden when there are no tracked accounts. Decided. |
| Wealth | B1 (W1) | Gold conversions use the real gram price; unconvertible moves are rejected or shown as incomplete instead of a wrong amount. (not decided) |
| Wealth | B2 (T1, W3) | Gold/crypto quantities show their real decimals (0.0123 BTC, 2.5 g); withdraw "Move to pocket" respects the chosen currency. |
| Wealth | B2 (W20) | Deleting a pocket asks to confirm (shows balance) and offers Undo. Decided (Addendum 2). |
| Wealth | B2 (W6) | Deleting a savings transaction no longer silently clamps the balance at 0; a message explains. (not decided) |
| Zakat sheet | B2 (W10) | "Save" no longer stamps "paid"; a separate "Mark zakat as paid" button records payment and starts the next hawl. Decided. |
| Zakat / asset / pocket forms | B9 (T3) | Fully available in Arabic (labels, errors, aria). Decided. |
| **Goals** | B11 (X19) | Goals with no status appear (as active). |
| **Budget / Reports** | B5 (R4, R16, R8) | Reports "Total out" excludes transfers/ATM/card payoff/top-up/savings and follows the budget month start; the hero budget excludes the "grow" block; Over-pace chip no longer fires falsely from day 1. Decided (Addendum 2). |
| Reports | B5 (X2, X3) | "Money in" labelled Expected vs Received; amounts do not wrap the currency symbol onto its own line. (not decided) |
| Reports | B5 (R12) | Chart tooltips show names; pie colours come from category tokens (some colours shift). (not decided) |
| Reports | B9 (R13) | Chart titles, filter chips, CSV headers and month names in Arabic. |
| **Accounts** | B2 | "Hide balances" and card actions keep their look, larger tap area. |
| **Budget plan** | B5 (R27) | "Move buffer" explains itself with a toast when there is nothing free. (not decided) |
| **Buddgy chat** | B2 (I2, I19) | Adds an expense in one step only within limits (max amount, date within 7 days, 5 per minute), otherwise asks for a tap; asks once before navigating. Decided. |
| Buddgy | B11 (I12) | Quota-denied no longer shown as a key rate-limit message. (not decided) |
| Buddgy | B11 (I20) | Memory proposals default OFF for new users; existing keep theirs. Decided (Addendum 2). |
| Voice / receipt scan | B11 (I3) | Offline voice queue no longer blocks behind one bad item (retry cap, dismiss). (not decided) |
| **Settings hub** | B9 (T8) | New row "First day of week" (Saturday / Sunday / Monday). Existing users get one-time default by timezone/language. Decided. |
| Settings (Arabic) | B9 (X14) | Rows, chevrons and back arrows stop mirroring; Arabic text aligns like the rest of the LTR layout. Decided. |
| Settings | B10b (U7) | None visible (row component merged). |
| Settings / Security | B3 (C5, C13) | Changing password asks for the current password, signs out other devices, re-trusts this one; turning 2-step off asks to re-authenticate. Decided. |
| Settings / Security | B6 (C21) | App-lock re-locks after a background timeout; web fallback. (not decided) |
| Settings / Notifications | B6 (O9, C25) | Notifications arrive around 09:00 local time; overdue alerts at day 1, 3, 7 then weekly; a pre-prompt sheet appears before the system push prompt. Decided. |
| Settings / Privacy | B11 (C10) | Two balance-privacy options either work or are hidden. (not decided) |
| **Onboarding / SMS** | B6 (DT1) | Prominent SMS disclosure and explicit consent screen before SMS tracking turns on. Decided (store checklist). |
| SMS review inbox | B4 (N18, N1) | Credits from an unknown sender go to "confirm" instead of auto-booking; debits stay automatic. Decided (Addendum 2). |
| **Global: sheets** | B10a (U30) | Every sheet announces its title to screen readers. |
| Global: sheets | B10b (U4 step 2) | 18 + 4 sheets move to the larger V3 title look (22px bold, tinted close button). Decided, separate stoppable commit. |
| Global: sheets | B8 | Rarely used heavy sheets may show a brief skeleton on first open (lazy load). |
| Global: toasts | B10a/B2 (U39, U31) | Toasts stay longer, pause while hovered/focused, and appear above open sheets. (not decided) |
| Global: focus | B10a (U25) | Keyboard focus ring is a darker teal, full strength, on every control. Decided ("same neutral hue" is actually teal). |
| Global: chips/text | B10a (U24, U28, U16, X18) | Category chip labels, pale-on-light text and tiny dark-mode labels get darker text tokens. Decided. |
| Global: forms | B10a (U21) | A few inputs (zakat inline fields, savings-account edit) become 48px high. (not decided) |
| Global: header | B10a (X4) | Logo link gets a name ("Buddget home") and a larger tap area. |
| Global: Arabic | B9 | Month/weekday names, correct plurals, Arabic keyboard digits accepted, no letter-spacing gaps in Arabic, correct punctuation placement. Decided. |
| Global: copy | B9/B11 (U46-U49) | One vocabulary (Delete vs Remove, expense vs transaction, calm error tone, no developer messages). Needs glossary approval. |
| **Auth** | B10b (U10) | Reset-password page uses the same password field (show/hide) as sign-in. |
| **404** | B11 (X11) | Branded, translated page with a "Back to Flow" button. Decided (Addendum 2). |
| **Offline** | B9 (X12) | Translated, with a "Try again" button. (not decided) |
| Notifications page | B10a (X7) | One heading instead of two. |
| Legal pages | B10a (X5/X7) | One h1; inline links unchanged. |
| **Admin (staff)** | B4 (PR1, LF4) | New "Pattern review" tab in SMS: countdown banner, review pack, Copy prompt, Mark reviewed (step-up). Decided. |
| Dead code | B10c | None visible. |

---

## 4. What I did NOT find a problem with

- `ReceiptDetailSheet` wiring (L10) is consistent in DECISIONS, LEDGER and FILE plan (not deleted). Translation keys land in B2/B9; confirm B9 does not skip it because it is on the B10c candidate list (ledger U1 note covers it).
- Pill merge (U15), AuthPasswordField reuse (U10), Switch hit area (U19) are low risk and match existing primitives.
- `ActionToast` can carry Undo (already used by expenses, payday actions, Buddgy); only the surrounding behaviours need work (C9).
- The admin page can reuse existing admin components (C6).

---

## 5. Items that need the owner's approval before they ship

1. **Glossary** (Delete/Remove, expense/transaction, Savings/Wealth, Budget/plan, error tone). Must be approved before B9, not before B11 (C17). Resolve "Savings the area" vs the Wealth tab.
2. **Arabic string list** (~156 missing strings + plural rewrites + the new copy listed below). Addendum 2 says ship then review; plan v1 still says "hold" (C25). Confirm the later rule.
3. **Egyptian dialect to MSA** for `PayCycleSheet` and `CurrencyDualSheet` (existing visible Arabic copy changes: "بيبدأ", "النهاردة", "إزاي"). Covered by "MSA" decision but it rewrites strings users already see.
4. **Copy for new UI**: "Mark zakat as paid" + confirm text, Undo messages for deleted payment/pocket/income, push pre-prompt sheet, 404 page, offline "Try again", week-start labels and the one-time notice, From/To account labels, card/BNPL validation messages, locked-field hints, balance-clamp message.
5. **SMS consent screen text** (DT1): wording is a Play/App Store compliance artifact; owner (and ideally a policy check) approves the exact text and the privacy-policy rewrite (C15).
6. **Focus ring look**: darker teal at full strength (the decision text says "neutral hue"; ship hue is teal), plus darker `AmountField` active border (C14).
7. **U4 step 2**: bigger sheet titles on 22 sheets, with before/after (C2). Confirm that the V3-target decision is the explicit component-reuse bypass.
8. **Reports pie colours / chip ink tokens** (C16): colour shifts.
9. **Week-start migration** for existing users and the notice (C11).
10. **UI changes marked "(not decided)" in section 3** (about 15 items; C26): at least L8, L20, W1, W6, D6/D11/D12, C21, C10, X12, U21, U39 duration.
11. **EmptyState scope reduction** (C1): the owner decision expected six migrations; the review recommends fewer.

---

## 6. Recommended plan edits (short list)

1. Reorder: glossary approval, then B9 (include U46-U49); toast fixes (U31/U39) and `FieldError` into B2; `AccountLegRow` in `MoneySheetParts` inside B2; T8/T9 before U6.
2. Replace U4 "4 new props" with "V3SheetHeader is the single component"; U9 shrinks to `illustration` only; U5 as union/thin wrapper; U7 keeps the wrapper.
3. U25 as a class-set change on 8 primitives + 28 bare outlines, not a token tweak; U18 DS text + guard update + `elementFromPoint` measurement; B8 keeps offline-critical sheets static.
4. Update LEDGER section 6 and DT6 to match Addendum 2; add a "needs owner" column for the (not decided) items.
