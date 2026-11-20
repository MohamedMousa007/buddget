# Findings D: billing and subscription management (BDG-019 to BDG-022)

Investigator D, 2026-11-20. Read-only: code, migrations and docs only. No store, RevenueCat or database call was made.

## Two premises in the brief are wrong

1. **The stay offer is merged and shipped.** `claude/practical-khayyam-2539d2` (tip `5b5630d0` "Stay offer: show the retention offer once when an iOS member taps How to cancel") is an ancestor of `origin/main` and of `75e4ce8c` (iOS 146 / Android vc180). Commits `c3e49cd3` (Apple retention offers), `96d10473` (configure once) and `70e5cced` (S8g fixes) are in the build too. `git diff 75e4ce8c origin/main` shows no change under `src/lib/billing`, `src/components/features/billing`, `src/components/features/usage`, `src/components/features/membership` or `src/app/api/billing`. **The shipped build and main run the same billing code**, so every finding below applies to iOS 146 as it stands.
2. **PayTabs does not exist.** The only `paytabs` string in `src/` is a merchant-name regex (`src/lib/sms/merchantDictionary.ts:15`). There is no web checkout, no web subscription table, and no cancel API. On the web nothing can be bought: `purchasesAvailable()` is false off native (`src/lib/billing/purchases.ts:32-34`), and `manageSubscriptionUrl('web')` returns null (`purchases.ts:21-24`). The pricing record names Paymob or Fawry for a future web rail, not PayTabs, and says it "is not built now" (`docs/launch/S5a-pricing.md:279-281`). So "PayTabs API cancel" and "web plus store double pay" describe a system that has not been built. Anything web-side is new backend work.

Also relevant: **Android cannot sell at all.** `.env.local` has no `NEXT_PUBLIC_REVENUECAT_ANDROID_KEY` (only the iOS `appl_` key is set; `scripts/native-env.mjs:86-88` only warns). Play products are not created (`docs/launch/STORE_SETUP.md:224`). So on Android every buy button shows the "not available yet" note.

---

## BDG-019: "Keep Pro" does nothing on iPhone

| Field | Content |
|---|---|
| Issue ID | BDG-019 |
| Summary | On the trial page, a "Keep Pro" tap with no store package loaded writes its error note above the button, not beside it, so nothing seems to happen. When a purchase does go through, the app shows "Welcome to Pro" without waiting for a verified transaction. |
| Severity | P1 (the trial-to-paid path, which is the only revenue path; plus a false success) |
| Reproducibility | Unconfirmed on a device. In code it is deterministic: open Settings > buddget Pro as a trial user on iOS while the store offerings are empty, then tap "Keep Pro" under "Keep Pro after <date>". |
| Platform | iOS (Android always gets the not-available note, see above; on the web the "cancelled" banner button is a true no-op) |
| Affected components | `src/components/features/billing/ProStateView.tsx:115-118,192,237,239-249`; `src/lib/billing/usePlanPurchase.ts:16-38`; `src/lib/billing/purchases.ts:45-82,134-143`; `src/lib/billing/billingSession.ts:8-14`; `src/lib/billing/billingStore.ts:53,80-87`; `src/components/features/usage/NoticeHost.tsx:69`; `src/lib/usage/usageNotices.ts:135`; `src/components/features/membership/ProPlanRow.tsx:16-21` |
| Backend dependencies | RevenueCat offering `default` (`$rc_monthly`, `$rc_annual`); App Store products `pro_monthly`, `pro_annual` (READY_TO_SUBMIT); webhook `POST /api/billing/revenuecat` -> `billing_apply` (0306); `GET /api/entitlements/me`; Vercel `REVENUECAT_WEBHOOK_AUTH` and `REVENUECAT_WEBHOOK_HMAC_SECRET` |

### Which "Keep Pro"

Three things carry that label. None of them is the stay offer, whose button reads "Stay with Pro" (`src/lib/i18n/membershipCopy.ts` `billing.stay.cta`).

| Where | Shown to | What the tap does |
|---|---|---|
| Trial panel CTA, `ProStateView.tsx:192` (`p.keep.cta` = "Keep Pro", `rewardsCopy.ts:356`) | Trial users on `/settings/pro` | `purchase()`, line 115: buys the chosen package |
| "Cancelled" banner action, `NoticeHost.tsx:69` (`usageCopy.ts:86`) | A member whose view is `canceled` (status canceled or `willRenew === false`), on the Pro screen only (`usageNotices.ts:135`) | `openManageSubscription()`: leaves the app for `apps.apple.com/account/subscriptions`. On the web it returns without doing anything (`purchases.ts:135-136`) |
| `ProPlanRow` pill "Keep Pro", `ProPlanRow.tsx:18` | Trial ending soon, in Settings and the profile menu | Not a button. It is a `Badge` inside a row that links to `/settings/pro` (lines 51-57) |

Testers today are on trial (billing is on, everyone starts Free plus a 30-day trial). A sandbox cancellation is the only way to reach the "cancelled" banner. So **the trial CTA is almost certainly the button the owner tapped.**

