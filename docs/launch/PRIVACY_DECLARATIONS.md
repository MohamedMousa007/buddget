# Privacy declarations: App Store labels and Play Data safety

Drafted 2026-11-20 (S9) from the code, the iOS manifest and the published policy. The owner enters these in App Store Connect (App Privacy) and Play Console (Data safety); nothing here was submitted. Supersedes the table in `docs/STORE_PRIVACY.md` (which stays as history). The published text is `/legal/privacy` and `/legal/terms`; the policy was brought in line with this file on 2026-11-20.

## 0. Headline answers

| Question | Answer | Evidence |
|---|---|---|
| Tracking (Apple) | **No.** No App Tracking Transparency prompt | `NSPrivacyTracking` false, no tracking domains; `PrivacyInfo.xcprivacy` |
| Advertising ID (Play and Apple) | **Not collected, not read.** Play "Advertising ID": No | Facebook SDK removed (`capacitor.config.ts` `facebook: false`, test `nativeHardening.test.ts`); no ads SDK in `package.json`, `build.gradle`; no IDFA / `ASIdentifierManager` use in `ios/App`; `AD_ID` permission explicitly removed in `AndroidManifest.xml` with `tools:node="remove"` (added in S9, so a library cannot merge it back) |
| Ads shown | None | Play "Ads": No |
| Data sold or shared for advertising | No | Policy sections 4 and 5 |
| Third-party SDKs that collect | Sentry (crash), RevenueCat (purchases), Firebase Cloud Messaging (push token). All are service providers | `package.json` |
| Encrypted in transit | Yes (TLS) | Policy section 9 |
| Deletion | In app (Delete Account) and by email request | `/api/account/delete`; policy section 6 |
| Data linked to the user | All of it. None is anonymous | |

On the first build after S9, open the merged manifest (`android/app/build/intermediates/merged_manifests`) and confirm there is no `AD_ID` line; if one is present, the Play "Advertising ID: No" answer is wrong.

## 1. What is collected and why

All collected data is linked to the account, none is used for tracking, none is sold.

| Data | Why | Source | Optional |
|---|---|---|---|
| Email address | Account, sign-in codes, support replies, one-trial and one-invite checks (keyed hash) | Sign-up, Google, Apple | Required |
| Name, profile photo | Display | Profile | Name required, photo optional |
| Phone number | Profile contact | Profile | Optional |
| Country, city | Currency and local defaults; typed by the user, not read from the device | Profile | Optional |
| User ID | Account | Server | Required |
| Device ID | Sync, notifications, trial and invite abuse checks. App-generated, not the advertising ID | `/api/devices` | Required |
| Push token | Notifications (FCM on Android and web, APNs on iOS) | Push registration | Optional |
| Device model, platform, app version, notification permission, SMS-capture state | Support and sync | `/api/devices` | Required |
| Financial info: expenses, income, debts, savings, balances, budgets, goals, payment methods, subscriptions | The app's purpose. The user enters it or approves what was read from bank texts. No bank login, no bank connection | User, SMS | Required to use the app |
| SMS text (section 3) | Create transactions | User turns the feature on | Optional, off by default |
| Photos | Receipt scanning; receipt images attached to expenses. Scans are processed and not kept; attached images stay on the device | Camera, photo library | Optional |
| Audio | Voice expense entry. Sent for transcription, deleted straight after | Microphone | Optional |
| Purchase history | Plan, trial, Pro renewals, Sparks balance, refunds | RevenueCat, App Store, Google Play | Only if the user buys |
| Loyalty points, tier, streak, invites | Rewards | App | Automatic |
| Buddgy messages and the short notes Buddgy saves | Answer questions. No transcript kept; usage counts and the notes are | User | Optional |
| Product interaction | One daily activity record per user (`analytics_touch`), feature usage counts | App | Automatic |
| Crash and performance data | Fixing crashes (Sentry): account id, device info, scrubbed on the device first, `sendDefaultPii: false`, no traces | Crash reporter | Automatic |
| Biometrics | **Not collected.** Face ID and fingerprint stay in the operating system; the app only learns pass or fail | | |
| Location | **Not collected** from the device | | |
| Contacts, calendar, health, browsing history, advertising data | **Not collected** | | |

## 2. Apple privacy nutrition label (App Privacy)

Every type below: **Linked to the user: Yes. Used for tracking: No.** Tracking question: "No, we do not track". Privacy policy URL: `https://my.buddget.app/privacy` (the URL already used on the subscriptions; `https://buddget.app/legal/privacy` is the in-app path).

| Apple category | Apple type | Purposes to tick |
|---|---|---|
| Contact Info | Email Address | App Functionality |
| Contact Info | Name | App Functionality |
| Contact Info | Phone Number | App Functionality |
| Financial Info | Other Financial Info | App Functionality |
| Purchases | Purchase History | App Functionality |
| User Content | Emails or Text Messages | App Functionality |
| User Content | Photos or Videos | App Functionality |
| User Content | Audio Data | App Functionality |
| User Content | Other User Content (Buddgy messages and saved notes) | App Functionality |
| Identifiers | User ID | App Functionality |
| Identifiers | Device ID | App Functionality |
| Usage Data | Product Interaction | Analytics, App Functionality |
| Diagnostics | Crash Data | App Functionality, Analytics |
| Diagnostics | Performance Data | App Functionality, Analytics |

Do not tick: Health and Fitness, Location, Contacts, Search History, Browsing History, Sensitive Info, Advertising Data, Other Data.

`ios/App/App/PrivacyInfo.xcprivacy` now matches this list (S9 added Purchase History and Emails or Text Messages; the rest was already there). Required-reason API: UserDefaults `CA92.1`. Plugins ship their own manifests; after the next archive, run Xcode's "Generate Privacy Report" and look for a type missing here.

