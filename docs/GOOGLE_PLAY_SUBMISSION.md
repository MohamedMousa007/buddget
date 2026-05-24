# Google Play submission — Buddget

Complete checklist for shipping the Capacitor Android build to Google Play.
**Buddget is Egypt-first** — the marketing copy below targets Egyptian users
first and treats UAE / GCC as expansion markets.

> Privacy Policy + Terms already live at `/privacy` and `/terms`. Reference
> them, don't recreate them.

---

## 1. App identity

- **App name (Play Console title):** Buddget — Budget & Expense Tracker
- **Short description (80 chars):**
  `Built for Egypt. Track EGP / AED spend by voice, receipt, and SMS.`
- **Long description:**

```
Buddget is a personal-finance tracker built for Egypt — and it works
seamlessly across the UAE and the GCC.

• Egypt-first defaults: EGP, جنيه, Egyptian banks (NBE, CIB, Banque Misr,
  QNB Alahli, AAIB, HSBC Egypt, Faisal Islamic, Bank of Alexandria,
  Banque du Caire, ADIB Egypt) — works in Arabic and English.
• Voice expenses: long-press the FAB and say "200 جنيه taxi" or
  "spent 90 EGP at Talabat". Powered by Whisper.
• Receipt scanning: snap a photo, Buddget reads the merchant, total,
  and date with Gemini Vision.
• Bank SMS auto-tracking: every transaction SMS becomes an expense — no
  copy-paste. Works in Arabic and English (تم خصم / debited / spent).
• Multi-currency: EGP, AED, SAR, QAR, KWD, OMR, BHD, USD, EUR, GBP.
• Budgets, debts, savings, and goals.
• Biometric sign-in (Face / Fingerprint).
• Home-screen widget for at-a-glance monthly spend.

Free. No ads. No bank logins. Your data stays yours.
```

- **Keywords (Play store search):** budget, expense, tracker, Egypt, EGP, UAE,
  AED, SAR, expat, GCC, voice expense, receipt scanner, SMS expense, جنيه,
  ميزانية, finance, debt tracker, savings tracker.

## 2. AndroidManifest.xml — required additions

After `npx cap add android`, merge the following into
`android/app/src/main/AndroidManifest.xml`. Capacitor scaffolds the rest.

```xml
<!-- ── PERMISSIONS ─────────────────────────────────────────── -->
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />

<!-- Push (FCM) -->
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.WAKE_LOCK" />
<uses-permission android:name="com.google.android.c2dm.permission.RECEIVE" />

<!-- Voice -->
<uses-permission android:name="android.permission.RECORD_AUDIO" />

<!-- Camera (receipt scan) -->
<uses-permission android:name="android.permission.CAMERA" />
<uses-feature android:name="android.hardware.camera" android:required="false" />

<!-- Biometrics -->
<uses-permission android:name="android.permission.USE_BIOMETRIC" />
<uses-permission android:name="android.permission.USE_FINGERPRINT" />

<!-- SMS auto-tracking — sensitive, requires Play Console justification -->
<uses-permission android:name="android.permission.RECEIVE_SMS" />
<uses-permission android:name="android.permission.READ_SMS" />

<!-- Notification Listener fallback -->
<!-- (the BIND_NOTIFICATION_LISTENER_SERVICE permission lives on the
     <service> declaration — see docs/NOTIFICATION_LISTENER.md) -->

<!-- App Group / shared keystore for the Glance widget -->
<!-- No <uses-permission> needed; SharedPreferences are intra-app. -->
```

Make sure Capacitor's `<application>` block carries `android:usesCleartextTraffic="false"`,
`android:requestLegacyExternalStorage="false"`, and a `tools:replace` line if
you need to override the FCM service icon.

## 3. Play Console — sensitive permissions form (SMS)

Google forbids `READ_SMS` / `RECEIVE_SMS` outside narrow categories
(default-SMS app, anti-fraud, banking). Buddget's justification:

