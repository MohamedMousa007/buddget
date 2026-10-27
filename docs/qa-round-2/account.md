# QA Round 2: ACCOUNT + SECURITY (read-only discovery)

Method: code read plus live SELECT-only checks on project ydihurtbcnoflhormgzi (pg_policies, grants, FKs, cron.job, cron.job_run_details, sms_parse_log counts). No repo edits, no probes created by this session, no DB writes. Round-1 items (A1, A5, A16, A15, D5, D6, B22 etc.) are not re-reported except where the round-1 fix is shown to be bypassed.

Counts: P0 0, P1 6, P2 10, P3 9 (25 total).

## P1

### C1 P1. Email 2FA is purely client-side and fails open
- src/hooks/useAuthModal.ts:310-352 (signIn), src/app/api/auth/device/check/route.ts, src/components/features/settings/hub/SecurityCard.tsx:65-70
- Problem: the password sign-in already creates a full session before `/api/auth/device/check` is asked. The client then decides to `signOut()` and show the OTP step. No server route, RLS policy or JWT claim (aal) ever requires 2FA. The client also proceeds when the check returns non-ok (`deviceRes.ok` false) or throws (`catch { proceed }`).
- Scenario: attacker with the victim's password calls `supabase.auth.signInWithPassword` directly (or just ignores the UI) and gets a working JWT for PostgREST and every /api route. 2FA never triggers. Also, any 429/500/network failure on `/device/check` lets a legit-looking UI login skip 2FA.
- Fix: enforce server-side (custom access token hook adding a `2fa_ok` claim, or Supabase MFA aal2, or an RLS/route gate keyed on trusted device). Fail closed in the client.

### C2 P1. trusted_devices can be self-inserted via PostgREST, bypassing the round-1 A1 fix
- Live DB: pg_policies `trusted_devices_self_insert` (with_check `user_id = auth.uid()`) and `trusted_devices_self_update`; role grants give `authenticated` INSERT/UPDATE/DELETE on the table. src/app/api/auth/device/trust/route.ts:12-35 gates trust on a recent OTP `amr`, but the same row can be written directly with the user JWT.
- Scenario: password-only session runs `supabase.from('trusted_devices').insert({user_id, device_id:'<any>'})`; the 2FA check now says trusted. Combined with C1, 2FA protects nothing.
- Fix: drop the INSERT/UPDATE policies (service role only writes), revoke table grants from anon/authenticated except SELECT/DELETE. Same review for `biometric_devices` (anon and authenticated hold full grants; policies currently only allow own SELECT/DELETE).

### C3 P1. sms_retention cron fails every night; raw SMS bodies are never purged (policy says they are not stored)
- Live: cron job 7 `sms-retention` -> `SELECT public.sms_retention()` status `failed` on 2026-10-25, 26, 27: `null value in column "raw_body" ... violates not-null constraint` from `UPDATE sms_parse_log SET raw_body = NULL` (migration 0141_retention.sql:31, 0140_sms_v2.sql:138; column created `text not null` in 0039_sms_events.sql:12).
- Evidence: sms_parse_log has 859 rows, 859 with raw_body, 679 older than 30 days and all harvested; oldest 2026-06-16.
- Impact: full bank SMS text (balances, counterparties, names) retained indefinitely. src/app/legal/privacy/sections/PrivacyRightsSections.tsx:26 says "SMS text: Not stored after parsing"; PrivacyDataSections.tsx:59 same. Compliance and trust issue; also survives until account delete.
- Fix: `ALTER COLUMN raw_body DROP NOT NULL` (or set to ''), re-run, add an alert on failed cron runs, add a test that executes the retention SQL against the schema.

### C4 P1. Android allowBackup=true exposes the biometric secret, device id and session to backup/restore
- android/app/src/main/AndroidManifest.xml:5 `android:allowBackup="true"`, no fullBackupContent / dataExtractionRules. Secrets in src/lib/native/biometricAuth.ts:6-10 (`buddget.biometric.secret`) and src/lib/native/deviceId.ts:4 live in Capacitor Preferences (plain SharedPreferences/UserDefaults, not Keystore/Keychain). Supabase session lives in WebView localStorage (also backed up).
- Scenario: adb backup / Google Auto Backup / device-to-device transfer restores the app on another phone with `secret` + `buddget_device_id`. `POST /api/biometric/signin` (src/app/api/biometric/signin/route.ts) validates only device id + secret hash, no biometric proof, no 2FA: it mints a fresh session for the owner. Account takeover with no password and no biometrics.
- Fix: `allowBackup="false"` plus exclusion rules; store secret in Keystore/Keychain-backed secure storage; bind the secret to a hardware-backed key if possible.

