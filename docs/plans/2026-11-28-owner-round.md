# Owner round 2026-11-28: plan (approved 2026-11-28)

## Root causes (read-only investigations)
1. OTP digits invisible: `AuthOtpRow.tsx` never sets a text colour; in light theme the digits inherit near-black text on the dark auth card; no autofill colour rules. Same row in admin `EmailCodeInput`.
2. iOS hero height: fixes are in iOS 158. Real cause: `HeroBand` has no fixed total height; Accounts/Debts notes wrap to two lines on narrower lines, Flow's never does.
3. Onboarding skipped: `OnboardingGate` only fires on `/` and `/flow`; sign-out from `/settings/profile` never navigates, so the next sign-up lands back there.
4. Empty states: shared `EmptyState` used inconsistently; several screens hand-rolled; Accounts empty state has "Find my accounts".
5. Budget plans: moved to a quiet text row at the page end (`621c848e`); `PlanDeck` still exists.
6. Desktop: Accounts/Debts capped at 640px, wide cap 1152px.

## Card flow (council round 2, 3 of 3 + Architect, within owner constraints)
- One sheet (`PaymentMethodSetupSheet`) with the same props from every entry. In-bank "Add card" CTA kept as is (bank preselected). New "Add card" on the main Accounts page. The + menu opens the same sheet.
- Type bar first: Debit | Credit | Prepaid (existing segmented control). Then bank, card last 4, currency.
- Debit added directly: "Spends from" preselects the matching account (same bank and currency, exactly one). If none: a visible "New {Bank} account (we'll create it)" choice, with optional "Balance now" and optional "Account last 4". Created as a real confirmed account; until it has a balance it shows "Set balance". Two candidates: ask, never guess. A second card at the same bank reuses the account.
- Credit: no auto account (the issuing bank is often not where the money is). "Paid from" picker, "Decide later" allowed; the hold-back must never vanish when the payer is untracked.
- Prepaid: standalone holder, "Balance on card now" required (0 allowed), default name "{Bank} Prepaid ••1234". The in-bank entry does not offer Prepaid (today it silently detaches).
- Account last 4: kept, optional at add time, learned later. Needed for salary, transfers, IPN and own-transfer detection, and for banks whose purchase SMS carry the account number (HSBC, generic). Asked in the form only for those banks. When an SMS creates a provisional "{Bank} ••5521" and exactly one same-bank account has no number: one-tap "Is this your {Bank} account ••5521?" merge, which teaches the digits and moves the history.
- Top-ups (one "Top up" row, never spending, never income by default):
  (a) from an account in the app: source down, card up, net worth unchanged (cross-currency stores the received amount);
  (b) from tracked Cash: Cash down, card up;
  (c) from outside / untracked cash: card up, net worth up (money enters tracking), not income; optional "It was income" switch.
  SMS "money loaded" with no matching debit: held as a pending top-up, then "Where did this come from? My account / Cash / Somewhere else / Income"; a late bank SMS takes over the pending row (no double credit).
- Live money bugs found on the way (fix with tests): deleting a bank account used only through its debit card hard-deletes it and that card's history stops moving any balance; an untracked payer drops the credit-card hold-back (Free to spend inflated); prepaid named after its bank breaks top-up matching; unpaired load books income; same last-4 on card and account goes ambiguous (warn on save).

## Workstreams
- WS1 Bugs and money logic (no mockup, tests mandatory), Opus: OTP colour + autofill; onboarding gate + sign-out to `/`; all card/top-up money bugs and the top-up model; account-delete history bug; hold-back with untracked payer; merge prompt logic.
- WS2 Mockups, before/after model as in round 9, ONLY the changed pages or parts (no all-screens gallery, no badges everywhere), Opus: hero one-line note and shared height; empty-state system and the changed empty states (Accounts first account, bank with no accounts, Debts, Income, Savings, Budget, Notifications, pickers); Add card sheet (type bar, spends from / new account, prepaid balance, top-up sheet, merge prompt) and the new Accounts "Add card" entry; Budget plans deck at the top; desktop skeleton for Flow, Accounts, Debts.
- WS3 Build after approval, parallel worktrees by area: empty states (Sonnet); add-card UI (Opus); budget plans (Sonnet); hero height (Haiku); desktop phase 1 (Opus).
- WS4 Cloud QA persona matrix (Sonnet runner): new user, full data, bank with no accounts, Meeza-only, credit-card-only, HSBC-style account SMS, Arabic, phone/tablet/desktop, light/dark; every page, sheet and picker; report then fix round.
- Then native build of both apps.

## Status
- WS1 money (this branch, tests written and passed, migration 0370 applied live):
  - deleting an account whose only history is on its debit card closes it and keeps the card linked;
  - an untracked payer is skipped, so a credit-card hold never vanishes (LOGIC_SPEC §4.1 updated);
  - a bank-issued prepaid card is never name-matched (last4 only);
  - a wallet/prepaid card's own credit with no funding leg is held (`failure_code = 'top_up_source'`), not booked as income: a later bank leg claims it and posts one transfer, confirming books it as income, and a failed post puts the hold back;
  - `tailClash` (same last 4 warning) and `mergeCandidateFor` (one-tap merge prompt) are pure helpers waiting for their UI.
- WS1 auth: own session (`ws1-auth`), not started yet.
- WS3 add-card must wire: the `tailClash` warning in `PaymentMethodSetupSheet`, the merge prompt on a provisional account, and the top-up answers on a `top_up_source` hold:
  - My account X: an own transfer X -> card (Top up category);
  - Cash: the same from the system Cash;
  - Somewhere else: an `account_adjustments` `manual_update` on the card (net worth up, not income);
  - It was income: the existing confirm (userConfirmed).
  Until then the held review list shows it as a credit to check, and confirming books income.
- Known edge: if both legs arrive within the same second, the bank leg can miss the still-processing wallet credit and book a single transfer while the credit is still held. The answer sheet should hide "My account" when such a transfer already exists.
