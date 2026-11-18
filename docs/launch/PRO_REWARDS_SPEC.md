# Pro, Rewards, Founders and Invites: build spec (final)

Owner sign-off: 2026-11-17 (night). This file is the single source of truth for the build. Where it differs from `docs/PRO_REWARDS_BUILD_PLAN.md` or older launch docs, **this file wins**.

- **Design source (zero deviation):** `docs/design/pro-rewards/mockup.html`. Open it in a browser. It has six phones: Plan and billing, Rewards, Founders club, Invite friends, Profile badges, Usage. Toggles switch Free/Trial/Pro, the tier, and Light/Dark. Build the UI exactly as drawn in both themes. New components are allowed where the design needs them (the owner approved this in words), but build them as reusable components with tokens, 44px touch targets, RTL and Arabic copy, and `prefers-reduced-motion` fallbacks.
- **Owner's price files:** `docs/design/pro-rewards/prices-monthly.csv` and `prices-annual.csv` (App Store price per country).
- **Live store state (what exists in App Store Connect and RevenueCat, stay offers, owner steps):** `docs/launch/STORE_SETUP.md`.

## 0. Owner decisions that override earlier rules

1. **Nothing is hidden.** Turn the billing switch on (`platform_settings.billing.enabled = true`). All pages are visible to every user now. Store purchases will not work until RevenueCat is configured tomorrow, so every buy button must fail gracefully (existing `purchasesAvailable` path: show the "not available yet" state, never crash).
2. **All existing users become Free tier and founders** (test data; it will be reset at launch). Give every existing account a founder number (ordered by sign-up date), plan Free, no trial side effects. The owner approved this live-database write in his own words.
3. **Live database:** Supabase project `tzioppxwsljhlglyducm`. Migration first, apply it, regenerate `src/lib/supabase/database.types.ts`, then code.
4. No native build and no store upload in this work.

## 1. Prices

- **Pro** (display anchors and docs; the store supplies the real localized price at runtime):

  | Country | Monthly | Yearly |
  |---|---|---|
  | Egypt | EGP 69.99 | EGP 499.99 |
  | UAE | AED 19.99 | AED 99.99 |
  | Saudi | SAR 19.99 | SAR 99.99 |
  | Qatar | QAR 19.99 | QAR 99.99 |
  | USD countries | USD 4.99 | USD 24.99 |

  Other countries are in the CSV files. Store product ids stay `pro_monthly` / `pro_annual`.
