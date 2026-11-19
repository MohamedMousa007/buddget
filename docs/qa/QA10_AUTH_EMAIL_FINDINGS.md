# QA-10 / email engine audit (read-only, origin/main fe5b2097, 2026-11-19)

Legend: **[code]** = verified in the repo at the cited line. **[live]** = verified by a read-only query on Frankfurt `tzioppxwsljhlglyducm` (auth logs, `email_templates`, aggregate counts from `email_log`). **[infer]** = my conclusion, not proven.

## 0. Headline

1. **The owner is only half right.** The app *has* its own branded engine (templates in `email_templates` + compiled copies, sent through Resend). But for everything Supabase Auth sends (sign-up, sign-in code, reset, email change, reauth, invite), our engine only takes over when **Supabase's "Send Email" hook is enabled on the project**. The Frankfurt project is a fresh project, and its hook is not on.
2. **Live evidence that the hook is OFF on Frankfurt [live]:**
   - The auth logs for 2026-11-18 show three web sign-ups (`POST /signup`, status 200, `user_confirmation_requested`, 16:01, 16:06, 16:24 UTC), but `email_log` has **no** `auth_hook / confirm_signup` row after 2026-11-15 01:16 (that is the Singapore era, copied over). If the hook were on, every send writes an `email_log` row, success or failure (`src/lib/server/email/send.ts:84-95`).
   - Two of those testers then confirmed with **`GET /verify` (status 303)**, meaning they clicked a **link**. Our `confirm_signup` template has **no link**, only the code (published en+ar rows: `has_link=false, has_code=true`; compiled copy `src/lib/email/defaults.ts:50-53` has no `button`). So the mail they got was **Supabase's built-in "Confirm signup" template**, whose default body is a link and has no `{{ .Token }}`. That is exactly "no confirmation code email arrives".
   - The third tester (16:24) signed up and asked for a resend at 16:25 (`POST /resend`, 200) and never verified [live]: GoTrue reported both sends as successful, so the mail was accepted by Supabase's mailer and either went to spam or was dropped by the default sender [infer].
   - `email_log` does show one `auth_hook / password_reset` delivered at 2026-11-18 16:11:38, but Frankfurt's auth logs have no recovery request at that time. **[infer]** It came from the **old Singapore project** (older native builds still point there; the move memory says native apps followed only from the 11-16 build, iOS 143 / Android vc176, commit b7193d97). Its hook still calls the same Vercel route with the current secret.
3. **The admin 8-digit code is our own email carrying a Supabase-minted OTP**, so its length is Supabase's OTP length setting. Setting it back to 6 fixes problem 1 for every *new* code.
4. **Setting OTP length to 6 does not fix problem 2.** The hook must be turned on in Frankfurt.

## 1. Inventory of every email

Generator → deliverer. (a) = our code + Resend end to end. (b) = Supabase Auth → our hook `POST /api/auth/email-hook` → our template → Resend. (c) = Supabase built-in template + Supabase mailer/SMTP.

| # | Email | Trigger in code | Type | Mode with hook ON | Mode today on Frankfurt (hook OFF) |
|---|---|---|---|---|---|
| 1 | Sign-up confirmation (code) | `supabase.auth.signUp` `src/hooks/useAuthModal.ts:420`; resend `useAuthModal.ts:287`, `:585` | `signup` | (b) → `confirm_signup` | **(c) "Confirm signup"** |
| 2 | Sign-in code (password-step 2FA on a new device) | `signInWithOtp({shouldCreateUser:false})` `useAuthModal.ts:355`; resend `:588` | `magiclink` | (b) → `sign_in_code` | (c) "Magic Link" |
| 3 | "Email me a code" after a bad password | `useAuthModal.ts:608` | `magiclink` | (b) → `sign_in_code` | (c) "Magic Link" |
| 4 | Second-factor gate (OAuth / session on an untrusted device) | `src/components/auth/SecondFactorGate.tsx:43` | `magiclink` | (b) | (c) "Magic Link" |
| 5 | Forgot password (in-app code) | `resetPasswordForEmail` `useAuthModal.ts:637`, resend `:587` | `recovery` | (b) → `password_reset` | (c) "Reset Password" |
| 6 | Admin "send password reset" to a user (link) | `src/app/api/admin/users/[id]/route.ts:238` (`redirectTo …/reset-password/confirm`) | `recovery` | (b) | (c) "Reset Password" |
| 7 | Admin portal sign-in / setup / step-up code | `src/lib/server/admin/emailCode.ts:23-27` (`generateLink({type:'magiclink'})` → `email_otp` → `sendTemplatedEmail('admin_unlock_code')`) | n/a (generateLink sends nothing) | (a) | (a) |
| 7b | Same, fallback when our mailer fails | `emailCode.ts:31` `signInWithOtp` | `magiclink` | (b) (so it also fails if Resend is down) | (c) "Magic Link" |
| 8 | Staff (admin) invite | `src/lib/server/admin/inviteEmail.ts:16-25` (generateLink invite/magiclink → `invite_admin`) | n/a | (a) | (a) |
| 9 | Welcome | `src/app/api/auth/welcome/route.ts:29` | n/a | (a) | (a) |
| 10 | Email change (old + new address) | **No caller in the app** (no `updateUser({email})` in `src/`). Hook supports it: `src/lib/server/email/authHook.ts:52-66` | `email_change` | (b) | (c) "Change Email Address" (only if someone triggers it outside the app) |
| 11 | Reauthentication | **No caller** (`reauthenticate` not used). Hook: `authHook.ts:28` | `reauthentication` | (b) | (c) "Reauthentication" (unused) |
| 12 | Supabase invite (`inviteUserByEmail`) | **No caller**. Hook maps `invite` → `invite_user` `authHook.ts:24` | `invite` | (b) | (c) "Invite user" (unused) |
| 13 | Password changed notice | Supabase security notification. Our change route uses `admin.auth.admin.updateUserById` (`src/app/api/auth/password/change/route.ts:59`). **[infer]** Admin updates do not fire the user-facing notice. | `password_changed_notification` | (b) → `password_changed` if the notice is enabled | (c) "Password changed" if enabled (off by default) |
| 14 | Email changed notice | Supabase security notification | `email_changed_notification` | (b) → `email_changed` | (c) if enabled |
| 15 | Phone/identity/MFA notices | Supabase security notifications | listed in `IGNORED_TYPES` `authHook.ts:34` | acknowledged, not mailed | (c) if enabled (off by default) |
| 16 | Account deletion | `src/app/api/account/delete/route.ts`: requires recent sign-in (`:24`), **sends no email** | n/a | none | none |
| 17 | "New device" notice | none exists (device trust is a code challenge, rows 2/4) | n/a | none | none |
| 18 | Biometric sign-in | `src/app/api/biometric/signin/route.ts:73` `generateLink` → client `verifyOtp` (`src/lib/native/biometricAuth.ts:329-330`) | n/a | **no email** | no email |

