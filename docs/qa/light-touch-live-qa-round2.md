# Light touch: live QA round 2 findings (my.buddget.app, 2026-11-26)

These come from the parallel write journeys W1–W5 after PR #51. The owner treats the account as a test account. Fix every item; a deviation from the mockup is a bug.

## P0: conformance (from owner review of build 155)
- The brand font never rendered. The `@theme inline` font stacks were literal system fonts, and next/font set the same variable names. Fixed on branch `claude/light-touch-conformance`; verify the computed font is Geist on web and native.
- Heroes on phone are still full-bleed bands (Accounts, Wealth, Debts, Subscriptions, Budget, Paydays, Goals). The mockup shows rounded light-touch hero cards on phone **and** desktop, as Flow has. This came from a wrong round-1 brief ("keep mobile look").
- Every screen must match `docs/mockups/light-touch/screens/`. Use the side-by-side composites in `docs/mockups/light-touch/compare/`.

## W1 Flow
- [P2] A bin delete once didn't stick while the sync toast "A newer edit from another device replaced yours" was showing. Investigate the conflict path when two clients edit the same row. The toast also re-appears on fresh inserts and overlaps other toasts.
- [P2] Add income ("Log money in") is still the old form. It must match the expense sheet structure (A1.6).
- [P3] A USD expense row shows only the EGP amount; show the original USD on the row.
- [P3] The edit sheet amount reads "-85.5"; it should be 85.50.
- [P3] The income type picked (Side hustle) is saved, but the row says "One-time".
- [P3] The payday-link offer for Nov 26 money suggests only the Oct 5 payday. Check the logic.
- [P3] Income delete has no undo, while expense delete does.
- [P3] "E£" in the credit card note; the add-income amount field has no accessible label.

## W4 Debts, subscriptions, budget, paydays
- [P1] A borrow with Received in Vodafone Cash ••1234 and Arrived on never credited the account, and net worth fell by 12,000. A payday into QNB credited fine.
- [P1] The Received-in carousel lists 7 duplicate "Vodafone Cash ••1234" entries plus NBE, "HSBC Egypt test" and a credit card, none of which are accounts on the Accounts page. Use the same account source as Accounts, deduplicated, accounts only.
- [P2] The installment default card isn't saved on create; it is when set through Edit.
- [P2] Subscription price history is reversed (a 210 edit against a 190 plan shows "Since: 190 · Before: 210").
- [P2] A cancelled subscription doesn't show under Ended; Upcoming shows "Cancelled 1".
- [P2] Budget review with one 500 line says "Over income by 500"; the Buffer doesn't shrink; the percentages add up to 100.3%.
- [P2] A debt payment can't be deleted on desktop (mouse swipe and tap do nothing). Add a row action or bin.
- [P2] A logged payday forgets its account (Edit shows "Received in: Choose"). The labels "Paid into" and "Received in" are inconsistent.
- [P3] A gold borrow's Added row shows "1" with no unit (0.80 g), and grams are rounded to one decimal.
- [P3] The borrow form has no Total / Per payment segment under the amount (A4.2, mockup).
- [P3] The first borrow payment is due from today, not from the borrow date.
- [P3] The active "Added" filter has no visible chip. The Borrowed tab's payments list includes installment payments.
- [P3] A budget line with Due day 5th shows "Next due —".
- [P3] Paydays: the amount shows with no currency after the currency changes, and currencies are mixed in "1,000 of 173,500". The Missed badges are inconsistent and low-contrast.
- [P3] The sync-conflict toast stays on screen for minutes.

## W5 Insights and layout
- [P2] Buddgy chat on desktop: the global + FAB covers Send.
- [P2] /paydays isn't in the centred column and has no hero.
- [P3] The pace chart "Today" label isn't under the today dot.
- [P3] The recap "Biggest buy" wraps and has no currency. Insights currency formats are mixed: use one format.
- [P3] Insights hero with no budget: show a "Set a budget" prompt the way Flow does.
- [P3] Wealth hero: the third stat cell is empty, and the 49% / 51% legend has no labels. Accounts hero legend "HSBC 99% · HSBC 1%": disambiguate.
- [P3] The budget draft hero says "0 EGP planned" while a row has 173,500.

## W2 Accounts
- [P2] Escape on the number pad closes the whole account sheet and drops the balance edit. Escape must close only the pad.
- [P2] The balance NumberPad ignores the hardware keyboard on desktop. Accept digits, the decimal point, Backspace and Enter.
- [P2] False "A newer edit from another device replaced yours" toasts after saves that did persist (Cash out, card delete).
- [P2] Cash out leaves no row in Flow, and Recent on the Cash account says "No activity" while In this month shows +500. A cash-out must show as a transfer row in both places.
- [P3] The custom display name (QA CIB) is dropped in some places: the provider page row title, the Credit cards list, the Flow expense picker, and the "Save this account…" confirm. Use the display name everywhere.
- [P3] Credit limit and Owed don't group thousands after blur.
- [P3] The provider hero and grouped row truncate decimals (12,345) while the row shows 11,845.67. Format consistently (smart decimals, rounded, not truncated).
- [P3] Set aside heading "QA phone pocket pocket": don't repeat the word "pocket".
- [P3] Card delete and account close have no undo after the confirm.

