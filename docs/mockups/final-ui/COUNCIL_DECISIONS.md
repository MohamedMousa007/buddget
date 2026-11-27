# Final UI adjustments: council decisions (2026-11-27)

Voices: Architect, Skeptic, Pragmatist, Critic. Brief: `COUNCIL_BRIEF.md`. **Read the Consolidated model at the end first: it supersedes anything above it that disagrees.** Status (2026-11-27): migrations 0351, 0353, 0354 applied live; mockup v9 pending the owner's OK.

| # | Decision | Agreement |
|---|---|---|
| D1 | One hero rule app-wide: full number while it fits; if not, shrink to a floor size, then drop decimals, then compact from 10M ("282.9M" / "282.9 مليون"). Exact figure on tap and in the screen-reader label. Net worth on its own line under the big number (never side by side on phone). | 4/4 on stacking; width-aware beat a plain digit threshold 3/4 |
| D2 | "Add card" on the provider page beside Add account, as the dashed "+" slot at the end of every card stack, and in the add menu. Not a link inside the Accounts row (two tap targets in one row). A card needs a provider, not an account: a card-only bank or wallet shows as its own provider row ("1 card"). Add card's "Linked account" defaults to None. | 3/4 (Pragmatist backed the in-row link) |
| D3 | Headline = Free to spend (rename "Available now"). Directly under: "of 297,950 in your accounts". "15,000 set aside" opens a list: pocket/goal, amount, account it sits in, each linking to its page. Over-committed shows "Over-committed by X" in red. | 4/4 |
| D4 | Page name Savings (مدخرات). Groups: Pockets (each shows "in CIB Current"), Goals (link rows, Goals owns goals), Investments (with price time). Emergency fund = pinned card (months covered). Monthly saving = plan row under hero. Zakat = yearly card at bottom. Pocket detail = full page; 3-dot Edit/Delete/Use for monthly saving. Add money + Withdraw on the detail page; page CTA "Add pocket". | 4/4 name/grouping/page; 3/4 two CTAs |
| D5 | Tabs list debts only; history inside each debt's detail page; Filter payments removed. Owed-to-me = own section and total. "Borrow" tab; cleared = trophy-style chip; Debt freedom row removed. Bigger rows (next due, progress, left). Detail page: hero, Add payment CTA, 3-dot Edit/Delete. Installments: next due, n of N, schedule, pay early. Borrow: person, direction, left, log, Mark settled. Credit card opens the shared card sheet with Pay / Pay off. Delete via 3-dot, not swipe. | 4/4 |
| D6 | Page name Income (دخل). Hero expected vs received. Source list like provider rows. "Add income" header link. Source detail = full page with timeline; Confirm received inline. Irregular income never "late". | 4/4 |
| D7 | Streak card: rule + payoff in one line, 4-dot strip, tier chip, neutral missed state, hides once kept. Sheet: What counts / What it earns / Where it takes you, link to Rewards. | 4/4 |
| D8 | Modern: Wave, Contour, Grain × 5 colours. Classic: Guilloche, Two-tone, Ribbon, Minimal emboss (generic motifs, no bank trade dress). Pre-rendered; text ≥4.5:1. | 3/4 (Skeptic: 2 Modern) |

## Found along the way
- Net worth disagrees: Accounts 339,959.50 vs Wealth 397,740 in the captures. Investigate; net worth lives only on Accounts, Savings shows "Saved and invested".
- One card has two names (sheet vs Flow). Use the display name everywhere.
- Rewards shop "card finish" renamed "tier card finish"; bank card faces stay free.

## Round 2 (2026-11-27): goals and pockets, monthly savings

Voices: Architect, Skeptic, Pragmatist, Critic.

