# QA round 2: NATIVE + OFFLINE (read-only discovery)

No repo files edited, no probes created by this agent (the qa2-debt/sms probes in git status belong to other sessions). No builds, no simulator, no DB writes.
Coverage: Android manifest/gradle/Kotlin, iOS plist/entitlements/Swift/SPM, capacitor.config.ts, capacitor-build.mjs, native-release.sh (read only), patch-android-plugins, smsTracker, pushNotifications, NativeBootstrap, AppShell listeners, AuthProvider boot, useNetworkStatus, sync reconnect, back-guard registry, relative /api calls, iOS 16 feature scan.

## P1

### V1 P1. Support feedback, inbox, board and votes call relative `/api/...` (dead on native)
- Files: `src/components/features/settings/hub/HelpCard.tsx:49`, `SupportBoardSheet.tsx:20,31`, `SupportInboxSheet.tsx:16-56` (getJson + POST at :56), `src/app/reset-password/confirm/page.tsx:170`.
- Problem: raw `fetch('/api/...')` instead of `apiFetchAuth`. In the static bundle the origin is `https://localhost`, so it never reaches buddget.app. The routes themselves accept Bearer (`resolveApiUserId`), so only the client is wrong.
- Scenario: native user submits feedback/idea, opens the support inbox or the board, or votes. Request returns 404 or index.html; the UI shows "Failed" or an empty list. Password-update cookie POST also fails (caught and logged).
- Fix: use `apiFetchAuth` in all five sites.

### V2 P1. `useAssetPrices` self-heal is dead on native
- File: `src/hooks/useAssetPrices.ts:77` `fetch('/api/prices/refresh', { method: 'POST' })`.
- Problem: relative URL on native, swallowed by `catch {}`. The "stale gold/crypto price" self-heal (shipped as the fix for dead prices) never runs in the app.
- Scenario: the cron stalls, so native users keep stale prices and net worth is wrong indefinitely.
- Fix: `apiFetch('/api/prices/refresh', ...)`.

### V3 P1. Android auto-backup exposes the SMS ingest token, bank SMS queue and receipts
- File: `android/app/src/main/AndroidManifest.xml:4` `android:allowBackup="true"`, no `dataExtractionRules` or `fullBackupContent`. targetSdk 36.
- Problem: `buddget_sms` SharedPreferences hold the non-expiring ingest token and `pending_queue` (raw bank SMS text) in plaintext. Capacitor Preferences, WebView localStorage (Supabase session) and `pending-ai/` receipt and voice files are in the backup set too (contradicts the "device-local only" receipt design).
- Scenario: `adb backup` or Google cloud backup restore onto another device clones a working ingest token. `sms_enabled` is restored with it, so the device forwards SMS without any setup on that phone.
- Fix: `allowBackup="false"`, or a `dataExtractionRules` and `fullBackupContent` that exclude `buddget_sms`, Preferences, WebView and `files/pending-ai`.

### V4 P1. The web layer needs iOS 16.4+, but the deployment target is 16.0
- Files: `ios/App/App.xcodeproj/project.pbxproj:260,317,338,365` (16.0), `ios/App/CapApp-SPM/Package.swift` (`.iOS(.v16)`).
- Evidence: Tailwind 4 (Safari 16.4 baseline: `@property`, `color-mix`, 51 uses of `color-mix` in src) and Next 16 (Safari 16.4 baseline).
- Regex lookbehind (Safari 16.4) remains in client code:
  - `src/lib/buddgy/local/quickAddDate.ts:13-14` (regex literals, a parse-time SyntaxError for the whole chunk).
  - `src/lib/buddgy/local/lexicon.ts:63` (module-scope `new RegExp`, throws at module evaluation).
  - `src/lib/buddgy/local/text.ts:35`, `parseQuickAdd.ts:96`.
  - Server-only, not a client issue: `salaryEvidence.ts`, `providerFromBody.ts`, `learnGates.ts`.
