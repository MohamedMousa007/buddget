# Findings G: account visuals, bank logos, Add Savings sheet and selectors

Investigator G, read-only. Checkout: `origin/main` worktree (store builds iOS 146 / Android vc180 were cut at `75e4ce8c`, which is an ancestor; none of the files below differ on any of the five named branches: `git diff --stat origin/main...origin/<branch>` on `savings-v3/`, `accounts/`, `SelectableCard`, `lib/payment` is empty for all five). So every symptom below exists at main and in the current store builds. No unmerged branch fixes any of them.

## Shared picture (read this first)

The Add Savings sheet is `src/components/features/savings-v3/AddSavingsSheetV3.tsx`. It is opened from the FAB by `QuickAddFAB.tsx:76-81` (`setWealthAddRequested(true)` then `navigate('/wealth')`), and rendered by `src/app/(app)/wealth/page.tsx:109,359-360` (`showAdd = addOpen || wealthAddRequested`).

Two different selector implementations sit in that one sheet:
- "Into" = `PocketRadioList` (`MoneySheetParts.tsx:25-52`): every pocket is a full `SelectableCard` row (40px icon tile, name, identity line, balance), stacked with `space-y-2`. No cap, no search, no collapse, no empty state, no add action.
- "From account" = `AccountPicker` (`features/accounts/AccountPicker.tsx:20-59`) via `AccountLegRow` (`MoneySheetParts.tsx:86-93`): a one-row trigger that unfolds an inline `role="listbox"` list.

The app has **seven** single-choice selector implementations (table in BDG-027/028). The owner's premise "other pickers use a dropdown" is only partly true: the account pickers in the expense, income, debt and installment forms are NOT dropdowns, they are `PaymentMethodPicker` (a `FieldButton` that opens `SelectPaymentMethodSheet`, a card carousel sheet). The real dropdown is `SelectField` (Base UI `Combobox` popover), used for non-account lists (admin, goals, subscriptions, edit-savings, country, month).

---

## BDG-026 Add Savings sheet cannot create a pocket

| Field | Content |
|---|---|
| Issue ID | BDG-026 |
| Summary | The sheet only lists existing pockets and has no "Add pocket" action, so a user with no suitable pocket must leave the sheet, create one elsewhere, and start over. |
| Severity | P2 (CX gap, no data loss; P1 only if a user can reach the sheet with zero pockets, see hypothesis H1) |
| Reproducibility | Consistent. FAB > Savings tile > sheet "Add money": "Into" shows existing pockets only. No control creates one. |
| Platform | all |
| Affected components | `AddSavingsSheetV3.tsx:75-77` (Into block), `MoneySheetParts.tsx:25-52` (list). Create flow: `AddHoldingSheet.tsx:60-190`, `PocketFormSheet.tsx:39-97`. Opener: `wealth/page.tsx:233` (`openHolding`), `:366` |
| Backend dependencies | None to add. Store action `addSavingsAccount` (`useFinanceStore.ts:1674-1717`, type `types.ts:1303-1305`) **already returns the new id** (`return id`). Sync of the new pocket rides the existing store sync. No migration. |
| Root cause | Confirmed by reading: the sheet was built as "pick from existing". `PocketRadioList` takes `pockets` only; there is no action slot. With zero pockets the Into block renders an empty `div`, `selected` is undefined, the CTA is disabled and reads `t.choosePocket` (`AddSavingsSheetV3.tsx:51,105`). Nothing tells the user how to get a pocket. |
| Evidence | `AddSavingsSheetV3.tsx:75-77`; `MoneySheetParts.tsx:34-49`; `PocketFormSheet.tsx:96` `;(onDone ?? onClose)()` discards the id; `AddHoldingSheet.tsx:175-181` `onDone={() => { setFormDef(null); onClose() }}` also discards it. |
| Shared causes | BDG-027, BDG-028 (same sheet, same selector gap). Withdraw sheet uses the same `PocketRadioList` (`WithdrawSheetV3.tsx:225`), so the gap is shared there, though the owner only asked for Add. |
| Proposed solution | See "Create flow and state" below. Summary: render `AddHoldingSheet` (or `PocketFormSheet` directly) as a **sibling inside `AddSavingsSheetV3`**, add an optional `onPocketCreated?: (id: string, currency: Currency) => void` to `AddHoldingSheet` and `PocketFormSheet` (additive, default unchanged; `PocketFormSheet.create` already has the id, it just stops discarding it), and select the new id on return. |
| Regression risk | Low if additive. Watch: (1) `AddHoldingSheet` has an Investment tab and a gold-strip switch that make no sense when launched from Add money (add a `pocketOnly` additive prop, or open `PocketFormSheet` directly with a kind chooser); (2) the Q3 e2e test `q-quick-add.spec.ts:68-90` and `d-pockets.spec.ts:40-44` assert the sheet's accessible names ("Add money", "From account QNB Alahli"); (3) stale-closure currency (H2). |
| Test that proves it | Unit/render: `AddSavingsSheetV3` with `pockets=[]` renders an "Add pocket" action (fails today). Journey (cloud runner): extend `e2e/journeys/specs/q-quick-add.spec.ts` Q3: type amount, add pocket, return, assert amount preserved and new pocket selected, save. Owner review for the visual. |
| Confidence | High on cause and fix shape; medium on the exact UX of the chooser step (owner choice). |
| Missing evidence | Whether a user can really reach the sheet with zero pockets: a new account's "Monthly Savings" is seeded after the first pull (commit `4862a880` says so), so it is a race window, not a steady state. Not verifiable without running the app. |

