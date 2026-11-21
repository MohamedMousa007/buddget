# Overnight run, 2026-11-21

## Done

- **Release:** job 20 all green (verify, 101 unit tests, every journey, sync, API, SMS). main and dev = `f16d0e18` (this branch + main + Keep Pro + SMS).
- **Builds (from f16d0e18):** iOS 147 on TestFlight; Android vc181 APK on Drive; signed Play AAB vc181 at `~/Desktop/buddget-vc181.aab`. The Android RevenueCat key was missing from `.env.local` and was added before these builds.
- **RevenueCat Android:** 7 products registered (`pro_monthly:monthly`, `pro_annual:annual`, `sparks_60/125/320/650/2000`), subscriptions attached to the `$rc_monthly` / `$rc_annual` packages and the `buddget_pro` entitlement. The RevenueCat service account was never invited to Play Console; it is now invited with View app information, View financial data, Manage orders and subscriptions, Manage store presence.
- **Play Console:** closed-testing track "Alpha": 178 countries, tester list "buddget closed testers" (raw201120@gmail.com, m.mousa0072016@gmail.com), feedback support@buddget.app. Store listing EN + AR rewritten (v3). App content: nothing outstanding.
- **App Store Connect:** version 1.0.0 (was 1.1.0) with EN + AR text (v3), keywords, URLs, copyright, review notes, review contact (your phone, not public), manual release. App Information: name "buddget: Budget & Expenses" / "بادجت: الميزانية والمصروفات", subtitle, Finance + Productivity, age rating 4+, content rights (third-party content, rights held: bank and merchant logos), privacy labels published (14 types, linked, no tracking, per `PRIVACY_DECLARATIONS.md`), price Free, available in 174 countries (China mainland left out: it needs an ICP filing and an AI declaration).
- **Copy:** `copywriting` + `copy-editing` skills installed from coreyhaines31/marketingskills (61.8k stars, MIT, read in full before install). Store copy v3 in `STORE_COPY_V3.md`. Every Arabic string in the app, site, emails and legal pages now uses بادجت / بادجي / برو / شرارات (commit `a41e71ae`).
- **Version reset (commit `35a4d72e`):** iOS marketing 1.0.0 (build numbers keep counting, next 148, because Apple refuses reused numbers), Android versionName 1.0.0 and versionCode restarts at 1 (Play never received a bundle), `APP_CLIENT_VERSION` 1.0.0 (no minimum is set on the server, so nothing is blocked).

## Later in the night

