# Round 9 mockup changes (read README.md first; same rules, same build/shot commands)

Model decisions you must follow: /Users/mohamedmousa/Desktop/Budget Manager/buddget/.claude/worktrees/flow-page-ui-redesign-53d70f/docs/mockups/final-ui/COUNCIL_DECISIONS.md (read "Owner rules", "Deep logic check", "Final revision", "Consolidated model"; later sections win). Words to use: Free to spend, Set aside, Short X, Release (money set aside in a bank; "Stays in CIB, back to Free to spend"), Withdraw (gold, cash, other outside holdings only), Pocket = no target, Goal = target, "Where your monthly savings go", Monthly savings (can't be deleted, hides when empty), Salary only for salary sources, Income for the rest. A goal holds its own money (no separate pocket), may sit in several places ("$400 in Deel · 18 g gold · 12,000 in CIB", each place an isolated segment), and an achieved goal is completed for good.

Rules for this round:
- Update your existing area file in place (it becomes the v9 version). Keep what the owner already approved; change only what is listed for your area.
- Mark every UI change of this round: NEW9.push(key) for each page/sheet key you added or changed, and new9(html) right after a changed part inside the final phone (sparingly: one badge per changed element, not per row).
- Shared pieces: reuse the Add goal version C top (icon picker row + name + amount) from lt-v6.js (AFTER.addgoalC, gIcon/gTile/ltIconPicker/heroGoal) for Add income source and Add installment. Reuse the shared "Paid from" method list (ltMethodPicker / ltPaidPicker in lt.js) and the provider-then-account picker from lt-v8-savings.js where an account is picked. A vertical 3-dot menu = ICON('ellipsis-vertical').
- Lists are pages, a single item is a sheet.

## Accounts (lt-v8-accounts.js)
1. Hero: Free to spend with Net worth beside it (both use fit8 compact when huge; tap shows exact). Remove the extra net-worth line under the hero.
2. Account row: full bank balance + "X free"; when short, "Short X" in amber.
3. Bank page: first tap on the stacked cards spreads them, a second tap opens the card sheet; remove "Show all"; cards left-aligned; only "Add account" as a text link (remove the Add card button beside it); cards are added from the dashed + card.
4. Card faces: Modern gets more alive textures with lighting (keep Wave = the voxel wave reference, add e.g. brushed metal, liquid chrome, frosted glass, carbon weave), with a "Lighting on/off" switch in the Add card look picker. Classic: faces modelled on famous bank card designs (generic, no bank marks), including a heraldic lion with its full pattern. Remove the card face gallery sheet.
5. Credit card sheet: one CTA "Pay card" opening a pay sheet with a "Full amount" chip; tip: "Spending on this card is added to what you owe. It isn't taken from any account until you pay the card."
6. Set-aside sheet: grouped list (Pockets / Goals), each row with amount, where it's kept, and "not covered" when short; built like the shared picker list.
7. New: Shortfall sheet ("CIB is short 2,400"; line "2,400 of what you set aside isn't in CIB anymore"; choices: It's in another account / I spent it / Keep for now) and "Where did this money go?" sheet shown before closing an account that holds set-aside money.

## Savings (lt-v8-savings.js)
1. Sections: Pockets, Goals (savings goals only, homes listed), Savings accounts (one row "2 savings accounts · In Accounts"), Investments, Emergency fund, Zakat. Remove the Monthly saving plan row and the A/B layout switch (keep Option A sections).
2. Pocket detail becomes a sheet (not a page): Add money (primary) + Release (or Withdraw for outside holdings), vertical 3-dot with Edit, Delete. Remove "Use for monthly saving".
3. New: "Where your monthly savings go" screen (percent per goal/pocket, total ≤100%, "Rest → Monthly savings" line) reached from a row under the hero.
4. New: Month-end card (on Savings top): "October leftover 6,200", where it goes per item and per account, Edit, Confirm, "Applies by itself on Nov 3", Undo after applying; variants: some not set aside ("1,200 saved but not set aside: no account had it free"), a month that spent more ("You spent 2,000 more than you received").
5. New: "Where is this money?" sheet (an account I haven't added / Cash / Gold or other) used when adding money from outside the app.
6. Add money uses the shared Paid from list; "start a pocket on an account" uses the bank-then-account list. CTA wording "Add pocket" everywhere (page link, sheet title, button).

## Goals (new file lt-v8-goals.js; page key goals: P8.goals)
1. Goals page as today (All/Active/Paused + trophy chip), goal cards show homes ("$400 in Deel · 18 g gold · 12,000 in CIB").
2. Goal detail sheet: Edit (pencil) in place of the bin, remove the extra "more" button; Delete sits inside Edit. Any sheet that only has a bin gets the same rule.
3. Achieved goals open a page with a back button (not a filter); achieved is permanent.
4. A goal with an unpriced part shows a warning line with the last price and date.
5. Budget line sheet (AFTER.s_line): amount tappable/editable inline with the shared inline currency.
6. Add menu (the + FAB sheet): Expense, Money in, Goal, Card only (remove Account, Subscription, Add by voice).

## Debts (lt-v8-debts.js)
1. Borrow detail and installment detail become sheets (not pages) with the vertical 3-dot (Edit, Mark settled / Pay off early, Delete).
2. Cleared debts open a page with a back button.
3. Add payment: shared inline editable currency; every amount tappable to edit.
4. Installment providers include banks; the provider shows as a badge next to the item name in rows; Add installment uses the Add goal C top (item icon, name, amount) and the provider as a picker below.
5. A plan on a credit card shows under its card (in the card sheet: "Installments: 2 plans · 2,400 a month · 18,000 left"), not as a second debt.
6. Keep the A/B row switch only if both are still useful; otherwise keep A.

## Income and streak (lt-v8-income.js)
1. "Salary" only for salary sources, "Income" for the rest (page title stays Income).
2. Money-in sheet: "Assign" CTA with a one-line tip ("Assign links this money to a salary or income you get regularly"); swipe action "Assign"; Assign sheet: no Cancel, an "Add salary" / "Add income" empty tile.
3. "Add income source" sheet (title exactly that) uses the Add goal C top (scrollable types with icons, name, amount; icon editable when Other), then how often, payday, into which account.
4. Source page shows the icon the user chose, not the bank logo.
5. Streak: remove the Flow streak card; add a small 3-segment ring next to the tier in the profile menu (open the profile dropdown on the final phone), tapping it opens Rewards; the streak sheet's bar: kept weeks in the brand colour, this week outlined, missed weeks neutral grey, upcoming faint; clear legend.