### The path from that tap

`ProStateView.tsx:115-118`:
```ts
const purchase = async () => {
  if (!store || !chosen.option) return setNote(p.notYet)
  if (await buy(chosen.option)) { setSheet(null); useUsageStore.getState().setWelcome('new') }
}
```
- `store` = `purchasesAvailable()`, which needs native plus the iOS key. The key is baked in by `npm run cap:build`, and `native-env.mjs:85` fails the build without it. So `store` is true on iOS 146.
- `chosen.option` is null whenever `usePlanPurchase` holds no packages. `planDisplays` then falls back to the owner's prices with `option: null` (`planBilling.ts:69-75`).
- The note is drawn only at line 237: `{note && sheet === null ? <p …>{note}</p> : null}`, right under the ManageBar, **above** the trial panel. The button itself sits at the end of the panel (lines 239-249), so the note is several hundred pixels away and often scrolled out of view, especially after "Choose plan" scrolls the panel to the centre (line 153). A second tap sets the same text, so nothing changes. No loading state shows either, because `busy` never becomes true on this path. Compare `PlansView.tsx:98-101`, where the note sits directly under the button.
- With a package, `buy()` (`usePlanPurchase.ts:27-38`) sets `busy` (the button shows its spinner) and calls `Purchases.purchasePackage`. "failed" writes `purchaseFailed` to the same misplaced note. "cancelled" writes nothing, which is correct.

### Ranked causes of "nothing happens"

1. **(Most likely) Offerings come back empty, so the not-available note lands out of sight.** Confirmed in code: `loadPackages` (`purchases.ts:69-73`) returns `offerings.current?.availablePackages`, and a thrown `getOfferings` becomes `[]` (`usePlanPurchase.ts:19`). Hypothesis for the store side: StoreKit returns no products for `pro_monthly` / `pro_annual`. The usual reasons are:
   - The Paid Apps agreement, banking or tax is not active. This is still an open owner step to *confirm* (`STORE_SETUP.md:57`, `:229`).
   - The products are not available in the tester's storefront.
   - A bundle or product id does not match.

   READY_TO_SUBMIT alone does not block sandbox. A product with complete metadata can be bought in sandbox and TestFlight before its first review. Treat "Ready to submit" as unverified, not as the blocker.
2. **One-shot load race (confirmed in code, intermittent).**
   - `loadPackages` returns `[]` immediately while `configuredFor === null` (`purchases.ts:70`).
   - The SDK is configured in `BillingHost`'s effect, which only fires once `billingEnabled` arrives (`BillingHost.tsx:39-41`). `startPurchases` is not awaited (`billingSession.ts:10`) and needs a dynamic import plus a native `configure`.
   - The `usePlanPurchase` effect runs once per mount (`usePlanPurchase.ts:16-21`, deps `[active]`) and never retries.
   - The page mounts `ProStateView` in the same render that delivers `me`, because `PlanPending` shows until then (`settings/pro/page.tsx:35`). So the first visit after a cold start gets `[]` and keeps it until the page remounts.
3. **Configure fails silently.** `startPurchases(userId).catch(() => undefined)` (`billingSession.ts:10`). Any configure error leaves `configuredFor` null, so the result is the same as cause 2, on every visit.
4. **False success, then the trial page again (confirmed in code).**
   - `isPaidPlan` is `planKey !== 'free'` (`billingStore.ts:53`). A trial (`plus_trial`) already counts as paid.
   - So `refreshUntilPaid()` returns true on its first read (`billingStore.ts:80-86`), whatever the webhook did.
   - `buy()` also ignores that result and returns `outcome === 'purchased'` (`usePlanPurchase.ts:32-37`).
   - The app therefore shows "Welcome to Pro" with no server confirmation. If the webhook is refused, the page then falls back to the trial view with "Keep Pro". The webhook answers 503 until both Vercel secrets are set (`revenuecat/route.ts:23-28`, `STORE_SETUP.md:56`).
   - A second tap makes StoreKit say "already subscribed". Plausibly that looks like "nothing".
   - The same flaw hits Restore: `restore()` (`usePlanPurchase.ts:41-48`) reports "Restored" for a trial user even when nothing was restored, because RevenueCat's restore resolves without error when there is nothing and `refreshUntilPaid(3)` is true for a trial.
5. **The "cancelled" banner's Keep Pro opens a page with nothing on it (hypothesis).**
   - `openManageSubscription` opens `https://apps.apple.com/account/subscriptions` (`purchases.ts:8-10,134-143`).
   - TestFlight purchases are sandbox subscriptions. To my knowledge they do not appear on the production account page; they are managed under Settings > App Store > Sandbox Account.
   - A tester who cancelled in sandbox and taps Keep Pro sees no buddget subscription there. On the web the same button does nothing at all.