### C5 P1. Password change needs no current password, does not revoke other sessions, and leaves biometric/trusted devices valid
- src/hooks/useProfilePage.ts:76-81 and src/app/reset-password/confirm/page.tsx:141-170 (authenticated user gets the new-password form straight off the live session, `updateUser({password})`, then `signOut({scope:'local'})`). Modal path src/hooks/useAuthModal.ts:508-530 same. No code touches `biometric_devices`, `trusted_devices` or sessions on password change.
- Scenario: stolen/borrowed unlocked session (or XSS) sets a new password in one call with no old password; the victim's other sessions and the attacker's registered biometric binding (`POST /api/biometric/register` needs only a session, no re-auth) survive a later password reset. Persistent takeover.
- Fix: require current password or fresh `reauthenticate()` nonce (enable secure password change in Supabase Auth), call global sign-out of other sessions, delete biometric_devices and trusted_devices on password change/reset, require recent re-auth on biometric register.

### C6 P1. Account deletion and DSR export miss PII tables (email_log, support tickets), docstring is stale
- src/lib/server/userData.ts (USER_DATA_TABLES) and src/lib/server/deleteAccount.ts:19-21 ("no auth.users FKs", false: live FK check shows ON DELETE CASCADE to profiles/auth.users for most tables, which is what actually deletes ai_*, loyalty_*, user_devices, trusted_devices, biometric_devices, push_tokens, sms_ingest_tokens, user_entitlements, feedback_votes, admin_user_notes).
- Survivors after delete (live schema): `email_log` (user_id + `to_email`, NO FK; 6 of 9 rows carry a user_id), `support_tickets` (FK ON DELETE SET NULL; `requester_email`, subject, plus `support_ticket_messages` bodies stay), `client_crashes` (SET NULL, crash payload stays), `admin_access_grants.target_user_id` and `admin_audit_log` (no FK, ids/emails), plus third parties (Sentry user id/device_id, Linear issues from /api/feedback, Resend, FCM).
- Also: keepStaffAccess branch (deleteAccount.ts:25-31) never deletes ai_usage_*, user_devices, trusted_devices, email_log, profile email, so a staff "delete my data" leaves them. The `export` route (src/app/api/admin/users/[id]/export/route.ts) iterates USER_DATA_TABLES only, so a DSR export omits email_log, support tickets/messages, user_devices, trusted_devices, ai_usage_*, loyalty, entitlements, ingest token metadata.
- Fix: add the missing tables (explicit deletes for no-FK/SET NULL tables; delete tickets by requester_email and user_id) and make a test that diffs `information_schema` user_id/email columns against the list.

## P2

### C7 P2. Sign-out never revokes the refresh token server-side
- src/components/auth/AuthProvider.tsx:433, src/app/reset-password/confirm/page.tsx:167, src/hooks/useEphemeralSessionGuard.ts:55 all use `signOut({scope:'local'})`. The comment in useEphemeralSessionGuard.ts:27 claims the refresh token "is revoked"; it is not.
- Scenario: token copied before sign-out (C4 backup, shared device, XSS) stays valid until natural expiry/rotation. "Sign out" gives no security guarantee.
- Fix: global (or "others") revoke on explicit sign-out when online, local clear on failure.

### C8 P2. "Remove phone" does not cut a stolen phone off
- src/app/api/devices/[id]/route.ts:58-70 only sets `user_devices.revoked_at`, deactivates the SMS token, deletes push tokens. It does not delete `biometric_devices` / `trusted_devices` rows for that device_id, does not revoke auth sessions, and `/api/biometric/signin` never consults `user_devices.revoked_at`.
- Scenario: lost phone with biometric enabled is "removed" by the owner; anyone holding its secret (see C4) still calls `/api/biometric/signin` and gets a new session. Revocation relies on the phone opening the app and honouring `revoked:true`.
- Fix: delete biometric/trusted rows in the same handler, check revoked in biometric/signin, offer "sign out everywhere".

### C9 P2. Global signOut() on every 2FA login and on device removal kills the user's other devices
- src/hooks/useAuthModal.ts:327 `await supabase.auth.signOut()` (default scope is global), also src/lib/devices/client.ts:77 and src/hooks/useVoiceExpense.ts:292.
- Scenario: a 2FA user signs in on a new browser: password step creates a session, then global sign-out revokes all of that account's sessions, including the phone, which then shows "session expired". Anyone who knows the password can repeat this to lock the victim out of every device (DoS).
- Fix: `signOut({scope:'local'})` there, or run the 2FA gate before creating a session.

