# Buddget — Income Handoff

Developer handoff for the redesigned **Income page** and **Add-Income modal**. Build to 100% fidelity — zero deviation.

## What's here
- **`Income Handoff.dc.html`** — the full spec (open in browser, or print to PDF). Covers data model, money math, every screen with specs, reuse rules, interactions, visual tokens, and an acceptance checklist. **Start here.**
- **`screens/`** — 9 full-size, high-res reference screenshots:
  - `01-income-page.png` — full page
  - `02-payday-selected-mark.png` — recurring card, payday selected + Mark CTA
  - `03-amount-received-sheet.png` — amount sheet (received/partial)
  - `02-04-assign-sheet.png` — assign hero slider (page)
  - `02-05-add-recurring.png` — Add income, Recurring tab
  - `02-06-add-onetime-assign.png` — Add income, One-time + assign
  - `02-07-payment-carousel.png` — payment selector *(reused component)*
  - `02-08-currency-sheet.png` — currency sheet *(reused component)*
  - `02-09-calendar.png` — date picker *(reused component)*
- **`doc-page.js`** — runtime for the printable doc only (not part of the product).

## Source of truth (match these exactly)
- `Buddget Income.dc.html` — the Income page
- `Income Form.dc.html` — the Add/Edit income modal
- `Currency Sheet.dc.html` — the reused currency selector

## ⛔ Do NOT rebuild — reuse the app's existing components
- **Payment-method card carousel** ("Received into")
- **Unified Calendar** (one-time "Received on")
- **Unified Currency Sheet** (currency field)

Mount them as-is; do not restyle or fork.

## Must-honor behaviors
- Projected (**Expected**) and actual (**Received**) are never merged; one-time shown separately.
- Recurring = one-card-per-swipe carousel, all cards equal height, payday chips on one line.
- Payday select → single glassy **Mark** CTA → amount sheet; input color white → green (matches) → blue (partial); status derived from amount. Overdue stays *awaiting*, never auto-missed.
- Assign = the same recurring hero slider with tap-to-select tick, next-awaiting soft-glow default, glassy-red CTA, red dots.
- Add modal: Recurring/One-time **tabs** above an **independent** Type; 3-row payday grid; one-time date pill; **no** status control.
- All sheets: tap-out **and** swipe-down to close; background scroll-locked while open; hardware/gesture back closes **one layer at a time** (secondary → primary → leave).
