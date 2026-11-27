# Round 9b: owner corrections (apply exactly; change NOTHING else)

The owner was upset that earlier changes added things nobody asked for. Rules for this pass:
- Change only the items listed for your area. Do not restyle, rename, move, add or remove anything else.
- Where an item says "bring back" / "revert", restore the previous approved version (round 8 backups exist: lt-v8-*.v8bak.js, lt-v8-*.pre-data.js, d8-r8-backup.js in the scratchpad, and git history of docs/mockups/final-ui/source/ in the repo: `git -C "/Users/mohamedmousa/Desktop/Budget Manager/buddget/.claude/worktrees/flow-page-ui-redesign-53d70f" show 067a413a~1:docs/mockups/final-ui/source/<file>` is the round-8 file).
- Use existing components/helpers; mark each changed part with new9() and its key in NEW9 (keep existing NEW9 entries).
- Keep the reconciled sample numbers.
- ⋮ menus: use the shared menu decided by the council (see bottom of this file once filled in).

## Accounts (lt-v8-accounts.js)
1. Remove lighting from all card faces (no key light, no light sweep) and remove the "Lighting on/off" switch.
3. Pay card sheet: the amount uses the shared inline currency picker (hero4 + ctl4, tappable currency next to the amount); the "Full amount" chip is centred under the amount.
13. Accounts hero is the same size as the Flow hero: remove the "of 384,935 in your accounts" line and any extra rows that make it taller than Flow's (keep big number, net worth beside it, the split bar with its legend, one note line). The sample switch above the hero stays.

## Savings (lt-v8-savings.js)
12. Remove the "Where your monthly savings go" row and the month-end breakdown block from the Savings page. Bring back the Monthly saving plan row from the round-8 mockup (same look); tapping it opens a sheet showing where monthly savings go (the split, editable) and this month's breakdown (the month-end card content: amount, where it goes, Confirm/Edit/Undo, the Fits/Capped/Overspent variants live inside that sheet).
13. Savings hero is the same size as the Flow hero: remove extra lines that make it taller (keep big number, split bar with legend, one note line).

## Goals and misc (lt-v8-goals.js)
4. Add menu: show every tile that exists in today's app except Account, Subscription and Add by voice, plus Card. That means Receipt and Pay debt (debt payment) must be visible. Verify on EVERY final-phone page (Accounts, Savings, Goals, Debts, Income, Flow) by opening the + menu and screenshotting.
6. Add goal C, "money you already have" block: title becomes "Already saved" with "optional" next to the title (remove "optional" from the amount); order: amount first, then where it is. Restore the previous shared source picker tabs (Account · Pocket · Outside, srcTabs from lt-v6.js) instead of the "Where it's kept" picker.
8. Goal detail: NO pen/edit icon. The header has the ⋮ menu (shared component) with Edit and Delete.
9. Goal detail: bring back every part that was removed (finish line, each month, "Behind for N months" card, and the rest of the round-8 goal detail). Only the "Where it's kept" section is updated to the new design (homes listed).
10. Budget line sheet: bring the delete bin back to the top header next to the X (as before); remove the "Delete line" CTA under Save.

## Debts (lt-v8-debts.js)
5. Borrow/installment detail ⋮ uses the shared menu decided below.
7. Add payment for an installment: prefilled with the upcoming instalment amount; keep only the "Full amount" chip; remove "This payment".

## Income (lt-v8-income.js)
2. Assign sheet: remove the "Add income" tile; keep one "Add salary" tile (as the single tile was in round 8). Irregular income is chosen inside the Add income source sheet (How often → Irregular). Keep the Add income source sheet itself as built this round (the owner asked for its Add goal top earlier); only the extra "Add income" entry goes.
11. Assign: restore the previous Assign CTA and the main CTA "Save" as they were in round 8; the ONLY change is a shorter tip text.

## ⋮ menu decision (council)
(filled in below)
Decision: **A, the app's existing CardActionMenu**: a small popover anchored to the tapped ⋮ (vertical dots), scrim-dismissed, items Edit / extras / Delete (red, confirm before delete). Used everywhere, including inside sheets. No bottom action sheets for ⋮. Mirror its markup/classes from src/components/ui/CardActionMenu.tsx in the repo (/Users/mohamedmousa/Desktop/Budget Manager/buddget/.claude/worktrees/flow-page-ui-redesign-53d70f). If your area opens a ⋮ as a bottom sheet today, switch it to the popover.