6. **Ruled out.**
   - Plugin missing: `@capacitor/app-launcher` and `@revenuecat/purchases-capacitor` 14.1.0 are wired in `ios/App/CapApp-SPM/Package.swift:18,30,42,54`.
   - Wrong key type: the iOS key prefix is `appl_`, not the test-store `test_`.
   - Feature switch off: the page redirects away when billing is off (`settings/pro/page.tsx:29-33`), so a visible Keep Pro means the switch is on.
   - Handler missing: none.
   - Web path taken on native: `getPlatform()` drives every branch.
7. **Stay offer (not this label, but the same journey).** `purchaseWithOffer` needs the discount on the product (`purchases.ts:91`) and RevenueCat to sign it (`getPromotionalOffer`, line 95). Signing needs an App Store In-App Purchase key (p8) uploaded to RevenueCat. `STORE_SETUP.md` never mentions one (hypothesis: missing). A failure here is visible: `stayNote` "The store did not finish the offer" (`ProStateView.tsx:140,288`). So it is not silent, but it is likely broken today.

### What a device log or sandbox run must show

- **Plan-card prices (a weak check).**
  - Fallback prices come from `money()` and look like `EGP 499.99` (`planBilling.ts:24`, `PRO_ANCHORS`), keyed on the profile country.
  - Store prices are StoreKit's `priceString` (`planOptions.ts:20`) for the Apple storefront.
  - The two can look the same, so this check only settles it when the sandbox account's storefront differs from the profile country (for example a US sandbox account shows USD from the store but EGP from the fallback).
- **Xcode or Console log with RevenueCat debug.** Look for `[Purchases] - ERROR … None of the products registered in the RevenueCat dashboard could be fetched from App Store Connect` (or a configuration error) after `getOfferings`. That confirms cause 1. No `configure` log line at all confirms cause 3.
- **Scroll up after the tap.** If "Buying isn't available on this device yet. Your plan stays as it is." sits under the Manage bar, causes 1 to 3 are confirmed.
- **If the StoreKit sheet does appear:** after a sandbox purchase, run the `billing_events` query below. No new `INITIAL_PURCHASE` row, together with a 503 in the RevenueCat webhook delivery log, confirms cause 4.

| Field | Content |
|---|---|
| Root cause | Confirmed UI defect: the note is drawn away from the button (`ProStateView.tsx:237` vs `:192`), and there is no pre-check or retry when packages are empty (`usePlanPurchase.ts:16-21`). Confirmed logic defect: success is shown without verification (`billingStore.ts:53`, `usePlanPurchase.ts:32-37`). Store-side emptiness (agreement, storefront, p8, webhook secrets) is a hypothesis to settle with the log above. |
| Evidence | Quoted inline above |
| Shared causes | BDG-020 (the same ManageBar and sheet), BDG-022 (`isPaidPlan` and the missed-webhook gap) |
| Proposed solution | (1) In `ProStateView`, render the note beside the CTA that set it, as `PlansView.tsx:101` already does. Give each CTA its own `role="status"` line. (2) `usePlanPurchase`: reload packages when the SDK becomes ready. Expose a `ready` promise or event from `startPurchases` and depend on it, instead of the one-shot `[active]`. While loading, the CTA shows `loading`. With no packages, it shows the disabled reason (`membershipCopy.plans.pricesUnavailable` already exists) plus Try again. (3) `billingSession.ts:10`: log the configure failure to Sentry and do not swallow it. (4) Verified success: after `purchased`, poll for a store-sourced entitlement (`me.subscription.fromStore && status in active/canceled`, or the RevenueCat `CustomerInfo.entitlements.active.buddget_pro` returned by `purchasePackage`). Show Welcome only after the server row changes. Otherwise show "Payment received, finishing up" with a retry, never Welcome. Fix `restore()` the same way, by comparing source before and after. (5) The cancelled banner: use `customerInfo.managementURL` from the SDK (in `purchases-typescript-internal` `customerInfo.d.ts:207`), and hide the button on the web. No migration. Reuse `usePlanPurchase`, `refreshUntilPaid` (narrowed), `PromptBanner`, `Button loading`. |
| Regression risk | The Welcome screen timing changes. Restore copy changes. A trial user who really bought but whose webhook is slow waits longer before Welcome. |
| Test that proves it | Unit (`src/lib/billing/billingStore.test.ts` or a new `usePlanPurchase.test.ts`): with `me` = trial, `buy()` while the server row stays trialing must not resolve true. Today it does. Component test (`ProStateView`): trial and empty packages, tap Keep Pro, and the status text sits inside the trial panel. Today it renders above it. Device: a sandbox purchase on TestFlight with the RevenueCat debug log. |
| Confidence | High that "nothing visible happens" when packages are empty, and that success is unverified. Medium on why packages are empty (store side unverified). |
| Missing evidence | Device log; whether the Paid Apps agreement is active; whether a p8 In-App Purchase key is in RevenueCat; whether the Vercel webhook secrets are set; the RevenueCat webhook delivery log. |

---

## BDG-020: Subscription page actions and the provider map

