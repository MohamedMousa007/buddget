# Crash reporting

JS errors, route and layout error boundaries, and native iOS and Android crashes are reported to Sentry. The admin portal's Crashes tab reads the `client_crashes` table, which the Sentry webhook fills.

## Setup (once)

1. Create a Sentry project (Capacitor / React). Copy its DSN.
2. Set `NEXT_PUBLIC_SENTRY_DSN` on Vercel (web) and add the same line to the `.env.local` that is stored in the `NATIVE_ENV_LOCAL_B64` GitHub secret (the native bundle reads it from there). Without it the reporter does nothing.
3. In Sentry, create an Internal Integration with a webhook to `https://<app>/api/webhooks/sentry`, enable "Alert Rule Action", and put its Client Secret in `SENTRY_WEBHOOK_SECRET` on Vercel. Add an issue alert rule that notifies this integration for every new issue and for regressions.
4. Source maps and dSYMs: `brew install getsentry/tools/sentry-cli`, then put an organization token in `~/.sentryclirc` (`[auth] token=`, `[defaults] org=buddget`, `project=buddget`). `cap:build` uploads and strips the web source maps; `native-release.sh` uploads the iOS dSYMs and aborts if sentry-cli cannot reach Sentry.

## What is sent

Scrubbed on the device first (`src/lib/crash/scrub.ts`): no emails, tokens, amounts, SMS text, query strings or request bodies. Events carry the platform, the app version, the native build number, the device id and the signed-in account's opaque id.

## Native start

The DSN is also baked into native code so a crash before the WebView loads is captured: iOS reads `SentryDsn` from Info.plist (filled from the `SENTRY_DSN` build setting) in `AppDelegate`; Android reads `io.sentry.dsn` from the manifest (filled from the `SENTRY_DSN` env var). `scripts/native-release.sh` exports it from `.env.local` and aborts when it is empty; `npm run cap:env:check` and `cap:build` also fail without `NEXT_PUBLIC_SENTRY_DSN`.

## Limits

Android builds are debug (not minified), so no mapping upload is needed. Add `sentry-cli upload-proguard` if release minify is ever turned on.
