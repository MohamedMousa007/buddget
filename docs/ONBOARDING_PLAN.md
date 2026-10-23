# Onboarding plan (for approval, no code yet)

Status: PLAN. Nothing here is built. Next gate: you approve or change the decisions in section 9, then mockups, then build in the phases of section 8.

## 1. Where we start

There is no onboarding today. The old flow and its table were removed (migration 0081). A new user signs in, sees a 1.5 to 8 second welcome splash, and lands on an empty Flow with a five-row setup checklist. First-run problems found in the code:

- Push permission fires at first sign-in with no explanation (`NativeBootstrap` / `pushNotifications.ts`).
- Currency and language are never asked: everyone starts as EGP and English.
- The accounts-from-SMS sheet is empty for a new user, because it reads SMS that has not arrived yet.
- iOS SMS needs a manual Shortcut build, the largest likely drop-off.
- The checklist is five equal rows with no order, no time promise and no personalisation.
- A budget-studio build error is a dead end.

Constraints that shape the design (from the repo and past incidents): sign-in is idToken-only on native; never refresh sessions by hand; the welcome splash is a one-shot latch and must not be gated on level-triggered `dataReady`; top-level moves on native use hard navigation; the store is offline-first and syncs last-write-wins, so a returning user on a fresh install must never push local answers over their server data; design tokens, 44px targets, RTL, reuse existing components.

## 2. Principles

1. First useful number inside two minutes: the user sees their own money, not a tour.
2. One decision per screen, always skippable, always resumable. Onboarding never blocks the app.
3. Every question says why it is asked, and the next screen echoes the answer back (rapport).
4. No permission prompt without a screen that shows the benefit first, and a calm path if the answer is no.
5. Minimal and warm: Buddgy's face changes mood per screen, short sentences, no walls of text. Arabic is a first-class language, not a translation pass.
6. Reuse: `SelectableCard`, `OptionChip`, `Progress`, `AmountField`, `EmptyState`, `ModalShell`, `BuddgyIcon`, the budget studio, `FoundAccountsSheet`. New pieces are a journey shell and per-step compositions, nothing that reshapes an existing component.

## 3. The journey: six steps, about two minutes

Entry: after sign-in and the existing welcome splash, only for a new account (section 5). A "Step n of 6" indicator and a "Skip for now" are on every screen.

| # | Screen | Asks | Writes to | Rapport / payoff |
|---|---|---|---|---|
| 1 | About you | Name (prefilled from the sign-in provider), country, language, currency (derived from country, one-tap override) | `profile.name`, `profile.country`, `settings.language`, `settings.baseCurrency` | "Nice to meet you, Mona." The screen flips to Arabic and RTL the moment she picks it. |
| 2 | What brings you | Pick up to two: know where my money goes, stop running out before payday, save for something, get out of debt, build a budget | `financial_profile.onboarding.goals`, seeds `priorities` for the budget | "Let's start with that." Later copy and the first card use it. |
| 3 | Where your money lives | Chips: cash, bank account, wallet, credit card. For each chosen: name (bank catalogue) and balance now, with "check your banking app" help and "I'll add later" | real accounts via the existing account actions (`ensureCashAccount`, opening balance) | Reveal: "You have EGP 18,400 across 3 accounts." This is the first real number. |
| 4 | Income and payday | Amount, day of month, steady or varies | one recurring income source (existing payday model) | Reveal: "Next payday in 12 days. About EGP 640 a day until then." This is the activation moment. |
| 5 | Make it automatic | Two cards, each with a benefit preview and a "Not now": bank-text capture (Android: permission after the priming screen; iOS: a 15-second preview of the result, then "Set up now, 2 minutes" or "Later"), and reminders (push) | existing SMS and push flows | A sample "this is what a captured transaction looks like" card. Denial leaves a quiet card on Flow, never a nag. |
| 6 | Your budget | "Want me to build it now? About two minutes." Opens the budget studio already filled from steps 1 to 4 (draft-first), or "Later" | existing studio | Because accounts, income and priorities are known, the studio asks only a few questions. |

Finish: land on Flow with a personalised first card (section 6), not the five-row wall.

## 4. Value before sign-up: recommendation is no