- **Sparks packs** (new sizes and ids; prices unchanged except Saudi's largest):

  | Product id | Sparks | Egypt | UAE | Saudi | USD |
  |---|---|---|---|---|---|
  | `sparks_60` | 60 | EGP 9.99 | Egypt only | Egypt only | Egypt only |
  | `sparks_125` | 125 | EGP 19.99 | Egypt only | Egypt only | Egypt only |
  | `sparks_320` | 320 | EGP 49.99 | AED 3.99 | SAR 3.99 | USD 0.99 |
  | `sparks_650` | 650 | EGP 99.99 | AED 7.99 | SAR 7.99 | USD 1.99 |
  | `sparks_2000` | 2000 | EGP 299.99 | AED 18.99 | SAR 21.99 | USD 4.99 |

  Replace the rows in `spark_products` (old ids `sparks_70/150/400/900/2500`).
- **Pack bonus:** Pro +15% (`sparks_bonus.proPercent = 15`). A Pro member at Diamond or above gets **+20%** ("loyal Pro"). Free members get no pack bonus. Bonus Sparks are clawed back with the pack on refund.
- **Egypt-only Pro AI limit:** 100 AI credits a week and 300 SMS AI calls a month for Pro members whose store country or base currency is Egypt; everyone else keeps 150 / 450.

## 2. Loyalty (the "recommended" model)

- **Points** (unchanged values): +10 kept week, +10 budget set (once a month), +40 month fully tracked.
- **Streak multiplier** on the weekly points: x1.5 from week 4, x2 from week 8. A missed week without a freeze drops one step (x2 to x1.5 to x1), not to zero.
- **A kept week must be real:** at least 3 reviewed/confirmed transactions in that week.
- **Tiers by lifetime points, never lost to a missed week:**

  | Key | Name | Lifetime points | Extra condition |
  |---|---|---|---|
  | `silver` | Silver | 0 | |
  | `emerald` | Emerald | 300 | |
  | `diamond` | Diamond | 800 | |
  | `elite` | Elite | 1,500 | active Pro (trial counts) |
  | `founder` | Elite Founder | 1,500 | a founder who qualifies for Elite |

  If Pro is not active, an Elite member shows as Diamond; Elite returns when Pro does. Replace the draft tiers (seed/sprout/tree). Tiers are switched ON.
- **Freezes:** 1 per 8 kept weeks (max 2 banked) for everyone; Emerald and above earn 1 per 4 kept weeks. A `loyalty_seasonal_freezes` dates table auto-freezes listed weeks (seed Ramadan and Eid weeks for 2027 and 2028).
- **Spark gifts** (reward bucket, valid 12 months, spent before bought Sparks, separate from `spark_purchases`): reaching Emerald 10, Diamond 20, Elite 30; streak 12 weeks 10, 26 weeks 20, 52 weeks 40.
- **Points shop** (spends `points_balance`, never lowers the tier): repair a missed week within 48 hours 120 pts; a streak freeze 80 pts; a card finish 150 pts; a Buddgy look 120 pts. Freeze and repair must work fully. Card finish and Buddgy look: store ownership and apply at least one real alternate finish/look each; if the art for more is not available, ship one of each and say so in the report.
- **Earn list on the Rewards page:** show the real rules (the mockup's +50/+5/+100/+150 are placeholders): kept week +10 (x1.5 / x2 with your streak), budget set +10, month fully tracked +40.
- **Not in this build** (leave clean seams, list in the report): alternate app icons, monthly recap share card, store offer codes (first month EGP 35, win-back).

## 3. Invite a friend (board decision, 3 of 3)

- **Friend:** the normal 30-day Pro trial plus 7 days = **37 days**, only when joining through an invite link or code. No card.
- **Inviter:** **1 week of Pro per activated friend**, granted by our server (promo entitlement). Weeks are banked and start when the current trial or Pro time ends. An inviter who is already a paying store subscriber gets **500 Sparks** instead (reward bucket).
- **Activated** = the friend used the app on 3 separate days and logged at least 5 transactions within their first 14 days. Sign-up alone earns nothing. Show pending friends with progress ("Active 2 of 3 days").
- **Caps:** at most 4 rewards per calendar month and 12 per year.
- **Milestones** (on activated friends): 3 friends +50 pts, 5 friends +100 pts, 10 friends the "Connector" card finish.
- **Guards:** one reward per new account and per device; no self-invite (same device or same user); only accounts created after the invite; claw back if the friend's account is deleted within 30 days; a server-side kill switch (`platform_settings.referrals.enabled`).
- **Link and code:** every user has a short code (for example `LAYLA-7K2`); link `https://buddget.app/i/<code>` (web route that stores the code and sends people to sign up or to the store); the sign-up flow accepts a code; native deep link if cheap, otherwise the code field.
- **Call-to-action placements:** the Invite page (Settings), the invite card on the Rewards page and on the profile/settings hub, a row on Plan and billing, and on the trial-ending notice ("Not ready to pay? Invite a friend and keep Pro another week").

## 4. Screens (all from the mockup)

- **Plan and billing** (`/settings/pro`): flip card with hover light, tier badge after the name, 3 facts including the member number, the four-action manage bar (Change plan, Manage, Restore, Receipts), "Pro this month" panel from real usage, history including Sparks, Free showcase with the comparison, plans block.
- **Usage** (`/settings/pro/usage`): meters with credit amounts, Sparks with packs inline, gold Most popular, More packs, bonus line, where the limit went, other limits.
- **Rewards** (`/settings/rewards`, new): Letterpress tier card on the flip rig (per-tier stock and foil, back shows perks), hot streak strip (12 weeks, freezes), invite card, tier ladder with badges and "you're here", badge placements, Earn points, Spend points (shop).
- **Founders club** (`/settings/founders`): signature card on the rig with a back face; keep the existing credit-name form, credits list and share.
- **Invite friends** (`/settings/invite`, new): as drawn.
- **Profile / settings hub:** option A. Gold PRO tag on the avatar for Pro and trial; tier badge after the name everywhere a name shows; founders get the gold and emerald avatar ring and the numbered gold chip.
- **Arabic:** all new copy in EN and AR (the app's i18n pattern). The script signature font has no Arabic glyphs: Arabic names use the app font.
- **Motion:** flip on tap with the spring; pointer tilt and the hover light only for fine pointers; reduced motion shows a still card.

## 5. Admin tools (owner and admins)

In the admin portal (`src/components/features/admin`, `src/app/api/admin`), with new permission keys in `src/lib/admin/permissions.ts`, granted to owner and admin roles by default and adjustable in the staff screen like the others:

- `billing.grant`: grant or remove Pro manually for a user (promo, with an end date or "until removed"), start or end a trial.
- `sparks.manage`: add or remove Sparks for a user (reward bucket or purchased-type test grant), with a reason; see their Sparks ledger.
- `loyalty.manage` (exists): adjust points, set or lock a tier, add freezes, set the streak, make or remove a founder (and number), reset a user's loyalty.
- `referrals.manage`: see a user's invites and rewards, approve or revoke a reward, mark a friend activated (for testing), toggle the referral kill switch.
- Platform switches: billing on/off, tiers on/off, referrals on/off, Spark gifts on/off.
- Every action writes the existing admin audit log.

## 6. Order and ownership

Sessions share one checkout. **Add only your own paths, never `git add -A`. Commit with `git commit -m "..." -- <your paths>`. Do not push.** The lead session runs `npm run verify` and pushes at the end.

| Phase | Session | Owns |
|---|---|---|
| 1 | Backend | `supabase/migrations/**`, `src/lib/supabase/database.types.ts`, `src/app/api/**` except `api/admin`, `src/lib/loyalty/**`, `src/lib/billing/**`, `src/lib/usage/**`, `src/lib/server/**`, `src/lib/referrals/**`; writes `docs/launch/PRO_REWARDS_CONTRACT.md` |
| 1 | Components | `src/components/features/membership/**` (new presentational components only, prop-driven, no data fetching), their tests |
| 2 | Pages | `src/app/(app)/settings/**`, `src/app/i/**`, `src/components/features/billing/**`, `src/components/features/usage/**`, `src/components/features/rewards/**`, `src/components/features/invite/**`, settings hub and profile components, `src/lib/i18n/**` |
| 2 | Admin | `src/components/features/admin/**`, `src/app/api/admin/**`, `src/lib/admin/**` |
| 3 | Lead | `npm run verify`, diff audit, push to dev and main |