### Create flow and state (answers to the brief)

- **Where the form state lives:** plain `useState` inside `AddSavingsSheetV3`: `amount`, `selectedId`, `currency`, `source`, `noteOpen`, `note` (`:35-47`), plus `picked` inside `useLegAccount` (`useLegAccount.ts:13`). No store, no form library. Nothing is persisted.
- **What happens if another sheet opens on top:** it depends on where the new sheet is mounted. Every `ModalShell` is a portal (`createPortal`, `ModalShell.tsx:262`) with the same default `z-[100]`; a later-mounted sheet stacks above an earlier one in DOM order. Back/Escape are LIFO (`registerBackGuard`, `backGuard.ts:11-24`; `useEscapeClose.ts` stack), so Android back and Escape close only the top sheet. `AddSavingsSheetV3` stays mounted (and keeps all its state) as long as its parent keeps `showAdd` true, which it does until `onClose`. **So if the create flow is rendered as a sibling inside `AddSavingsSheetV3`, the typed amount survives. If it is hoisted to the page and the Add sheet is closed first (the pattern `onNeedAsset` uses at `wealth/page.tsx:365`: `setWithdrawOpen(false); … openHolding(type)`), the state is lost.** Do not copy `onNeedAsset`.
- **Existing precedent for a sibling-nested create flow:** `AddHoldingSheet.tsx:121-189` already renders chooser + `PocketFormSheet` + `AssetFormSheet` as sibling `ModalShell`s ("each registers its own back guard: hardware back peels the form first, then the chooser").
- **400 ms ghost-click guard:** `OPEN_GRACE_MS = 400` (`ModalShell.tsx:20,168-182`) blocks backdrop/drag dismissal for 400 ms after a sheet opens; the new sheet therefore will not be dismissed by the tap that opened it. It does not touch state. No change needed.
- **Can the existing create flow return the new id?** Not today. The id exists (`addSavingsAccount` returns it) but `PocketFormSheet.create` (`:80-97`) ignores the return value and `onDone` takes no argument. Fix is additive: capture `const id = addSavingsAccount(...)`, call `onDone?.(id)` / a new optional `onCreated`. `PocketFormSheet` also knows the currency, so pass `(id, currency)`.
- **H2 (hypothesis, plausible):** `pickPocket` (`AddSavingsSheetV3.tsx:40-44`) looks up the currency in the `pockets` prop; right after creation the prop is still the old array, so the currency would not follow the new pocket. `selectedPocket()` already tolerates a pocket arriving late (`selectedPocket.ts`), so the id can be set immediately; take the currency from the create callback instead of the lookup.
- **H3 (hypothesis):** the glass NumberPad is a portal plus a global `numpadInset` (`numpadInset.ts`, `useNumberPad.tsx`). If the pad is open when the user taps "Add pocket", it may still lift the new sheet. Needs a device/browser check; closing the pad on action tap is a one-line mitigation.
- **Where else "Create Savings Pocket" can be started:** `AddHoldingSheet` from the wealth page (`openHolding`), and the pocket kinds in `src/lib/savings/pocketKinds`. Edit lives in `modals/EditSavingsAccountSheet.tsx`.

---

## BDG-027 Pockets are a long vertical list

