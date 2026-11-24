# QA night A: cards and accounts (Bugs 1, 2, 5, 6, 7, 10)

Investigation only. No source changed. Branch at time of reading: `claude/qa-bugs-wealth-logic-905035` (HEAD 830fce82).

## Data model (shared by every bug here)

- Accounts and cards live in the same table, `payment_methods`. The type enum covers `cash | bank_account | debit_card | credit_card | prepaid_card | wallet | bnpl | other` (`src/lib/store/types.ts:49-57`).
- A card hangs under an account through `payment_methods.parent_id uuid REFERENCES payment_methods(id) ON DELETE SET NULL`. It also has a not-self check and a partial index (`supabase/migrations/0150_accounts_core.sql:5,12,15`). An owner link guard runs as a trigger (`0326_link_guard_remaining.sql:30`). The store field is `PaymentMethod.parentId` (`types.ts:60-61`: "Absent = standalone"). The mapper writes it in both directions (`src/lib/supabase/remote/mappers/paymentMethodMapper.ts:20,44`).
- Types that can be a parent: `bank_account` and `wallet` (`src/lib/accounts/kinds.ts:9,12`, `canBeParent`). Only `debit_card` draws on its parent (`drawsOnParent`, `kinds.ts:14`).
- **There is no provider or bank column.** The provider is the text of `name` (`composePaymentMethodName` / `decomposePaymentMethodName` in `src/lib/payment/paymentMethodDefaults`). So "provider" and "linked account" are two independent facts: provider is text in `name`, the link is `parent_id`. Only one UI path sets the link (see Bug 1), and it does so implicitly.
- What `parent_id` drives:
  - **Balances.** `resolveAccountId` (`src/lib/accounts/resolve.ts:33-46`) sends a debit card's spending to its parent's balance. `computeBalances` uses it (`src/lib/accounts/balance.ts:91-92`). This is derived live, so re-linking a debit card moves its whole history to another account's balance.
  - **Account list.** `useAccounts` groups cards with `cards = methods.filter(c => c.parentId === m.id)` (`src/lib/accounts/useAccounts.ts:62`). Any row with a `parentId` is never an account row (`:59`).
  - **SMS balance reports.** A report on a debit card lands on its parent (`src/lib/sms/balanceReport.ts:83`), and track_sms is inherited (`src/lib/sms/createSmsExpense.ts:461-463`).
  - **Exclusion inheritance** (`0178_expense_inherit_exclusion.sql:9`).
  - **The free-tier SMS account cap**, which counts only rows with `parent_id IS NULL` (`0292_s6_trial_and_sms_cap.sql:126,133`). Every unlinked card currently uses up a cap slot.
- **Migration needed: no.** The column, FK, index and guard already exist. This rests on `database.types.ts:3167,3228-3231` and the migration files. I did not run `list_tables` against live this session; confirm before implementing, as the DB-first rule requires.

## Shared root causes

1. **R1: the card setup sheet has no "linked account" field.** `PaymentMethodSetupSheet` sets `parentId` only from the `parentAccountId` prop or from an SMS `prefill.parentId` (debit cards only) (`src/components/features/payments/PaymentMethodSetupSheet.tsx:218`). The edit branch never writes `parentId` (`:214`). This one gap causes Bugs 1, 2 and 5.
2. **R2: the account detail carousel is rendered in select mode.** `AccountDetailSheet` mounts `PaymentCardCarousel` without `onMenu` (`src/components/features/accounts/AccountDetailSheet.tsx:101`). `onMenu` controls the kebab button and also the face layout (`PaymentCardCarousel.tsx:159,164,167`). This one gap causes Bugs 6 and 7.
3. **R3: the store silently de-duplicates on add without considering the link.** `addPaymentMethod` returns an existing "twin" with the same name, type, currency and last4, and drops the new `parentId` (`src/lib/store/useFinanceStore.ts:621-625`). This makes Bugs 1 and 2 worse.

---

## Bug 1: Unable to assign a newly added card to an existing bank account