| Field | Content |
|---|---|
| Issue ID | BDG-020 |
| Summary | The Plan and billing page has 10 or more controls that mostly scroll, show text or leave the app. It has no real cancel, and the store it names follows the device, not the subscription. |
| Severity | P2 |
| Reproducibility | Consistent: open `/settings/pro` in each state |
| Platform | All |
| Affected components | `src/components/features/billing/ProStateView.tsx:124-158,262-316`; `src/components/features/membership/ManageBar.tsx`; `src/components/features/billing/PlansView.tsx`; `src/lib/billing/purchases.ts` |
| Backend dependencies | `user_entitlements` (status, will_renew, canceled_at, current_period_end, grace_ends_at, source, store, product_id, stay_offer_*), `billing_events`, `billing_apply`, `stay_offer_state` / `stay_offer_claim`, `/api/entitlements/me`, `/api/billing/stay-offer` |

### Every control as built

**ManageBar** (trial and member, `ProStateView.tsx:149-158`):

| Cell | Trial | Store member (native) | Non-store member (promo, admin, banked weeks) or web |
|---|---|---|---|
| Choose plan / Change plan | **Scroll only** to the Keep panel (line 153) | Leaves the app for the device's store subscriptions page | Opens the "plans" sheet. On the web, buying there gives the not-available note |
| Manage | Opens the "Manage your plan" sheet (below) | same | same |
| Restore | `restorePurchases` (false "Restored" for a trial, see BDG-019 cause 4). On the web: the not-available note | same | same |
| Receipts | Sheet: BillingHistory plus store receipts link plus "Problem with a purchase?" | same | same |

**Manage sheet** (`ProStateView.tsx:276-302`):
- **"Manage in App Store / Google Play"**: only when `store && fromStore`. Calls `openManageSubscription`, which goes to the generic account URL (no `sku` or `package` on Play).
- **"How to cancel"**:
  - iOS store member: fetches the stay offer. If eligible, an inline card with "Stay with Pro" and "Cancel anyway". Otherwise **static three-step text** (`membershipCopy.ts:271-273`).
  - Android, web, trial and promo: the static steps only.
  - A **trial user** has nothing to cancel (no card, the trial ends by itself), yet is shown App Store cancel steps. A **promo member** on iOS is shown App Store steps for a subscription that does not exist.
- **"Problem with a purchase?"**: `reportaproblem.apple.com` on iOS, and on Android the same order-history URL as Receipts (`purchases.ts:14-17`).

**Elsewhere on the page:**
- Trial panel: Keep Pro (purchase); "Invite a friend and keep Pro another week" (ghost, goes to `/settings/invite`).
- PromptBanner "Fix" on `issue`: `openManageSubscription`.
- Cancelled banner: "Keep Pro", the same `openManageSubscription`.
- Plans sheet: PlansBlock, CTA, plus StoreLinks (Restore, Terms, Privacy).
- **PlansView** (Free or expired): Start trial; plan cards; Continue; Restore, Terms, Privacy; InviteCta.

**Dead or redundant controls:**
- "Choose plan" only scrolls.
- "How to cancel" shows text for anyone not eligible for the stay offer.
- The store subscriptions page is reached from four controls: Change plan, Manage in store, Fix, Keep Pro.
- Restore appears in up to two places at once (ManageBar and the plans sheet).
- "Problem with a purchase?" appears in two sheets.
- **Wrong store:** `storeName`, `links`, the cancel steps and `openManageSubscription` all key on `getPlatform()` (`ProStateView.tsx:101-108`). `/api/entitlements/me` never sends the subscription's `source` or `store` (`me/route.ts:118-136`, only `fromStore`). So an Apple subscriber on Android is sent to Google Play and told Play steps.

### What each provider really allows

| Provider | Programmatic cancel | Management surface | Retention | In code today |
|---|---|---|---|---|
| Apple | None. Only the user cancels | Deep link `apps.apple.com/account/subscriptions`. StoreKit's in-app `showManageSubscriptions` sheet supports sandbox, but `@revenuecat/purchases-capacitor` 14.1 does **not** expose it (no such method in `dist/esm/definitions.d.ts`). `customerInfo.managementURL` is exposed. `beginRefundRequestForActiveEntitlement` is exposed (`definitions.d.ts:869`) | In-app promotional offer (built, needs a p8 key in RevenueCat); Apple's own retention messaging on its cancel sheet (configured, "Prepare for Submission", `STORE_SETUP.md:43-50`) | Deep link, stay offer |
| Google | Yes, server-side: the Play Developer API can cancel; RevenueCat's REST API can revoke or refund (verify the exact endpoint before building) | Deep link `play.google.com/store/account/subscriptions?sku=<id>&package=app.buddget` (code uses the generic URL) | Play has its own cancel-survey and offers | Generic deep link only; **no Android key, no Play products** |
| PayTabs / web | Not applicable: no web rail exists | — | — | Nothing |

**How cancellation state comes back:**
- Only through the RevenueCat webhook (`revenuecat.ts:201-213`):
  - CANCELLATION -> `status='canceled', will_renew=false, canceled_at`.
  - UNCANCELLATION -> active.
  - EXPIRATION -> expired.
  - BILLING_ISSUE -> past_due plus `grace_ends_at`.
  - CANCELLATION with reason CUSTOMER_SUPPORT -> refund, expired now.
