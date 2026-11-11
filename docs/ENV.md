# Environment contract

Where each variable is set: **Vercel** (server + build), **.env.local** (native builds only, see `.env.example`), **`npm run verify`** (dummy values for the build). `NEXT_PUBLIC_*` values are inlined into the client bundle at build time and are never secret.

## Required in production (Vercel)

| Variable | Used for |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase client. If missing in a Vercel production deploy `src/proxy.ts` answers 503 when `VERCEL_ENV` is `production` (it used to serve the app with no auth gate). `NEXT_PUBLIC_SUPABASE_ANON_KEY` is the legacy name for the publishable key. |
| `SUPABASE_SECRET_KEY` | Service-role key. Code reads this name first; `SUPABASE_SERVICE_ROLE_KEY` is the legacy fallback in some paths only (instrumentation-node.ts and ai/quota.ts check `SUPABASE_SECRET_KEY` alone). Set `SUPABASE_SECRET_KEY`. |
| `CRON_SECRET` | Bearer secret for every `/api/cron/*` route. Unset means every cron answers 401 (fail closed). |
| `GEMINI_API_KEY` | AI features. Optional model overrides: `GEMINI_MODEL_FAST`, `GEMINI_MODEL_SMART`, `GEMINI_MODEL_LEGACY`, `GEMINI_API_BASE`. |
| `NEXT_PUBLIC_APP_URL` | Canonical app origin. |

## Optional server variables

| Variable | Used for |
|---|---|
| `GROQ_API_KEY` | Voice transcription. |
| `FINNHUB_KEY`, `GOLDAPI_IO_KEY`, `GOLDPRICEZ_KEY` | Price providers (cron/prices). Missing keys skip that provider. |
| `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` or `FIREBASE_SERVICE_ACCOUNT_JSON` | Native push (firebase-admin). |
| `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `EMAIL_FROM`, `SUPPORT_EMAIL`, `SEND_EMAIL_HOOK_SECRET` | Email and the Supabase auth email hook. |
| `ASC_ISSUER_ID`, `ASC_KEY_ID`, `ASC_PRIVATE_KEY`, `ASC_APP_ID` | App Store Connect API key (Users and Access > Integrations > App Store Connect API, role Developer) and the app's numeric Apple ID. Feeds `/api/cron/ios-crashes`. |
| `SENTRY_WEBHOOK_SECRET`, `LINEAR_API_KEY`, `LINEAR_WEBHOOK_SECRET` | Webhooks. Signatures are verified with these. |
| `ADMIN_AUTH_SECRET`, `NEXT_PUBLIC_ADMIN_HOST`, `NEXT_PUBLIC_MARKETING_HOST`, `NEXT_PUBLIC_MY_HOST` | Admin portal and multi-host routing. |
| `AI_RATE_LIMITING_ENABLED`, `AI_RATE_LIMIT_MAX`, `AI_RATE_LIMIT_WINDOW_MS` | AI rate limiting. |
| `SMS_REQUIRE_DEVICE_HEADER` | Require the device header on SMS ingest. |

## Client / native build (`NEXT_PUBLIC_*`, see `.env.example`)

`NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_OAUTH_GOOGLE`, `NEXT_PUBLIC_OAUTH_APPLE`, `NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID`, `NEXT_PUBLIC_GOOGLE_IOS_CLIENT_ID`, `NEXT_PUBLIC_APPLE_SERVICES_ID`, `NEXT_PUBLIC_SENTRY_DSN`, `NEXT_PUBLIC_NATIVE_SHELL` (set by the Capacitor build), `NEXT_PUBLIC_SITE_SAMPLE_REVIEWS`.

## Dev and test only (never set in production)

| Variable | Effect |
|---|---|
| `NEXT_PUBLIC_DEV_AUTH_BYPASS=1` | Skips the login gate; ignored when `NODE_ENV=production`. |
| `NEXT_PUBLIC_PWA_DEV`, `NEXT_PUBLIC_SENTRY_DEV` | Enable the service worker / Sentry in `next dev`. |
| `CAPACITOR=true` | Static-export mode for the Capacitor bundle (`next.config.ts`); set by `npm run cap:build`, never on Vercel. |
| `CAP_WEBVIEW_DEBUG=1` | Local `cap:build` only: makes the native WebView remotely inspectable (`capacitor.config.ts`). Off by default and in every release; never use that build for TestFlight or Drive. |
| `APK_PUBLIC_LINK=1` | `scripts/upload-apk.sh` creates an "anyone with the link" Drive share. Default is a private Drive file link (the APK is a debug-signed build). |
| `QA_PG_URL` | Postgres URL for the `*.pg.test.ts` admin suites (`npm run test:pg`). Without it they skip. |
| `RUN_AI_EVAL=1` + `GEMINI_API_KEY` | Live Gemini golden set (`npm run eval:ai`). Excluded from `npm test`. |
| `TZ` | `npm test` defaults to `Africa/Cairo`; `npm run verify` also runs `America/New_York`. |

## Verify

`npm run verify` (`scripts/verify.sh`) builds with dummy Supabase values; GitHub Actions is not relied on.

`VERCEL_ENV` is set by Vercel itself and read by `src/proxy.ts`.