**Confirmed in code.** Profile menu → Cards opens `PaymentMethodsSheet` (`src/components/layout/ProfileDropdown.tsx:200`). "Add method" there opens `PaymentMethodSetupSheet` with no `parentAccountId` (`src/components/modals/PaymentMethodsSheet.tsx:66,139-146`). The sheet's fields are provider, type, identifier, currency, credit terms, style, theme and default (`PaymentMethodSetupSheet.tsx:286-424`). None of them picks an account. On save, `parentId = parentAccountId ?? (type === 'debit_card' ? prefill?.parentId : undefined)` (`:218`), so a card added there is always standalone. Editing cannot fix it later either, because the edit payload has no `parentId` (`:214`).

**Root cause.** R1, and R3 on top of it.

**Files.** `PaymentMethodSetupSheet.tsx`, `PaymentMethodsSheet.tsx`, `useFinanceStore.ts` (`addPaymentMethod`, `updatePaymentMethod`), `useAccounts.ts`, `kinds.ts`, table `payment_methods.parent_id`.

**Minimal fix (reuse).**
- Add a "Linked account" field to `PaymentMethodSetupSheet`. Show it only when `type` is a card type (`CARD_TYPES`, `:43`) and never when editing an account (`typeLock` set from a bank or wallet).
- Options: open accounts where `canBeParent(type)` holds (from `useAccounts().accounts`), plus **"None (standalone)"** for wallets, service cards and BNPL-type cards.
- Reuse **`AccountPicker`** (`src/components/features/accounts/AccountPicker.tsx`). It already shows the provider plus currency subtitle, which tells HSBC EGP from HSBC USD (`:28`, `sharesProvider`). It needs two **additive** props with the default unchanged: a nullable value with a `noneLabel` row, and a hidden balance column. Alternatives are `FieldButton` plus a list sheet, or `OptionChip` rows. Do not reshape `AccountPicker`.
- State: `linkedId`. Seed it from `parentAccountId` (account entry), from `prefill.parentId` (SMS), or from `editing.parentId` (edit). Otherwise use `undefined`, or one matching account: same provider and currency, exactly one candidate.
- Save: `parentId: linkedId` on both add and edit. On edit, pass `parentId: linkedId ?? undefined` explicitly. The mapper turns `undefined` into `null` (`paymentMethodMapper.ts:20`).
- When an account is picked and the card is new, adopt the account's currency, as the parent prefill does today (`:132`).
- Fix R3 in `addPaymentMethod`: when a twin is found and the new method carries a `parentId` the twin lacks, set it on the twin before returning. Otherwise "Add card" under an account can return an unlinked existing card.

**Regression risks.**
- Relinking a debit card moves all of its past spending between account balances (`resolve.ts:41-44`). Changing the link in edit mode needs a confirm that names this, or a rule that it applies only going forward. Future-only would need a freeze, as `CLAUDE_CONTEXT.md` §Pocket exits notes for pocket holders.
- A linked card stops counting toward the SMS cap. Unlinking one can push the user over the cap; the trigger then sets `track_sms=false` on update (`0292:124-134`). In practice `old.track_sms` is true, so the trigger returns early (`:125`). Still, check that unlinking never switches tracking off.
- Credit card terms and debt auto-creation (`useFinanceStore.ts:635-659`) must still work.
- SMS prefill path (`:151-152,218`).
- Buddgy undo restores `parentId` (`src/lib/buddgy/tools/exec/payments.ts:285`). That is unaffected, but check it.

**Test label: deep technical.** The change touches balance attribution, the SMS cap and sync of `parent_id`. Required tests:
- Store unit tests: add with link; twin adopts link; edit relinks or unlinks; `resolveAccountId` follows the link.
- A balance test: a relinked debit card moves its spend.
- One Playwright journey: Profile → Cards → Add → pick HSBC USD → the card appears under HSBC USD only.