- The data is written by `billing_apply` (0306) into `user_entitlements` and logged in `billing_events`.
- The client never reads `CustomerInfo`.
- **No reconcile job exists.** It was planned (`S5a-pricing.md:339`), but `src/app/api/cron/` has none. A webhook missed during a 503 window is never repaired (RevenueCat retries for about 80 minutes, then stops). Restore does not repair it either.
- The rule "not marked cancelled until the provider confirms" already holds for store subscriptions, because only the webhook writes `canceled`.

### Proposed single "Manage subscription" sheet

There is one entry point: a `SettingsRow` at the end of the page, replacing the 4-cell ManageBar's Manage, Restore and Receipts cells. Keep the status line, and keep "Choose plan" only as the trial panel's own CTA. Rows are shown by provider (from a new `store` field on `/me`) and by state:

| Row | Shows when | Action |
|---|---|---|
| Renewal / status line | always | text: "Renews 17 Nov 2027 · EGP 499/yr", "Pro until …", "Trial ends …" |
| Change plan | store member on the **same** store as the device | Apple: store page via `managementURL` (Apple handles upgrade and downgrade within the group). Google: `purchasePackage` with `googleProductChangeInfo` (new) |
| Cancel subscription | store member, will_renew true | Start the cancel journey (below) |
| Resubscribe | canceled but running | `managementURL` (Apple), the Play deep link with `sku` |
| Fix payment | past_due | `managementURL` |
| Restore purchases | native, not a store member | `restorePurchases` plus a verified check |
| Receipts | has history | the existing Receipts content |
| Bought on another device | `store` differs from the device platform | text: "Manage it on your iPhone / in Google Play", plus the right link |
| Trial | trialing | "Nothing to cancel. Your trial ends on <date> and no card is on file." No cancel steps |

**Cancel journey:**
1. A retention step, only when `GET /api/billing/stay-offer` is eligible. A decision dialog with "Stay with Pro" (primary) and "Continue to cancel" (secondary, the same size, never hidden).
2. The provider's mechanism:
   - Apple opens `managementURL`.
   - Google opens the Play deep link with `sku` and `package`. Server-side cancel is optional later.
3. Back in the app, on App resume, refresh `/me`. Show "Cancelled, Pro until <date>" only once the webhook has written `canceled`. Until then show "Waiting for <store> to confirm". This needs no new table.

**New backend work:**
- Add a `store` / `source` field to `/me`'s `subscription`. This is one line in `me/route.ts:118-136`; no migration, because the row already has `source` and `store`.
- A reconcile cron: set-based, rows with `current_period_end < now() - 1 day and status in ('active','past_due') and source in ('apple','google')`, a bounded batch, calling RevenueCat's GET subscriber. This is new; it needs an index check against `docs/DB_SCALING_PLAN.md`.
- Android: a key, products, and `googleProductChangeInfo`.
- A web rail (Paymob or Fawry, or PayTabs if the owner switches), with its own table, webhooks and cancel. This is entirely new.

| Field | Content |
|---|---|
| Root cause | Confirmed: the design rule "Everything that changes a subscription goes to the store; the app only links there" (`ProStateView.tsx:74-77`), plus device-platform keying and no `store` field on `/me` |
| Shared causes | BDG-019, BDG-021, BDG-022 |
| Proposed solution | As above. Reuse `SettingsRow` / `SettingsSection`, `ModalShell` plus `V3SheetHeader` plus `SheetFooter`, `PromptBanner`, the existing stay-offer route and `purchaseWithOffer`. Remove the ManageBar cells or make a new additive variant; do not reshape `ManageBar` (project rule). |
| Regression risk | App Review expects Restore reachable from the purchase screen: keep it on PlansView and in the trial panel. Apple guideline 3.1.2 needs subscription management reachable. |
| Test that proves it | Component tests per state (trial, active Apple on iOS, active Apple on Android, canceled, past_due, promo): assert the visible rows match the table. Today a trial shows "How to cancel" with App Store steps. Extend `e2e/journeys/specs/round2/pro-rewards/10-screens.spec.ts` with a state matrix. |
| Confidence | High (the map is read from code) |
| Missing evidence | The exact Google and RevenueCat cancel endpoints and their terms (not checked, by rule) |

---

## BDG-021: Subscription sheets look off-system

| Field | Content |
|---|---|
| Issue ID | BDG-021 |
| Summary | The billing sheets already use the standard frame. What looks off is the composition inside them. |
| Severity | P3 |
| Reproducibility | Consistent |
| Platform | All (worst in light mode) |
| Affected components | `ProStateView.tsx:262-316`, `ManageBar.tsx` plus `membership.module.css:39-48`, `WeekCheckSheet.tsx`, `NoticeHost.tsx:161-215` |
| Backend dependencies | none |

