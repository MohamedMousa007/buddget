# QA night, group A: accounts and misc (bugs 3, 4, 9, 15)

Investigation only. Nothing under `src/` or `supabase/` was changed. Evidence tags: **[code]** read in source, **[live]** read-only count on `tzioppxwsljhlglyducm` (counts only, no personal data), **[reasoned]** derived and not observed on a device.

---

## Bug 3: some payment providers have no logo

### Confirmed behaviour
There are two separate logo mechanisms, and they do not share assets:

1. **`BrandMark` via `bankLogoSrc` / `bankLogoForName`** (`src/lib/payment/bankLogos.ts:8-62`, `src/components/features/accounts/BrandMark.tsx:22-36`). It reads only `BANK_LOGO_FILES`, which maps catalogue ids to `public/logos/banks/*`. It is used by the provider picker (`ProviderPickerSheet.tsx:141`), account rows (`AccountRow.tsx:44`), `AccountPicker`, `AddAccountSheet:113`, `DetectedAccountsSheet:200`, onboarding `StepAccounts:95`, and the Buddgy `AccountPick` and `MoveBody` cards.
2. **`ProviderBadge`** (`src/components/features/debts/redesign/ProviderBadge.tsx:16-31`). It has its own `OFFICIAL_LOGOS` map to `public/providers/*`, keyed by installment slug, and is used only on debt and installment surfaces.

When a brand has no entry, both mechanisms fall back to a monogram on purpose, which is the "missing logo" the tester saw. Neither `<img>` has an `onError` fallback, but every mapped file exists and is a valid PNG, SVG or WebP **[code]**. `bankLogos.test.ts` keeps the bank map and the folder in step, so there are no broken paths, wrong keys or alias misses for banks.

### Root cause
The catalogue (`PAYMENT_BRANDS`, `paymentMethodDefaults.ts:203-416`) has 114 brands, and `BANK_LOGO_FILES` covers 54 of them: every `bank_account` brand. The other **60 brands have no logo on the BrandMark path**. `docs/quality/buddget-remediation/bank-logos.md:94` records that the logo pass covered banks only.

**A. 11 brands have an asset in `public/providers/` that `bankLogoSrc` never reads** (they show a logo on debt screens and a monogram everywhere else):
valu, souhoola, sympl, aman, contact, halan (MNT-Halan), tabby, tamara, postpay, cashew, spotii.

**B. 49 brands have no asset at all:**
- Egypt wallets and schemes: instapay, vodafone (Vodafone Cash), orangecash, wepay, etisalatcash (e& Cash), khazna, lucky, opay, fawry, telda, meeza, meezadebit
- Saudi Arabia: mada, stcpay, urpay, barq
- UAE: careempay, eand (e& money), payit, botim, ziina, nol, hafilat, sayer, jaywan, adnoc, enoc, emarat
- Gulf schemes and wallets: knet, naps, ooredoomoney, benefit, omannet, thawani
- Global: applepay, googlepay, samsungpay, visa, mastercard, amex (American Express), unionpay, paypal, payoneer, wise, skrill, binancepay, edenred, pluxee, zaincash

Debt side: `mispay`, `shahry` and `forsa` have files in `public/providers/` but are not catalogue brands. `bank_epp` and `other` have no file by design.

### Recommended minimal fix
1. **No new assets needed:** make `bankLogoSrc` fall back to the `/providers/` file for the 11 ids in list A. The cleanest way is to move `OFFICIAL_LOGOS` into `src/lib/payment/bankLogos.ts` (or a sibling `providerLogos.ts`) as the one map that both `BrandMark` and `ProviderBadge` read. That is additive: `ProviderBadge` keeps its look. Extend `bankLogos.test.ts` so every mapped file exists.
2. **Needs assets and owner sign-off:** source logos for list B, with the licence and nominative-use rules in `bank-logos.md`. Priority by market: vodafone, instapay, fawry, telda, meeza, orangecash, valu-like EG wallets, then stcpay, mada, urpay, barq, then the global schemes (visa, mastercard, applepay, googlepay).
3. Optional: an `onError` that swaps the image back to the monogram, so a future bad path degrades cleanly.