### C10 P2. Balance privacy: 2 of 5 surfaces are not implemented and the mask covers only /accounts and Buddgy
- src/components/features/settings/hub/BalancePrivacyCard.tsx:11 offers hero/lists/notifications/widgets/buddgy. `useMask`/`isMasked` are used only in src/app/accounts/page.tsx:56-58 and src/lib/buddgy/client/{context,runTurn}.ts. Nothing reads `privacy` for notifications (src/lib/server/emitNotification.ts, sms/parse push text) or widgets; dashboard, wealth, flow, savings, net worth ignore it.
- Scenario: user sets "Hide all"; push notifications still show "amount - merchant" on the lock screen and dashboard shows balances.
- Fix: wire server-side push/notification text to user_settings.privacy, apply masks on the main hero surfaces, or hide the options that do nothing.

### C11 P2. CSV export is vulnerable to formula injection
- src/lib/utils/formatters.ts:181-185 `escapeCsvField` only doubles quotes. Used by src/hooks/useSettingsPage.ts:62-80 and src/hooks/useReportsPage.ts:205-230.
- Scenario: a counterparty sets a transfer/sender name to `=HYPERLINK("http://evil","x")` or `+cmd|...`; SMS parsing stores it as expense description; the user exports and opens in Excel/Sheets and the formula runs.
- Fix: prefix `'` (or tab) when the value starts with `= + - @ \t \r`.

### C12 P2. No self-service full data export (GDPR access/portability)
- src/components/features/settings/hub/DataCard.tsx offers only an expenses CSV and a local JSON backup (store.exportData, useFinanceStore.ts:1830). The full DSR export exists only as an admin route behind `dsr.manage`, a financial grant and step-up. Users cannot obtain income, debts, savings, SMS log, devices, support or email history themselves. Privacy page promises a 30 day response by email only.
- Fix: authenticated `/api/account/export` mirroring the (completed) table list, rate limited.

### C13 P2. 2FA can be turned off with a toggle and no re-auth; OAuth/biometric sign-ins skip 2FA
- src/components/features/settings/hub/SecurityCard.tsx:69-70 `updateSettings({twoFactorEmailEnabled})` syncs straight to user_settings (RLS own-row update). src/hooks/useOAuthSignIn.ts and biometric signin never call `/device/check`.
- Scenario: stolen session disables 2FA silently; an account with 2FA on is still fully reachable via Google/Apple/biometric.
- Fix: require recent OTP to disable, make 2FA a server attribute (service-role write only).

### C14 P2. "Remember me" off: pagehide signs the user out on reload/navigation, flag is tab-local and not set on OTP/OAuth logins
- src/hooks/useEphemeralSessionGuard.ts:50-58: `pagehide` also fires on F5, hard navigation (e.g. `window.location.replace('/')`), bfcache. The sessionStorage flag is per tab (a second tab keeps the token in localStorage forever) and `markSessionEphemeral` is called only in the password path (useAuthModal.ts:319); OTP/OAuth never reset it, so a stale `1` from an earlier unticked login signs a later Google login out on reload.
- Fix: use a session-lifetime marker plus `beforeunload`-free approach (e.g. store expiry, check on boot), set/clear in every sign-in path.

### C15 P2. Privacy policy does not match what the app does
- src/app/legal/privacy/sections/PrivacyTechSections.tsx:24 states no third-party analytics; src/lib/crash/init.ts ships Sentry (with user id and `device_id` tags); the policy sections list Supabase, Google, Groq but not Sentry, the email provider (Resend), Linear (feedback to issues), FCM/APNs. "Raw SMS text not stored" is false (C3). Token storage text says "HTTP-only cookies", but native stores the session in WebView localStorage and the SDK web client keeps it in JS-readable storage too. Effective date May 24, 2026 predates later features (SMS template learning from user corrections shared across users: sms_template_signals, sms_corpus).
- Fix: update and re-date policy, add a consent/notice for crash reporting and cross-user SMS template learning.

### C16 P2. Sensitive lock data in Sentry: the trusted-device identifier is sent as a tag
- src/lib/crash/init.ts:62-63 `Sentry.setTag('device_id', id)`. That id is half of the biometric sign-in credential and the 2FA trusted-device key. Sentry is a third party and `scrubEvent` does not touch `tags`. Combine with C4 (secret) and the id is the only missing part.
- Fix: send a hash of the id (HMAC with a public salt is enough), scrub tags.

## P3

### C17 P3. scrub.ts quality gaps and a quadratic regex
- src/lib/crash/scrub.ts: `tags`, `exception.values[].stacktrace.frames[].vars`, `transaction`, `server_name`, `threads`, `logentry` are not scrubbed; `contexts.device.name` ("<Name>'s iPhone") passes because `name` is not in SENSITIVE_KEY; the amount rules know only 12 currencies (no TRY, Arabic "جنيه", bare numbers); `beforeSend` does not cover native crashes from `enableNative`.
- Measured: `new RegExp('\\b\\d[\\d,.\\s]*\\s?(?:EGP|...)\\b','gi')` on `"1 ".repeat(8000)` takes 607 ms and 32000 repeats take 14.5 s (superlinear, main thread hang) when scrubText gets a long digit/space string.
- Fix: bound the quantifier (`{0,20}`), add keys and tags, add a test with a large input.