What is **already on primitives**:
- The Plans, Manage and Receipts sheets (`ProStateView.tsx:263-268`), WeekCheckSheet (`:51-57`) and LimitSheet / Sparks packs (`NoticeHost.tsx:182-201`) all use `ModalShell` plus `V3SheetHeader` plus `SheetBody`. So the `sheetHeaders.test.ts` rule passes.
- LimitSheet also pins its CTAs in `SheetFooter safeArea`, which makes it the reference pattern.

What is off, and the primitive each should use:

| Place | Problem | Use |
|---|---|---|
| Stay-offer card in the Manage sheet (`ProStateView.tsx:284-291`) | A default `Card` inside a `ModalShell` panel is card-on-card, white on white in light mode (`DESIGN_SYSTEM.md:302`; `card.tsx:32`). Raw `<p>` typography. "Cancel anyway" is an underlined 12px ghost link, a dark pattern next to a cta-block | Its own decision step: `V3SheetHeader.DialogTitle` plus `SheetFooter` with two `Button`s of standard sizes, or `ResolveSheet`'s footer (primary plus quiet secondary). At minimum use `Card variant="elevated"` |
| Cancel steps (`:292-300`) | `Card` default inside the sheet; hand-made numbered bubbles | `Card variant="elevated"` and the numbered-steps pattern if one exists in `src/components/ui`; otherwise replace with the provider action (BDG-020) |
| Plans sheet CTA (`:269-275`, `plansChoice` `:189-194`) | The CTA scrolls with the content instead of being pinned. The note is a raw `<p>` | `SheetFooter safeArea` (as in LimitSheet). Check that `PlansBlock` uses `surface="elevated"` inside a sheet |
| Manage sheet header | Title only, no subtitle saying what the sheet does | `V3SheetHeader.Subtitle` with the status line |
| `ManageBar` (`ManageBar.tsx:42-46`) | Four raw `<button>`s (`data-raw-button-ok`), 11.5px labels (`.m4 font-size: .71875rem`). 60px height passes the 44px rule | Keep the component (no reshape). If BDG-020 retires it, use `SettingsRow`s instead |
| Status notes (`:237`, `:272`, `:288`) | Three hand-styled `role=status` lines | One shared inline-note style (the `note` slot in `ResolveSheet` is the nearest primitive) |

Hardcoded hex values in `membership.module.css` are only on founder and avatar decoration (`:23,32,35,87,140`), not on subscription surfaces.

| Field | Content |
|---|---|
| Root cause | Confirmed: the sheets were built from `Card` and raw text inside the standard frame, without `SheetFooter`, and without `elevated` for in-sheet cards |
| Shared causes | BDG-020 (the rebuilt sheet fixes most of this) |
| Proposed solution | Fold into the BDG-020 sheet. Additive only; no primitive changes |
| Regression risk | Low; visual only |
| Test that proves it | Owner review, plus `node e2e/ui/pro-rewards-sweep.mjs` (en/ar x light/dark x 375/1440, axe, the 44px hit test) |
| Confidence | High |
| Missing evidence | Screenshots from the device in light and dark mode |

---

## BDG-022: Subscription state consistency

| Field | Content |
|---|---|
| Issue ID | BDG-022 |
| Summary | One `user_entitlements` row per user, written only by webhooks, with last-event-wins. Nothing reconciles it, nothing ties it to a store transaction, and the client never cross-checks the store. |
| Severity | P1 once Android sells; P2 today (iOS only, no web rail) |
| Reproducibility | Unconfirmed (needs a second store) |
| Platform | All |
| Affected components | `supabase/migrations/0306_pro_rewards_sparks.sql` `billing_apply`; `supabase/migrations/0308_pro_rewards_referrals.sql:125-146` `promo_apply_banked`; `src/lib/entitlements/resolve.ts`; `src/lib/entitlements/server.ts:7-24`; `src/app/api/entitlements/me/route.ts`; `src/lib/billing/revenuecat.ts`; `src/lib/billing/billingStore.ts:53` |
| Backend dependencies | `user_entitlements` (PK `user_id`), `billing_events` (unique `provider, event_id`), `pro_promo_grants`, `trial_claims`, `plans`, SQL `entitlement_grants` |

**The model:**
- **Source of truth for "is Pro":** the server's `resolveEntitlements` over the single `user_entitlements` row (`server.ts:7-24`, `resolve.ts` `grantsPlan`, with the same rule in SQL `entitlement_grants`).
  - `trialing` holds until `trial_ends_at`.
  - `active` holds until `current_period_end`.
  - `canceled` holds to the period end.
  - `past_due` holds to the grace end, or the period end plus 3 days.
  - Anything lapsed reads as `expired`.
- **Sources:** `default` (trial), `promo` (banked weeks, invites), `loyalty`, `admin`, `apple`, `google`.
- **Writers:**
  - the RevenueCat webhook via `billing_apply`;
  - `trial_claim`;
  - `promo_apply_banked`, which overwrites the row with `source='promo'` only when nothing grants;
  - the admin `set_entitlement`.
- RevenueCat's own entitlement `buddget_pro` is never read by the app.