- Scenario: iPhone on iOS 16.0-16.3 installs from TestFlight or the App Store. Buddgy chat (via `useBuddgyChat` -> `localTurn`) crashes on load, and the CSS is broken (shadows, rings, transforms, opacity colours).
- The earlier "iOS 16 lookbehind" fix covered only some files.
- Fix: raise the deployment target to 16.4 (preferred, and in the SPM `platforms`), or remove the lookbehind regexes and add a CSS fallback.

### V5 P1 (verify). iOS `CFBundleVersion` is a literal "6" in Info.plist
- File: `ios/App/App/Info.plist:42-43`. `scripts/native-release.sh:34` bumps only `CURRENT_PROJECT_VERSION` (now 129) in the pbxproj.
- Problem: a literal Info.plist value is not overridden by the build setting, so every archive would carry build 6 and TestFlight would reject it. Releases 127-129 reportedly uploaded, so something may differ in practice.
- Action: confirm the build number in the last TestFlight archive. If it shows 6 (or fails), change the plist to `$(CURRENT_PROJECT_VERSION)`.

## P2

### V6 P2. WebView debugging is enabled in release builds (Android and iOS)
- Android: `capacitor.config.ts:~28` `webContentsDebuggingEnabled: process.env.NODE_ENV !== 'production'`. `scripts/capacitor-build.mjs` runs `npx cap sync` with the parent env, where NODE_ENV is unset. Evidence: the generated `android/app/src/main/assets/capacitor.config.json` in the main checkout has `"webContentsDebuggingEnabled": true`.
- iOS: `ios/debug.xcconfig` (`CAPACITOR_DEBUG = true`) is the baseConfigurationReference for both Debug and Release (pbxproj:208, 329), so the Release WebView is inspectable.
- Impact: anyone with the device and USB can attach to `chrome://inspect` or Safari Web Inspector and read the Supabase session from localStorage.
- Fix: set `NODE_ENV=production` in the cap sync env (or hardcode false), and give Release an xcconfig with `CAPACITOR_DEBUG = false`.

### V7 P2. SMS ingest token and bank SMS queue are stored in plaintext
- iOS: `SmsCapacitorPlugin.swift` `SmsCredentialStore` uses `UserDefaults.standard` (plist, included in iTunes/iCloud backups). Android: SharedPreferences (see V3).
- Fix: Keychain on iOS, EncryptedSharedPreferences or Keystore on Android, and exclude from backup.

### V8 P2. `READ_SMS` is declared but never used
- File: `AndroidManifest.xml` (also `SmsCapacitorPlugin.kt` permission alias). No inbox read exists in the Kotlin code; only `SMS_RECEIVED` is used.
- Impact: Play restricted-permission review risk and a bigger privacy surface.
- Fix: drop `READ_SMS`. Also confirm the Play SMS permission declaration. `RECORD_AUDIO` and `MODIFY_AUDIO_SETTINGS` are needed for voice.

### V9 P2. The auth effect re-runs on language change, which can relock the app
- File: `src/components/auth/AuthProvider.tsx:~275-392`, dependency `[configured, t.auth.sessionExpired]`.
- Problem: a locale change re-runs the effect, which re-subscribes and calls `getSession()` again. With app lock enabled (`isAppLockEnabled`) it takes the "restored session + lock" branch: `setLockedBoth(true)`, `stopAutoRefresh()`.
- Scenario: biometric lock on, the user unlocks, changes the language in Settings, and is locked again with auto-refresh frozen.
- Fix: keep the string in a ref, and make the dependency list `[configured]`.

### V10 P2. Push token refresh posts with a stale JWT and ignores the response
- File: `src/lib/native/pushNotifications.ts` `postToken` / `currentArgs.accessToken` (:58-62, :97-100, :139-155).
- Problem: the Bearer is captured once at registration. A later `registration` or `tokenReceived` event (hours later, after rotation) sends an expired JWT and gets 401. `res.ok` is never checked and there is no retry. B18 only noted iOS.
- Impact: the server keeps a dead FCM token and pushes stop silently.
- Fix: read `getSession()` at post time, check `res.ok`, retry.

