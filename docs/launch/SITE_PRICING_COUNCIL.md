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

# Part 2: invites before launch, and old captures (council, 2026-11-28)

The owner asked: no Founder spots counter (keep "limited seats" honest: only 100, ever); the waitlist invite must look and work like the app's (guest pass, its own landing); decide `/i/<code>` and the old-design captures by council.

| Voice | `/i/<code>` before launch | Waitlist rewards | Old captures |
|---|---|---|---|
| Architect | Keep the guest pass and cookie; main button becomes "Join the waitlist" with the code | Server bridge into the app's own referral rules | Recapture if redesigned |
| Skeptic | Same; never send newcomers to `/flow` | Promise nothing; email matching is fragile | Drop until recaptured; never English on Arabic pages |
| Pragmatist | Same; flip to stores with one flag | Small bridge; pending until the inviter has an account | Check v9 first; fix the Arabic chat first |
| Critic | Same; update the tests deliberately | Dedicated bridge, caps and native activation still apply, one referrer per invitee | Swap or drop now; recapture later |

## Verdict (applied)

- **`/i/<code>`:** the app's guest pass stays (code cookie, inviter name). While `STORE_LIVE` is all false, "Join the waitlist" leads to `/<lang>/waitlist/invite?ref=<code>` and "I already have buddget" still signs existing users in. Unit test and e2e R11, R11b and J5 were updated to this contract.
- **Waitlist guest pass:** after joining, each member gets the app's guest pass card ("37 Days of Pro", signed with their first name, their code), with share and copy. The shared link opens a dedicated invite landing, "<Name> sent you a guest pass", with the pass and the join form. That page is kept out of search.
- **Rewards are real (bridge, migration 0369):** a daily cron (`/api/cron/waitlist-referrals`) records the in-app referral through `referral_redeem` once the invitee has a confirmed account under the same email.
  - Every existing invite rule still applies: one per person and mailbox, no self or same-device invites, the inviter is paid only after the friend activates on a phone, caps of 4 a month and 12 a year, and the friend's trial gets +7 days.
  - Only the "code older than the account, under 7 days" rule is replaced, and only in waitlist mode: the account must be under 14 days old and the invitee's waitlist row must prove the link.
  - An in-app code on the row wins over a waitlist referrer.
- **Strongest dissent (Skeptic):** email matching misses people who sign up with a different email or Apple's hidden address. The pass says "same email in the app" on its back and in its terms, and a miss costs a reward, never money.
- **Old captures:** quick add, subscriptions and reports have no v9 capture, so their pages show no phone. Arabic pages show no phone for the English Buddgy chat. Recaptured the same day: `e2e/ui/store-shots.mjs` shots 18-24 (quick add, subscriptions, insights, Arabic Buddgy, plus Arabic variants), run against the branch's Vercel preview (council part 3).
- **Founder Club:** no counter. The copy says "Only 100 seats. Ever.", that numbers are never reissued, and that the club closes when the 100 are taken.

# Part 3: capture from the preview, not a local dev server (council, 2026-11-28)

The owner asked whether capturing from the already-built preview beats a local dev server. Architect, Skeptic and Pragmatist said preview: it is faster with nothing to compile, it shows the production build that ships, and it keeps the no-dev-server rule. The Critic said local: the preview sign-in was untested, and a half-working session could give plausible but wrong screenshots.

**Verdict:** use the preview, with the Critic's risks turned into required guardrails:
1. The deployment SHA equals the pushed HEAD.
2. The preview uses the seeded Supabase project.
3. The session comes from the auth API, with cookies written by `@supabase/ssr`; no password is typed into the page.
4. The run stops unless seeded data is visible.
5. Synthetic users are cleaned up, and 0 are left.

The owner made this the rule for all future runs (CLAUDE.md, "Tests run only when the owner asks").
