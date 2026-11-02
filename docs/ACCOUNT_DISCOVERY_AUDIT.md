# Audit: account discovery from SMS (accounts, cards, wallets), confirmation and manual completion

Date: 2026-11-02. Scope: how Buddget turns bank messages into accounts and cards, how it tells a card from an account, how the user confirms or completes missing details (provider, currency, number), and how this behaves on iOS where no sender is available. **Audit only: no code or data changed.** Evidence tags: **[code]**, **[live]** (read-only SELECT), **[reasoned]**.
Companion document: `docs/ACCOUNT_BALANCE_ACCURACY_PLAN.md` (root causes RC1-RC9 and phases 0-5). Section 4 maps this audit to that plan.

## 1. The flow as built

| Step | Where | What it does |
|---|---|---|
| 1. Capture | `sms/parse/route.ts:919` | Keeps only the last 4 digits of the AI/pattern-reported number (`account_last4`) |
| 2. Attribute a transaction | `createSmsExpense.ts` `resolvePaymentMethodByLast4` | exact last4 -> wallet provider -> default method |
| 3. Detect "new" accounts | `usePaymentMethodDetector` + `SmsAccountDetectionBanner` | last 7 days of parsed SMS, grouped by last4, minus methods with the same last4; prompt "Add card / Link existing / Not mine" |
| 4. Bulk discovery | `FoundAccountsSheet` ("Find my accounts") | up to 300 rows, grouped by (bank, last4), adds accounts and sets the opening balance from the message balance |
| 5. Create/complete | `PaymentMethodSetupSheet` | provider (required), type, last4 (0 or exactly 4 digits), currency, colour, default |
| 6. Confirm | `useSmsConfirmations` / `SmsReviewSheet` / `api/sms/confirm` | confirms currency, salary, credit-card payoff, sender mismatch, insert failures |
| 7. iOS provider | `providerFromBody.ts`, `pickProvider` | no sender on iOS (0 of 824 forwarded messages had one), so the provider is read from the text or a bank hotline |
| 8. Balance | `accounts/balance.ts`, `resolve.ts` | only tracked balance holders count; a debit card counts only through its parent account |

## 2. Findings

Priority: P1 wrong money or blocks the core job, P2 degrades accuracy or UX, P3 polish.

