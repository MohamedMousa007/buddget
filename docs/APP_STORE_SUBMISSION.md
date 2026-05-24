# App Store submission — Buddget

End-to-end checklist for shipping Buddget to the iOS App Store via the
Capacitor wrapper. **Egypt is the primary market**; UAE / GCC are expansion.

> Privacy Policy + Terms already live at `/privacy` and `/terms`. Reference
> them, don't recreate them.

---

## 1. App Store Connect basics

- **App Name:** Buddget — Budget & Expense Tracker
- **Bundle Identifier:** `online.buddget`
- **Subtitle (30 chars):** `Track EGP & AED smartly`
- **Promotional text (170 chars):** `Built for Egypt. Voice expenses,
  receipt scan, and bank-SMS auto-tracking with EGP / AED — works across the
  GCC.`
- **Description:** _(reuse copy from `docs/GOOGLE_PLAY_SUBMISSION.md` §1)_
- **Keywords (100 chars total):**
  `budget,expense,tracker,Egypt,EGP,AED,UAE,GCC,voice,receipt,SMS,جنيه,ميزانية`
- **Support URL:** `https://buddget.app/support`
- **Privacy Policy URL:** `https://buddget.app/privacy`
- **Marketing URL:** `https://buddget.app`

## 2. Categories

- **Primary:** Finance.
- **Secondary:** Productivity.

## 3. Info.plist additions (required)

Capacitor scaffolds `ios/App/App/Info.plist`. Append the following keys before
the final `</dict>`:

```xml
<key>NSCameraUsageDescription</key>
<string>Buddget uses the camera so you can scan receipts and turn them into
expenses automatically. Photos are not saved to your library.</string>

<key>NSMicrophoneUsageDescription</key>
<string>Buddget uses the microphone so you can record an expense by voice
(e.g. "spent 90 EGP at Talabat"). Audio is sent securely for transcription
and not stored after processing.</string>

<key>NSSpeechRecognitionUsageDescription</key>
<string>Buddget uses speech recognition to turn your voice into a typed
expense, with Arabic and English support.</string>

<key>NSFaceIDUsageDescription</key>
<string>Buddget uses Face ID so you can sign in instantly without typing
your password.</string>

<key>NSUserNotificationUsageDescription</key>
<string>Buddget sends notifications for budget alerts, recurring debt
reminders, and confirmation of auto-detected SMS transactions.</string>

<key>NSPhotoLibraryUsageDescription</key>
<string>Buddget can pick a previously taken receipt photo from your
library to scan it. We do not modify or upload anything else.</string>

<key>UIBackgroundModes</key>
<array>
  <string>remote-notification</string>
</array>

<key>ITSAppUsesNonExemptEncryption</key>
<false/>

<key>CFBundleLocalizations</key>
<array>
  <string>en</string>
  <string>ar</string>
</array>

<key>CFBundleAllowMixedLocalizations</key>
<true/>

<key>UISupportedInterfaceOrientations</key>
<array>
  <string>UIInterfaceOrientationPortrait</string>
</array>

<key>LSApplicationQueriesSchemes</key>
<array>
  <string>https</string>
</array>
```

## 4. Capabilities (Xcode → Signing & Capabilities)

- Push Notifications.
- Background Modes → Remote notifications.
- App Groups → `group.online.buddget` (also on the Widget extension target).
- Sign in with Apple (when OAuth is enabled).
- Keychain Sharing (optional, for sharing the Supabase session with the
  watchOS companion if added later).

## 5. Asset checklist

- **App icon:** 1024×1024 PNG (no alpha channel) at
  `public/icons/icon-1024.png`. Re-export at every required size or use
  Asset Catalog automation in Xcode.
- **Launch screen:** dark `#0A0A0F` background with white Buddget wordmark.
- **Marketing screenshots:** 6.7" / 6.1" / 5.5" at 1290×2796, 1170×2532,
  and 1242×2208 respectively. Recommended set (Egypt-first):
  1. Dashboard with EGP hero number and Egyptian-Arabic month label.
  2. Voice expense sheet showing "200 جنيه taxi to office".
  3. Receipt scan result for Talabat / Otlob.
  4. SMS auto-tracking screen showing CIB / NBE.
  5. Face ID unlock.
  6. Widget showcase on iPhone home screen.
- **App Preview video** (optional, 15–30s). Show voice → receipt → SMS in EGP.

## 6. Privacy nutrition labels

Disclose, in this order:

| Data | Linked to user? | Used to track? | Purpose |
| ---- | --------------- | -------------- | ------- |
| Contact info — Email | Yes | No | Account auth |
| Identifiers — User ID | Yes | No | Server sync |
| Financial info — Other (expenses) | Yes | No | App functionality |
| Audio data | No | No | Voice input (transient) |
| Photos | No | No | Receipt OCR (transient) |
| Diagnostics — Crash data | No | No | App stability |

Do **not** declare advertising data, location, or contacts — Buddget collects
none.

## 7. Test account for App Review

Create a sandbox Supabase user with the email `appreview@buddget.app` and a
strong password. Pre-seed it with:

- 5–10 expenses across EGP, AED, SAR.
- One sample receipt scan.
- One pending SMS transaction at confidence 0.65 (so the reviewer can see
  the confirm prompt).
- Biometric sign-in disabled (so the reviewer can sign in with the password).

Document this in **App Review Information → Notes**.

## 8. Build pipeline

```bash
NEXT_PUBLIC_API_BASE_URL="https://buddget.app" npm run cap:build
npx cap open ios
```

In Xcode:

1. Select the `App` scheme.
2. Choose **Any iOS Device (arm64)**.
3. **Product → Archive**.
4. **Distribute App → App Store Connect → Upload**.
5. Bump `CFBundleShortVersionString` and `CFBundleVersion` for each upload.

Use TestFlight to ship internal builds to the QA group in Cairo before public
release.

## 9. Common rejection traps

- **Missing privacy strings.** Every entitlement above must have a non-empty
  `*UsageDescription`. Reviewers will reject blanks.
- **SMS-related copy on iOS.** iOS doesn't grant SMS read access — reviewers
  flag any UI implying it does. The iOS path uses Shortcuts; describe it as
  "user-relayed via Shortcuts" in screenshots and copy.
- **Background modes.** Only `remote-notification` is justified. Remove any
  Capacitor-injected background modes you don't actually use.
- **Demo currency.** App Review historically pushes back on UAE-only screenshots
  for Egypt-targeted apps. Mix at least 2 EGP / جنيه screens to make the
  Egypt-first positioning visible at a glance.

## 10. Re-submission checklist

- [ ] Bumped `CFBundleShortVersionString` and `CFBundleVersion`.
- [ ] Updated screenshots if UI changed materially.
- [ ] Verified Face ID + biometric sign-in still works after Capacitor
      sync.
- [ ] Confirmed `/privacy` + `/terms` URLs resolve in production.
- [ ] Tested receipt scan and voice expense on a physical iPhone.
- [ ] Submitted via TestFlight to internal testers first.