- **Savings goals = one pocket each (4/4).** A savings goal is a target (amount, date) on exactly one pocket; the pocket balance is the goal's progress. No pocket counts toward two goals. Spending-limit and debt pay-off goals stay pocketless targets (Skeptic: move them to Budget and Debts later).
- **Monthly savings split (3/4).** One split, on pockets, in percentages that cannot total more than 100% (no priority rule). Goal pockets are pockets, so goals are covered. Pragmatist dissent: keep the existing goal shares engine instead of a new pocket split.
- **Monthly savings pocket (3/4, against the owner's delete rule).** Stays as the remainder: whatever is not split goes there. It can be renamed and hides when empty, but is not deletable, because with splits under 100% the rest needs a home.
- **Bugs found in today's model:** a pocket linked to two goals counts in full for both (`computeGoalProgress.ts` 68-72); goal shares compute amounts but never move money (`allocateMonth.ts`), and the month-carry cron is not scheduled; deleting a goal's only pocket drops the goal to 0 with no warning (`canDeletePocket.ts`).
- **Migration:** row counts first; goals with several pockets keep the largest (or merge), shares convert to pocket percentages.

## Round 3 (2026-11-27): does a goal need a pocket; pockets and bank accounts

Voices: Architect, Skeptic, Pragmatist, Critic. 4/4 on both.

- **A savings goal is the money container the user sees.** No separate pocket, no linking step, the word "pocket" never appears for a goal. In the data it is one savings row with a target and date (the `SavingsAccount.targetAmount` field already exists, "reserved for a future Goals feature"); a pocket without a target is the same object (Monthly savings, emergency fund). The Goal table keeps only goals that hold no money (debt pay-off, spending limits). Reached = marked achieved, money stays. Deleted = money released back to free (held) or kept as a plain savings item / moved to Monthly savings (outside), never deleted with it. Gold/USD goal: target in its own unit, conversion for display only.
- **Pockets are money set aside inside an account, never added on top.** Several per account is fine (several earmarks). A separate savings account or certificate is an Account (SMS keeps it updated) marked as savings and shown on Savings by reference, never a second balance. Items outside any account are only for what no SMS can see: cash at home, gold, an untracked bank.
- **Bugs to fix before the redesign ships:**
  - `balance.ts:109` clamps free at 0, so an SMS debit below the set-aside total is hidden; show "Set aside N more than you have" with Release / take from.
  - Goal progress and the Savings page keep counting set-aside money the account no longer holds.
  - Month carry (`cron/month-carry/route.ts:167`) posts from the primary account without the free check and can book a bank transfer that never happened; cross-bank pocket moves can be booked twice when the real transfer arrives by SMS (needs pairing).
  - Unpriced gold or FX silently drops out of goal progress (`computeGoalProgress`).
  - `SavingsAccount.linkedPaymentMethodId` has no reader for pockets: define it as the savings-account flag or remove it.

## Round 4 (2026-11-27): shortfall, month-end leftover, the pocket link field

Voices: Architect, Skeptic, Pragmatist, Critic.

- **Shortfall (4/4, owner's idea kept, trimmed).** Derived, never stored: short = set aside − balance. Triggers when a debit takes an account from covered to short and it is still short after a grace window (24h / after SMS pairing); never on FX-only drift; one notice per account per episode, auto-cleared when covered again. Choices: **Move** (re-home whole items to another same-currency account with enough free; nothing moves at the bank), **I spent it** (release the shortfall, Monthly savings first, then the shared picker), **Ignore**. "Cover from another savings item" and "outside money" dropped (same-account item changes nothing; cross-account = Move; outside = claims money we can't see, a double count). Until answered: account row "Short X" in the warning colour, items show "X not covered", goal progress counts only the covered part.
- **Month-end leftover (4/4).** Set aside, nothing moves: one savings deposit per item, source carry, no account leg. Each item's share is set aside in the account it is held in, capped at that account's free money; Monthly savings sits in the account that received most of the month's counted income (fallback: primary). What no account can cover is shown, not invented ("1,200 of your leftover isn't in your accounts"). Base-currency accounts only. The user sees one month-end card (split per item and account) to confirm or edit; auto-applies after 3 days.
- **LIVE BUG (verified 2026-11-27):** the month-carry cron runs daily (vercel.json, since 2026-11-05) and posts from the primary account (route.ts:167). Live: 6 carry rows, 3 users, 3 with an account leg into an outside pocket (money taken out of the primary account that never left the bank). Next month-end run: Dec 1.
- **Pocket link field (4/4).** Drop `savings_accounts.linked_payment_method_id`. Repair first by id with a before/after balance dry run and notices suppressed: linked-not-held rows → set held_in when the currency matches, else leave standalone and ask; linked≠held row → check (likely a card resolved to its parent account), held wins. Remove the grey-out (AddHoldingSheet.tsx:69) so an account holds several items, and the write (PocketFormSheet.tsx:94). "This is a savings account" becomes a flag on the account (new migration). Live: 49 pockets, 6 linked, 3 linked-not-held, 1 linked≠held.

## Round 5 (2026-11-27): one goal across accounts, where month-end leftover sits, outside money

Voices: Architect, Skeptic, Pragmatist, Critic. 4/4 on all three.

- **A goal can have parts.** Each part is one savings item with one home (set aside in one account, or outside: gold, cash, untracked bank) and one currency. One part = shown as a single goal card (the common case); several = the card lists them ("$400 in Deel · 18 g gold · 12,000 in CIB"). The target lives on the goal only (retire `SavingsAccount.targetAmount`). Add money picks the account from the shared Paid-from list and fills that part (creates it if new); the account's free money caps it. Progress = parts at live rates; rate-only moves are labelled ("+1,200 from rate changes"); achieved stays achieved (no flip on an FX swing); missing price = warning with the last price and date. Shortfall and withdrawals are per part. Deleting a goal: set-aside parts go back to free; outside parts ask keep or remove.
- **Month-end leftover.** How much = income received − spending (card purchases count when made), as today. Where = each bank/wallet account's real free money at month end, after holding back the card bills that account pays; spread in proportion, never above any account's free. The item % split applies to that amount. Monthly savings has one part per account for what is left. What fits nowhere is shown ("1,200 saved but not set aside: no account had it free"), never invented. A late expense shrinks the Monthly savings part in that account first. The server must check free before writing (it doesn't today).
- **Outside money.** Never a bare amount. "Where is this money?": an account I haven't added (add it with its real balance, then set aside inside), cash at home (the system Cash account), or gold/other (an outside holding). Opening balances, not income. When a bank is added later, ask "Is <item> money in this account?" and move the part there instead of counting twice.
- **Bugs found:** ~~gold is valued as 24k whatever its karat~~ (retracted: holdings already price each karat; only XAU-gram pockets are 24k by definition, now labelled) (a 21k holding is about 14% too high: `savingsAccountBalanceInBase`); the carry posts into the primary account's vault without checking its free money (server has no `over_available` guard).
- **Done (owner approved):** pocket link field retired, rows repaired live (migration 0353, commit 372065ad).

## Owner rules (2026-11-27): always match the bank

- **The bank is the truth.** When a bank SMS shows a balance that differs from the app, the account takes the bank's balance. Everything set aside in that account is then checked against it: covered = nothing to do; short = the shortfall flow (Move / I spent it / Ignore). Month-end placement always uses this bank-aligned free money, so saved money is always real leftover still sitting in a bank, set aside.
- **Automated, with the user in the loop once a month.** The month-end card shows the leftover and where it will be set aside (per goal and per account), pre-filled by the rules; one tap confirms, it applies by itself after 3 days. Shortfalls notify once. Nothing else asks the user.
- **Done 2026-11-27 (a267093b, migration 0354, applied live):** carry, goal funding and the carry adjustment no longer move money (no account leg); they only set aside inside pockets held in a tracked account; goals saving outside accounts are skipped; the 2 vaults fed by the old legs are now held in their account. Gold pockets labelled 24k (holdings already price each karat; the 21k claim was wrong).
- **Still to build with the redesign:** the cap at each account's free money and the proportional spread across accounts (both need the client's live balances, so they move into the month-end card), the shortfall notice and sheet, and the SMS-balance check above.


## Audit (2026-11-27): council validation of everything

- **Live data (verified):** 0 pocket links left; 0 carry rows that move an account; 0 pockets held in another currency, a closed/deleted account, or a missing account; 0 goals with several pockets; 0 pockets shared by goals.
- **Code (fixed, 7d01085a):** HIGH, a legless carry row read as an orphan pocket move and raised its holder account (300 made 1,000 read 1,300); carry now skips before that rule. MEDIUM, a pocket whose account is closed/deleted/untracked could still take the carry; it is now treated as outside money. LOW, 0354 turned one tester's earlier 100 EGP move to an outside pocket into money leaving the bank, which is correct under this model.
- **Contradictions resolved (Skeptic):** round 5 beats round 3 on the goal model; "Use for monthly saving" is dropped; month-end uses the round-5 spread, base currency only, filling existing parts first; the free-money cap is enforced in both the month-end card and the server; outside money = gold/other only (cash goes to the Cash account, an untracked bank gets added); deleting releases set-aside money; net worth has one formula.
- **Owner requests that amend earlier decisions (Pragmatist):** D1 net worth stays beside Free to spend, both scaled together; lists are pages, a single item is a sheet (pocket, borrow, installment are sheets; achieved goals and cleared debts are pages); Pay / Pay off becomes one "Pay card" with a full-amount chip; no Add card button beside Add account (the dashed + card adds cards); the icon/name/amount top becomes a shared component (Add goal, Add income source, Add installment); the face gallery goes; the Flow streak card moves to a profile-menu ring opening Rewards, whose streak row opens the streak sheet.
- **Needs the owner:** (1) "salary" for every income, or only for salary sources ("income" for freelance, family, rent); (2) "Release" instead of "Withdraw" for money set aside in a bank; (3) bank installments on a credit card stay inside the card (no second debt).

## Consolidated model (supersedes the rounds above)

The bank is the truth: every tracked account carries its bank balance (SMS balances win), and saved money is never a second balance. Saved money is either set aside inside an account or, for gold and other assets only, an outside holding. A **Pocket** is a reserve with no target; a **Goal** is a target (amount, date, its own unit) that owns one or more parts; the UI never says "part" or "savings item" (a goal card lists its homes: "$400 in Deel · 18 g gold · 12,000 in CIB"). Each part has one home, one currency and one owner. **Monthly savings** is an undeletable system pocket (rename, hides when empty) with one part per account. The **month-end leftover** (income received − spending) is spread across accounts by their bank-aligned free money after card bills, then split by the item percentages in "Where leftovers go" (≤100%), filling existing parts first; what fits nowhere is shown, never invented. The client proposes it on one month-end card (confirm or edit; applies itself after 3 days) and the server refuses anything above an account's free money. **Shortfall** is derived per part: Move / I spent it (Monthly savings first) / Ignore (dismisses the notice; the row keeps "Short X" and goal progress counts only the covered part). **Outside money** is asked "Where is this money?" (an account not added yet / Cash / gold or other). **Deleting** a goal, pocket or account releases set-aside money to free and asks about outside holdings. **Net worth** = accounts + outside holdings + investments − debts, with set-aside money counted once inside its account, shown on Accounts only; Savings shows "Saved and invested". **Savings page:** Pockets, Goals, Savings accounts (by reference, linking to Accounts), Investments, Emergency fund (a goal sized in months of spending, pinned), Zakat; savings goals only (spending-limit and pay-off goals stay on Goals).

## Final revision (2026-11-27, Opus council): supersedes the Consolidated model where they differ

Story tests (7): salaried one-bank user, cash + gold user and month end with a card bill pass; the USD freelancer, deleting an account that holds goal money, an unlinked card and Arabic text failed and are fixed below.

1. **Month-end uses every tracked account in its own currency** (banks, wallets, tracked Cash; "base currency only" dropped). Each set-aside part is stored in its account's currency, converted only for display. Uses the user's cycle start day. **Fill order:** the account with the most free money first, then the next, each capped at its free money (fewer parts than a proportional spread). A month that spent more than it received sets nothing aside and releases nothing; the card says "You spent X more than you received".
2. **Card bills are held back before anything is set aside**, only what is due (statement balance + this month's instalment). A card with no linked account is held back from the account that paid it last, else the primary; Add card asks once when "Linked account" is None (new field: "pays this card from").
3. **Shortfall fires on any drop of the bank-aligned balance** (a debit or an SMS balance correction), after SMS pairing, no timer. Row chip "Short X"; sheet line "X of what you set aside isn't in CIB anymore". Choices: **It's in another account** (pre-filled when a transfer just left), **I spent it** (Monthly savings first), **Keep for now**. Free money can go negative internally (no clamp at 0).
4. **Closing or deleting an account that holds set-aside money** opens that sheet first ("Where did this money go?"). Money in a closed account is never counted as outside money (fix `netWorthBasis`; 0 live rows today).
5. **Achieved goal whose money was later spent:** "Achieved · X no longer set aside".
6. **Arabic/RTL:** each home on a goal ("$400 in Deel · 18 g gold · 12,000 in CIB") is an isolated segment with locale separators and Arabic units.
7. **One name per idea:** the pocket stays "Monthly savings"; its split screen is "Where your monthly savings go" (rest → Monthly savings shown as a line). Glossary used on every screen: Free to spend = not set aside, after card bills; Set aside = held inside an account; Saved and invested ≠ net worth (one-line explainer); Pocket = no target; Goal = target. Savings accounts appear on Savings as one row "2 savings accounts · In Accounts".
8. **Open calls decided:** (a) "Salary" (راتب) only for salary sources, "Income" (دخل) for the rest, copy only (routes and code names unchanged); (b) **Release** with "Stays in CIB, back to Free to spend" (Arabic "رجّعه للمتاح"); "Withdraw" only for gold, cash and other outside holdings; (c) installments on a credit card live under the card only: the card owes billed balance + remaining plan principal once, instalments are settlements not new spending, only the billed instalment is held back; a bank is a provider only for loans not on a card; valU/BNPL stay installment debts.
9. **Month-end card:** applies itself after 3 days, recomputed against free money at that moment (says what it capped), with Undo.
10. **Cut for now (internal testers):** the "+1,200 from rate changes" label (a small "includes rate changes" note instead); a multi-home editor (homes are listed read-only, added through Add money); the "Is this money in the new bank?" prompt; new work on the emergency fund target and Zakat (keep what exists).

## Deep logic check (2026-11-27, Opus: Accountant, Critic, Skeptic): supersedes earlier rules where they differ

Method: invariants written as equations, then a 3-month ledger simulated with real numbers (CIB EGP, Deel USD, a CIB card with an instalment plan, cash, 21k gold; salary, USD freelance, card spend, bill, own transfer, a goal in CIB + Deel, Monthly savings, an SMS correction, a refund, an account closed), each invariant checked after every event against the model and today's code.

**Invariants (the rules every screen and job must keep)**
1. Every tracked open account shows the bank's balance (an SMS balance wins).
2. Set aside in an account = the sum of the parts held there, each in that account's currency.
3. Free(A) = balance − set aside − card money A must cover. It can go below 0. Short(A) = set aside − balance, only when positive; card money never counts as a shortfall.
4. Setting aside, releasing, "I spent it" and month-end never change any account balance (labels only).
5. Net worth = open tracked accounts + outside holdings + investments − debts. Set-aside money counts zero extra times; money in a closed account counts zero times; a card plan is owed once, inside the card.
6. Goal progress = covered parts at live value.
7. Month-end placed ≤ min(leftover, free money), and ≤ each account's free money. Leftover = income − spending − money already added to savings in the month.
8. Own transfers, card bills and instalments are neither income nor spending.
9. Each month is applied exactly once.
10. A past cross-currency row keeps the rate it was booked at.

**Model fixes adopted (3/3 unless noted)**
1. Leftover subtracts money already added to savings during the month (otherwise it is set aside twice).
2. Card money held back = everything owed on the card except the unbilled plan principal (statement balance + purchases since the statement + this cycle's instalment if not yet billed). Holding back only the statement left later purchases free and caused a false shortfall at the next bill (Skeptic).
3. Release and "I spent it" are labels (not cash flow): they never move a balance (today's withdrawal path would move it twice).
4. One "live account" rule (tracked, open, not deleted) used by the app, the server and net worth. An account holding set-aside money cannot close until "Where did this money go?" is answered; afterwards it holds 0.
5. An unexplained SMS balance drop counts in the month's leftover as outflow, so a month never claims money that is gone.
6. Month-end is one server action with one key: a proposal row (proposed / applied / undone), applied by the user's confirm or on day 3 by the server, compare-and-set, never twice; the server computes free money from the ledger; each account is capped at min(free at month end, free now) so new salary is never taken as last month's leftover; Undo keeps the row.
7. Closed months are never reopened. A late SMS or refund counts in the month it arrives; the carry-adjustment machinery is retired. Each month stores its own dates and rates.
8. One allocator: "Where your monthly savings go". Goal fixed/share settings become pre-filled lines. Fill order: each item's existing parts first, then the account with the most free money (compared at apply-time rates).
9. Goal progress counts covered money; "Achieved" is stamped from covered money; if money or rates later drop it, it stays Achieved with "now X below target".
10. When an account is short, parts go uncovered in this order: Monthly savings, then the lowest-priority goal.
11. A plan on a card: the full price is spending at purchase; instalments are settlements; principal is owed once inside the card.
12. Monthly savings has one part per account (id derived from user + account).
13. Shortfall ignores card money and pure rate moves; negative free shows as "Free to spend −X".

**Live code problems found (server month-end job, next run Dec 1)**
- No cap at free money: the leftover goes entirely into the main account's vault even when that account can't hold it (phantom shortfall).
- A gold or other unpriced deposit in the month records the month as empty, so it is never carried.
- An unchecked read in goal funding can set the same money aside twice.
- A claim written before the deposit and released only in code: a timeout leaves months marked done with nothing booked.
- Changing the cycle start day re-windows closed months (days never carried or counted twice).
- Late corrections re-price a closed month at today's rates (FX leaks into savings).
- Money in a closed account counts as outside money (net worth too high).
- Cross-currency transfers are re-converted at today's rate on every read, so balances drift from the bank (build item).
- SMS corrections stored as deltas: a late SMS dated before a correction lowers the balance twice (build item).
- Bank-plan instalments counted as spending (double counting with the purchase).
Recommendation (3/3): pause the month-end job's writes until the rebuilt month-end card and single server action ship.

## Owner rules (2026-11-27, later)
- **An achieved goal is completed for good.** It never goes back to active: not when its money is spent later, not when a rate drops. (Replaces "stays Achieved with now X below target" and "Achieved · X no longer set aside".) Its money can still be released or spent normally; the goal just stays in the trophy list.
- **Month-end job writes paused** until the month-end card and its single capped server action ship (`MONTH_CARRY_WRITES=on` turns writes back on; paused runs evaluate and report `paused: true`).