### V11 P2. Push-tap routing is attached only after the first sync and the push decision
- Files: `NativeBootstrap.tsx:50-90`, `pushNotifications.ts:67-82`, `AppShell.tsx` `SmsPushActionHandler`.
- Problem: the `pushNotificationActionPerformed` listener is attached only inside `registerPushNotifications`. That runs only after `synced` + flag + `decide()`, and is skipped when `pushOptOut` is set or `deferPushPrompt` returns true. `bootstrapped.current` is set before the async work, so there is no re-try.
- Scenario: cold start from a notification tap while offline or slow. The tap is never routed (the user lands on the dashboard).
- Fix: attach the listeners once at boot, independent of registration.

### V12 P2. Confirm dialog and menus have no Android back guard
- Files: `src/components/ui/dialog/DialogProvider.tsx` (Base UI AlertDialog), `CardActionMenu.tsx`.
- Problem: neither registers `registerBackGuard`. The `AndroidBackHandler` runs guards first, so the press hits the sheet underneath (closing it while the confirm stays on screen) or navigates back.
- Scenario: "Delete?" confirm over a sheet, press back. Also minor: `GoalAchievedScreen` (z-200 fullscreen) has no guard.
- Fix: wrap with `useDismissable`.

### V13 P2. `safeLocalStorage` fallback loses data after quota and returns stale reads
- File: `src/lib/store/safeLocalStorage.ts`.
- Problem: on a `setItem` quota error the value goes only to the in-memory Map, with no warning. `getItem` prefers the (older) localStorage value over the memory value. WKWebView and Android localStorage are capped at about 5 MB. The main finance store persists there.
- Scenario: heavy user goes over quota and keeps editing offline. The app is killed and the edits revert on relaunch.
- Fix: surface a quota banner, shrink or compress the persisted slice, and read memory first.

### V14 P2. iOS push AppDelegate is missing the APNs forwarding methods
- File: `ios/App/App/AppDelegate.swift`. There is no `didRegisterForRemoteNotificationsWithDeviceToken` or `didFailToRegister...` forwarding (the Capacitor template posts `.capacitorDidRegisterForRemoteNotifications`).
- Problem: the `@capacitor/push-notifications` `registration` and `registrationError` events never fire on iOS. FCM works only via Firebase swizzling (no `FirebaseAppDelegateProxyEnabled` override in the plist). This is a plausible cause of B18 (silent iOS registration failure).
- Fix: add the two forwarding methods.

### V15 P2. Dead widget sync writes a financial snapshot continuously
- Files: `src/components/layout/AppShell.tsx:317` mounts `WidgetSync`; `widgetBridge.ts` writes spend, budget and latest expense to Preferences.
- Problem: there is no widget extension in the repo (and no App Group entitlement), but data is still written on every change. It lands in backups (V3/V7) and wastes work.
- Fix: unmount `WidgetSync` until a widget exists.

## P3