**Ways one user ends up paying twice, or paying without Pro:**
1. **Missed webhook plus a second device.** While the webhook answers 503 (secrets unset) or after RevenueCat stops retrying, the row stays `trialing`, so a second device still shows the trial page with Keep Pro. Once Android sells, a purchase on Play adds a second store subscription. Apple blocks a duplicate in the same subscription group only for the same Apple ID. No reconcile exists (BDG-020). Confirmed in code; it needs Android to happen.
2. **Two stores, one row, last event wins.** `billing_apply` guards only `v_at < last_event_at` and overwrites `source`, `store`, `store_original_txn` and `status` unconditionally (0306). An Apple `EXPIRATION` or `CANCELLATION` that arrives after a live Google `INITIAL_PURCHASE` marks the user expired while Google still bills. The reverse is the same. Confirmed in SQL.
3. **The client trusts the plan key, not the source.** `isPaidPlan` (`billingStore.ts:53`) treats a trial as paid, so the app cannot tell "purchase recorded" from "still trialing" (BDG-019 cause 4).
4. **Wrong-store guidance.** The client is never told the subscription's store (`me/route.ts:118-136`). An Apple subscriber on Android is sent to Google Play to cancel and keeps paying Apple.
5. **Sandbox grants production Pro.** `parseEvent` ignores RevenueCat's `environment` field (`revenuecat.ts:101-129`). A TestFlight sandbox purchase writes a live `apple` entitlement, which then expires on sandbox timing (monthly = 5 minutes). Acceptable for internal testers, but it confuses test results. Hypothesis: sandbox events also reach the webhook.
6. **Web plus store:** impossible today, because there is no web rail. If one is built, it needs a cross-rail guard (below).

**What the S8g suites cover now** (`e2e/api/round2/pro-rewards/`):

| Case | Covered by |
|---|---|
| Webhook auth (no or wrong secret, bad or stale signature) | `30-billing.spec.ts` H1; unit `route.test.ts:62-75`, `webhookAuth.test.ts` |
| Bad bodies, unknown user | H2, H7 |
| Purchase plus replay (idempotent), country | H3 |
| Out-of-order EXPIRATION after RENEWAL | H4 |
| Sparks pack buy, refund, bonus | H5, H6, B1, B2 |
| Trial once per account, mailbox and race; no trial for Pro, canceled, lapsed or past buyers | X1 to X5, J9 |
| Stay-offer eligibility, lapse window, claim without purchase | O1 to O3; unit `route.test.ts:91` |
| `/me` shape for Free, trial, Pro, lapsed, founder | M0, M1 |
| Event mapping: cancel, uncancel, expiry, refund (CUSTOMER_SUPPORT), refund reversed, billing issue plus grace, pause, product change, transfer | unit `src/lib/billing/revenuecat.test.ts` only (not end to end) |
| Selling off | `unit/selling-off*.test.tsx` |
| Web buy buttons fail gracefully | journeys J6 |

**Missing:**
- A CANCELLATION -> UNCANCELLATION -> EXPIRATION sequence through `billing_apply` end to end.
- BILLING_ISSUE -> grace -> recovered RENEWAL / EXPIRATION end to end, plus the `issue` page state.
- Refund (CUSTOMER_SUPPORT) end to end: Pro ends now, Sparks period ended.
- TRANSFER end to end (only unit-tested).
- **Two stores on one user** (Apple EXPIRATION after a Google purchase): this would fail today.
- Upgrade and downgrade (PRODUCT_CHANGE then RENEWAL) end to end.
- A store event arriving while a `promo` or banked-weeks row is active (and banked weeks starting after a store lapse).
- A trial user's purchase not confirmed by the webhook: the app must not show Welcome (BDG-019).
- Restore with nothing to restore while on trial.
- Cross-device: an Apple subscriber on Android sees the correct store.
- A sandbox-environment event.
- Native purchase sheets (out of scope for cloud QA; needs a TestFlight sandbox run).

| Field | Content |
|---|---|
| Root cause | Confirmed: a single row with last-event-wins (`billing_apply`), no store-transaction ownership, no reconcile, no `store` on `/me`, and the client keyed on `planKey`, not source |
| Shared causes | BDG-019, BDG-020 |
| Proposed solution | (1) In `billing_apply`: when the row is store-sourced and `store_original_txn` differs from the event's, treat an EXPIRATION or CANCELLATION for the *other* transaction as a no-op (outcome `foreign_txn`), and log a `billing_events` note for a second live store subscription so staff can refund. This is a migration (create or replace the function; grants unchanged per 0315). (2) A reconcile cron (BDG-020). (3) Add `store` / `source` to `/me`. (4) A purchase guard: before `purchasePackage`, refuse when `me.subscription.fromStore && proActive`, and read `Purchases.getCustomerInfo().entitlements.active.buddget_pro` to catch a subscription the server missed. Then offer "Restore" instead of a second purchase. (5) Ignore or tag `environment: 'SANDBOX'` events in production, or keep them only for an allow-list of tester ids (owner decision). (6) A future web rail must check the same row before checkout, and the store paywalls must check it too. |
| Regression risk | A `foreign_txn` no-op could hide a real cancellation if the store moved the user to a new original transaction (Apple keeps `original_transaction_id` stable within a group; Play renews keep `purchaseToken` lineage). Test with TRANSFER. |
| Test that proves it | Add `H8` to `e2e/api/round2/pro-rewards/30-billing.spec.ts`: a Google INITIAL_PURCHASE (otx B, now) followed by an Apple EXPIRATION (otx A, now plus 1s) must leave Pro active with source google. It fails today. Mark it `test.fail` with the BDG id until fixed. |
| Confidence | High on the model; medium on how likely double pay is (needs Android) |
| Missing evidence | Live counts (queries below); RevenueCat's sandbox webhook behaviour |