### Regression risk
- Low. BNPL tiles in `ProviderPickerSheet` and debt cards change from monogram to logo.
- `BrandMark` draws a white tile, and some `/providers/` WebP files may be light-on-dark. Check each one, and add a `BANK_LOGO_BG` entry where needed, as was done for Weyay.

### Test label
**UI-only** (static asset mapping). The existing `bankLogos.test.ts` folder-and-map assertion should be extended to cover provider files, since that is a cheap unit test of the map.

### Open questions
- Does the owner want logos for card schemes and Apple/Google Pay at all? Trademark rules for schemes are stricter.
- One map or two?

---

## Bug 4: the account details sheet scrolls horizontally

### Confirmed behaviour [code + reasoned; not observed on a device]
- The sheet is `AccountDetailSheet`, opened from `src/app/(app)/accounts/page.tsx:158`. It passes `scrollChild` to `ModalShell` (`AccountDetailSheet.tsx:84`), so ModalShell's own body loses `overflow-y-auto overscroll-y-contain touch-pan-y` (`ModalShell.tsx:355`).
- The sheet's own scroller is `AccountDetailSheet.tsx:97`: `min-h-0 flex-1 space-y-5 overflow-y-auto pb-3 pt-2`. It has no `overflow-x` and no `touch-action`. Under the CSS spec, `overflow-y: auto` with `overflow-x: visible` computes `overflow-x` to `auto`, so this div scrolls horizontally whenever a descendant overflows.
- **The overflowing element is the card carousel** (`PaymentCardCarousel.tsx:130-140`). Its root is `relative h-[224px] touch-pan-y` and is not clipped. Each slot is `absolute start-1/2` with `transform: translateX(off*132px) scale(...)` (`:94-104`), and slots up to |off| 2.2 are still laid out, even at opacity 0.
  - On a 390px sheet, the slot at +1 (the next card, or the "Add a card" tile) ends about 40px past the right edge, and the slot at +2 about 170px past it.
  - Transformed absolute boxes count toward the scroll container's scrollable overflow, so the scroller at line 97 gets a horizontal scroll range.
- **Why only this sheet:** the carousel root itself is `touch-pan-y`, so swipes on the cards drive the carousel's own pointer handler. Swipes on the Cash out / Set aside / Update buttons or the Recent list hit an ancestor with default `touch-action: auto`, and pan the whole scroller sideways.
  - The other hosts (`PaymentMethodsSheet`, `SelectPaymentMethodSheet`, `InstallmentProviderPickerSheet`) do not use `scrollChild`, so ModalShell's `touch-pan-y` body stops the pan.
- Ruled out: `TransactionRow` is `w-full`, and `min-w-0` truncation keeps it from overflowing. No global `overflow-x` rule applies.
- How to tell it apart on device: the pan should appear only on accounts that can hold cards (`canBeParent`: bank account or wallet) and have the carousel, never on the Cash sheet.

### Root cause
The unclipped carousel slots overflow the horizontal edge, and the `scrollChild` scroller has neither `overflow-x-hidden` nor `touch-pan-y`.

### Recommended minimal fix
Change one line at `AccountDetailSheet.tsx:97`: add `overflow-x-hidden overscroll-y-contain touch-pan-y`, which mirrors ModalShell's default body.
- Do **not** add `overflow-hidden` to the shared `PaymentCardCarousel`. It would clip the peeking neighbour cards in the 4 other hosts.
- The carousel keeps its own pointer drag, because it already has `touch-pan-y`.

### Regression risk
- Low.
- Check that nothing in the sheet relies on horizontal overflow; nothing does.
- Check that iOS edge swipe-back still works (`src/lib/navigation/edgeSwipe.ts` notes `pan-y` areas).
- Check that vertical scroll and drag-to-close still behave.

### Test label
**Complex UI interaction** (gesture, scroll container, nested in a sheet). A targeted Playwright check is worth it: open an account with at least one card at a 390px viewport, assert `scrollWidth <= clientWidth` on the sheet scroller, and try a horizontal drag on the Recent list. Otherwise the owner checks by hand on a device.