Hook route: `src/app/api/auth/email-hook/route.ts:14-46`. It verifies Standard-Webhooks HMAC with `SEND_EMAIL_HOOK_SECRET` (`:15`, `src/lib/server/email/webhook.ts:9-24`, accepts `v1,whsec_…`). Types handled: `signup, invite, magiclink, recovery, email_change, reauthentication, password_changed_notification, email_changed_notification` (`authHook.ts:22-31`). `email_change_new` is not a separate type in the payload; secure email change arrives as `email_change` with `token_new/token_hash_new` and is split into two mails (`authHook.ts:56-63`). Any other type gets a 422 (`authHook.ts:48`, route `:35`).

Our engine: `sendTemplatedEmail` (`src/lib/server/email/send.ts:43-99`) renders from `email_templates` (published) → compiled fallback (`src/lib/server/email/render.ts:37-42`) and posts to `https://api.resend.com/emails` (`send.ts:60`), from `EMAIL_FROM` or `buddget <no-reply@buddget.app>` (`send.ts:9,68`). Locale `en` or `ar` comes from the user's saved language (`send.ts:57`, `src/lib/email/scenarios.ts:52-54`). **Arabic versions exist for every scenario** (`src/lib/email/defaults.ts:49-105`) and RTL rendering (`src/lib/email/blocks.ts:124`).

## 2. What depends on Frankfurt dashboard settings (reset by the move)

GoTrue config is **not in Postgres**. It lives in the platform's Auth config (Management API / dashboard). I could not read it. The auth schema has no hook settings row. What I could see is behaviour in the auth logs (above).

Owner checklist, Frankfurt project `tzioppxwsljhlglyducm`:

1. **Authentication → Hooks → Send Email hook: enable it, type HTTPS, URL `https://<app origin>/api/auth/email-hook`.** Admin portal → Emails → Setup shows the exact URL (`src/app/api/admin/emails/setup/route.ts:16`, `appOrigin()`).
   - **Secret:** paste the **same** value that Vercel has in `SEND_EMAIL_HOOK_SECRET` (format `v1,whsec_…`). Do not generate a new one: Vercel holds one secret (`route.ts:15`), and the Singapore project, which still serves older native builds, signs with the current one. A new secret would break whichever project does not match.
   - Verify: Emails → Setup "Last hook email" should show `confirm_signup` or `sign_in_code` from a Frankfurt test sign-up.
2. **Auth → Providers → Email → Email OTP length = 6** (done by the owner). It drives the admin code (row 7), every hook code and Supabase template codes.
3. **Email OTP expiry.** The default is 3600 s. Our emails say "10 minutes" (`src/lib/email/render.ts:18`, `variables.ts:51`). Set 600 s to match, or accept that the copy is wrong.
4. **Confirm email = ON.** Logs show `user_confirmation_requested`, so it is on [live]. Keep it on. If it were off, sign-up would sign in with no code at all (`useAuthModal.ts:466-474`).
5. **Secure email change** (on/off). It decides one vs two change mails. It does not matter today, because there is no caller.
6. **SMTP settings.** With the hook on, SMTP is not used for auth mail. Until then, Supabase's default sender is rate-limited (a few per hour, project-wide) and is meant for team addresses only. Either set custom SMTP (Resend SMTP: host `smtp.resend.com`, port 465, user `resend`, password = an API key, sender `no-reply@buddget.app`) or, better, just enable the hook.
7. **Rate limits** (Auth → Rate Limits): "emails sent per hour" and "token verifications". These reset to defaults. Raise the email limit if testers sign up in bursts. A breach surfaces as an error (`authErrors.ts:89`), not silence.
8. **URL configuration**: Site URL `https://my.buddget.app` (the host seen in the logs; confirm the production app origin) plus Redirect URLs including the app origin `/**`, the admin origin `/auth/callback**` (staff invite `inviteEmail.ts:15`) and `/reset-password/confirm` (`users/[id]/route.ts:238`). Without them, link mails redirect to the default Site URL (localhost) [infer].
9. **Email templates (Supabase).** Only used while the hook is off. If you leave the hook off for any time, paste the templates in §5. The defaults are link-only, which is why sign-up shows no code.
10. **Security notifications** (Password changed, Email changed, …): leave them off, or turn on only Password/Email changed. With the hook on they come through our templates (types 13/14). Phone/identity/MFA are acknowledged and not mailed.
11. **Vercel env** (not the dashboard, but needed by the hook): `RESEND_API_KEY`, `EMAIL_FROM` on a Resend-verified domain, `SEND_EMAIL_HOOK_SECRET`. Emails → Setup shows ticks (`EmailSetup.tsx:16-22`).
12. **Singapore project**: until every tester is on build ≥ iOS 143 / vc176, the same settings matter there too (OTP length, hook).