| ID | P | Finding | Cause (evidence) | Effect |
|---|---|---|---|---|
| A1 | P1 | The detector offers **phantom accounts** for number variants | `linked` is a strict set of registered `last4` values; `001` is not in `{0001}` [code]. [live] this account's log holds `001` (ATM) next to registered `0001`; other users' logs hold `301`, `0301` | "HSBC ••001 detected, add card" for an account you already have. Accepting it creates a duplicate; "Not mine" is stored forever under that string |
| A2 | P1 | The prompt can **only create cards, never an account** | `PaymentMethodSetupSheet` runs the prefill through `asCardType` ("a bank account is added as the debit card it issues, since accounts have their own sheet"); the banner CTA reads "Add card" for every non-wallet type [code] | An SMS about "Account ****0001" ends up as a **debit card with no parent**. `resolveAccountId` returns null for a parentless debit card, so every transaction attributed to it moves no balance [code] |
| A3 | P1 | The setup sheet **rejects 2, 3 and 5 digit numbers** | `canSave` requires `last4.length` to be 0 or 4; `use4` keeps only exactly 4 [code]. The database has no length constraint [live] | A user cannot record `001`, even deliberately. Combined with exact-equality matching (RC2), the only workable value is the one the bank never prints |
| A4 | P2 | **Currency is never detected** | `PmPrefill` has name, last4, type only; the sheet sets `currency = baseCurrency` [code]. `FoundAccountsSheet` also uses the base currency [code] | A USD account (••0110) is created in EGP. `FoundAccountsSheet` stores the USD balance from the message as an EGP opening balance |
| A5 | P2 | `FoundAccountsSheet` makes everything a **bank account (or wallet)** and groups by bank + digits | `type = brand.type === 'wallet' ? 'wallet' : 'bank_account'`, ignoring `paymentTypeFromSms`; dedupe against existing methods by `last4` alone (no bank); only rows with both `bank_name` and `account_last4` [code] | A card number becomes a bank account; two banks sharing the same last digits collide; purchases whose number was not captured are never discovered |
| A6 | P2 | The detector groups by **last4 only** and the dismissal key is `pm:<last4>` | `groups.set(l4, ...)`, `provider` = most common value across mixed banks [code] | Same digits at two providers merge into one prompt with a guessed provider; "Not mine" on one silences the other |
| A7 | P2 | A method holds **one identifier**; "Link existing" overwrites it | `updatePaymentMethod(choice, { last4 })` replaces the stored value [code]. [live] the child card "HSBC Egypt" has `last4 = NULL` | Linking `001` to the account erases `0001` and breaks all earlier matches. An account number tail, a card tail (5950) and a wallet number cannot coexist, so the declined card 5950 can never attach |
| A8 | P2 | There is **no confirmation for "which account is this?"** | `awaiting_confirmation` is set only for currency_provisional, sender_mismatch, insert_failed, debt_unassigned and salary (`parse/route.ts:1051,1074`). `SmsReviewSheet` shows "new instrument" text but offers no account picker, and finds the account by exact `m.last4 === item.account_last4` (line 102) [code] | An unplaceable transaction is saved without an account and no one is asked (RC3/RC4 in the balance plan) |
| A9 | P2 | **No retroactive attribution** after adding or linking an account | no re-attribution code anywhere in store, accounts or sms modules (searched) [code]; [live] the 4 unattributed 31 Oct expenses remain unattributed | Fixing the account setup does not repair history |
| A10 | P2 | A new account is **untracked until an opening balance is set**, and the banner never asks | `isTracked` needs `openingBalance` and `openingAt`; untracked accounts are absent from balances [code]. The banner path creates the account without a balance; `FoundAccountsSheet` reads `balance_after`, which is empty because balance reports never resolve (RC5/RC6) [live] | Spending against a new account is silently ignored until the user finds "Set balance" |
| A11 | P2 | **7-day window** | `since = now - 7 days` in the detector [code] | An account seen on day 8 never prompts; the prompt reappears only if a new message arrives |
| A12 | P3 | **Type inference is order-dependent and weak** | `TYPE_RULES` tests `credit card`, then `debit card`, then bare `card`, then `account` [code]. "Purchase from 103-104\*\*\*-001" contains none of these, so type is null and falls to the card default (A2) | A message that mentions both ("card purchase from account ...001") is typed as a card although the digits belong to the account |
| A13 | P3 | **Provider on iOS** works for known banks only | `providerFromBody` needs a catalogue name or one of 5 hotlines [code]. Unknown bank -> provider empty -> the sheet requires the user to type it (this part is fine) | Acceptable, but nothing asks the user at confirmation time, and "Bank" placeholder is filtered in `pickProvider` only |
| A14 | P3 | **Account number vs card number are not distinguished at capture** | The AI prompt asks for "the PRIMARY masked account or card number"; one field, no kind [code] | The resolver cannot tell whether "001" is an account tail or a card tail |

What works and should be kept: provider is required (`hasProvider`), so a user can always complete a missing provider; currency can be chosen in the sheet (but is not prefilled); the sheet's debit-card-under-account path (`parentAccountId`) exists; `FoundAccountsSheet` correctly seeds the opening balance from a message balance as an anchor; wallet attribution by sender is sound; ambiguity is not auto-resolved on the server (`findUniqueByLast4`).

## 3. Can the user fill in what is missing?
- **Provider:** yes, required in the sheet. Not offered at the moment of confirmation, and not learned.
- **Currency:** can be changed in the sheet but starts at the base currency; the SMS currency is ignored (A4).
- **Type:** yes, but the prefill coerces accounts to cards (A2). There is no "this is a bank account" path from the prompt.
- **Number:** only exactly 4 digits (A3); one identifier per method (A7).
- **Parent account for a card:** only when added from the account screen; the detector path creates a parentless card (A2).
- **Opening balance:** not in this sheet (A10).

## 4. Alignment with the fixes proposed for the owner's account