---

## Queries for the lead

Ids and counts only. Each is bounded on an indexed column.

```sql
-- 1. Did any store event reach billing_apply in the last 14 days, and with what outcome?
--    (billing_events unique (provider, event_id); check that the event_at index exists first with EXPLAIN)
select type, outcome, store, count(*) from public.billing_events
where provider = 'revenuecat' and event_at > now() - interval '14 days'
group by type, outcome, store order by 4 desc limit 50;

-- 2. How many store-sourced entitlements exist, by status
select source, status, count(*) from public.user_entitlements
where source in ('apple','google') group by source, status;

-- 3. The owner's own row (lead substitutes the owner's user id; no personal data returned)
select plan_key, status, source, store, product_id, will_renew, current_period_end, trial_ends_at,
       last_event_at, stay_offer_claimed_at, stay_offer_redeemed_at
from public.user_entitlements where user_id = '<owner uuid>';

-- 4. The selling switch
select key, value from public.platform_settings where key in ('billing.enabled','billing') limit 5;

-- 5. Stale active store rows that a reconcile would touch (size of the job)
select count(*) from public.user_entitlements
where source in ('apple','google') and status in ('active','past_due') and current_period_end < now() - interval '1 day';
```
Also, outside SQL, and for the owner:
- Are `REVENUECAT_WEBHOOK_AUTH` and `REVENUECAT_WEBHOOK_HMAC_SECRET` set on Vercel production?
- What does RevenueCat's webhook delivery log show for the last sandbox purchase?

## Decisions that need the owner

1. Confirm in App Store Connect that the Paid Apps agreement, banking and tax are **Active**. Upload an In-App Purchase key (p8) to RevenueCat; the stay offer cannot be signed without it. Set the two Vercel webhook secrets. Until these three are done, no iOS purchase can complete end to end, whatever the code does.
2. Should sandbox (TestFlight) purchases grant live Pro on the production database?
3. The web rail: PayTabs (named in the register) or Paymob/Fawry (named in `S5a-pricing.md:279`), or none at launch. That choice decides whether any web cancel API work exists.
4. Is Android selling in scope for launch? A key, Play products and service-account credentials are all open.

## Decisions that need Council

**A. Cancellation and retention**

| Option | What | For | Against |
|---|---|---|---|
| A1 | Keep as is: "How to cancel" shows the stay offer or steps | No work | Fails BDG-020; steps for a trial are wrong |
| A2 | One Manage sheet. Cancel = an optional stay step, then the store's own page (`managementURL` / Play deep link with `sku`). The cancelled state is shown only after the webhook confirms | Uses only what each store allows; small; passes Apple review norms | Leaves the app for the final tap |
| A3 | A2 plus an in-app StoreKit `showManageSubscriptions` and RevenueCat Customer Center (`@revenuecat/purchases-capacitor-ui`, a new native dependency) | Cancel without leaving the app; sandbox works | A new plugin plus a native build; Customer Center's look is off-system |
| A4 | A2 plus a server-side Google cancel through the Play or RevenueCat API | A true one-tap cancel on Android | Asymmetric with iOS; a risky permission for the service account |

**Recommendation: A2.** Keep the existing retention step: once per lifetime, and both buttons get equal weight. Add a "Waiting for <store> to confirm" state. Revisit A3 only if device testing shows people get lost on the store page.

**B. Cross-platform purchasing**

| Option | What | For | Against |
|---|---|---|---|
| B1 | As is: last event wins, no guard | — | Double pay and wrong expiry once Android sells |
| B2 | Store-transaction ownership in `billing_apply`, a purchase guard (server row plus `CustomerInfo`), `store` on `/me`, a reconcile cron | Closes every path found; no new tables | One migration, one cron, client changes |
| B3 | Treat RevenueCat as the source of truth: the server calls the RevenueCat REST API on `/me` (cached) instead of trusting the row | One truth across stores | A network call on a hot path (against the DB-load rules unless it is cached hard); RevenueCat outage = no Pro |
| B4 | Sell on one platform only at launch (iOS), with Android and web reading the entitlement | Zero double-pay risk now | Android users cannot pay |

**Recommendation: B2, with B4 as the launch posture** (iOS sells, Android and web read the entitlement) until B2's migration and cron are in. A web rail, if chosen, joins B2's guard; it is not built in parallel.