### Open questions
None.

---

## Bug 9: an unrecognised bank account cannot be removed without confirming its balance

### Confirmed behaviour [code]
1. The server creates a **provisional** account from an SMS that names bank, digits and currency (`src/lib/sms/accountPlacement.ts:75-117`, called from `createSmsExpense.ts:510-524`). `DetectedAccountsSheet` lists it with Keep / Link existing / Not mine.
2. "Not mine" calls `rejectProvisional` (`DetectedAccountsSheet.tsx:136-141`), which sets `{ provisional: false, excluded: true }` (`src/lib/accounts/provisional.ts:107-111`). It does **not** close the account.
3. With `provisional` false and `closedAt` unset, `isOpenAccount`, and with it `isSetUpAccount`, are now true (`src/lib/accounts/kinds.ts:39-42`). The account **joins the Accounts list** as an ordinary row with the subtitle "This account is not counted" and a "Set balance" action (`AccountRow.tsx:32-35,65`).
4. Tapping a row with no balance opens `UpdateBalanceSheet`, not the detail sheet (`accounts/page.tsx:92`). "Close account" exists only in the detail sheet's menu (`AccountDetailSheet.tsx:72-79`). The only way to remove the row is to set a balance first.
5. Settings > Not counted (`NotCountedSheet.tsx:33`) only toggles `excluded`. Turning it off makes the row a normal untracked account.

`DetectedAccountsSheet` is the only "Not mine" surface (grep of `prompts.notMine`). Non-provisional detections use `settlePrompt(key)` and disappear correctly. Only the provisional branch is broken.

### What each option does to the next SMS [code]
- **Excluded but open (today):** `findUniqueByLast4` (`createSmsExpense.ts:418-445`) matches it by tail, so no duplicate is created and the messages land on it, excluded. That part is correct; only the visibility is wrong.
- **Excluded and closed:** `findUniqueByLast4` drops only rows that are both provisional and closed (`:437`), so a closed non-provisional row still matches. Messages keep landing on it, excluded, and nothing is re-created. **This is the right state.**
- **Deleted:** hard delete, or soft delete via `deleted_at`, removes it from the lookup (`.is('deleted_at', null)`). The next SMS creates a fresh provisional account and the prompt returns. **Wrong**, because there is no other blocklist for provisional accounts.

Live: 6 excluded non-provisional non-cash rows exist, all already closed (4 tracked, 2 untracked). 0 rows are currently stuck open, untracked and excluded. 4 provisional accounts are open, waiting for an answer **[live]**.

### Root cause
"Not mine" leaves the rejected account **open**, so it becomes a list row. The list routes balance-less rows to the balance sheet, which has no remove action.

### Recommended minimal fix
- In `rejectProvisional`, also close the account. Either set `closedAt: now, isDefault: false` in the same `updatePaymentMethod` patch, or call `removePaymentMethod(state, id, 'close')` (`src/lib/accounts/removePaymentMethod.ts:31-50`), which also detaches cards and hands the default over.
- Undo restores `{ provisional: true, excluded: false, closedAt: undefined }`.
- The copy `provisionalNotMineNote` already says its messages stop counting, so no copy change is needed.
- Separate, broader gap to raise (not required for this bug): any untracked account can only be closed after a balance is set. The ⋯ Close action could also appear on `UpdateBalanceSheet`, or tapping a balance-less row could open the detail sheet. This is an owner decision, so it is not in the minimal fix.

### Regression risk
- Closed rows still match by tail, so the SMS goes there and stays excluded. Check:
  - closed accounts are left out of `pickablePaymentMethods`, net worth, gaps and the inbox count (`provisionalAsDetected` already filters `!m.closedAt`);
  - the closed row's cards are detached;
  - sync of `closed_at`.
- Undo must clear `closedAt`, or the account stays hidden.

### Test label
**Deep technical** (account state, SMS attribution, sync, and an undo that crosses persistence). Tests are mandatory:
- a unit test on `rejectProvisional` and its undo;
- an integration or API test that a second SMS with the same bank and digits lands on the closed excluded row and creates no new provisional;
- a Playwright journey: provisional → Not mine → absent from the Accounts list, and absent after reload.
Search `e2e/sms/**` and `e2e/journeys/**` first for an existing provisional-account case.