**Open questions.**
- (a) Should credit cards be linkable? Today the parent path allows it, but credit spend never touches the parent balance, so the link is grouping only.
- (b) Should prepaid cards be linkable? A prepaid card holds its own balance, is listed as an account (`accounts/page.tsx:81`), and would vanish from the account list if it got a parent (`useAccounts.ts:59`). Recommendation: hide the field for prepaid.
- (c) When the account and card currencies differ (an EGP account and a USD card), allow it or block it?

---

## Bug 2: Cards added through payment methods are not shown under accounts

**Confirmed in code.**
- Account detail and the account row show only `account.cards`, which is `parentId === account.id` (`useAccounts.ts:62`; `AccountRow.tsx:69` → `CardStrip`; `AccountDetailSheet.tsx:100-104`). A card added from Profile → Cards has no `parentId` (Bug 1), so it never appears there.
- Standalone cards are computed as `standaloneCards` (`useAccounts.ts:79-83`), but **nothing renders them**. No consumer exists in `src/`, and the i18n key `accountsPage.standaloneCards` ("Other cards", `en.ts:348`) is unused. On the Accounts page they are invisible.
- R3 also applies. A user who adds the same card again from the account gets the existing unlinked twin back, and it still does not appear (`useFinanceStore.ts:624-625`).

**Root cause.** R1 and R3. A secondary cause is that the Accounts page never renders `standaloneCards`.

**Minimal fix.**
- Bug 1's fix covers new cards and lets existing ones be relinked in Edit.
- No duplicates: the Profile → Cards deck already lists every non-account card once, linked or not (`PaymentMethodsSheet.tsx:63`). Under an account a card appears only where `parentId` matches, so a card can never sit under two accounts. Nothing more is needed there.
- "Independent methods stay independent": a card with `parentId` absent stays out of every account. If the owner wants such cards visible on the Accounts page, render `model.standaloneCards` in an "Other cards" section. Use `SectionHeader`, `Card` and `CardStrip`, or `PaymentCardCarousel` with `onMenu`. This is optional, so ask (below).
- Existing data: no backfill migration. A heuristic auto-link is possible (same provider, currency and a single account) but is not recommended without owner approval, because it would move balances. The user relinks through Edit.

**Regression risks.** The same as Bug 1. Adding an "Other cards" section is UI-only.

**Test label: deep technical** (it is the same link change as Bug 1; reuse those tests). The "Other cards" section on its own is UI-only.

**Open question.** Should standalone cards get their own "Other cards" section on the Accounts page? The copy already exists, unused.

---

## Bug 5: A new card is attached to the wrong bank account

**Confirmed in code.** These are two layers of the same conflation.

1. **Save.** On the HSBC account, "Add card" opens `PaymentMethodSetupSheet` with `parentAccountId = HSBC` (`accounts/page.tsx:168`). Provider and brand are seeded from the parent (`PaymentMethodSetupSheet.tsx:126-134`). If the user switches the provider to NBE, `pickBrand` changes only `brandId`, `providerName`, type and currency (`:161-174`); `setCustomProvider` does the same (`:188-190`). The link never changes. On save, `parentId = parentAccountId` applies unconditionally (`:218`). Result: a card named "NBE …" with `parentId = HSBC`. It lists under HSBC, and its debit spending reduces HSBC's balance.
2. **Display.** `cardBankName(m, parent)` prints the **parent's** provider when a parent exists (`src/lib/payment/cardThemes.ts:103-106`). It is called by the carousel (`PaymentCardCarousel.tsx:144,156`) and the mini card (`CardFaceChip.tsx:16`). So the card face also says "HSBC", and the user's NBE choice is invisible on every surface except the edit form.

**Root cause.** Provider (text in `name`) and linked account (`parent_id`) are separate facts, but the UI shows only the provider. The sheet silently keeps the entry point's account as the link (R1).

**Minimal fix.**
- The visible "Linked account" field from Bug 1 is pre-selected to HSBC when the sheet opens from HSBC.
- In `pickBrand` and `setCustomProvider`: if a linked account is selected and the new provider does not match its provider, re-resolve the link:
  - Exactly one open account of the new provider (and the current currency): select it.
  - Otherwise: set it to None, and the user picks.
  The field stays visible, so the change is never silent.