| Audit finding | Already covered by `ACCOUNT_BALANCE_ACCURACY_PLAN.md` | Gap to add |
|---|---|---|
| A1 phantom accounts | Phase 2 suffix matching and resolver | The detector and `FoundAccountsSheet` must call the same resolver; today they have their own equality checks (4 matchers plus 2 UI checks) |
| A3 four-digit limit | Phase 2/3 accept 2-6 digits in the parser and matcher | **Also the setup sheet and `PmPrefill`**: accept 2-6 digits, keep the value as typed (string) |
| A7 one identifier | Phase 2 `payment_method_aliases` | Make it the primary model: `payment_method_identifiers(method_id, kind: account \| card \| wallet, digits, source)`; "Link existing" **adds** an identifier, never overwrites |
| A2 account vs card | Not covered | New: capture the identifier kind (account vs card) at parse time, offer "Add account" vs "Add card", and require a parent account for a debit card or ask the user to pick one |
| A4 currency | RC5 uses currency as a resolver signal | New: carry the SMS currency into the prefill and `FoundAccountsSheet`; never set a foreign-currency balance as base currency |
| A8 confirmation | Phase 4 review queue | Add the reason `account_unknown` / `account_ambiguous` to `awaiting_confirmation` with an account picker on `SmsReviewSheet` |
| A9 retroactive | Phase 5 back-fill (suggest only) | Run the same re-attribution automatically (with undo) when the user confirms an account or identifier |
| A10 untracked | Phase 0/4 | When creating from a message that states a balance, set the opening balance anchor (currency-checked) in the same step |
| A11 window | not covered | Detect from retained data without a 7-day cap; prompt once per identifier until answered |
| A5/A6 collisions | Phase 2 scoring (institution + currency + kind) | Scope dismissals by identifier + provider + currency |
| A12/A14 type | Phase 3 extractor | Extractor returns identifier kind and instrument; type rules ranked by evidence nearest the number |

## 5. Proposed design (how it should work end to end)

1. **Identifiers, not a column.** `payment_method_identifiers`: `(id, user_id, payment_method_id, kind, digits, visible_count, provider_key, currency, source, created_at)`, unique on `(user_id, kind, digits, provider_key)`. Sources: user, sms_learned, migration of today's `last4` (kind inferred from type). The `last4` column stays for display.
2. **One resolver** (Phase 2 of the balance plan) used by server ingest, the detector, `FoundAccountsSheet`, `SmsReviewSheet` and balance reports. Suffix matching with leading zeros kept; provider, currency, kind, parent link and balance continuity as signals; ambiguity goes to review.
3. **Discovery queue.** An unknown identifier creates one "New account?" item per `(provider, kind, digits, currency)` with the detected provider, type, currency, and balance pre-filled and editable. Actions: Add account, Add card under an existing account (picker, defaulting to the same bank), Link to existing (adds identifier), Not mine. Answers are stored and applied to history.
4. **Completing missing parts.** The sheet always shows what the SMS did not say (provider on iOS, currency, type) as required fields with sensible suggestions, and accepts 2-6 digit numbers.
5. **Guardrails.** Never auto-create an account from a single message; never auto-pick between two accounts of one bank; every unattributed transaction is counted and shown.

## 6. Tests to write first (red before green)
- Resolver: HSBC `...***-001`, `****0001`, `ending 5950`, Arabic digits, two HSBC accounts (EGP/USD), card under parent, same digits at two banks.
- Detector: `001` with existing `0001` produces no prompt; `5950` produces "Add card under HSBC ••0001".
- Setup sheet: saves `001`, `01`, `00001`; "Link existing" keeps both identifiers.
- Prefill: bank account type is not coerced to card; SMS currency preselected.
- Re-attribution: confirming an identifier attaches the 4 historical expenses and the balance changes by exactly their sum.
- Property test: attaching/detaching one expense changes exactly one account's balance by its amount.

## 7. Register entries
New P1: A1, A2, A3. New P2: A4-A11. New P3: A12-A14. A1-A3 and A8-A10 share root causes with RC1-RC5 of the balance plan, so one resolver plus the identifier table closes most of them.