### Open questions
- Should "Not mine" on an account that already carries history also offer "delete its transactions"? Today they stay, excluded.
- Does the owner want the broader "close without a balance" path?

---

## Bug 15: Cash shows AED when the preferred currency is EGP, and Cash cannot change currency

### Confirmed behaviour
- **Seeding:** the client seeds the system Cash with `currency: settings.baseCurrency` at seed time (`ensureCashAccount`, `src/lib/accounts/actions.ts:31-40`; `seedSystemCash` `:43-50`; triggered by `useEnsureSystemCash` after the first pull). Migration 0329 seeded with `coalesce(p.base_currency, 'EGP')` (`supabase/migrations/0329_system_cash_backfill.sql:19`). Neither path hard-codes AED or reads the device locale **[code]**.
- **No follow-up:** changing the main currency (`useBaseCurrencySwitch` → `planBaseCurrencySwitch`, `src/hooks/useBaseCurrencySwitch.ts:31-60`) patches settings, profile, budget plans and gold only. It never touches Cash. Onboarding `StepAbout.tsx:38-41` sets `baseCurrency` after Cash may already exist.
  - So Cash keeps whatever the base currency was the moment it was seeded. AED is a user whose base was AED at seed time and was changed to EGP later. Live shows that one mismatched row is a seeded system Cash (AED with base EGP, `seeded_row` true, profile updated after) **[live]**.
- **Latent:** the column default `payment_methods.currency` is `'AED'` **[live]**. No current insert omits currency (the client mapper always sends `pm.currency`, and the server provisional insert sets it), but any future insert that forgets the field gets AED.
- **No currency edit for Cash:** `AccountDetailSheet.tsx:70` drops the Edit item for Cash. `AddAccountSheet` hides the currency field for `kind === 'cash'` (`AddAccountSheet.tsx:108-122`). Bank accounts and cards edit currency through `PaymentMethodSetupSheet`'s `CurrencyField` (`PaymentMethodSetupSheet.tsx:360-365`, saved at `:211`) as a plain relabel.
- **Second bug, a silent data error:** the two Cash balance entry sheets label the amount in the base currency but store it in Cash's own currency.
  - `AddAccountSheet.tsx:81-84,127`: the AmountField shows `base`, then `setOpeningBalance(ensureCashAccount(), amount)`.
  - `CashOnHandSheet.tsx`: shows `settings.baseCurrency`, then `setOpeningBalance(ensureCashAccount(), amount)`.
  - A user with AED Cash and EGP base types "1,000 EGP" and gets a balance of 1,000 AED. The engine reads opening balance and adjustments in account currency (`src/lib/accounts/balance.ts:54-60,152`).

Live mismatches: 7 open Cash rows differ from the profile base.

| Cash | Base | Rows | Seeded | Tracked |
|---|---|---|---|---|
| USD | EGP | 3 | no | no |
| AED | EGP | 1 | yes | yes |
| AED | EGP | 1 | no | no |
| EGP | AED | 1 | no | no |
| USD | AED | 1 | no | no |

**[live]** The non-seeded USD rows look like deliberate user-created Cash, so **no blanket realign**.

### Root cause
Cash's currency is snapshotted once from the base currency and never updated afterwards. There is no UI to change it, and the Cash balance sheets assume Cash is always in the base currency.

### What changing currency should do
- Expenses, income and payments carry their own currency and are converted at read time (`balance.ts:65-79`), so history does not need rewriting.
- What does need handling: `openingBalance` and `account_adjustments.delta` are unitless numbers read in the account currency. A relabel reinterprets them: 1,000 AED becomes 1,000 EGP. Options:
  - (a) untracked Cash (no opening balance): a relabel is safe;
  - (b) tracked Cash: convert `openingBalance` and each adjustment delta at the current rate, or re-ask "How much cash do you have now?" (reuse `UpdateBalanceSheet`) and reset the opening balance and time.