## 3. The two tester problems

### Problem 1: admin portal sign-in, code has 8 digits, screen wants 6

Path [code]:
- Password step → `POST /api/admin/auth/code` (`src/app/api/admin/auth/code/route.ts:25-47`) → `sendEmailCode` (`emailCode.ts:22`).
- `service.auth.admin.generateLink({ type: 'magiclink', email })` (`emailCode.ts:23`). **Supabase mints the OTP**, and its length = the project's *Email OTP length*. Our code only mails it (`emailCode.ts:26`, template `admin_unlock_code`, Resend). Live: two `admin/admin_unlock_code/delivered` rows on 11-18, and Frankfurt auth log `POST /admin/generate_link` at 16:51:06 [live].
- UI: `EmailCodeInput` → `AuthOtpRow` keeps only 6 digits (`src/components/features/auth-modal/AuthOtpRow.tsx:22,33,59,66`). The submit button needs 6 (`src/components/features/admin/auth/SignInScreen.tsx:94`).
- Server: `verifyEmailCode` rejects any length ≠ `EMAIL_CODE_LENGTH = 6` (`emailCode.ts:6,40`), then `verifyOtp({type:'email'})` (`:41`).

So: **Supabase OTP, our email.** Cause: the region move reset the OTP length to 8. **Setting it back to 6 fixes it by itself** for new codes. Codes already sent stay 8 digits until they expire, so testers should request a new one. If our mailer fails, the fallback (`emailCode.ts:31`) has Supabase send its own "Magic Link" mail, with the same length.

### Problem 2: sign-up, no confirmation code arrives

Path [code]: `signUp` (`useAuthModal.ts:420`) → on `data.user` without a session → verify step (`:475-481`) → 6-digit `verifyOtp({type:'signup'})` (`:498-512`).

Cause [live + infer]: on Frankfurt the **Send Email hook is not enabled**, so Supabase sends its **default "Confirm signup" template**, which is a link and has no `{{ .Token }}`. Testers who got the mail clicked the link (`GET /verify` 303). The app's code screen can never be satisfied from that mail. Some mails may not arrive at all (default sender limits and spam) [infer].

**OTP length → 6 does not fix this.** Fix: enable the hook with the existing secret (§2.1). Interim alternative: paste the §5 "Confirm signup" template.

Other failure modes I checked in code, which would look different from what testers saw:
- Hook on but secret mismatch or missing: route returns 401/503 (`route.ts:16,24`) **without any log line**. GoTrue then fails the signup with "Error sending confirmation email", and the app shows `errorEmailSendFailed` (`authErrors.ts:92`). The `isEmailSendError && data.user` branch (`useAuthModal.ts:430-441`) is effectively dead, because supabase-js returns `user: null` with an error [infer].
- Resend key/domain failure: a `failed` row in `email_log` with the reason (`send.ts:79-95`), a 502 to GoTrue, and the same user-visible error. Note: 874 `welcome` failures "RESEND_API_KEY is not set", all with null user_id, 2026-11-18 00:57-04:37 [live]. **[infer]** Something without the key (a test run or preview env) writes to the production `email_log`. Worth a look, but it is separate.
- Rate limit: error `errorRateLimit` (`authErrors.ts:89`), not silence.
- Logging gap: the hook route logs nothing for bad signature, missing secret, bad body or unsupported type (`route.ts:16,24,30,35`). Recommend `console.error` on each.

## 4. OTP inputs and validators (every hard-coded 6)

| Where | Line(s) | What |
|---|---|---|
| `src/components/features/auth-modal/AuthOtpRow.tsx` | 22, 23, 27, 33, 35 (`5`), 38, 42 (`5`), 59, 61 (`5`), 66, 74 | Shared 6-box input (user app **and** admin portal), `autoComplete="one-time-code"` (`:73`) for iOS/Mail autofill |
| `src/hooks/useOtpAutofill.ts` | 33 | Android clipboard autofill regex `\b(\d{6})\b` |
| `src/hooks/useAuthModal.ts` | 498-499 | sign-up / recovery / 2FA verify |
| `src/components/auth/SecondFactorGate.tsx` | 61-62 | 2nd-factor gate verify |
| `src/components/features/admin/ui/StepUp.tsx` | 45 | admin step-up ready check |
| `src/components/features/admin/auth/SignInScreen.tsx` | 94 | admin sign-in button |
| `src/components/features/admin/auth/SetupFlow.tsx` | 75 | admin setup button |
| `src/lib/server/admin/emailCode.ts` | 6, 40 | server check `EMAIL_CODE_LENGTH` |
| Copy | `src/components/features/admin/auth/EmailCodeInput.tsx:46`; `src/lib/i18n/dictionaries/en.ts:1711,2054,2060,2063,2086,2096`; `ar.ts:1720,2062,2068,2071,2094,2104` | "6-digit" wording |