| Field | Content |
|---|---|
| Issue ID | BDG-027 |
| Summary | `PocketRadioList` renders every pocket as a ~68px three-line card with no cap or search, so five or more pockets push the amount and CTA far down the sheet. |
| Severity | P2 |
| Reproducibility | Consistent: create five or more pockets, open Add money. The body (`SheetBody`, `overflow-y-auto`) scrolls; Into alone is about 5 x 68 px plus gaps. |
| Platform | all (worse on small phones) |
| Affected components | `MoneySheetParts.tsx:25-52`; callers `AddSavingsSheetV3.tsx:76`, `WithdrawSheetV3.tsx:225` |
| Backend dependencies | none |
| Root cause | Confirmed: it is a radiogroup of full cards by design (commit history: `PocketRadioList` was written for 2-3 pockets). No collapse threshold. |
| Evidence | `MoneySheetParts.tsx:34-49` (`pockets.map` straight into `SelectableCard`). |
| Shared causes | BDG-026, BDG-028 |
| Proposed solution | See the selector decision below. |
| Regression risk | `d-pockets.spec.ts` and Q3 find controls by accessible name; the Withdraw sheet shares the component, so a change must keep Withdraw working or move both together. |
| Test that proves it | Render test: 8 pockets, assert the closed selector shows one row (selected pocket) not eight; open it, assert all eight reachable, search filters, empty state shows the Add pocket action, long name truncates (`truncate`), currency shown. Owner review for look. |
| Confidence | High |
| Missing evidence | Real pocket-count distribution (not needed to fix). |

### Selector inventory (single-choice pickers in the app)

| # | Implementation | Where | Shape | Search | Empty / add action | Notes |
|---|---|---|---|---|---|---|
| 1 | `PocketRadioList` | `savings-v3/MoneySheetParts.tsx` | inline radiogroup of cards | no | no | Add + Withdraw "Into/From" |
| 2 | `AccountPicker` | `features/accounts/AccountPicker.tsx` | inline collapsible listbox, `BrandMark` rows | no | no | 4 callers: `MoneySheetParts.tsx:90`, `MoveMoneySheet.tsx:70`, `RepaidSheet.tsx:53`, `UnplacedSmsSheet.tsx:28`. Documented in `docs/DESIGN_SYSTEM.md:405`: "Not `SelectField` (that does not expand inline)" |
| 3 | `SelectField` | `ui/SelectField.tsx` (Base UI Combobox popover, z-[120]) | dropdown | auto at more than 8 items | no (fixed "no results" text) | ~17 files, none are account lists; options have `glyph`, `description`, no trailing value |
| 4 | `PaymentMethodPicker` + `SelectPaymentMethodSheet` | `features/payments/` | `FieldButton` opens a card-carousel sheet with a trailing "+" add tile | no | yes (add tile opens `PaymentMethodSetupSheet`) | 6 callers: expense, income x2, debt x3 forms. This is the app's real "account picker in forms" |
| 5 | `ProviderPickerSheet` | `features/payments/ProviderPickerSheet.tsx` | searchable sheet, Popular/All, custom CTA | yes | yes ("Add custom") | **Hard-wired to `PAYMENT_BRANDS`** (`:42`, `:88`); 4 callers |
| 5b | `InstallmentProviderPickerSheet` | `features/debts/redesign/` (190 lines) | a second provider sheet | | | Parallel duplicate of 5 |
| 6 | `CurrencySheet` / `CurrencyList`, `CountrySelect` | `ui/` | sheet / select | yes | no | |
| 7 | radiogroup of method cards | `AddHoldingSheet.tsx:97-118` | inline cards | no | no | A third copy of "pick an account" |

Counts: 7 distinct implementations (8 counting the duplicate provider sheet). Two of them are in the one Add Savings sheet.

### Which single component should serve both Into and From account?

Options, with what each needs:

