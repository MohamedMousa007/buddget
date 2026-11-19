# A real Cash account for every user

Date: 2026-11-19. Owner decision: every user gets a real Cash account. Its balance is not tracked by default, and when the user tracks it, the balance is labelled an estimate. This supersedes the QA-18 position that the second Cash row is by design.

## Critique (board + council, before any code)

The brief that every seat saw is the section "Facts" below. There were six independent reviewers, each with one lens.

| Seat | Score / vote | Most dangerous risk |
|---|---|---|
| Board: Offers | 6 · Fund if | Money dropped or doubled during the migration |
| Board: Product | 6 · Fund if | A wrong merge silently changes a tracked balance |
| Board: Data integrity | 5 · Fund if | Old builds keep writing NULL and re-split Cash after a merge |
| Council: Skeptic | Don't (as framed) | Lopsided cost: 54 new rows and 380 rewrites to fix a bug that 12 users have |
| Council: Pragmatist | Do it, two steps | Merging the 5 tracked-balance users |
| Council: Critic | Do it, no flag day | Re-pointing history while a device holds unsynced edits |

### Where they agreed
- NULL on the server stays a permanent alias for Cash while old builds are installed. Do not rewrite the 380 NULL rows now.
- Use one fixed id per user so two devices create the same row, not two.
- Never change an existing tracked balance. A user's existing real Cash *is* their system Cash.
- Show "Estimate" once, where the cash balance itself appears. Prefer a "still about X?" correction (the existing Update balance) over a disclaimer on every screen.

### What was taken and rejected
- **Rejected:** a server trigger that rewrites NULL to the Cash id (Data seat). Old builds keep reading NULL as their in-store Cash, and the client already maps NULL to the real Cash. A rewrite buys nothing until old builds are gone.
- **Rejected:** a sign-up trigger plus a server backfill for all users. A broken sign-up trigger has hurt before (migration 0081). The row is created by the client after the first pull, like the Monthly Savings pocket.
- **Skeptic's point, taken in part:** the wire format does not change, and NULL stays.

## Facts (2026-11-19, Frankfurt)
- 54 users. 12 have a real Cash row (13 rows: one user has two, both untracked). 5 track a cash balance.
- 285 of 751 expenses, 91 income events and 4 debt payments carry NULL, which means Cash.
- Users who track a real Cash already see NULL rows counted in that balance (`resolveAccountId` sends the sentinel to the real Cash). Adopting the existing row therefore changes no number.
- Android vc179 includes the one-Cash-in-pickers fix (5240cfca). iOS 145 does not: iPhone testers see two Cash entries until the next iOS build.

## Phase 1 (this change)
1. `systemCashId(userId)` gives a fixed id per user. `ensureCashAccount` creates that row when no open real Cash exists, and returns an existing one otherwise.
2. After the first pull (`hasPulled`), `useEnsureSystemCash` seeds it untracked: no opening balance, so it stays out of net worth. The seed carries an old edit time (2000-01-01), so the server's newest-edit-wins rule (migration 0241) never lets a late seed from another device overwrite a balance the user set.
3. "Set up account" rule: an untracked Cash is not a set-up account (`isSetUpAccount`). The setup checklist, the onboarding eligibility check, the Accounts list and its "Set balance" row read it, so a new user's screens look as before.
4. A tracked Cash shows an "Estimate" chip where its balance shows.
5. Cash can never be closed or deleted (`removePaymentMethod` already refuses).
6. The one user with two untracked Cash rows: the duplicate's rows are re-pointed to the oldest row and the duplicate is closed, in a migration file with the ids recorded.

## Owner follow-up (same day): testers' data changed now, and Cash asks once
The owner ruled that every user is a tester, so their data can change now, and chose "ask once" over opt-in tracking.
- **Migration 0329 (applied):** every user without an open Cash got the system Cash (the same id the app derives). 87 expenses and 4 recurring expenses that carried no method and that the app reads as Cash moved onto it. Result: 55 of 55 users have exactly one open Cash, the 5 tracked balances are untouched, and per-user expense counts and totals are unchanged (checked inside the migration).
- **Kept as they are, on purpose:**
  - 214 expenses from bank SMS that named no account. They are "Unassigned", not Cash.
  - 91 income events and 4 debt payments with no method. The engine reads those as "no account", and moving them would add money to Cash that may never have been cash.
- **Ask once:** after the first expense paid with an untracked Cash, a sheet asks "How much cash do you have right now?" (Save / Not now). It is never asked again (`dismissBanner('cash-on-hand-ask')`; Settings > restore dismissed prompts brings it back). An answer starts Cash's balance as an estimate.
- **Cash always visible:** the Accounts page shows the Cash "Set balance" row on its empty state too.

## Still to do (phase 3)
- Drop `pm_default_cash` from the store, the mappers and the pickers once no device runs an older build. New rows already carry the real id; older builds still write NULL, which the app reads as Cash.
- An occasional "Still about X?" nudge for a tracked Cash, reusing Update balance. Not built yet.

## Not covered
- A second Cash in another currency (USD cash). `ensureCashAccount` always returns the one Cash. That limitation predates this change.