- **Tests moved local** (owner, 2026-11-21: "You can run them local instead"). Job 21 also passed in the cloud (verify, 183 targeted tests, Arabic sweep: no overflow or broken joining, R11 + g-buddgy, 0 users left). Local `npm run verify` green twice (6,996 then 6,999 tests).
- **iPhone SMS settings were not as agreed** (owner noticed). BDG-008 had shipped the guide's guards and the facts, but the Settings row was a link to the guide, and once set up the guide sat on a separate row. Now per `findings/B-sms-setup.md`: a "Set up" button and no switch until this phone has a setup claim or a Shortcut run; then the switch, "View guide" beside it, and this phone's status ("Not confirmed yet", "The Shortcut ran", "Connected · last SMS 2 hours ago", or the quiet note). Status times are in the page language.
- **Real bug found by the Playwright test:** the SMS plugin loader let a second caller during the first import get `null`, so on a cold start Settings could show "Set up" on a phone that is set up. Fixed with one shared load; unit test fails on the old code, passes now.
- **New Playwright spec** `e2e/journeys/specs/round2/ios-sms-settings.spec.ts`: a fake iOS bridge makes the browser act as the iPhone app. 4/4 green against a production build (never set up, claimed, run seen, Skip-guide confirm).
- **App Store shot 02** replaced with the iPhone view ("Set up" button) instead of the web switch. Play keeps the Android switch shot, which is correct there.
- **Builds:** main/dev `1f449dce`. **iOS 1.0.0 (149)** on TestFlight and attached to App Store version 1.0.0; **Android vc2** APK on Drive (https://drive.google.com/file/d/1meCEU_3IYLQmMWi-lOlxcZb5IKHsDMxX/view) and signed Play bundle `~/Desktop/buddget-vc2.aab` (version 1.0.0). iOS 148 / Android vc1 went out before the SMS fix and are superseded.
- **TestFlight cleaned:** every older build expired (1.1.0 130 to 147, the old 1.1.0 7 to 9, 1.0.0 148). Only 1.0.0 (149) is active, in the Alpha testers group. Old AABs moved to `~/Desktop/old-aab/`. Old Drive APKs (debug-signed) were left in place.

## Afternoon, 2026-11-21

- **"Keep Pro" spun forever (root cause, fixed):** `purchases.ts` returned the RevenueCat plugin from an async function. Capacitor's plugin proxy answers `then` with a native method, so the promise took it for a thenable and never settled: on a phone every store call (configure, offerings, purchase, restore) hung before reaching RevenueCat. That is why RevenueCat shows 0 customers. The unit test mock now has the proxy's `then`; 9 tests hung on the old code and pass on the fix. No other plugin in the app is returned this way.
- **SMS row:** "Connected" only (no last-SMS time); "View guide" opens the guide's first page directly; "Set up again" replaces the switch after 14 days with no SMS and no Shortcut run on this phone. Playwright `ios-sms-settings` 4/4 on a production build.
- **Pro page:** the "Nothing is charged until you choose a plan" line under the CTA is removed.
- **RevenueCat Play products:** plan `ef58f135` (v3 names: بادجت برو، شهري / سنوي, N شرارة) is drafted but cannot apply: Play still answers "Manage store presence" missing and "No application found". Play only allows in-app products once a bundle with the billing permission is uploaded, so this waits on the AAB. Before applying, add Sparks availability (and `equalize_missing_product_prices`).

- **Builds with the billing fix (main `145e47c8`):** iOS 1.0.0 (150) on TestFlight (Alpha testers) and attached to App Store version 1.0.0 in place of 149; Android vc3 APK on Drive (https://drive.google.com/file/d/1fwel4hhtloJBMsULWD-r_7J642LF3CXX/view); signed Play bundle `~/Desktop/buddget-vc3.aab` (jar verified). vc2 moved to `~/Desktop/old-aab/`. Upload vc3, not vc2.

## Waiting on you (in order)

1. **Drag the AAB into Play:** in the Brave tab "Prepare release" (Alpha), drop `~/Desktop/buddget-vc3.aab` on "Upload app bundles", then Save, Next, and "Send for review" (the closed test starts when Google approves). The upload tool I have caps at 10.4 MB and the bundle is 22 MB. The release notes are typed in that tab.
2. **Reviewer demo account:** create the Layla Hassan demo account and type its email and password into App Store Connect (App Review > Sign-In Information) and Play Console (App content > App access). I may not enter passwords.
3. **10 more testers** for Play's 12-tester / 14-day rule: the clock starts only when 12 have opted in.
4. **Screenshots: uploaded.** From the cloud capture (`qa/store-shots`, Layla Hassan persona, web render of f16d0e18): App Store iPhone 6 shots (resized to the 1206 x 2622 size this account's version asks for) + iPad 13" 4 shots; Play phone 6 + 7" tablet 3 + 10" tablet 3 (Play listing saved as draft; it goes out with the release). Shot 07 (Pro trial) left out on purpose: it shows a crossed-out yearly price, against the paywall rule in `STORE_SETUP.md`. Seen in the shots and worth fixing (UI, so mockup first): the Buddgy orb sits on top of the "Today" date label on Flow, and Arabic month names in the monospace date font render letter by letter ("نو فمبر"). Replace these web shots with simulator and emulator captures of the 1.0.0 build when convenient.

## Owner-visible decisions taken overnight (overturn any)

- iOS keeps build numbers above 147 (a "reset" to build 1 would be refused by Apple for the 1.0 train).
- China mainland excluded on the App Store.
- Membership card badges `PRO` / `PRO TRIAL` stay in Latin letters (logo-like mark; letter-spacing breaks Arabic joining).
- Variable Spark counts in Arabic read "N شرارة"; numbers 3 to 10 should be "شرارات". Proper fix: an `arCount` 'spark' unit (small follow-up).
- Old Drive APKs (vc181 and earlier, debug-signed) cannot be updated by vc1+ without uninstalling first.

## Labels

- **Automated verification:** everything up to `f16d0e18` (job 20). Job 21 pending.
- **Manual verification required:** Arabic brand words on the membership cards and the SMS guide wordmark; store pages once screenshots are in.
- **Native verification required:** sandbox purchase on iPhone and Android (RevenueCat Play permissions can take up to a day to apply).
- **Blocked:** AAB upload (file size), reviewer credentials (passwords), Play subscription creation through RevenueCat (needs the new permission to propagate, then a re-plan).