Native: no native OTP code. iOS uses the `one-time-code` attribute and Android the clipboard hook above (`useOtpAutofill.ts`). `src/lib/sms/deviceOtpGate.ts` is the SMS-ingest OTP *filter*, not an input.

Smallest change: one shared constant, client-safe (no server imports):

```ts
// src/lib/auth/otp.ts
export const EMAIL_OTP_LENGTH = 6
```

- `emailCode.ts`: `export { EMAIL_OTP_LENGTH as EMAIL_CODE_LENGTH } from '@/lib/auth/otp'`, or replace the uses.
- `AuthOtpRow`: `const N = EMAIL_OTP_LENGTH`. Use `.slice(0, N)`, `' '.repeat(N)` for the padding, `N - 1` for the focus caps, `Array.from({ length: N })` and `otpDigit(i + 1, N)`.
- `useOtpAutofill`: `new RegExp(`\\b(\\d{${EMAIL_OTP_LENGTH}})\\b`)`.
- `useAuthModal`, `SecondFactorGate`, `StepUp`, `SignInScreen`, `SetupFlow`: replace `6` with the constant.
- Copy: make the strings functions of the length, or reword to "the code we emailed" (smallest).

Keep it 6 and matching the dashboard. A constant does not make the app follow a dashboard change automatically. An alternative is to accept 6-10 digits and let Supabase decide, but that is more change than QA-10 needs.

## 5. Supabase built-in templates

**If the Send Email hook is enabled (recommended), no Supabase template is needed.** Hook types cover every email Supabase can send for this app. Then "Confirm signup", "Invite user", "Magic Link", "Change Email Address", "Reset Password", "Reauthentication" and the security-notification templates are all **unused**. Admin code, staff invite and welcome never use Supabase templates.

**While the hook is off (Frankfurt today), these are needed for the product to work**, in order of importance:

1. **Confirm signup**: sign-up is blocked without a code.
2. **Magic Link**: new-device 2FA, "email me a code", the second-factor gate and the admin-code fallback.
3. **Reset Password**: in-app reset code, plus the admin-sent reset link.
4. **Reauthentication** and **Change Email Address**: no caller today, so optional. Included for completeness.
5. Not needed: **Invite user** (the app never calls `inviteUserByEmail`; staff invites use our engine). Security notifications are optional.

Notes:
- These are **English only**. Our engine would send Arabic to Arabic-preference users (`send.ts:57`). Supabase templates cannot branch on the user's language, so Arabic users get English while on the fallback.
- Expiry copy is left out because the Supabase template cannot read the setting.
- The structure, colours, logo, card, code box, note and footer are copied from `src/lib/email/blocks.ts:40-151`. Wording comes from `src/lib/email/defaults.ts`.

### Confirm signup
Subject: `Confirm your buddget account`