```
Buddget reads incoming SMS messages from a user-curated list of bank senders
in order to automatically log financial transactions to the user's own
budget. Messages are processed locally where possible and forwarded to
the user's account on Buddget's secure backend (HTTPS, per-user bearer
tokens). Buddget is NOT a default SMS handler. The feature is opt-in:
disabled by default, requires explicit user action in Settings, and can
be revoked at any time. Egypt is our primary market — Egyptian banks send
transaction notifications via SMS more often than push, which makes this
permission essential for the core "automatic expense logging" feature.
Alternative path: users on iOS / Android with notification access disabled
use the iOS Shortcut bridge (manual-relay, no SMS permission required).
```

Attach a 30-second screen-recording showing:

1. The user enabling SMS auto-tracking inside Settings.
2. A bank SMS arriving and an expense appearing in the dashboard.
3. The user disabling auto-tracking and the immediate cessation of ingest.

## 4. Data safety form

Declare the following data collection:

| Data type | Collected | Optional | Purpose |
| --------- | --------- | -------- | ------- |
| Email address | Yes | No | Account creation, sign-in |
| Name | Yes | Yes | Personalisation |
| Financial info — purchase history | Yes | Yes | Core feature (budget tracking) |
| Photos | Yes | Yes | Receipt scanning (sent to AI, not stored) |
| Audio | Yes | Yes | Voice expense (sent to AI, not stored) |
| SMS | Yes | Yes | Bank transaction parsing (opt-in) |
| Device identifiers | No | — | We use FCM tokens, not advertising IDs |

State that **all** data is encrypted in transit (HTTPS) and at rest
(Supabase + Postgres-encrypted disks), and that users can delete their
account from Settings at any time.

## 5. Store assets

- **Icon:** 512×512 PNG. Use `public/icons/icon-512.png`.
- **Feature graphic:** 1024×500 PNG, dark navy `#0A0A0F` background, EGP +
  AED hero numbers, Egyptian skyline silhouette.
- **Phone screenshots (≥ 4, max 8):** 1080×1920 PNG. Recommended set:
  1. Dashboard with EGP budget hero.
  2. Voice recording sheet with Egyptian Arabic transcript.
  3. Receipt scan result (Talabat receipt).
  4. SMS auto-tracked expense from CIB.
  5. Biometric sign-in screen.
  6. Home-screen widget composite.
- **Tablet screenshot:** 1200×1920 PNG, optional.

## 6. Pricing & countries

- **Price:** Free.
- **Countries:** Launch in `Egypt` first, then add `United Arab Emirates`,
  `Saudi Arabia`, `Qatar`, `Kuwait`, `Oman`, `Bahrain`. Keep `United States`
  and `United Kingdom` available for diaspora users.

## 7. Pre-launch report

Enable the pre-launch report in Play Console. It runs on Google's device farm
to catch crashes. Add a robot-account email and password (or skip by setting
`<meta-data android:name="firebase_messaging_auto_init_enabled" android:value="false" />`
to avoid sending tokens for the test devices).

## 8. Post-launch

- Crashlytics: enabled via the Firebase plugin.
- Performance Monitoring: optional, costs render-time. Disable by default.
- A/B test the onboarding screen messaging in Egyptian Arabic vs English.
- Track DAU split: Egypt vs UAE vs other GCC. Iterate on bank SMS regex
  whenever a previously-ignored Egyptian bank format shows up in
  `sms_parse_log` with low confidence.

## 9. Re-submission checklist

- Bumped `versionCode` and `versionName` in `android/app/build.gradle`.
- Re-ran `npm run cap:build` against the deployed API.
- Privacy Policy URL still resolves: `https://buddget.app/privacy`.
- Terms URL still resolves: `https://buddget.app/terms`.
- Tested on a real Egyptian SIM with bank SMS auto-tracking.
- Verified the Glance widget renders EGP + جنيه correctly.
