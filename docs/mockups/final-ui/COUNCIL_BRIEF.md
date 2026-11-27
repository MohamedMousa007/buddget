# Final UI adjustments: council brief (2026-11-27)

buddget is an Egyptian-first personal budgeting app (EN/AR, phone-first, Capacitor iOS/Android + web). Design language "light touch": calm, white/teal, rounded hero cards, quiet text links, grouped rows, bottom sheets, Geist numbers. Pre-launch; all current users are internal testers. The owner wants modern, easy to understand, consistent with the rest of the app, and asked to be criticised hard ("choose only what is best").

Current app captures: `docs/mockups/light-touch/app-screens/*.png` (page-accounts, page-provider, page-wealth, page-debts, page-paydays, page-flow, sheet-card, sheet-addcard, sheet-setaside, sheet-s_payday, sheet-income, sheet-s_vault ...). Approved previous mockup: `docs/mockups/light-touch/screens/*.png`.

Existing patterns to reuse: Accounts page = hero + list of provider rows (bank logo, accounts and card counts, total) -> provider page with its accounts and stacked mini card faces; card detail sheet; goal detail page (hero, status badge, 3-dot menu with Edit/Delete, CTAs); Goals page has an All/Active/Paused bar with a trophy chip for achieved goals; Flow is the one ledger of all money movement.

## Decisions needed

D1. Accounts hero overflow. With hundreds of millions, the big "Available" number collides with net worth on the right. What rule? (abbreviate above a threshold, width-aware fit, stack net worth under it on narrow screens, ...)

D2. Adding a card without adding an account. Where does "Add card" live so it is easy and modern, and what about a card not linked to any account (e.g. a credit card from a bank where the user has no debit/current account, a prepaid card)? Idea from owner: a text button "Add card" under the "N cards" count in the provider row.

D3. Set-aside money on Accounts (money in an account reserved for pockets/goals). (a) How does the user see where it is set aside to and why? (b) Should the hero headline be the total in accounts (with "X free" smaller, as today) or the free-to-spend amount (total without set-aside) as a motivation not to overspend? Owner explicitly asks to be criticised hard here.

D4. "Wealth" page redesign. Today pockets, bank-held pockets, goal pockets, savings pockets, investments (gold, crypto, stocks), monthly savings, zakat and emergency fund all feel melted together. Decide: (a) the page name: Wallet, Vault, Assets, or Pockets; (b) the information structure/grouping; (c) where monthly savings, zakat, emergency fund live and how they look; (d) pocket detail as a full page (like goal detail) vs a sheet; (e) Add money + Withdraw as two CTAs vs one "Move money" CTA; (f) how to set a pocket as the default for monthly saving. The page CTA becomes "Add pocket".

D5. Debts. (a) Payment history: a list under each tab (Borrow / Installments / Cards) vs only inside each debt's detail (Flow already has every transaction); (b) remove the "filter payments" control or keep; (c) debt detail as page vs sheet. Owner wants a 3-dot menu (Edit/Delete) and Add payment as a CTA; borrow detail and installment detail customised with what users need (learn from leading BNPL/installment apps: valU, Tabby, Tamara, Klarna, Affirm).

D6. Income/Paydays. "Paydays" is hard to understand. Owner idea: page = income hero + list of income sources (like Accounts' provider list), tap -> detail with the payday timeline and actions (confirm receipt / log). Decide (a) page name: "Income" or a better one-word name; (b) source detail as page vs sheet; (c) the clear "Add income" CTA placement.

D7. Flow's weekly streak card ("check your week") is not understood as part of the loyalty tiers (Free -> founders/Pro sparks), and its sheet is weak. What should the card say/show, and how should the sheet explain the link to tiers and rewards?

D8. Card faces: replace "Metallic" with "Modern" (generative/parametric textures like a voxel-wave black card, available in several colours the user picks) and rename "Real bank" to "Classic" (designs inspired by real, award-winning bank cards such as HSBC, without copying brands). Which texture families for Modern, and which classic styles?
