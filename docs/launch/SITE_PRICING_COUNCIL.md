# Site pricing: show or tease (council, 2026-11-28)

Question: before the store listings are approved, should the website show the actual Pro and Sparks prices, or say "announced at launch"?

| Voice | Position |
|---|---|
| Architect | Show. The prices are already set in App Store Connect, a visible price filters the waitlist toward real buyers, and a pricing page with no price reads as hiding something. |
| Skeptic | Show, as planned prices. "Show vs tease" is the wrong question; the real one is how to be honest about numbers that are not locked. Lead with Free and the trial, keep Sparks to one line. |
| Pragmatist | Show. The low local price (EGP 69.99 is under USD 2) is a selling point, and Pro time as a reward means nothing without a visible price. Sparks go below the fold. |
| Critic | Show, with a dated disclaimer. Never word a Founder or invite reward in price terms, so a price change cannot break a promise. Show only the three anchor markets. |

## Verdict (applied)

- **Show the prices**, labelled "Planned launch prices. The final price is shown in the app before you pay." with a "Prices as of" date.
- **Lead with Free forever plus 30 days of Pro, no card.** The price comes second.
- **Three anchor markets only:** Egypt (EGP 69.99 a month, EGP 499.99 a year), UAE, Saudi Arabia and Qatar (19.99 / 99.99 in local currency), everywhere else (USD 4.99 / USD 24.99, other regions see their store's local price). The source is the `pro_monthly` / `pro_annual` rows in `docs/launch/STORE_SETUP.md`.
- **Sparks:** one line, "Optional one-time AI top-ups from USD 0.99 (EGP 9.99 in Egypt), never expire". No pack ladder and no bonus percentage (the spec and app copy still disagree, see `STORE_COPY_V4.md` owner notes).
- **Rewards stay in Pro days, never in money.** The Founder Club and invite copy never quotes a price or a discount.
- No crossed-out price, no "founding price" (same rule as the paywall).
- **Strongest dissent:** the Critic's point that a published number becomes a promise. That is the reason for the label and the date, and why the site reads the app's own anchors (`PRO_ANCHORS` in `src/components/features/billing/planBilling.ts`) instead of a second copy of the prices. Update it the day the listings go live.