1. **`SelectField` extended additively (recommended, subject to owner/Council).** It is the app's dropdown, already supports `glyph` (any ReactNode, so `SavingsAccountIcon` tile or `BrandMark`), `description` (identity / subtitle line), `renderTrigger`, auto-search over 8 items, portal z above sheets, and is already used inside sheets (`EditSavingsAccountSheet`). Gaps, each addable without changing today's behaviour:
   - `SelectFieldOption.trailing?: ReactNode` (the balance / "free" figure; pockets and accounts both show one)
   - `footer?: ReactNode` or `emptyAction?: { label; onSelect }` on the field (the "Add pocket" row, shown in the popup footer and as the empty-state action; must close the popup before opening a sheet)
   - `emptyText?: string` override for the empty case (today `Combobox.Empty` text is the search no-results string)
   - `description` is single-line truncated: fine for long names (`truncate`), but long user-typed names need `dir="auto"` on the label
   - Trigger class: pass `h-12` (DS rule `docs/DESIGN_SYSTEM.md:182`); the default is `py-2.5` which is shorter
   - Popup is `w-[var(--anchor-width)] min-w-[14rem]`, so it fits a full-width trigger
   - Currency display: via `trailing` (balance + currency code), or the `description` line
   All of these are optional props with unchanged defaults, which the rule allows. None reshapes `SelectField`.
2. **Make `AccountPicker` generic.** It is the DS-documented standard for the From/To leg and has 4 callers, but it is typed to `AccountView` and `BrandMark`, collapses inline (a long expanded list inside a scrolling sheet is exactly the BDG-027 problem), and has no search or empty state. Generalising it is a reshape.
3. **Reuse `ProviderPickerSheet`.** Cannot be reused as is: it reads the brand catalogue directly. Making it generic is a reshape. Reject.
4. **A new `OptionPickerSheet`** (a searchable list sheet with `V3SheetHeader`, `SelectableCard` rows, empty-state action, pinned "Add" button, i.e. what `ProviderPickerSheet` would be without the catalogue). This is the cleanest long-term shape (ProviderPickerSheet and InstallmentProviderPickerSheet could later become thin wrappers), but it is a new component: raise the DS alert and wait for the owner.

**Recommendation:** option 1 for both Into and From account, with the three additive props. This follows the owner's wording ("same dropdown as other pickers"). Flags: (a) `docs/DESIGN_SYSTEM.md:405` currently says AccountPicker is "Not SelectField"; moving the From leg to SelectField contradicts that line and needs a doc edit plus owner/Council OK. (b) `AccountPicker` stays for `MoveMoneySheet`, `RepaidSheet`, `UnplacedSmsSheet` unless the owner wants them migrated too: leaving them means two implementations remain in the app, but not inside one sheet. (c) Existing e2e asserts `getByRole('button', { name: /From account QNB Alahli/ })` (`d-pockets.spec.ts:44`); the `Combobox.Trigger` takes an `aria-label`, so keep that label format or update the spec in the same change.
Nothing above requires reshaping an existing component. Option 4 would be a new component and must be an alert, not a quiet build.

---

## BDG-028 "From account" is a collapsible list, other pickers are dropdowns

| Field | Content |
|---|---|
| Issue ID | BDG-028 |
| Summary | The From account leg uses the inline-collapsing `AccountPicker` while the owner expects the same picker as elsewhere. |
| Severity | P3 |
| Reproducibility | Consistent: Add money, This month, tap the From account row, the list unfolds in place. |
| Platform | all |
| Affected components | `MoneySheetParts.tsx:86-93`, `AccountPicker.tsx:20-59`, `useLegAccount.ts:10-21` |
| Backend dependencies | none |
| Root cause | Confirmed: it is a deliberate, documented pattern (`DESIGN_SYSTEM.md:405`), not a regression. The owner's expectation of "a dropdown like the others" does not match any account picker (see inventory: forms use sheet #4, not a dropdown). So the premise needs one question to the owner: which "other pickers" did they mean? |
| Evidence | `AccountPicker.tsx:30-39,40-56`; `d4da405c` and `4862a880` touched it last (same-provider currency subtitle). |
| Shared causes | BDG-026, 027 |
| Proposed solution | Same component as Into (option 1 above); `useLegAccount` (state + eligibility) stays untouched and feeds the items; `AccountLegRow` keeps hiding itself when `leg.views.length === 0`. |
| Regression risk | e2e accessible name (above); `BrandMark` glyph must carry through (use `glyph`); `freeText` formatting must be preserved in `trailing`. |
| Test that proves it | Render test that Into and From render the same `SelectField` and that a leg with one eligible account still hides. |
| Confidence | High |
| Missing evidence | Which pickers the owner meant. |

---

## BDG-024 Bank accounts use letter icons