- Keep `cardBankName` as it is (its tests and `CardFaceChip` rely on the parent naming the bank). Once the link is right, parent and provider agree. Alternative if the owner prefers: prefer the card's own provider when it differs from the parent's. That is a shared behaviour change and needs a test in `cardThemes.test.ts`.

**Regression risks.**
- SMS prefill with `parentId` must not be cleared by the brand auto-resolve on open. Run re-resolution only on a user `pickBrand`, never in the open effect.
- Edit mode of an existing linked card: changing the provider must not quietly unlink it without the field showing it.

**Test label: deep technical** (balance attribution). Required tests:
- Component or unit test: open with `parentAccountId=HSBC`, pick NBE → saved `parentId` is NBE's account or none, never HSBC.
- Open with `parentAccountId`, keep HSBC → `parentId` = HSBC.

**Open question.** Product intent when the provider changes inside an account's Add card flow: (a) re-resolve the link as above (recommended); (b) lock the provider to the account's bank in that entry point; (c) keep the link and warn.

---

## Bug 6: No card actions in bank account details

**Confirmed in code.** `AccountDetailSheet.tsx:101` renders `<PaymentCardCarousel methods={cards} … onAddCard … />` with **no `onMenu`**, so no kebab is drawn (`PaymentCardCarousel.tsx:167-179`). The only kebab on that sheet is the header one, which manages the account (Edit account, Set default, Close account; `AccountDetailSheet.tsx:69-80,89-95,168`). Profile → Cards passes `onMenu` and builds Edit, Set default and Delete with `CardActionMenu` (`PaymentMethodsSheet.tsx:96,107-135`). The page's `Sheet` union can edit only the open account (`accounts/page.tsx:42,169`). It has no card-edit state.

**Root cause.** R2, plus missing wiring for card edit and delete on the Accounts page.

**Minimal fix (reuse).**
- In `AccountDetailSheet`, pass `onMenu={(id, anchor) => …}` and render a second **`CardActionMenu`** for the card. Use the same item set as `PaymentMethodsSheet.tsx:112-132`: Edit (`Pencil`), Set default (`Star`), Delete (`Trash2`, destructive, guarded by `useConfirm`, calls `deletePaymentMethod`). Add an `onEditCard(cardId)` prop.
- In `accounts/page.tsx`, add a `Sheet` kind `{ kind: 'editCard'; id; cardId }` and mount `PaymentMethodSetupSheet editing={card} nested`. It already supports `onDelete` and `deleteLabel` (`PaymentMethodSetupSheet.tsx:66-68,429-434`).
- Optional: extract the item builder from `PaymentMethodsSheet` into a small shared hook (`useCardMenuItems`) so the two surfaces cannot drift. It would be the second consumer, not a new component.
- After a delete, clamp `active` (the carousel already clamps with `safeActive`).

**Regression risks.**
- Stacking: menu `z-[110]` inside a `ModalShell` and a nested setup sheet at `z-[120+]`.
- Back and swipe-back closing order.
- The FAB ghost-click grace (`ModalShell`).
- Tapping the kebab must not also trigger the card's tap or focus. The carousel already stops propagation on `pointerdown` (`PaymentCardCarousel.tsx:170`).

**Test label: complex UI interaction** (a menu over a sheet with a nested edit sheet and delete). A targeted test is warranted:
- Render or Playwright: account detail → card kebab → Edit opens the prefilled sheet; Delete confirms and the card leaves the strip.
- Mockup approval first, because the face gains a control.

---

## Bug 7: Card layout differs between Payment methods and bank accounts

**Confirmed in code.** Both surfaces use the same `CardFace` through `PaymentCardCarousel`. The differences come entirely from `onMenu` (R2):
- With `onMenu` (Profile → Cards):
  - `reserveTopRight` hides the top-right currency (`CardFace.tsx:102-106`; `PaymentCardCarousel.tsx:164`).
  - The currency moves to the bottom-left holder slot, but **only when the card has no label**: `holder={label || (onMenu || isSelected ? m.currency : undefined)}` (`PaymentCardCarousel.tsx:159`). A labelled card on that surface shows **no currency at all**.
