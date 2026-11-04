# Store privacy answers (App Store and Google Play)

Written 2026-11-02 so the first submission matches what the apps actually do. The iOS manifest (`ios/App/App/PrivacyInfo.xcprivacy`) now declares the same data types as the table below; keep the two in step with the privacy policy.

## Data the apps collect
All of it is linked to the account, none of it is used for tracking, and none is sold. The apps use no advertising identifier and show no App Tracking Transparency prompt.

| Data (Apple name / Play name) | Why | Where it comes from |
|---|---|---|
| Email address | Account, sign-in, support replies | Sign-up |
| Name | Account display | Profile |
| Phone number (optional) | Profile contact | Profile |
| User ID | Account | Sign-up |
| Device ID (push token) | Notifications | Push registration |
| Other financial info / Financial info | The app's purpose: expenses, income, debts, savings, balances | Entered by the user or read from bank messages |
| Other user content / Messages | Bank message text the user forwards (iOS Shortcut, Android SMS) so transactions are created. Raw text is masked and deleted on a schedule (`sms_retention_enabled`, daily job) | User-forwarded or received SMS |
| Photos | Receipt scanning and attachments | Camera / photo library |
| Audio | Voice expense entry (sent for transcription, not kept) | Microphone |
| Product interaction | Product analytics | App usage events |
| Crash data and performance data | Fixing crashes (Sentry) | Crash reporter |

## App Store Connect privacy label
Declare the rows above. Every type: **Linked to the user = yes, Used for tracking = no**. Purposes: App Functionality for account, financial, content, photo, audio and device data; Analytics for product interaction, crash and performance data.

Required-reason API in the app target: UserDefaults (`CA92.1`), already declared. Plugins ship their own manifests.

## Google Play Data safety
Same table: collected, not shared with third parties for their own purposes (service providers such as hosting, AI and crash reporting process it for us), encrypted in transit, deletion available in the app (Account delete) and by request.

## Things that can block approval (decide before submitting)
1. **SMS permission (Play).** `RECEIVE_SMS` is a restricted permission. Play only allows it for apps that complete the Permissions Declaration Form with an approved use case; reading bank messages to build expenses has to be argued there (core feature, on-device filtering before anything is sent, opt-in, raw text deleted). Without approval the Android build is rejected. Prepare the declaration text and a screen recording of the opt-in flow.
2. **Privacy policy URL and in-app link.** Both stores require a live policy that matches the table above, including the retention windows. Confirm the published text says what the retention job does (30 days parsed, 7 days rejected, 60-day hard cap).
3. **Account deletion.** Apple and Play both require in-app deletion. The app has it (`/api/account/delete`); mention the path in the review notes.
4. **Sign in with Apple.** Only needed if a third-party social login is offered; the app uses email sign-in, so not required today.
5. **Review notes.** Provide a demo account, explain that bank messages reach the iOS app through a user-created Shortcuts automation, and that no message is read without the user enabling it.