Sign in with Apple: Google sign-in is offered, so Apple sign-in must stay available on iOS (it is).

## 3. SMS handling (the paragraph both stores want)

- **Off by default.** The user turns it on in Settings and allows the permission. It can be turned off or the permission revoked at any time.
- **Android:** `RECEIVE_SMS` only (no `READ_SMS`, no `SEND_SMS`). A receiver sees new messages; the app does not read the inbox. Play's Permissions Declaration Form (core feature, screen recording) is owner step H0.1.
- **iOS:** no SMS permission exists. Messages reach the app only through a Shortcuts automation the user creates, which forwards the text.
- **What leaves the phone** (QA-71 wording): messages from business senders (banks, wallets, companies) that contain a number, and other messages that look like a transaction. Personal conversations that are neither are not sent.
- **On our servers:** parsed by learned patterns first. When none matches, the text is sent to Google Gemini to extract amount, merchant and date. When a new pattern is learned, the model sees a masked version only. Gemini is on the paid tier (no training on it).
- **Kept:** the extracted expense (amount, merchant, date, category) stays with the account. The raw text is deleted after at most 30 days (7 days if rejected or if it holds a one-time code; up to 60 days while waiting for the user to confirm). Only a masked copy, with numbers, names and account details removed, is kept for improving parsing; rarely seen patterns go after 180 days. No raw message is kept longer than 60 days.
- Never sold, never used for advertising, encrypted in transit and at rest.

Play Data safety category: Messages > **SMS or MMS**.

## 4. Google Play Data safety form

Top questions: collects data **Yes**; all data encrypted in transit **Yes**; users can request deletion **Yes** (in-app and by request; give the support email and the policy URL as the "delete data" link); Families policy **No** (18+).

"Shared" means transferred to a third party that may use it for its own purposes. Hosting, AI, crash, email and billing providers act for us, so they are **not** sharing under Play's definition. Answer **No** to "shared" on every row.

| Play category | Type | Collected | Purpose | Optional | Processed ephemerally |
|---|---|---|---|---|---|
| Personal info | Name | Yes | App functionality, account management | Required | No |
| Personal info | Email address | Yes | App functionality, account management | Required | No |
| Personal info | User IDs | Yes | App functionality, account management | Required | No |
| Personal info | Phone number | Yes | App functionality | Optional | No |
| Financial info | Purchase history | Yes | App functionality | Optional | No |
| Financial info | Other financial info (the budget data the user enters or approves) | Yes | App functionality | Required | No |
| Financial info | Payment info (card, bank) | **No**: the stores take payment, we never see it | | | |
| Messages | SMS or MMS | Yes | App functionality | Optional | No (raw text deleted on a schedule, section 3) |
| Messages | Emails, other in-app messages | **No** (recommended: Buddgy chats are not kept as a transcript; the saved notes are covered under Other financial info and App activity). Owner to confirm | | | |
| Photos and videos | Photos | Yes | App functionality | Optional | Yes (scans are processed, not kept) |
| Audio | Voice or sound recordings | Yes | App functionality | Optional | **Yes** (deleted after transcription) |
| App activity | App interactions | Yes | Analytics, app functionality | Required | No |
| App info and performance | Crash logs | Yes | Analytics | Required | No |
| App info and performance | Diagnostics | Yes | Analytics | Required | No |
| Device or other IDs | App-generated device id, push token | Yes | App functionality, fraud prevention | Required | No |
| Location | Approximate or precise | **No** | | | |
| Health and fitness, Contacts, Calendar, Files and docs, Web browsing | | **No** | | | |

The **Advertising ID** question in App content is already answered No (2026-11-19) and stays No.

## 5. Who gets what

| Provider | Gets | Why | Region |
|---|---|---|---|
| Supabase | Everything in the account | Database, auth | Frankfurt (eu-central-1) |
| Vercel | Requests as they pass | Hosting | fra1 |
| Google (Gemini) | Buddgy context, receipt images, SMS text for the fallback parse (masked for learning) | AI | United States |
| Groq (Whisper) | Voice audio | Transcription, not retained | United States |
| Sentry | Account id, device info, scrubbed error events | Crash reports | Per the Sentry project (confirm) |
| RevenueCat | Account id, purchase records | Subscriptions, Sparks | United States |
| Apple, Google Play | Payment, refunds | Stores | |
| Firebase Cloud Messaging, APNs | Device token, notification title and short body | Push | |
| Resend | Email address, message | Sign-in codes, resets, support replies | |
| Linear | Feedback text and account id (not email) | Support tracker | |

## 6. Review notes (both stores)

- Demo account: the owner creates a fresh account in the Frankfurt project with a "Layla Hassan" persona and puts the credentials in the review form only, never in the repo (open item in `docs/launch/STORE_SETUP.md`).
- SMS: off by default; Android receive-only; iOS through a user-created Shortcut; nothing is read until the user turns it on; the reviewer can see the whole flow in Settings > Integrations > SMS Tracking, and the app works fully without it.
- Account deletion: Settings > Delete Account.
- Purchases: Pro subscriptions and Sparks packs through the stores' billing; Restore Purchases is in Plan and billing; no external payment link.

## 7. Open points that touch these answers

1. The Gemini fallback parse sends the SMS text readable (masked only when learning a pattern). The policy now says so. If the owner wants masking there too, that is a code change and the policy sentence can then be softened.
2. The "Emails, other in-app messages" row: owner to confirm the No recommendation.
3. Sentry region: confirm the project's data region and fix the cell above.
4. Re-check this file after any new SDK, permission or personal-data field.