```html
<!DOCTYPE html>
<html lang="en" dir="ltr" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light dark" />
  <meta name="supported-color-schemes" content="light dark" />
  <title>Confirm your buddget account</title>
  <style>
    .logo-dark { display: none !important; }
    @media (prefers-color-scheme: dark) {
      .bg { background-color: #0A100F !important; }
      .card { background-color: #111917 !important; border-color: #25302E !important; }
      .well { background-color: #18211F !important; border-color: #25302E !important; }
      .rule { background-color: #25302E !important; }
      .text { color: #EAF2F0 !important; }
      .text-2 { color: #9BABA8 !important; }
      .text-3 { color: #748380 !important; }
      .ink { color: #7FE6DA !important; }
      .note { background-color: #0F2723 !important; border-color: #1FC3B2 !important; }
      .logo-light { display: none !important; }
      .logo-dark { display: inline-block !important; }
    }
  </style>
</head>
<body class="bg" style="margin:0; padding:0; background-color:#F4F7F6; font-family:'DM Sans','Helvetica Neue',Helvetica,Arial,sans-serif; -webkit-text-size-adjust:100%;">
  <div style="display:none; max-height:0; overflow:hidden; opacity:0; color:#F4F7F6; font-size:1px; line-height:1px;">Your buddget code is {{ .Token }}.</div>
  <table role="presentation" class="bg" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F4F7F6; padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" class="card" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px; background-color:#FFFFFF; border:1px solid #DDE6E4; border-radius:20px; overflow:hidden;">
          <tr><td style="height:4px; line-height:4px; font-size:0; background-color:#12B0A0;">&nbsp;</td></tr>
          <tr><td align="center" style="padding:36px 40px 8px;">
            <img class="logo-light" src="https://buddget.app/email/buddget-wordmark-ink.png" width="168" height="40" alt="buddget" style="display:inline-block; border:0; outline:none; text-decoration:none; height:40px; width:168px;" />
            <img class="logo-dark" src="https://buddget.app/email/buddget-wordmark-light.png" width="168" height="40" alt="" style="display:none; border:0; outline:none; text-decoration:none; height:40px; width:168px;" />
          </td></tr>
          <tr><td align="center" style="padding:20px 40px 0;">
            <h1 class="text" style="margin:0; font-size:24px; line-height:1.3; font-weight:700; color:#0D1A18;">Confirm your email</h1>
          </td></tr>
          <tr><td align="center" style="padding:10px 40px 0;">
            <p class="text-2" style="margin:0; font-size:15px; line-height:1.6; color:#566B68;">Enter this code in buddget to verify your email and finish setting up your account.</p>
          </td></tr>
          <tr><td align="center" style="padding:28px 40px 8px;">
            <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
              <tr>
                <td class="well" align="center" style="background-color:#ECF1F0; border:1px solid #DDE6E4; border-radius:16px; padding:22px 16px;">
                  <p class="text-3" style="margin:0 0 8px; font-size:11px; font-weight:600; letter-spacing:1.4px; text-transform:uppercase; color:#687371;">Verification code</p>
                  <p class="ink" dir="ltr" style="margin:0; font-size:40px; line-height:1.1; font-weight:700; letter-spacing:10px; color:#0B7568; font-family:'SF Mono',Menlo,Consolas,'Courier New',monospace; padding-left:10px;">{{ .Token }}</p>
                </td>
              </tr>
            </table>
          </td></tr>
          <tr><td align="left" style="padding:24px 40px 8px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td class="note" style="background-color:#E3F6F3; border-left:3px solid #0D8578; border-radius:0 12px 12px 0; padding:14px 16px; text-align:left;">
                  <p class="text-2" style="margin:0; font-size:13px; line-height:1.55; color:#566B68;"><strong class="text" style="color:#0D1A18;">Didn’t ask for this?</strong> You can ignore this email. Someone may have typed your address by mistake, and nothing happens without the code.</p>
                </td>
              </tr>
            </table>
          </td></tr>
          <tr><td align="center" style="padding:24px 40px 0;"><div class="rule" style="height:1px; line-height:1px; background-color:#DDE6E4;">&nbsp;</div></td></tr>
          <tr><td align="center" style="padding:20px 40px 32px;">
            <p class="text-3" style="margin:0 0 4px; font-size:12px; line-height:1.5; color:#687371;">Sent by buddget</p>
            <p class="text-3" style="margin:0; font-size:12px; line-height:1.5; color:#687371;">This is an automated message, please don’t reply.</p>
          </td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

### Magic Link (code-only: every app flow verifies the code with `type: 'email'`)
Subject: `Your buddget sign-in code`

```html
<!DOCTYPE html>
<html lang="en" dir="ltr" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light dark" />
  <meta name="supported-color-schemes" content="light dark" />
  <title>Your buddget sign-in code</title>
  <style>
    .logo-dark { display: none !important; }
    @media (prefers-color-scheme: dark) {
      .bg { background-color: #0A100F !important; }
      .card { background-color: #111917 !important; border-color: #25302E !important; }
      .well { background-color: #18211F !important; border-color: #25302E !important; }
      .rule { background-color: #25302E !important; }
      .text { color: #EAF2F0 !important; }
      .text-2 { color: #9BABA8 !important; }
      .text-3 { color: #748380 !important; }
      .ink { color: #7FE6DA !important; }
      .note { background-color: #0F2723 !important; border-color: #1FC3B2 !important; }
      .logo-light { display: none !important; }
      .logo-dark { display: inline-block !important; }
    }
  </style>
</head>
<body class="bg" style="margin:0; padding:0; background-color:#F4F7F6; font-family:'DM Sans','Helvetica Neue',Helvetica,Arial,sans-serif; -webkit-text-size-adjust:100%;">
  <div style="display:none; max-height:0; overflow:hidden; opacity:0; color:#F4F7F6; font-size:1px; line-height:1px;">Your buddget code is {{ .Token }}.</div>
  <table role="presentation" class="bg" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F4F7F6; padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" class="card" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px; background-color:#FFFFFF; border:1px solid #DDE6E4; border-radius:20px; overflow:hidden;">
          <tr><td style="height:4px; line-height:4px; font-size:0; background-color:#12B0A0;">&nbsp;</td></tr>
          <tr><td align="center" style="padding:36px 40px 8px;">
            <img class="logo-light" src="https://buddget.app/email/buddget-wordmark-ink.png" width="168" height="40" alt="buddget" style="display:inline-block; border:0; outline:none; text-decoration:none; height:40px; width:168px;" />
            <img class="logo-dark" src="https://buddget.app/email/buddget-wordmark-light.png" width="168" height="40" alt="" style="display:none; border:0; outline:none; text-decoration:none; height:40px; width:168px;" />
          </td></tr>
          <tr><td align="center" style="padding:20px 40px 0;">
            <h1 class="text" style="margin:0; font-size:24px; line-height:1.3; font-weight:700; color:#0D1A18;">Sign in to buddget</h1>
          </td></tr>
          <tr><td align="center" style="padding:10px 40px 0;">
            <p class="text-2" style="margin:0; font-size:15px; line-height:1.6; color:#566B68;">Enter this code in buddget to continue signing in.</p>
          </td></tr>
          <tr><td align="center" style="padding:28px 40px 8px;">
            <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
              <tr>
                <td class="well" align="center" style="background-color:#ECF1F0; border:1px solid #DDE6E4; border-radius:16px; padding:22px 16px;">
                  <p class="text-3" style="margin:0 0 8px; font-size:11px; font-weight:600; letter-spacing:1.4px; text-transform:uppercase; color:#687371;">Sign-in code</p>
                  <p class="ink" dir="ltr" style="margin:0; font-size:40px; line-height:1.1; font-weight:700; letter-spacing:10px; color:#0B7568; font-family:'SF Mono',Menlo,Consolas,'Courier New',monospace; padding-left:10px;">{{ .Token }}</p>
                </td>
              </tr>
            </table>
          </td></tr>
          <tr><td align="left" style="padding:24px 40px 8px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td class="note" style="background-color:#E3F6F3; border-left:3px solid #0D8578; border-radius:0 12px 12px 0; padding:14px 16px; text-align:left;">
                  <p class="text-2" style="margin:0; font-size:13px; line-height:1.55; color:#566B68;"><strong class="text" style="color:#0D1A18;">Didn’t try to sign in?</strong> You can ignore this email. Nobody can get in without the code.</p>
                </td>
              </tr>
            </table>
          </td></tr>
          <tr><td align="center" style="padding:24px 40px 0;"><div class="rule" style="height:1px; line-height:1px; background-color:#DDE6E4;">&nbsp;</div></td></tr>
          <tr><td align="center" style="padding:20px 40px 32px;">
            <p class="text-3" style="margin:0 0 4px; font-size:12px; line-height:1.5; color:#687371;">Sent by buddget</p>
            <p class="text-3" style="margin:0; font-size:12px; line-height:1.5; color:#687371;">This is an automated message, please don’t reply.</p>
          </td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

### Reset Password (code for the in-app flow, link for the admin-sent reset)
Subject: `Reset your buddget password`

```html
<!DOCTYPE html>
<html lang="en" dir="ltr" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light dark" />
  <meta name="supported-color-schemes" content="light dark" />
  <title>Reset your buddget password</title>
  <style>
    .logo-dark { display: none !important; }
    @media (prefers-color-scheme: dark) {
      .bg { background-color: #0A100F !important; }
      .card { background-color: #111917 !important; border-color: #25302E !important; }
      .well { background-color: #18211F !important; border-color: #25302E !important; }
      .rule { background-color: #25302E !important; }
      .text { color: #EAF2F0 !important; }
      .text-2 { color: #9BABA8 !important; }
      .text-3 { color: #748380 !important; }
      .ink { color: #7FE6DA !important; }
      .note { background-color: #0F2723 !important; border-color: #1FC3B2 !important; }
      .logo-light { display: none !important; }
      .logo-dark { display: inline-block !important; }
    }
  </style>
</head>
<body class="bg" style="margin:0; padding:0; background-color:#F4F7F6; font-family:'DM Sans','Helvetica Neue',Helvetica,Arial,sans-serif; -webkit-text-size-adjust:100%;">
  <div style="display:none; max-height:0; overflow:hidden; opacity:0; color:#F4F7F6; font-size:1px; line-height:1px;">Choose a new password for your buddget account.</div>
  <table role="presentation" class="bg" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F4F7F6; padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" class="card" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px; background-color:#FFFFFF; border:1px solid #DDE6E4; border-radius:20px; overflow:hidden;">
          <tr><td style="height:4px; line-height:4px; font-size:0; background-color:#12B0A0;">&nbsp;</td></tr>
          <tr><td align="center" style="padding:36px 40px 8px;">
            <img class="logo-light" src="https://buddget.app/email/buddget-wordmark-ink.png" width="168" height="40" alt="buddget" style="display:inline-block; border:0; outline:none; text-decoration:none; height:40px; width:168px;" />
            <img class="logo-dark" src="https://buddget.app/email/buddget-wordmark-light.png" width="168" height="40" alt="" style="display:none; border:0; outline:none; text-decoration:none; height:40px; width:168px;" />
          </td></tr>
          <tr><td align="center" style="padding:20px 40px 0;">
            <h1 class="text" style="margin:0; font-size:24px; line-height:1.3; font-weight:700; color:#0D1A18;">Reset your password</h1>
          </td></tr>
          <tr><td align="center" style="padding:10px 40px 0;">
            <p class="text-2" style="margin:0; font-size:15px; line-height:1.6; color:#566B68;">Enter this code in buddget to choose a new password, or tap the button.</p>
          </td></tr>
          <tr><td align="center" style="padding:28px 40px 8px;">
            <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
              <tr>
                <td class="well" align="center" style="background-color:#ECF1F0; border:1px solid #DDE6E4; border-radius:16px; padding:22px 16px;">
                  <p class="text-3" style="margin:0 0 8px; font-size:11px; font-weight:600; letter-spacing:1.4px; text-transform:uppercase; color:#687371;">Reset code</p>
                  <p class="ink" dir="ltr" style="margin:0; font-size:40px; line-height:1.1; font-weight:700; letter-spacing:10px; color:#0B7568; font-family:'SF Mono',Menlo,Consolas,'Courier New',monospace; padding-left:10px;">{{ .Token }}</p>
                </td>
              </tr>
            </table>
          </td></tr>
          <tr><td align="center" style="padding:28px 40px 8px;">
            <a href="{{ .ConfirmationURL }}" style="display:block; background-color:#0D8578; color:#FFFFFF; font-size:16px; font-weight:700; line-height:52px; height:52px; text-align:center; text-decoration:none; border-radius:14px;">Reset password</a>
          </td></tr>
          <tr><td align="left" style="padding:24px 40px 8px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td class="note" style="background-color:#E3F6F3; border-left:3px solid #0D8578; border-radius:0 12px 12px 0; padding:14px 16px; text-align:left;">
                  <p class="text-2" style="margin:0; font-size:13px; line-height:1.55; color:#566B68;"><strong class="text" style="color:#0D1A18;">Didn’t ask for this?</strong> Your password stays the same until you use this code or link. You can ignore this email.</p>
                </td>
              </tr>
            </table>
          </td></tr>
          <tr><td align="center" style="padding:24px 40px 0;"><div class="rule" style="height:1px; line-height:1px; background-color:#DDE6E4;">&nbsp;</div></td></tr>
          <tr><td align="center" style="padding:20px 40px 32px;">
            <p class="text-3" style="margin:0 0 4px; font-size:12px; line-height:1.5; color:#687371;">Sent by buddget</p>
            <p class="text-3" style="margin:0; font-size:12px; line-height:1.5; color:#687371;">This is an automated message, please don’t reply.</p>
          </td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

### Reauthentication (optional: no caller today; code-only)
Subject: `Confirm it’s you`

```html
<!DOCTYPE html>
<html lang="en" dir="ltr" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light dark" />
  <meta name="supported-color-schemes" content="light dark" />
  <title>Confirm it’s you</title>
  <style>
    .logo-dark { display: none !important; }
    @media (prefers-color-scheme: dark) {
      .bg { background-color: #0A100F !important; }
      .card { background-color: #111917 !important; border-color: #25302E !important; }
      .well { background-color: #18211F !important; border-color: #25302E !important; }
      .rule { background-color: #25302E !important; }
      .text { color: #EAF2F0 !important; }
      .text-2 { color: #9BABA8 !important; }
      .text-3 { color: #748380 !important; }
      .ink { color: #7FE6DA !important; }
      .note { background-color: #0F2723 !important; border-color: #1FC3B2 !important; }
      .logo-light { display: none !important; }
      .logo-dark { display: inline-block !important; }
    }
  </style>
</head>
<body class="bg" style="margin:0; padding:0; background-color:#F4F7F6; font-family:'DM Sans','Helvetica Neue',Helvetica,Arial,sans-serif; -webkit-text-size-adjust:100%;">
  <div style="display:none; max-height:0; overflow:hidden; opacity:0; color:#F4F7F6; font-size:1px; line-height:1px;">Your buddget code is {{ .Token }}.</div>
  <table role="presentation" class="bg" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F4F7F6; padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" class="card" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px; background-color:#FFFFFF; border:1px solid #DDE6E4; border-radius:20px; overflow:hidden;">
          <tr><td style="height:4px; line-height:4px; font-size:0; background-color:#12B0A0;">&nbsp;</td></tr>
          <tr><td align="center" style="padding:36px 40px 8px;">
            <img class="logo-light" src="https://buddget.app/email/buddget-wordmark-ink.png" width="168" height="40" alt="buddget" style="display:inline-block; border:0; outline:none; text-decoration:none; height:40px; width:168px;" />
            <img class="logo-dark" src="https://buddget.app/email/buddget-wordmark-light.png" width="168" height="40" alt="" style="display:none; border:0; outline:none; text-decoration:none; height:40px; width:168px;" />
          </td></tr>
          <tr><td align="center" style="padding:20px 40px 0;">
            <h1 class="text" style="margin:0; font-size:24px; line-height:1.3; font-weight:700; color:#0D1A18;">Confirm it’s you</h1>
          </td></tr>
          <tr><td align="center" style="padding:10px 40px 0;">
            <p class="text-2" style="margin:0; font-size:15px; line-height:1.6; color:#566B68;">Enter this code to continue with the sensitive change you asked for.</p>
          </td></tr>
          <tr><td align="center" style="padding:28px 40px 8px;">
            <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
              <tr>
                <td class="well" align="center" style="background-color:#ECF1F0; border:1px solid #DDE6E4; border-radius:16px; padding:22px 16px;">
                  <p class="text-3" style="margin:0 0 8px; font-size:11px; font-weight:600; letter-spacing:1.4px; text-transform:uppercase; color:#687371;">Confirmation code</p>
                  <p class="ink" dir="ltr" style="margin:0; font-size:40px; line-height:1.1; font-weight:700; letter-spacing:10px; color:#0B7568; font-family:'SF Mono',Menlo,Consolas,'Courier New',monospace; padding-left:10px;">{{ .Token }}</p>
                </td>
              </tr>
            </table>
          </td></tr>
          <tr><td align="left" style="padding:24px 40px 8px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td class="note" style="background-color:#E3F6F3; border-left:3px solid #0D8578; border-radius:0 12px 12px 0; padding:14px 16px; text-align:left;">
                  <p class="text-2" style="margin:0; font-size:13px; line-height:1.55; color:#566B68;"><strong class="text" style="color:#0D1A18;">Didn’t ask for this?</strong> Someone may be using your account. Change your password right away.</p>
                </td>
              </tr>
            </table>
          </td></tr>
          <tr><td align="center" style="padding:24px 40px 0;"><div class="rule" style="height:1px; line-height:1px; background-color:#DDE6E4;">&nbsp;</div></td></tr>
          <tr><td align="center" style="padding:20px 40px 32px;">
            <p class="text-3" style="margin:0 0 4px; font-size:12px; line-height:1.5; color:#687371;">Sent by buddget</p>
            <p class="text-3" style="margin:0; font-size:12px; line-height:1.5; color:#687371;">This is an automated message, please don’t reply.</p>
          </td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

### Change Email Address (optional: no caller today)
Subject: `Confirm your new buddget email`

```html
<!DOCTYPE html>
<html lang="en" dir="ltr" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light dark" />
  <meta name="supported-color-schemes" content="light dark" />
  <title>Confirm your new buddget email</title>
  <style>
    .logo-dark { display: none !important; }
    @media (prefers-color-scheme: dark) {
      .bg { background-color: #0A100F !important; }
      .card { background-color: #111917 !important; border-color: #25302E !important; }
      .well { background-color: #18211F !important; border-color: #25302E !important; }
      .rule { background-color: #25302E !important; }
      .text { color: #EAF2F0 !important; }
      .text-2 { color: #9BABA8 !important; }
      .text-3 { color: #748380 !important; }
      .ink { color: #7FE6DA !important; }
      .note { background-color: #0F2723 !important; border-color: #1FC3B2 !important; }
      .logo-light { display: none !important; }
      .logo-dark { display: inline-block !important; }
    }
  </style>
</head>
<body class="bg" style="margin:0; padding:0; background-color:#F4F7F6; font-family:'DM Sans','Helvetica Neue',Helvetica,Arial,sans-serif; -webkit-text-size-adjust:100%;">
  <div style="display:none; max-height:0; overflow:hidden; opacity:0; color:#F4F7F6; font-size:1px; line-height:1px;">Confirm the new email address for your account.</div>
  <table role="presentation" class="bg" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F4F7F6; padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" class="card" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px; background-color:#FFFFFF; border:1px solid #DDE6E4; border-radius:20px; overflow:hidden;">
          <tr><td style="height:4px; line-height:4px; font-size:0; background-color:#12B0A0;">&nbsp;</td></tr>
          <tr><td align="center" style="padding:36px 40px 8px;">
            <img class="logo-light" src="https://buddget.app/email/buddget-wordmark-ink.png" width="168" height="40" alt="buddget" style="display:inline-block; border:0; outline:none; text-decoration:none; height:40px; width:168px;" />
            <img class="logo-dark" src="https://buddget.app/email/buddget-wordmark-light.png" width="168" height="40" alt="" style="display:none; border:0; outline:none; text-decoration:none; height:40px; width:168px;" />
          </td></tr>
          <tr><td align="center" style="padding:20px 40px 0;">
            <h1 class="text" style="margin:0; font-size:24px; line-height:1.3; font-weight:700; color:#0D1A18;">Confirm your new email</h1>
          </td></tr>
          <tr><td align="center" style="padding:10px 40px 0;">
            <p class="text-2" style="margin:0; font-size:15px; line-height:1.6; color:#566B68;">Someone asked to change the email address of your buddget account from {{ .Email }} to {{ .NewEmail }}. Tap the button to confirm it, or use the code below.</p>
          </td></tr>
          <tr><td align="center" style="padding:28px 40px 8px;">
            <a href="{{ .ConfirmationURL }}" style="display:block; background-color:#0D8578; color:#FFFFFF; font-size:16px; font-weight:700; line-height:52px; height:52px; text-align:center; text-decoration:none; border-radius:14px;">Confirm email</a>
          </td></tr>
          <tr><td align="center" style="padding:28px 40px 8px;">
            <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
              <tr>
                <td class="well" align="center" style="background-color:#ECF1F0; border:1px solid #DDE6E4; border-radius:16px; padding:22px 16px;">
                  <p class="text-3" style="margin:0 0 8px; font-size:11px; font-weight:600; letter-spacing:1.4px; text-transform:uppercase; color:#687371;">Confirmation code</p>
                  <p class="ink" dir="ltr" style="margin:0; font-size:40px; line-height:1.1; font-weight:700; letter-spacing:10px; color:#0B7568; font-family:'SF Mono',Menlo,Consolas,'Courier New',monospace; padding-left:10px;">{{ .Token }}</p>
                </td>
              </tr>
            </table>
          </td></tr>
          <tr><td align="left" style="padding:24px 40px 8px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td class="note" style="background-color:#E3F6F3; border-left:3px solid #0D8578; border-radius:0 12px 12px 0; padding:14px 16px; text-align:left;">
                  <p class="text-2" style="margin:0; font-size:13px; line-height:1.55; color:#566B68;"><strong class="text" style="color:#0D1A18;">Didn’t ask for this?</strong> Your email stays the same until you confirm. If this wasn’t you, change your password.</p>
                </td>
              </tr>
            </table>
          </td></tr>
          <tr><td align="center" style="padding:24px 40px 0;"><div class="rule" style="height:1px; line-height:1px; background-color:#DDE6E4;">&nbsp;</div></td></tr>
          <tr><td align="center" style="padding:20px 40px 32px;">
            <p class="text-3" style="margin:0 0 4px; font-size:12px; line-height:1.5; color:#687371;">Sent by buddget</p>
            <p class="text-3" style="margin:0; font-size:12px; line-height:1.5; color:#687371;">This is an automated message, please don’t reply.</p>
          </td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

## 6. Side findings
- Frankfurt auth logs show repeated `bad_jwt: unrecognized JWT kid dd9e16b3-… for ES256` on `GET /user` (11-18 16:05-16:14). **[infer]** Clients hold tokens signed by the old Singapore keys, or the signing keys were not carried over. This is not email, but it is related to the move.
- 874 `welcome` sends failed with "RESEND_API_KEY is not set" (null user_id, 11-18 00:57-04:37) [live]. Some environment without the key writes to the production `email_log`.
- `supabase/README.md:10-23` is out of date (it says there is no sign-in OTP and that recovery is a link). The hook makes Supabase templates irrelevant.
