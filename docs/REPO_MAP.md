# Buddget — Repo Map

Triage aid: locate the directory that owns a symptom before searching. Read this first, then `Grep` within the named path. Stack: Next.js (App Router) + Zustand + Supabase, wrapped as a native app via Capacitor (iOS/Android).

## Where things live

| Symptom / domain | Look here |
|---|---|
| **Global app state, persistence** | `src/lib/store/` — `useFinanceStore.ts` (core), `useSettingsStore.ts`, `types.ts` (domain types), `migrations/`, `safeLocalStorage.ts` |
| **Auth (OAuth, OTP, biometric, session)** | `src/lib/auth/` (web/server), `src/lib/native/socialSignIn.ts` + `biometricAuth.ts` (native), `src/app/auth/`, `src/app/reset-password/` |
| **Supabase (client, server, types, RPC)** | `src/lib/supabase/` — `client.ts`, `server.ts`, `service.ts`, `database.types.ts`, `env.ts`, `remote/` |
| **Native bridges (Capacitor)** | `src/lib/native/` — `isNative.ts`, `useCapacitor.ts`, `NativeBootstrap.tsx`, camera/voice/push/SMS/widget bridges. Native config: `capacitor.config.ts` |
| **SMS transaction parsing** | `src/lib/sms/` — `smsParser.ts`, `aiParserPrompt.ts`, `patterns/`, `egyptianBankPatterns.ts`, `createSmsExpense.ts` |
| **AI (budget planner, chat, command parsing)** | `src/lib/ai/` — `runAiCommand.ts`, `generateBudgetPlan.ts`, `generateWithFallback.ts`, `gemini.ts` |
| **Voice (record, transcribe, intent)** | `src/lib/voice/` + `src/lib/native/voiceRecorder.ts` |
| **Notifications / alerts** | `src/lib/notifications/` (`evaluateAlerts.ts`), `src/lib/native/pushNotifications.ts`, `src/app/notifications/` |
| **Feature domains (data logic)** | `src/lib/{budget,expenses,debts,goals,savings,subscriptions,payment,market}/` |
| **Server-only API routes** | `src/app/api/` — `ai`, `auth`, `sms`, `voice`, `receipt`, `rates`, `gold`, `push`, `cron`, `admin`. (Stashed during `cap:build`.) |
| **UI components** | `src/components/` grouped by domain (`dashboard`, `expenses`, `debts`, …) + `ui/` (primitives), `layout/`, `modals/` |
| **Screens (routes)** | `src/app/<route>/` mirrors domains: `expenses`, `debts`, `goals`, `savings`, `subscriptions`, `reports`, `settings`, `profile`, `onboarding` |
| **Hooks (per-feature UI logic)** | `src/hooks/use*.ts` |
| **i18n / theme / design tokens** | `src/lib/i18n/`, `src/lib/theme/`, tokens documented in `docs/DESIGN_SYSTEM.md` |
| **Sync engine / offline** | `src/components/sync/`, `src/lib/store/useSyncFailures.ts`, `src/app/offline/` |

## Cross-platform rule
A bug reported on a screen usually has logic in `src/lib/<domain>/` and UI in `src/components/<domain>/`. For anything touching device features (camera, SMS, push, biometric, storage, OAuth), the native path is in `src/lib/native/` and **must** be fixed there too — not just the web branch. `isNative.ts` gates platform behavior.

## Build / release
`scripts/capacitor-build.mjs` (`npm run cap:build`) → static export to `out/` → syncs to `ios/App/App/public` and `android/app/src/main/assets/public`. Release automation: `scripts/native-release.sh`. Native projects (`ios/`, `android/`) are **not** in git.
