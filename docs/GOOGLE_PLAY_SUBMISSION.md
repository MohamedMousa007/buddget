# Google Play submission — Buddget

Complete checklist for shipping the Capacitor Android build to Google Play.
**Buddget is Egypt-first** — the marketing copy below targets Egyptian users
first and treats UAE / GCC as expansion markets.

> Privacy Policy + Terms already live at `https://buddget.app/legal/privacy` and
> `https://buddget.app/legal/terms` (Arabic: `/ar/legal/privacy`, `/ar/legal/terms`;
> `/privacy` and `/terms` redirect). Reference them, don't recreate them.
> Data safety answers live in **`docs/STORE_PRIVACY.md`** (the single source);
> section 4 below only maps them onto the Play form.

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
<!-- ── PERMISSIONS (exactly what android/app/src/main/AndroidManifest.xml declares) ── -->
<uses-permission android:name="android.permission.INTERNET" />

<!-- Push (FCM) -->
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />

<!-- SMS forwarding runs as a data-sync foreground service on API 24-30 (Android 14+ needs the type) -->
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_DATA_SYNC" />

<!-- Voice expense -->
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />

<!-- Receipt scan -->
<uses-permission android:name="android.permission.CAMERA" />

<!-- Biometrics -->
<uses-permission android:name="android.permission.USE_BIOMETRIC" />
<uses-permission android:name="android.permission.USE_FINGERPRINT" />

<!-- SMS auto-tracking: restricted, needs the Play Console declaration (section 3).
     RECEIVE_SMS only. The app never reads the inbox, so there is no READ_SMS. -->
<uses-permission android:name="android.permission.RECEIVE_SMS" />
```

There is no Notification Listener service and no location, contacts, advertising-ID
or storage permission anywhere in the app. If the manifest changes, update this
block and `docs/STORE_PRIVACY.md` in the same commit.

Make sure Capacitor's `<application>` block carries `android:usesCleartextTraffic="false"`,
`android:requestLegacyExternalStorage="false"`, and a `tools:replace` line if
you need to override the FCM service icon.

## 3. Play Console — sensitive permissions form (SMS)

Google restricts `RECEIVE_SMS` to a short list of approved use cases. Buddget
declares only `RECEIVE_SMS` (no `READ_SMS`, no default-SMS-handler role). Its
justification:

```
Buddget receives incoming SMS messages (RECEIVE_SMS only; it never reads the
inbox) and, on the device, keeps only messages from business senders or that
match transaction keywords. Those messages are forwarded to the user's own
account on Buddget's backend (HTTPS, per-user token), parsed there into an
expense, and the raw text is masked and deleted on a schedule. Buddget is NOT
a default SMS handler. The feature is opt-in:
disabled by default, requires explicit user action in Settings, and can
be revoked at any time. Egypt is our primary market — Egyptian banks send
transaction notifications via SMS more often than push, which makes this
permission essential for the core "automatic expense logging" feature.
Alternative path: iOS users, and Android users who do not grant the permission,
enter transactions manually or by voice/receipt; iOS also has a Shortcuts
automation that relays bank messages without any SMS permission.
```

Attach a 30-second screen-recording showing:

1. The user enabling SMS auto-tracking inside Settings.
2. A bank SMS arriving and an expense appearing in the dashboard.
3. The user disabling auto-tracking and the immediate cessation of ingest.

## 4. Data safety form

The authoritative list is the table in **`docs/STORE_PRIVACY.md`** ("Data the apps
collect"); declare exactly those rows and keep the two stores' answers identical.
Mapping onto the Play form:

| Play category / type | Collected | Shared | Optional | Purpose |
| --- | --- | --- | --- | --- |
| Personal info: Email address | Yes | No | No | Account management |
| Personal info: Name | Yes | No | Yes | Account management |
| Personal info: Phone number | Yes | No | Yes | Account management (optional profile field) |
| Personal info: User IDs | Yes | No | No | Account management |
| Financial info: Other financial info | Yes | No | No | App functionality (expenses, income, debts, savings, balances) |
| Messages: SMS or MMS | Yes | No | Yes (opt-in) | App functionality: bank message text is filtered on the device, forwarded to the backend and parsed there; the raw text is masked and deleted on a schedule |
| Photos and videos: Photos | Yes | No | Yes | App functionality (receipt scan; the image goes to the AI reader, the picture itself stays on the device) |
| Audio: Voice or sound recordings | Yes | No | Yes | App functionality (voice expense; sent for transcription, not kept) |
| App activity: App interactions | Yes | No | No | Analytics (first-run funnel events, `app_analytics_events`) |
| App info and performance: Crash logs, Diagnostics | Yes | No | No | Analytics (Sentry; a short one-way hash of the device id is the only device tag) |
| Device or other IDs | Yes | No | No | App functionality (FCM push token, app-generated device id for biometric sign-in and trusted devices). Not the advertising ID |

"Shared" is No for every row: hosting, AI and crash-reporting providers act as
service providers processing the data for Buddget, which Play does not count as
sharing. No data is used for advertising, tracking or sold.

State that **all** data is encrypted in transit (HTTPS) and at rest
(Supabase + Postgres-encrypted disks), and that users can delete their
account from Settings at any time (and by request at support@buddget.app).

Decisions applied (conservative defaults; change only if the owner knows better):

1. **Sender numbers.** Declare the sender address (including a personal phone number that
   passes the `SmsGate` transaction-keyword check) as SMS-derived data: tick "Phone number"
   under SMS, collected, not shared, optional, with the same purposes as the other SMS data.
2. **Receipt images.** `/api/receipt/scan` sends the image to Gemini. Declare it as processed
   by a service provider. The statement "not kept" must be re-confirmed against the AI
   provider's current retention terms before every submission (owner check, cannot be done from code).
3. **Play RECEIVE_SMS approval.** Without the Permissions Declaration Form approval the
   Android build is rejected (see `docs/STORE_PRIVACY.md`). Submit the declaration first.

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
- Privacy Policy URL still resolves: `https://buddget.app/legal/privacy` (and the Arabic page `https://buddget.app/ar/legal/privacy`).
- Terms URL still resolves: `https://buddget.app/terms`.
- Tested on a real Egyptian SIM with bank SMS auto-tracking.
- Verified the Glance widget renders EGP + جنيه correctly.
