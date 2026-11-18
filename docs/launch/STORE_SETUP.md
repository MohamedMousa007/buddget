# Store setup: App Store Connect and RevenueCat (iOS)

State as of 2026-11-18. Everything below was created through RevenueCat's App Store Connect integration; nothing has been submitted to Apple's review yet (products go in with the next app version).

## Identifiers

| Thing | Id |
|---|---|
| RevenueCat project | `projb9480b99` (dashboard `b9480b99`) |
| RevenueCat iOS app | `app5008c2628f`, bundle `app.buddget` (test store `app79df340a6c` keeps the two sample products) |
| Entitlement | `buddget_pro` (`entlf059063abf`): `pro_monthly`, `pro_annual` and the two test-store products |
| Offering | `default` (`ofrng2f566520c6`, current): `$rc_monthly` -> `pro_monthly`, `$rc_annual` -> `pro_annual` |
| Webhook | `buddget server` -> `https://buddget.app/api/billing/revenuecat`, all events |
| Subscription group | `Buddget Pro` (22586479), EN and AR group names |

## Products (App Store Connect, all `READY_TO_SUBMIT`)

| Store id | Type | Where | Base prices | RevenueCat id |
|---|---|---|---|---|
| `pro_monthly` | subscription 1M | all | EGP 69.99, AED/SAR/QAR 19.99, USD 4.99 (+ the price file) | `prodc5ccfbb979` |
| `pro_annual` | subscription 1Y | all | EGP 499.99, AED/SAR/QAR 99.99, USD 24.99 | `prod0ad078c15f` |
| `sparks_60` | consumable | Egypt only | EGP 9.99 | `prodd147bde401` |
| `sparks_125` | consumable | Egypt only | EGP 19.99 | `prod1590e273c2` |
| `sparks_320` | consumable | all | USD 0.99, EGP 49.99, AED 3.99, SAR 3.99 | `proda672624d98` |
| `sparks_650` | consumable | all | USD 1.99, EGP 99.99, AED 7.99, SAR 7.99 | `prod6a4746ceae` |
| `sparks_2000` | consumable | all | USD 4.99, EGP 299.99, AED 18.99, SAR 21.99 | `prod7d24d8173c` |

Every product has EN + AR name and description, review notes, and a real review screenshot from the app (a stand-in member, `docs/design/pro-rewards/store/review/`). Both subscriptions have the privacy policy URL. No introductory offer on purpose: the 30-day trial is granted in-app without a card.

## Stay (retention) offers, board 3-0 / council majority, 2026-11-18

Same terms in every market; Egypt is the thin one and stays above its AI cost ceiling (USD 0.45 a month) in both cases.

| Product | Offer id | Terms | Egypt | AE/SA/QA | USD |
|---|---|---|---|---|---|
| `pro_monthly` | `stay30_2m` | 30% off, pay as you go, 2 months | EGP 48.99 | 13.99 | 3.49 |
| `pro_annual` | `stay_annual_20` | 20% off, one year paid upfront | EGP 399.99 | 79.99 | 19.99 |

Other territories are Apple's equalised price from USD. Rules the app must enforce (Apple does not): one redemption per account per lifetime, checked on the server; lapsed users only after 30 days away; shown once when someone taps to cancel, never stacked with points-shop discounts, no points for accepting. Offer terms cannot be edited: to change one, create a new id and delete the old. Deleted ids (`stay_half_3m`, `stay_annual_30`) can never be reused.

**Built (migration 0317):** on iOS, "How to cancel" in the Manage sheet first asks `GET /api/billing/stay-offer`, which reads `stay_offer_state` (entitlement status, source, product, `user_entitlements.stay_offer_redeemed_at`, an EXPIRATION in the last 30 days) and applies the rule in `src/lib/billing/stayOffer.ts`. Eligible members see one card (title, what they keep, "Stay with Pro", "Cancel anyway"); the button signs the App Store discount through RevenueCat (`purchaseWithOffer`: `getPromotionalOffer` then `purchaseDiscountedPackage`). The redemption is stamped twice, idempotently: by the app right after the purchase (`POST /api/billing/stay-offer`) and by the webhook when a RENEWAL or INITIAL_PURCHASE carries the offer in `offer_code` or `discount_identifier`. Android and web go straight to the cancel steps.

