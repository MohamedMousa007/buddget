# Final UI adjustments: council decisions (2026-11-27)

Voices: Architect, Skeptic, Pragmatist, Critic. Brief: `COUNCIL_BRIEF.md`. Status: waiting for the owner's OK before mockups.

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
- **Bugs found:** gold is valued as 24k whatever its karat (a 21k holding is about 14% too high: `savingsAccountBalanceInBase`); the carry posts into the primary account's vault without checking its free money (server has no `over_available` guard).
- **Done (owner approved):** pocket link field retired, rows repaired live (migration 0353, commit 372065ad).