- Without `onMenu` (account detail): currency top-right, label bottom-left, no kebab.
- `PaymentMethodPicker` and `SelectPaymentMethodSheet` (select mode) give a third layout: currency in the holder only when selected.

**Root cause.** R2. Layout is a side-effect of whether the carousel is in manage mode, and the holder fallback drops the currency when a label exists.

**Minimal fix.**
- Bug 6's fix (pass `onMenu` in account detail) makes the two manage surfaces identical with no layout change.
- Also make the currency always visible in manage mode. In `PaymentCardCarousel.tsx:159`, compose `holder` as `[label, (onMenu || isSelected) ? m.currency : null].filter(Boolean).join(' · ')`. This is carousel-only and leaves `CardFace` defaults untouched.
- If the owner wants the currency in a fixed spot regardless of the menu (for example bottom-right beside the network box), that needs an **additive** `CardFace` prop such as `currencyPlacement`, with today's layout kept as the default. Raise it with the owner; per the design-system rule, do not reshape `CardFace`.

**Regression risks.** `PaymentCardCarousel` is shared by `PaymentMethodsSheet`, `AccountDetailSheet`, `SelectPaymentMethodSheet` and `InstallmentProviderPickerSheet`. The holder change affects manage mode and selected cards only. Long labels truncate (`CardFace.tsx:132` has `truncate`). In RTL the face is forced to `dir="ltr"`, which is fine.

**Test label: UI-only.** Before/after mockup → owner approval → implement → cloud screenshot. No new automated test (cosmetic, checkable by eye).

---

## Bug 10: Horizontal three-dot icon makes card management unclear

**Not reproducible in the current source as an icon.**
- Every card kebab is already vertical:
  - `PaymentCardCarousel.tsx:177`: `<MoreVertical />`, the Profile → Cards deck.
  - `AccountDetailSheet.tsx:92`: header.
  - `heroCardShared.tsx:74`: debts.
- `git log -S MoreHorizontal` on the carousel and the wallet sheet finds no horizontal icon in their history. Lucide `^0.577` `MoreVertical` is the vertical ellipsis.
- The only horizontal kebab in the app is `GoalDetailSheet.tsx:166` (`MoreHorizontal`), which is not a card surface.
- **What is horizontal on the card surface is the hint copy.** `paymentMethods.walletHint` reads "Swipe your cards · tap ⋯ to manage" (`src/lib/i18n/dictionaries/en.ts:2601`). Arabic is "… اضغط ⋯ للإدارة" (`ar.ts:2611`). It shows U+22EF (horizontal) under a vertical ⋮ button (`PaymentMethodsSheet.tsx:95`, rendered by `PaymentCardCarousel.tsx:216`).

**Likely root cause.** The hint glyph does not match the icon. The other possibility is that QA ran an older native build or looked at the Goal detail menu.

**Minimal fix.**
- Change both hints to "⋮" (U+22EE), copy only.
- Optionally switch `GoalDetailSheet.tsx:166` to `MoreVertical` so the app has a single kebab convention. The `CardActionMenu` doc comment (`CardActionMenu.tsx:8`) already names ⋮ as the app-wide rule.
- Tap behaviour is unchanged.

**Test label: UI-only** (copy and icon). Mockup and owner approval, no automated test.

**Open question.** Which screen and build did QA see the horizontal icon on? If it is the card itself on a current build, send a screenshot. The source shows `MoreVertical` there.

---

## Order of work

1. **Bugs 1, 5, 2 together.** One deep-technical change:
   - linked-account field;
   - provider-change re-resolution;
   - edit relink;
   - twin adopts link;
   - tests first.
2. **Bugs 6 and 7.** Card menu in account detail plus the holder currency line. Mockup first.
3. **Bug 10.** Hint glyph, after QA confirms the screen.