**Apple retention messaging (App Store Connect, 2026-11-18):** message `buddget pro` (Prepare for Submission, not yet added for review) is shown on Apple's own cancel sheet for both subscriptions. EN + AR header and body (benefits only, no prices, as Apple requires); no image yet (3840 x 2160 optional). Each subscription carries its own retention offer, same terms as the in-app stay offers; these are separate Apple objects with their own ids:

| Product | Retention offer id | Terms | Egypt | AE/SA/QA | USD |
|---|---|---|---|---|---|
| `pro_monthly` | `retain_monthly_30` | pay as you go, 2 months | EGP 48.99 | 13.99 | 3.49 |
| `pro_annual` | `retain_annual_20` | pay up front, 1 year | EGP 399.99 | 79.99 | 19.99 |

Eligibility: paid for at least 1 month, 24 months between offers, all 175 territories. Apple's auto-conversion was wrong for our markets (it proposed EGP 999.99 and EGP 199.99, and Poland at full price), so those were set by hand; check every row after any edit. The webhook treats both ids as the account's one stay offer (`APPLE_RETENTION_OFFERS` in `stayOffer.ts`), so a member who takes Apple's offer never also gets the in-app one. Sparks packs are consumables and cannot have retention messages.

**Not built yet:** Apple's win-back offers for lapsed subscribers.

## Owner steps still open

1. Vercel: `NEXT_PUBLIC_REVENUECAT_IOS_KEY` (public SDK key from the RevenueCat app page), `REVENUECAT_WEBHOOK_AUTH` (the Authorization header value set on the webhook in RevenueCat), `REVENUECAT_WEBHOOK_HMAC_SECRET` (the webhook signing secret). The server refuses every event until both webhook values are set.
2. App Store Connect, app level: turn on the Billing Grace Period (3 days, all renewals, production and sandbox; owner choice 2026-11-18); set the App Store Server Notifications V2 URL to the one RevenueCat shows on the iOS app page; confirm the Paid Apps agreement, banking and tax are active; confirm Small Business Program enrolment (the 15% the plan assumes).
3. Optional: upload `docs/design/pro-rewards/store/buddget-pro-*-card-1024.png` as each subscription's promotional image (Apple shows it in the App Store subscription list); decide Family Sharing (off; cannot be turned off again once on).
4. Android: a Google Play service account in RevenueCat, then the same products in Play Console (`pro_monthly:monthly`, `pro_annual:annual`, the packs).
5. Submit the in-app purchases with the next app version and run one sandbox purchase of each kind.

## Android (Google Play): progress

- Play Console developer account created (personal, trader declared); identity verification pending with Google, so creating the app is blocked until it clears.
- Google Cloud project `Buddget` (`gen-lang-client-0929604237`, owned by the same Google account): Google Play Android Developer API, Google Play Developer Reporting API and Cloud Pub/Sub API enabled.
- Service account `revenuecat@gen-lang-client-0929604237.iam.gserviceaccount.com` with Pub/Sub Admin and Monitoring Viewer only.
- Service account JSON key created by the owner and kept offline (not in the repo).
- RevenueCat Play Store app `app86a098cc89` (`buddget Android`, package `app.buddget`) created 2026-11-18; credentials not uploaded yet.
- Next (owner): create its JSON key (Keys -> Add key -> JSON), keep it with the App Store keys. After Play verification: create the app, invite the service account in Play Console with View app information, View financial data, Manage orders and subscriptions; add a Play Store app in RevenueCat for `app.buddget` and upload the JSON; connect Google developer notifications and paste the topic in Play Console's Monetization setup.

## Re-running

Prices and offers are read live from Apple with `get-product-store-state`; changes go through `create-product-store-state-plan` -> plan -> apply (review the diff first). Review screenshots: `upload-product-store-state-screenshot` reserves a slot, PUT the bytes to the returned URL, then set `screenshot_id` + MD5 in a plan.