## W3 Wealth and goals
- [P1] Gold bought from a pocket doesn't reduce the pocket. A −1,000 "Withdrew" row appears, but the pocket stays 1,350 after a reload and net worth double-counts 1,000. Delete then Undo fixes it, so the create path differs from the undo path.
- [P1] New goal "Already saved" from a pocket doesn't take money out of the source pocket, so it's double-counted. Adding money to an existing goal from a pocket works.
- [P2] Withdraw more than the pocket holds: no refusal, and the button stays enabled ("goes from 1,550 to 0").
- [P2] Changing a goal's pocket on detail changes its saved amount (500 → 350), contradicting "keeps every amount where it is".
- [P2] A fixed-plan goal shows On track when its own milestones finish after the finish line (QA laptop, 100% in May 2029 vs Nov 2027).
- [P2] Fund it on goal detail defaults the share to 100% when switching from add-myself (125% in total). Default to a sensible share (e.g. 10–20%, or what's left) and block or confirm going over 100%.
- [P2] The first deposit into a just-created pocket was once dropped silently (sheet closed, nothing saved).
- [P2] The Monthly limit goal card uses saving copy ("98,411 saved · 0 to go"). Use limit copy (spent of limit).
- [P3] Recent moves: rows out of time order; pocket-to-pocket moves, Outside deposits and Outside gold buys never appear; the day total only sums the rows shown.
- [P3] Swallowed taps: the first Create goal tap right after Fund it closes, and the first X on "You did it".
- [P3] "You did it" says "after 1 month" and "7 deposits" for a goal created the same day. Fix the facts.
- [P3] The "Paying this off instead?" row shows two blank chips.
- [P3] Zakat "This year ends 15 Oct 2026" when that date has passed: say it ended / is due. The Year starts date has no year.
- [P3] The goals hero flashes "≈ 1,884,639 a month" before settling.

## Conformance diffs (my review of docs/mockups/light-touch/compare/*.png, phone 390px)
Re-run `node scripts/qa/light-touch-capture.mjs` against http://localhost:3001 after fixing, and check your screens match.

**C1 Global, Flow, Insights**
- AmountHero: the gap between the amount and its unit is far too wide (e.g. "−3,250      EGP"), because the input box doesn't shrink to its content. The mockup sits the unit right after the number (about 6px). This shows on every sheet.
- Flow rows: a text label ("Food", "One-time", "Groceries") sits under each row icon. The mockup has no label.
- [P1] Insights learning state (few days of data) crashes the whole app with "buddget hit a problem".
- Font: verify Geist renders on every page (`checks.json` bodyFont).

**C2 Accounts page, Wealth page**
- The Accounts hero is a full-bleed band with a 3-cell row (In accounts / Set aside / Credit owed). The mockup is a rounded card: label, big number, net worth on the right, a segmented bar with a legend, then ONE note line "15,000 set aside · 14,220 owed on cards", and no cell row.
- Accounts section heads: "+ Add account" should be a quiet text link, not a pill button.
- Provider cards: mini cards sit in a stacked/overlapping row, then a "4 cards · Show all ▾" line. The app shows a loose grid with "2 cards".
- The untracked Cash row title truncates to "Cash on…". It should read "Cash on hand" in full.
- The Wealth page doesn't match:
  - The mockup has a rounded hero (What you hold, net worth ▲ % on the right, a legend line "Savings 52% · Gold 31% · Stocks 17%", no cells).
  - Then Add money (primary) and Withdraw (secondary).
  - Then HOLDINGS rows (certificate, "Gold 21k · 18 g" with "3,210 a gram · ▲ 8.1% since you bought", stocks).
  - Then ACTIVITY rows.
  - Rework the app's band, cells, gold-rate strip, chips and pocket/investment lists into this structure. Keep every function reachable: the gold price goes into the gold holding row; pocket filters and "Add pocket or asset" become a quiet "+ Add" in the Holdings section head.

**C3 Goals and savings sheets**
- Goal detail: "E£ 15,000 of E£ 50,000" becomes "15,000 of 50,000" (no E£ anywhere). The status goes as a badge in the subtitle ("Save for · Travel [ON TRACK]"), not as a separate chip line. Use the mockup's "Behind for N months" card when the goal is behind.

**C4 Debts, subscriptions, budget, paydays**
- Budget page:
  - Month | Plan segment full width at the top.
  - Line rows use their category icon and tone (house, food, plug…), not a generic lavender wallet tile.
  - Bars in the brand teal (amber when near the limit, red when over).
  - The "My budget" plan selector moves above as a quiet row.
- Budget line sheet: the header tile uses the line's category icon and tone. When data exists, show the "Sized from your last 3 bills" Buddgy note.
- Paydays page (top level, as in the mockup):
  - Hero "SALARY · MONTHLY → CIB PAYROLL", "31,500 EGP each month", "Next payday Nov 25 · On time 6 of 6", and a row of 6 month check circles.
  - "Log a payday" as the primary filled button and Edit payday as secondary.
  - History rows with the bank logo, "Salary · October", "+31,500 EGP", "Oct 25 · on time".
  - Today the app shows a detail page with a back header, a line timeline and two secondary buttons.
- Subscriptions page:
  - The hero needs the progress bar (Paid X · Y still due this month).
  - Remove the "November 2026 · 4 active +" header row.
  - Sections "Next 30 days" / "Paid this month".
  - Row amounts as "−494 EGP" with the original "$9.99 USD" under it. Today the app shows "≈ 530", "99.00" with no sign or unit.
- Subscription sheet: remove the read-only "Tracking: Match from SMS" row (not in the mockup). Make sure Last charges shows.
- Cancel subscription sheet: the logo is blank. Show the service logo as on the sub sheet.
- Empty Debts: the mockup shows only the empty card, with no 0 hero.