- V16 P3. `AndroidBackHandler`, `SmsStartupSync`, `useAssetPrices`, `SupabaseFinanceSync`, `useOtpAutofill`: `App.addListener` is awaited and `handle` is assigned after cleanup may already have run, so the listener leaks (double back handling under StrictMode or a fast bare-route unmount/remount). Fix: `if (cancelled) await handle.remove()` after the await.
- V17 P3. `drainAndSubmitPendingSms` has no in-flight guard. It is called from mount, SIGNED_IN, `appStateChange`, and the reconnect timer (plus the Android WorkManager). Concurrent drains double-POST. Add a module-level mutex.
- V18 P3. `SmsForwardWorker.kt`: `URL("$apiUrl/api/sms/parse")` is built outside the try block (an empty `api_url` throws MalformedURLException). 408/429 are treated as terminal failure rather than retry. The iOS `CatchBankSmsIntent` and the Android worker don't send `x-buddget-device-id`; verify they stay exempt when `SMS_REQUIRE_DEVICE_HEADER=1`.
- V19 P3. `SmsReceiver` forwards OTP and other business-sender SMS with digits to the API (privacy surface). Pre-filter OTP-only messages client-side.
- V20 P3. `BootReceiver` is `exported="true"` with no permission and does nothing useful. Set it to false or remove it. The `app.buddget://` custom scheme (any host) is claimable by other apps, so keep OAuth idToken-only.
- V21 P3. Status bar: `PlatformBodyClass` sets `Style.Dark` once and `applyTheme` never updates it, so light-theme users get light status text on a light background. The Android colour `#0A0A0F` differs from the config's `#0A100F`, and `setBackgroundColor` is a no-op under forced edge-to-edge (targetSdk 36).
- V22 P3. `package.json` has `@capacitor-community/speech-recognition`, which is never imported. Android links it (extra permission surface) and iOS has no SPM package (stale Package.swift). Remove it, and the unused `NSSpeechRecognitionUsageDescription`.
- V23 P3. No `PrivacyInfo.xcprivacy` in the app target. The app itself uses UserDefaults (required-reason API, `CA92.1`) in `SmsCredentialStore` and Preferences. App Store Connect flags missing reasons (ITMS-91053). Add one declaring UserDefaults plus any file-timestamp use.
- V24 P3. `capacitor.config.ts` has `Preferences.group: 'group.app.buddget'` but `App.entitlements` has no App Groups entitlement. `aps-environment` is `development`; verify the exported build re-signs to production (usually automatic for app-store-connect exports).
- V25 P3. Android sets no `minWebViewVersion`; Tailwind 4 needs Chrome 111+ (minSdk 24 devices with an outdated WebView would render broken). `windowSoftInputMode` is unset, so check keyboard overlap on device (ModalShell relies on a focus heuristic on Android).
- V26 P3. Android `FileProvider` `file_paths.xml` exposes `external-path "."` (broad, grants are per URI only). `DocumentScannerPlugin.kt`: a second `scan()` overwrites `pendingCall`, and 5 full-size pages are decoded to Bitmaps and base64'd with no downscale (OOM risk on low-RAM phones). `MainActivity` overwrites `pendingMicRequest` on a second request.
- V27 P3. `SmsPushActionHandler` `sms_confirm`: `.then(r => r.json())` with no `res.ok` check, so failures silently navigate home. `useNetworkStatus` runs both web `online/offline` events and the Capacitor Network listener; the web events can flip state against the OS status. `getStatus` failure falls back to the web value.
- V28 P3. iOS `UIRequiredDeviceCapabilities` lists `armv7`. Landscape is allowed on iPhone while the CSS is portrait-first. The WKUserScript forces `* { touch-action: pan-x pan-y }` and `font-size: max(16px,1em) !important` on inputs globally.
- V29 P3. Positive checks (no finding): no ATS exceptions, no cleartext (targetSdk 36 default false, `allowMixedContent` false), `minifyEnabled false` (no R8 break), FCM registration and unregister on sign-out exist, `apiUrl` is used for the other 37 API sites, `allowNavigation` is limited to buddget.app.

## Manual device checklist