Letting people try the app before an account sounds friendly, but here it is the riskiest option: the offline-first store would hold answers that later have to merge into an account, a returning user could overwrite their server data, the AI features need a session, and native auth has strict rules. Keep sign-up first, make it light (email-first morph form already exists), and spend the effort on the six steps above. Separate, smaller item to study later: move email verification to an in-app 6-digit code so it does not send people to their mail app.

## 5. Who sees it, and how it is remembered

- New accounts only. Eligible = signed in, first server pull finished, the account holds no data (no accounts beyond the default cash, no income, no expenses, no plan), and no onboarding record. If the pull does not finish within the existing ceiling, show nothing. A returning user on a new device has server data, so they never see it.
- Progress and completion live in `profiles.financial_profile.onboarding` (`{v, step, goals, doneAt, skippedAt}`): it already syncs, resumes on another device, needs no migration, and is cleared by an admin reset, so a reset account gets the journey again.
- Not gated on `dataReady` level changes and not on auth metadata (the earlier races). One in-memory latch per user, like the splash.
- Existing users: no forced journey. Settings gets "Replay setup" later if wanted. They keep the checklist chip.
- It is a shell route (instant, back-guarded), reached with the app's own navigation, so Android back asks "leave setup?" instead of exiting. Rolled out behind a feature flag (`onboarding_v1`, percentage + kill switch) using the admin portal flags that already exist.

## 6. Flow empty state, rebuilt to match

Replace the five equal checklist rows with a state that follows what is done, using the existing `EmptyState` and `SetupChecklist` data:

- Journey skipped or just started: one card for the next undone step with a time promise, the rest collapsed under "More to set up" (accounts are now a first-class step).
- Accounts and income done, no transactions yet: "Your accounts are ready. EGP 640 a day until payday." with two actions: add your first expense, or turn on bank-text capture.
- First transaction in: the normal ledger, the checklist shrinks to the header chip.

This is the same content as the journey, so skipping onboarding never leaves a hole.

## 7. Permissions, denial and the iOS Shortcut

- Push: stop asking at first sign-in. Ask on step 5, or after the first logged transaction, with a one-line benefit. On "no", remember it and offer at most once more after 30 days.
- Android SMS: priming screen first, then the OS permission. Before shipping this change confirm the Play Console SMS declaration for the app is current (Play restricts SMS permissions); this is a check, not a code task.
- iOS Shortcut: never blocking. Show the result first (a short animation of a bank text becoming a transaction), offer "Set up now" or "Later", and re-offer contextually after the first manual expense. The Wallet-transaction automation stays a future complement.
- Accounts are not blocked on SMS: balances are typed in step 3, and the found-accounts sheet is offered afterwards once messages exist.

## 8. Build phases (each shippable, each with tests)

0. Mockups of the six steps, the finish card and the new Flow empty state (light, dark, Arabic) for your approval, with real components and tokens.
1. Foundations: eligibility, progress record, shell route, back guard, flag, analytics events (`onboarding_step_view`, `_complete`, `_skip`, permission outcomes) into the existing analytics tables.
2. Steps 1 and 2 (About you, goals) including language/RTL switching and echo-back.
3. Step 3 (accounts and balance reveal) on the existing account actions.
4. Step 4 (income and payday) on the existing payday model, with the "per day until payday" number.
5. Step 5 (automation): SMS and push priming, remove the blind push request, denial paths.
6. Step 6 (budget handoff) and the Flow empty state and first card.
7. Polish and QA: Arabic parity, dark mode, accessibility, offline behaviour mid-journey, device pass on iOS and Android, an admin funnel card (steps reached, skips, permission outcomes) so the portal reflects it.

## 9. Decisions needed from you

1. Six steps as above, or fewer? (Merging steps 2 into 1 saves one tap; I would keep it, it is the rapport step.)
2. Primary success moment: "first real balance plus per-day number" (recommended) versus "first detected transaction".
3. Sign-up first (recommended) versus a try-first guest mode.
4. iOS Shortcut deferred and contextual (recommended) versus part of the journey.
5. New accounts only (recommended) versus also nudging existing users.
6. Roll out behind the flag at 10% first (recommended) versus everyone at once.
7. Okay to stop asking for push permission at first sign-in?

## 10. What this does not change

The budget studio, accounts model, SMS pipeline and admin portal are reused as they are. The only existing behaviours that change are the first-sign-in push request and the Flow empty state.
