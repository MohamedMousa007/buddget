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