### Android real device (also test on API 24-26 with an old WebView, plus Android 13/14/15)
1. Fresh install, cold start: splash, then landing or lock. The status bar and nav bar colours and icon contrast in light and dark themes (V21).
2. Gesture-nav and 3-button phones: bottom nav sits above the system bar; notch and cutout top padding.
3. Login by Google and by email OTP. Kill the app mid-login, then retry.
4. Biometric lock on: unlock, change the language in Settings, check it does NOT relock (V9). Background for more than 30 s, resume, lock is shown.
5. Permissions: deny and allow SMS, notifications (Android 13+ prompt), camera, mic (voice first run: grant dialog then recording), biometrics. Re-open after "don't ask again".
6. SMS: enable tracking, send the adversarial set. With the app killed, the notification arrives. With airplane mode, check the pending card, then reconnect (drain once, not twice, V17). Send two identical SMS within one second.
7. Push: token registers after login. Wait over 1 h, rotate (reinstall or clear data), verify the token update still lands (V10). Tap a push from a killed app, offline and online (V11). Toggle push opt-out.
8. Back button on every sheet: add expense, number pad, date picker, confirm dialog over a sheet (V12), `CardActionMenu`, goal celebration, scanner, settings sheets, onboarding. On the dashboard: "press again to exit".
9. Scanner: scan 1 and 5 pages, cancel, Play Services module download, rotate during the scan, low-RAM device.
10. Offline: airplane mode at cold start (fast path), add expense, reconnect, verify the sync once. Add a voice or receipt capture offline, check the pending chip.
11. Support: Settings, Help: submit feedback, open the inbox, vote on the board (V1). Gold or price stale refresh (V2).
12. Backup: `adb shell bmgr backupnow app.buddget`, or inspect `dumpsys backup`, confirm the SMS token is not backed up after the fix (V3).
13. `chrome://inspect` must NOT list the release WebView (V6).
14. Keyboard overlap: text fields at the bottom of long sheets, with and without a suggestions bar. Rotate. Samsung keyboard.
15. Reboot, then receive an SMS without opening the app (BootReceiver, WorkManager). Doze and battery saver.
16. Language Arabic (RTL), Arabic digits, font scale 200%.
17. Deep link `app.buddget://auth/callback` from a browser, and with the app already running.

### iOS real device (also iOS 16.0-16.3 if available, and 17/18)
1. Install on an iOS 16.0-16.3 device: app must load, Buddgy chat opens, CSS is intact (V4). If not, raise the target.
2. Cold start and splash. Dynamic Island and notch top inset, the home-indicator bottom inset, landscape.
3. Sign in with Apple, Google and email OTP (Face ID prompt wording). Biometric unlock and the lock after the language change (V9).
4. Notifications: allow, then check the token is registered (check the push-token row in Supabase via the Settings device list) (V14). Tap a push from killed state, foreground push banner.
5. Shortcut automation: "Catch Bank SMS" with the app killed, locked screen, two SMS in the same second, airplane mode, then open the app and verify the drain, no duplicates.
6. Camera and VisionKit scanner: allow, deny, scan multi-page, rotate pages upright. Photos permission string. Mic and voice (WKWebView prompt appears once, not every session).
7. Offline fast-path: airplane mode cold start, edits, reconnect.
8. Keyboard: sheets with inputs, visualViewport inset, no pinch zoom, no rubber-band bounce.
9. Safari Web Inspector must not attach to the TestFlight build (V6).
10. Backup: confirm the ingest token is not in an iCloud backup (V7).
11. TestFlight build number matches `CURRENT_PROJECT_VERSION` (V5). Archive Validate shows no ITMS-91053 privacy warnings (V23). Check `aps-environment` in the exported entitlements is production (V24).
12. Support and feedback flows (V1) and the gold price refresh (V2).

## Areas not reached
- The full PendingCapturesChip and receipt scan flows, `notificationParser.ts` (Android notification listener), `biometricAuth.ts` and `socialSignIn.ts` internals, `receiptImages.ts` cleanup, deep-link handler code (`useOAuthSignIn`, `appUrlOpen`), and the cache-first boot (`navStore`, `AppViewRouter`).
- Third-party plugin privacy manifests (SPM dependencies), the SwiftPM-resolved versions, Gradle versions beyond `variables.gradle`, and `ios/App/App/Base.lproj` storyboards.
- Real iOS 16 and Android WebView rendering (static analysis only), and a sweep for iOS-16-unsupported CSS other than `color-mix`, `@property` and `dvh`.