| Field | Content |
|---|---|
| Issue ID | BDG-024 |
| Summary | A bank, wallet or card is shown as a coloured squircle with 1-2 letters (`BrandMark`), because the catalogue has colours and initials but no logo asset and the account row does not store which brand it is. |
| Severity | P3 (polish; legal-gated) |
| Reproducibility | Consistent: any account row on the Accounts tab, any account picker, onboarding StepAccounts, the Detected accounts sheet. |
| Platform | all |
| Affected components | see "Where a bank icon appears" |
| Backend dependencies | None for a static asset approach. A per-account stored `brandKey` would need a `payment_methods` column plus migration (see below); not required if the key is resolved at render. |
| Root cause | Confirmed. `PaymentBrand` (`paymentMethodDefaults.ts:182-194`) has `id, name, short, type, colors[2], country, full, aliases, passThrough, alsoMerchant`, **no logo or image field**. The "letter icon" is `BrandMark` (`accounts/BrandMark.tsx:15-31`): the fill is the method colour, the text is `monogram(name)` (`accountDisplay.ts:6-11`: a short ALL-CAPS first word stays whole, e.g. "CIB"; otherwise the initials, max 2). The provider picker tile is the catalogue `short` (`providerInitials`, `:331-334`: first 2-3 letters) at `ProviderPickerSheet.tsx:98-103`. |
| Evidence | `BrandMark.tsx:25`; `accountDisplay.ts:6`; `PaymentMethod` (`types.ts:59-89`) has `name, type, color, icon, last4, label` and no `brandKey` (the only `brandKey` in `types.ts:325` belongs to subscriptions). Brand identity for an account is **inferred from the name string** with `resolvePaymentBrandKey` (`paymentMethodDefaults.ts:363-396`). That function rebuilds and sorts a candidate list and builds regexes on every call, so it must never run per row per render: memoise by method id, or store the key. |
| Shared causes | BDG-025 (card face) and BDG-027/028 (selector glyphs): one `BrandMark` change reaches all of them. |
| Proposed solution | Add an optional `logo?: string` to the catalogue entry (or a separate `BANK_LOGOS` map keyed by brand id, like `ProviderBadge.OFFICIAL_LOGOS`) and let `BrandMark` render the image on the same squircle when a logo exists, falling back to the monogram: an additive prop with an unchanged default. Resolve `brandKey` once (memoised hook keyed by method id, or persist at create time). Neutral Lucide `Landmark` icon is the fallback for a bank with no logo (owner asked for "neutral bank icon otherwise"; today the fallback is letters). |
| Regression risk | Logo-on-colour contrast in light and dark (logos need a neutral `bg-white`/elevated tile, as `BrandTile` and `ProviderBadge` do, not the brand fill); RTL; the `StepAccounts` onboarding list; `AccountRow.contrast.test.ts` asserts ink contrast on the fill; image weight in a list; native offline (static files in `public/` ship in the bundle, no network). |
| Test that proves it | Unit: `BrandMark` with a known bank renders an `img` with alt text; unknown bank renders the monogram or neutral icon. Catalogue test: every logo path in the map exists on disk (the same kind of check `catalogDisplay.test.ts` does for subscriptions). Owner review for look in light and dark. |
| Confidence | High on the cause; the licensing outcome is not mine to call. |
| Missing evidence | No asset has been fetched (rule: do not download). I did not verify any bank's brand-kit terms. |

### Bank catalogue (counts from `CAT_RAW`, `paymentMethodDefaults.ts:195-324`)

Banks (`type: 'bank_account'`): **Egypt 11** (NBE, CIB, Banque Misr, QNB Alahli, AAIB, Banque du Caire, Bank of Alexandria, Faisal Islamic, ADIB Egypt, Al Baraka, HSBC Egypt), **Saudi Arabia 9** (D360, Al Rajhi, SNB, Riyad Bank, SABB, Alinma, Bank Albilad, Arab National Bank, Bank Aljazira), **UAE 11** (Emirates NBD, ADCB, FAB, DIB, Mashreq, ADIB, RAKBANK, CBD, Liv, Wio, Zand). 31 banks across the three requested countries. Outside scope but present: Kuwait 6, Qatar 4, Bahrain 4, Oman 3 (17 more), so 48 banks in all.
Other catalogue entries per country (wallets, cards, rails, BNPL): Egypt 29 brands in total, Saudi 15, UAE 26, plus 21 with no country (Apple Pay, Visa, PayPal, ...). Brands with a hand-set colour pair: only about 25 of them (CIB, NBE, Banque Misr, QNB, Al Rajhi, Emirates NBD, ADCB, FAB, and a few wallets). The rest fall back to the type colour (`PAYMENT_TYPE_META`), so most banks are indistinguishable except by their letters.
Metadata per bank: name, optional full name, 2 colours, country, aliases (English, Arabic, SMS sender IDs). No logo, no website, no brand-kit URL.