### C18 P3. Device id header is unvalidated
- src/lib/auth/resolveDeviceId.ts:10-11 accepts any non-empty `X-Buddget-Device-Id` (no length/charset check) while the cookie path enforces `/^[0-9a-f-]{10,}$/i`; it overrides the cookie even on web. Values are written to trusted_devices, biometric_devices and used in rate-limit keys (`bio-signin-dev:${deviceId}`), so per-device throttling is bypassed by rotating ids (per-IP 40 per 10 min remains, taken from the first x-forwarded-for entry).
- Fix: same regex + length cap (<= 100) on the header.

### C19 P3. /api/auth/password-updated is unauthenticated and the cookie is forgeable
- src/app/api/auth/password-updated/route.ts: anyone can POST and get the `buddget_password_updated` cookie, then the app shows the "password updated" success modal. The comment says the forgeable query param was replaced; the POST remains open (cosmetic, but also a trivially scriptable cookie-write endpoint).
- Fix: require a session or signed one-time value.

### C20 P3. Apple native sign-in omits the nonce
- src/lib/native/socialSignIn.ts:143-150 intentionally sends no nonce for Apple; a captured Apple identity token can be replayed to `signInWithIdToken` until it expires. Google path uses a hashed nonce.

### C21 P3. Biometric/app-lock weaknesses
- src/lib/native/biometricAuth.ts: `androidBiometryStrength: 'weak'`; web fallback `authenticate()` calls `navigator.credentials.get` with no allowCredentials and never verifies the assertion, so web "lock" is decorative; app lock evaluated only at cold start in AuthProvider.tsx:360-375 (no re-lock after background timeout, process stays alive on Android); lock is UI-only while the session remains in storage.

### C22 P3. Sensitive routes verify the JWT locally only
- src/app/api/account/delete/route.ts and auth/device/trust use `resolveRouteIdentity` (getClaims): revoked, banned or signed-out-elsewhere sessions still pass until JWT expiry (<= 1 h). With the 5 minute `amr` window the exposure is small for delete, larger for other getClaims routes that move data.

### C23 P3. Delete ordering and partial success
- src/lib/server/deleteAccount.ts:36-55 wipes data and profile first, then `auth.admin.deleteUser`; if that fails the account remains with no data. `partialErrors` still returns `ok:true` (account/delete/route.ts:34-37) so the client shows the "deleted" screen while rows may remain.
- Fix: delete the auth user first (cascades do the rest), report partial failures to the user/support.

### C24 P3. Small RPC/policy hardening
- `analytics_touch(p_paths jsonb)` (SECURITY DEFINER, callable by any authenticated user) merges an unbounded client-provided jsonb into app_analytics_daily.paths (storage bloat). `get_sms_keyword_pool(top_n)` is executable by anon with unbounded top_n. `profiles_update_own` lets users write `email` (shown to admins as identity), `welcome_email_sent_at`, `data_reset_at` (wipes all other devices' local copies on next sync).

### C25 P3. Push permission prompt
- src/lib/native/pushNotifications.ts:44 requests permission inside the register call right after sign-in with no pre-prompt rationale; on denial `registeredUserId = null`, so every later register attempt re-prompts (Android 13 hard-blocks after two denials; iOS shows nothing, but the retry loops hit native each launch).

### Also noted (not separately scored)
- Shared cookie domain (middleware.ts supabaseCookieDomain) means the admin host and app share one session cookie; an XSS on the admin host (A24 HTML filter) equals app session theft.
- auth email-hook (src/app/api/auth/email-hook/route.ts) signature check is correct (timing-safe, 5 min tolerance) but has no webhook-id replay cache.
- auth/callback open-redirect handling is correct (verified `//`, `/\`, absolute URLs fall back to origin).
- Logs: no token/OTP/password logged in src (grep); only `[oauth] signInWithIdToken rejected` message and `[biometric] checkBiometry` JSON, which are non-secret.
- refreshSession() is not called anywhere in src (apiBase.ts mentions it only in a comment); native OAuth uses idToken only; no violations of those memory rules found.

## Areas not reached
- Live Supabase Auth settings (JWT expiry, secure password change, OTP length/expiry, rate limits) - dashboard-only, not queryable; assumed defaults.
- Actual device behaviour (biometric prompt, backup/restore, FCM/APNs permission UX, iOS Keychain data protection), Apple Sign-In flow, SMS permission prompt UI.
- settings/sms and settings/memory page logic beyond the privacy surface check; legal page rendering/accessibility; support/board routes; admin portal auth (covered by round 1).
- No dynamic exploitation: all findings are static or SELECT-verified; C1/C2/C5 direct-API exploit steps are reasoned from policies and grants, not executed.
