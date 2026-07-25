# Savings Redesign — Handoff Brief for Claude Design

Redesign the Buddget **Savings** surface, matching the quality bar of the completed Expenses,
Income, Debt and Payment Methods redesigns. Read `docs/DESIGN_SYSTEM.md` first — all colour
tokens, spacing, border-radius, touch targets (44×44 min), safe-area classes and typography must
conform. Mobile-first, RTL-ready (Arabic), light and dark. **Creative direction is yours** — the
structure below is the contract, not the visual design.

## Structure

Two sub-tabs, **Savings** and **Investment**, in the established tab pattern (as Debt uses).

## Savings tab

- Pockets, each showing **one** number labelled **Saved** (what the user put in).
- The system **"Monthly Savings"** vault: visually distinct and undeletable — it's the app's
  holding place for money not yet assigned to a real pocket. The user can move money out of it.
- **This month: Target vs Saved** — the headline stat (e.g. "Target 2,000 · Saved 2,350").
- **Emergency fund** — months of expenses covered by liquid savings.
- **Savings rate** with a short trend.
- A **filterable ledger** (by pocket, type, date).

## Investment tab

- Pockets show **Invested** and **Value** with the gain/loss **delta** (savings pockets never do —
  there, Saved and Value are always identical, so only one number appears).
- A pocket is a **container of holdings**: a Gold pocket holds 24k / 21k / 18k line items; a Crypto
  pocket holds BTC and ETH. Value = Σ (quantity × live price).
- An **allocation donut** across everything (concentration at a glance).
- A **gold detail** view: karat breakdown, the **local-vs-global gap**, and — for Egyptian users —
  the **Sagha-dollar vs official-dollar** spread (a genuinely useful signal there).

## The one rule for adding money

Adding to a pocket asks **exactly one question**:

> **Where is this money coming from?**
> ○ **From this month's budget** — reduces what you have left to spend
> ○ **Money I already had** — outside your budget; doesn't affect this month

No accounting vocabulary anywhere in the UI (no "allocate", "declare", "cash flow", "transfer type").

## Trust, not error states

Every price-derived number carries an **"as of" timestamp** and a **confidence indicator**
(exact / high / low / single source / unavailable). **Unavailable must read as genuinely
unavailable — never as zero.** Treat this as a trust feature, not an error.

## Two copy problems to solve

1. **The carry can exceed "left to spend."** At month end the amount swept into savings can be
   *larger* than the "left to spend" figure shown during the month, because money reserved for the
   savings target carries too. This is correct but surprising — it needs wording that makes it feel
   right, not like a bug.
2. **Karat-unconfirmed holdings.** Some migrated gold holdings are flagged "karat unconfirmed" (we
   assumed 24k when we couldn't know). Needs a low-friction way for the user to confirm whether
   their grams are 24k, 21k or 18k.

## Out of scope

No price projections, forecasts, or investment advice — anywhere.