### How logos are stored today (two precedents)

- **Subscriptions:** WebP files in `public/subscription-icons/<brandKey>.webp` (about 110, 512px), rendered by `BrandTile.tsx:44-52` through `next/image`, gated by `LOGO_POLICY` (`lib/constants/logoPolicy.ts`). Unlisted brand = initials by construction. Source PNGs live in `assets/restricted-subscription-icons/` (77 files).
- **BNPL / installment providers:** 14 files in `public/providers/` (png, webp, svg), mapped by `ProviderBadge.tsx:15-30` (`OFFICIAL_LOGOS`), white tile, `alt = t.common.logoAlt(label)`. Eleven of these ids (tabby, tamara, valu, sympl, souhoola, halan, spotii, cashew, aman, contact, postpay) are also `PAYMENT_BRANDS` ids, so those payment brands could reuse the existing files.
- Both are static files bundled with the app (work offline, no remote fetch). No sprite, no remote URLs, no SVG sprite. Payment-method brand marks themselves have no logos at all.

### Where a bank icon appears (all use `BrandMark` with a name and a colour)

`AccountRow.tsx:43` (Accounts list), `AccountPicker.tsx:32,46`, `AddAccountSheet.tsx:112`, `DetectedAccountsSheet.tsx:199` (SMS-detected accounts; colour via `resolvePaymentBrandKey` at `:196`), `onboarding/StepAccounts.tsx:94`, `accounts/page.tsx:101` (Cash). Not on `BrandMark`: `ProviderPickerSheet.tsx:98` (catalogue `short` tile), `PaymentMethodSetupSheet.tsx:241` (`fieldInitials`), `PaymentMethodPicker.tsx:48-58` (a **type icon**, `paymentTypeIcon`, not a letter), `PaymentCardCarousel` big card face (provider name as text plus a type glyph), `TransactionRow` (generic `icon` slot filled by the caller; transactions show the category icon, not the account's, so there is no bank icon on a transaction row today; "same icon in transactions" would be a new feature, ask the owner what is meant). SMS-matched accounts reach `BrandMark` via `DetectedAccountsSheet` and then become ordinary rows.

### Sourcing options and licensing (owner decision)

Bank names and logos are registered trademarks. Showing the user's own bank's logo to identify their account is common in finance apps (aggregators show institution logos supplied by their data vendor), but it is **tolerated practice, not permission**. The project's own research (`docs/subscriptions-redesign/logo-legal/framework.md`, a risk assessment, not legal advice) says: the closest precedent is bank suits against Plaid (TD Bank, PNC), where the complaint was about logos plus colours in a flow that looked like the bank's own login, i.e. implied affiliation; a passive tracker tile is lower risk but big brands do sue; GCC trademark law is unified (Royal Decree M/51) and exception text for referential use was **not found**; banks are named there as "active enforcers [unverified]"; **banks were not individually assessed** (no bank appears in any of the `logo-legal/*.md|json` files). Its recommended mitigations were: unmodified logo in a neutral tile, bank NAME shown in text beside it, no implied partnership or "connected" wording, no logos in store assets, marketing or onboarding hero, takedown email, a kill switch, and a dated log of each logo's source.
Precedent in this repo: on 2026-11-19 the owner decided every subscription brand with an image ships its real logo, including those rated RED, accepting the trademark-complaint risk (`logoPolicy.ts:11-14`). A bank decision is the same kind of decision but with higher enforcement risk per the research.

Options:
- **A. Official brand-kit SVGs** from each bank's press or brand page, only where the page permits referential use. Lowest risk, per-bank manual review, 31 banks (Egypt, Saudi, UAE). Needs download and a source log (not done here).
- **B. Wikimedia Commons or similar SVGs.** Licensing is about the file, not the trademark: a "PD-textlogo" tag removes copyright only. Trademark risk is unchanged. Do not treat as permission.
- **C. Logo API / CDN at runtime.** Risk stays with the app, removable without a release, but needs network (breaks offline and the native cache-first boot) and a third-party terms review. Not recommended for this app.
- **D. Neutral bank icon plus the brand colour** (Lucide `Landmark` on the brand-colour squircle), no logos at all. Zero trademark risk, a clear improvement on letters when a logo is missing, and it is the stated fallback. The simplest first step.
- **E. User-uploaded icon.** Shifts risk to the user, adds storage and moderation. Out of scope.
- **F. Written permission** from the top banks (NBE, CIB, Misr, Al Rajhi, Emirates NBD). Best, slow.
Suggested order if the owner approves risk: D now (no legal gate), then A for the few banks with a public brand page, behind a per-brand policy map like `LOGO_POLICY` so a logo can be pulled by deleting one file and one line.

---

## BDG-025 Account mini cards do not feel like bank cards

| Field | Content |
|---|---|
| Issue ID | BDG-025 |
| Summary | The mini card is `CardFaceChip`, a 70x44 gradient chip showing the type word and last four, which reads as a chip rather than a bank card; and it only appears under bank-account rows. |
| Severity | P3 |
| Reproducibility | Consistent: Accounts tab, a bank account that has at least one card; the strip under the row. |
| Platform | all |
| Affected components | `accounts/CardFaceChip.tsx:11-28`, `accounts/CardStrip.tsx:12-37`, host `AccountRow.tsx:68`; shared helpers `PaymentCardCarousel.tsx:16-19` (`cardGradient`), `lib/ui/contrast.ts:43-69` (`cardFace`), `accountDisplay.ts:22-39` |
| Backend dependencies | none |
| Root cause | Design gap, not a bug. `CardFaceChip` was added in `a22c1b99` and simplified in `d4da405c` ("mini cards show type and last 4"). |
| Evidence | See below. |
| Shared causes | BDG-024 (the mark), BDG-027/028 (a picker could show the same face). |
| Proposed solution | See "What a modern card can reuse". |
| Regression risk | `CardStrip` is `dir="ltr"` and 44px tall (touch target); `AccountRow.contrast.test.ts` and `accounts.render.test.ts` cover rows; ink contrast must stay AA over the whole gradient (that is what `cardFace` clamps). |
| Test that proves it | Owner review for the visual; keep a unit test that no field beyond last4 reaches the chip (below). |
| Confidence | High on facts; the design is the owner's call. |
| Missing evidence | No screenshot reviewed; a visual check is the only way to judge the result. |

### Data shown (no full number, no CVV: confirmed)

`CardFaceChip` receives a `PaymentMethod` (`types.ts:59-89`). The type has `last4`, `last4Aliases`, `label`, `name`, `type`, `color`, `currency`, `parentId`, balance fields. There is **no PAN, CVV, expiry or cardholder field** on the type, and none on the generated `payment_methods` row type (`database.types.ts:3057-3081` lists `color, last4, last4_aliases, name, type, …`; a case-insensitive search for `cvv|card_number|pan|expiry|expiration` in `types.ts` and `database.types.ts` finds none). The chip shows: type word (`cardTypeLabel`: Credit / Prepaid / Debit, else the type label), a network word only when the method name matches `/visa|master|meeza|amex|mada/` (`accountDisplay.ts:18-31`), and `••` + last4, or `••••` when none. **A full number or CVV cannot be displayed because the app never holds one.** Note: the owner wants "no network brand names", but the chip currently prints VISA/MASTERCARD/MEEZA/AMEX/MADA when the name says so (`CardFaceChip.tsx:21`), so that is a deliberate removal.

### How debit, credit, wallet and cash differ today

- Debit, credit, prepaid cards that hang under a **bank account** get a chip; the only differences are the type word and the account colour (`cardTypeLabel`, `accountColor`). `CardStrip` is rendered only when `method.type === 'bank_account'` (`AccountRow.tsx:68`), shows 2 chips, "+N", or a dashed add slot.
- Wallet and cash rows show only `BrandMark` (cash gets the cash icon, `AccountRow.tsx:44-45`): no chip, no strip. Cards can hang under wallets (`canBeParent`, `kinds.ts:9-12`), but the strip does not render for them (hypothesis worth a check: possibly intentional).
- Standalone credit cards are not rows on the Accounts tab (`isOpenAccount` = cash, bank, wallet, prepaid); they appear in `PaymentCardCarousel`.

### Tokens and colours today

Colour: the method's own colour (`m.color ?? PAYMENT_TYPE_META[type].color`), same in light and dark; gradient `linear-gradient(140deg, …)` from `cardGradient`; ink via `cardFace` (AA-clamped). Radius `rounded-[9px]`, shadow `var(--shadow-sm)`. No hex in the file. The large carousel face adds a radial sheen (`radial-gradient(120% 90% at 85% 8%, rgba(255,255,255,.16), transparent 60%)`), an inset top highlight and a coloured drop shadow (`PaymentCardCarousel.tsx:157-168`), which the chip lacks, so "subtle depth" can be borrowed from there.

### What a "modern card" variant can reuse, and variant count

Reusable: `cardGradient`, `cardFace` (ink and AA), `accountColor`, `cardTypeLabel`, `splitMoney`, the carousel's sheen and inset highlight, `BrandMark`/the new logo for the corner mark, `CardStrip` (layout, 44px height, `dir="ltr"`, "+N"), tokens `--shadow-sm`, `--color-brand-*`. "Stacked" = overlap the chips with negative margin inside `CardStrip`; no new primitive.
Variant count: `CardFaceChip` has exactly one look today, so a modern look would be its 2nd. But card faces exist in **three places that each draw their own markup** (the carousel face, the setup preview `PaymentMethodSetupSheet.tsx:456-490`, `CardFaceChip`), sharing only the two helper functions. A modern look would make a 4th card-face rendering in the app. By the project rule ("3rd or 4th variant: propose promoting it to its own component") the right move is to **propose a shared `CardFace` component** (sizes `sm`/`lg`, type, last4, mark, sheen), with the three call sites moving over, rather than adding a prop to `CardFaceChip`. That proposal needs the owner's yes; nothing should be built before it. Do not edit the carousel face to match.

---

## Queries for the lead

None needed for these five. Optional, only if the owner wants numbers (counts and ids only, no personal data):

```sql
-- how many users have 5 or more savings pockets (sizes BDG-027); counts only
select count(*) from (
  select user_id from savings_accounts
  where category = 'savings'
  group by user_id having count(*) >= 5
) t;

-- brand coverage if a stored brand key is ever considered (counts only)
select type, count(*) from payment_methods group by type order by 2 desc limit 10;
```
(Run the first only if `savings_accounts` has `user_id` and `category` columns; I did not check the live schema. Both are small scans of tables that are not large today; run off peak, one at a time.)

## Decisions that need the owner

1. **Bank logos (BDG-024): legal risk.** Choose D only (neutral bank icon), D plus per-bank logos, or none. If logos: which sourcing option (A, B or F), accepting that trademark risk is not removed by any copyright-free file, and whether banks get the same "ship it" decision as subscriptions on 2026-11-19. The project's own research did not assess banks, and it names banks as likely enforcers. I did not download anything.
2. **Meaning of "same icon in transactions" (BDG-024).** Transaction rows show the category icon today, not the account; do you want the account mark on transaction rows?
3. **Which "other pickers" are dropdowns (BDG-028).** The expense/income/debt account pickers are a card-carousel sheet, not a dropdown; `SelectField` is the dropdown. Confirm the target is `SelectField` (recommended) rather than the carousel sheet.
4. **Add pocket entry (BDG-026):** full chooser (existing kind list plus "from an account you have") or straight to the kind form? Pocket-only or also investments?
5. **"No network brand names" (BDG-025):** confirm removing VISA/MEEZA/MADA text from the chip.

## Decisions that need Council

1. **Design-system alert (rule: reuse, never reshape).** Moving the From account leg to `SelectField` needs three additive props (`option.trailing`, `footer`/`emptyAction`, `emptyText`) and contradicts `DESIGN_SYSTEM.md:405` ("AccountPicker: not SelectField"). Alternative is a new `OptionPickerSheet`. Council picks: extend `SelectField` (recommended), or new component, or keep `AccountPicker` and only fix Into.
2. **Seven selector implementations.** Decide whether to consolidate beyond this sheet (`AccountPicker` callers, `AddHoldingSheet` method cards, `InstallmentProviderPickerSheet` duplicate) or leave them and only unify this sheet.
3. **New `CardFace` component (BDG-025).** Promote the three hand-drawn card faces to one component (project rule at the 3rd/4th variant), or add a variant to `CardFaceChip`.
4. **Persist `brandKey` on `payment_methods` (BDG-024)?** Needed only for logos; resolving at render from the name works but must be memoised. A column would need a migration and sync mapper changes (`types.ts` plus mapper rule in `CLAUDE.md`).