- The same relabel hazard already exists for bank accounts edited in `PaymentMethodSetupSheet`. It is out of scope but worth a note.

### Recommended minimal fix
1. Fix the label/storage mismatch: `AddAccountSheet` (cash branch) and `CashOnHandSheet` should show `currency` from the Cash row (`ensureCashAccount()`'s method), not `settings.baseCurrency`.
2. Let Cash change currency. Reuse `CurrencyField`, as an item in `AccountDetailSheet`'s ⋯ menu for Cash or a row on its detail sheet. Make it a relabel when untracked. When tracked, either convert, or ask for the balance again through `UpdateBalanceSheet`. The owner picks which.
3. When the main currency changes and Cash is **untracked**, move Cash along with it, as part of `planBaseCurrencySwitch`. For a tracked Cash, ask instead.
4. Optional data repair, only with owner approval: realign just the 1 seeded, untracked-or-confirmed system Cash row (AED with base EGP). Leave the user-created USD rows alone.
5. Optional: make the `payment_methods.currency` column default safer (drop it, or default to the profile base through the app). This needs a migration, so treat it as deep technical.

### Regression risk
- Balance, net worth and the budget studio (`studioEntities.ts:42` filters Cash by `currency === base`). Cash in a non-base currency drops out of the studio today, and changing currency moves it in or out.
- The sync tie-break: the seed row's `updatedAt` is 2000-01-01 on purpose, and a currency edit must stamp now.
- Undo of the base switch must also restore Cash's currency.

### Test label
**Deep technical** (financial calculation: currency of opening balance and adjustments, the base-switch side effect, sync stamp). Required:
- unit tests on the Cash-currency change (untracked relabel; tracked conversion or reset), on `planBaseCurrencySwitch` with an untracked Cash, and that the cash-entry sheets store in the Cash row's currency;
- a Playwright check for the visible currency label only if the owner wants it.

### Open questions
- Tracked Cash currency change: convert at the current rate, or re-ask the amount?
- Should a base switch move a tracked Cash too, or only an untracked one?
- Is a second Cash per currency in scope? `SYSTEM_CASH_PLAN.md` lists it as not covered.
- Approval to realign the 1 seeded AED row?

---

## Implementation (2026-11-24, commit "fix(accounts): provider logos, reject closes account, cash currency")

- **Bug 3:**
  - `PROVIDER_LOGO_FILES` in `src/lib/payment/bankLogos.ts` is now the one provider map. `bankLogoSrc` tries the bank file first, then the provider file, and `ProviderBadge` reads it too.
  - `BrandMark` and `ProviderBadge` fall back to the monogram on an image error.
  - The 49 brands with no asset are unchanged (licensing) and are left for a Linear ticket.
- **Bug 9:** `rejectProvisional` also sets `closedAt` (and `isDefault: false`), and Undo clears it.
  - Test: `src/lib/accounts/__tests__/rejectProvisional.test.ts`, written failing first. It also covers the server lookup: a later SMS with the same digits lands on the closed excluded row and no new provisional account is inserted.
- **Bug 15:**
  - **(a)** The two cash entry sheets ask in `cashCurrency(...)`, the Cash row's own currency.
  - **(b)** `changeCashCurrency` (in `actions.ts`) plus `CashCurrencySheet.tsx`, which reuses `CurrencyField` and `AmountField`, with copy in `src/lib/i18n/cashCurrencyCopy.ts` (en and ar). A Cash with money asks for the amount in the new currency, prefilled at today's rate, and records the difference through `updateBalance`. Wiring into `AccountDetailSheet` is a follow-up.
  - **(c)** `cashThatFollowsBase` and `useBaseCurrencySwitch`: an empty Cash with no history follows a main-currency switch, and Undo restores it.
  - **(d)** Migration `0345` drops the `payment_methods.currency` default. It is applied to live, the column now has no default and is NOT NULL, and `database.types.ts` Insert makes `currency` required.
  - **(e)** The one seeded AED Cash row was **not** realigned: it has an opening balance of 500 and 1 adjustment, so it is not empty.
