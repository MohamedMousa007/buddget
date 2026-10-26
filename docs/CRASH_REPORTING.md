# Crash reporting

JS errors, route and layout error boundaries, and native iOS and Android crashes are reported to Sentry. The admin portal's Crashes tab reads the `client_crashes` table, which the Sentry webhook fills.

## Setup (once)

1. Create a Sentry project (Capacitor / React). Copy its DSN.
2. Set `NEXT_PUBLIC_SENTRY_DSN` on Vercel (web) and add the same line to the `.env.local` that is stored in the `NATIVE_ENV_LOCAL_B64` GitHub secret (the native bundle reads it from there). Without it the reporter does nothing.
3. In Sentry, create an Internal Integration with a webhook to `https://<app>/api/webhooks/sentry`, enable "Alert Rule Action", and put its Client Secret in `SENTRY_WEBHOOK_SECRET` on Vercel. Add an issue alert rule that notifies this integration for every new issue and for regressions.
4. Source maps and dSYMs: add a `SENTRY_AUTH_TOKEN` secret and run the upload step in the native workflows so stacks are readable. (Not wired yet.)

## What is sent

Scrubbed on the device first (`src/lib/crash/scrub.ts`): no emails, tokens, amounts, SMS text, query strings or request bodies. Events carry the platform, the app version, the native build number, the device id and the signed-in account's opaque id.

## Limits

A crash before the JS bundle loads (the very first native frames) is only caught once the native SDK is initialised natively in `AppDelegate` / `MainActivity`, which needs the DSN in native code. The JS init covers everything after the WebView starts.
