# Overnight run, 2026-11-21

## Done

- **Release:** job 20 all green (verify, 101 unit tests, every journey, sync, API, SMS). main and dev = `f16d0e18` (this branch + main + Keep Pro + SMS).
- **Builds (from f16d0e18):** iOS 147 on TestFlight; Android vc181 APK on Drive; signed Play AAB vc181 at `~/Desktop/buddget-vc181.aab`. The Android RevenueCat key was missing from `.env.local` and was added before these builds.
- **RevenueCat Android:** 7 products registered (`pro_monthly:monthly`, `pro_annual:annual`, `sparks_60/125/320/650/2000`), subscriptions attached to the `$rc_monthly` / `$rc_annual` packages and the `buddget_pro` entitlement. The RevenueCat service account was never invited to Play Console; it is now invited with View app information, View financial data, Manage orders and subscriptions, Manage store presence.
- **Play Console:** closed-testing track "Alpha": 178 countries, tester list "buddget closed testers" (raw201120@gmail.com, m.mousa0072016@gmail.com), feedback support@buddget.app. Store listing EN + AR rewritten (v3). App content: nothing outstanding.
- **App Store Connect:** version 1.0.0 (was 1.1.0) with EN + AR text (v3), keywords, URLs, copyright, review notes, review contact (your phone, not public), manual release. App Information: name "buddget: Budget & Expenses" / "بادجت: الميزانية والمصروفات", subtitle, Finance + Productivity, age rating 4+, content rights (third-party content, rights held: bank and merchant logos), privacy labels published (14 types, linked, no tracking, per `PRIVACY_DECLARATIONS.md`), price Free, available in 174 countries (China mainland left out: it needs an ICP filing and an AI declaration).
- **Copy:** `copywriting` + `copy-editing` skills installed from coreyhaines31/marketingskills (61.8k stars, MIT, read in full before install). Store copy v3 in `STORE_COPY_V3.md`. Every Arabic string in the app, site, emails and legal pages now uses بادجت / بادجي / برو / شرارات (commit `a41e71ae`).
- **Version reset (commit `35a4d72e`):** iOS marketing 1.0.0 (build numbers keep counting, next 148, because Apple refuses reused numbers), Android versionName 1.0.0 and versionCode restarts at 1 (Play never received a bundle), `APP_CLIENT_VERSION` 1.0.0 (no minimum is set on the server, so nothing is blocked).

## Waiting on you (in order)

1. **Start the "QA runner: job 21" card** (tests for the Arabic copy and the version reset). Nothing can go to main or be rebuilt until it is green. When it lands I push to dev and main, build iOS 1.0.0 (148) and Android vc1, attach build 148 to the App Store version, and retire the old TestFlight builds.
2. **Drag the AAB into Play:** in the Brave tab "Prepare release" (Alpha), drop the new `~/Desktop/buddget-vc1.aab` (after step 1's build; `buddget-vc181.aab` is the old numbering) on "Upload app bundles". The upload tool I have caps at 10.4 MB and the bundle is 22 MB. The release notes are typed in that tab.
3. **Reviewer demo account:** create the Layla Hassan demo account and type its email and password into App Store Connect (App Review > Sign-In Information) and Play Console (App content > App access). I may not enter passwords.
4. **10 more testers** for Play's 12-tester / 14-day rule: the clock starts only when 12 have opted in.
5. **Screenshots:** the cloud screenshot job (iPhone 6.9", iPad 13", Play phone and tablets) was started; if it pushed `qa/store-shots`, I upload them; otherwise they are still missing on both stores.

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
