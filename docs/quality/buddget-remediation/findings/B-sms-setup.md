# Findings B: iOS SMS shortcut setup and device state (BDG-008)

Investigator B, read-only. Code read at `origin/main` in this worktree (HEAD 3d65b36f). Store builds iOS 146 / Android vc180 were built at `75e4ce8c`; every file below is identical there for the parts quoted (checked with `git show 75e4ce8c:...` for the guide; the guide commits a6512c0f, bf7e04c6 and 0c737d1f are ancestors of 75e4ce8c). `origin/ios/one-automation-sms` differs from main here only in `SettingsSubPageShell.tsx` (4 lines) and `PrivacyInfo.xcprivacy`; nothing in the state model. `claude/wizardly-elion-081241`, `claude/inspiring-boyd-84cc3b` and `claude/ecstatic-shamir-e2f695` carry no unmerged change to these files. `claude/practical-khayyam-2539d2` does not exist on the remote.

---

## BDG-008a: Settings and onboarding mix up preference, setup, verification and health

| Field | Content |
|---|---|
| Issue ID | BDG-008 (state model part) |
| Summary | One boolean `wired` decides "Set up" versus the switch, one boolean `enabled` decides on/off, and "connected" is the newest SMS of the whole account; there is no state for "claimed", "verified by first SMS" or "suspected inactive", and finishing the guide is only a claim. |
| Severity | P1 (users see a green "Automation active" and "Connected" that the code never proved; on two-phone accounts the pill shows the other phone's SMS) |
| Reproducibility | Consistent. (1) iPhone, never set up: Settings > SMS tracking > Set up > Start > tap Next through every step without building anything > Finish. Done screen says "Automation active"; Settings now shows the switch ON. (2) Account with an Android collecting SMS and an iPhone that never ran the Shortcut: on the iPhone, Settings > SMS tracking > Setup guide shows "Connected · last SMS 5m ago". (3) Start the guide, build the automation, send the test message, press X: Settings switches from "Set up" to the switch (OFF). |
| Platform | iOS (state model); the pill bug affects iOS only (the card is iOS-only) |
| Affected components | `src/hooks/useSmsTracking.ts:76-80,120-132,233-251`; `src/components/features/settings/hub/SmsCard.tsx:17-32`; `src/components/features/settings/SmsIosSetupCard.tsx:26-34`; `src/components/onboarding/SmsTrackingGuide.tsx:100-136,171-172,216-227`; `src/components/features/onboarding/StepAutomate.tsx:33-46,93`; `ios/App/App/SmsCapacitorPlugin.swift:471-533`; `ios/App/App/CatchBankSmsIntent.swift:30-36`; `src/components/layout/AppShell.tsx:91-130`; `src/lib/devices/client.ts:33-48,101-136`; `src/lib/server/devices/registry.ts:60-99` |
| Backend dependencies | `/api/sms/setup-token` (POST/DELETE), `/api/sms/revoke-token`, `/api/sms/parse`, `/api/devices` (GET/POST/PATCH); tables `user_settings.sms_tracking_enabled`, `user_devices` (`collects_sms`, `last_sms_at`, `sms_last_result`, `sms_queue_*`), `sms_ingest_tokens` (`device_id`, `is_active`), `sms_parse_log` (`device_id`, `received_at`); view `sms_parse_today`; function `user_device_last_sms` |
| Root cause | Confirmed. The model has three facts, not four, and the UI reads the wrong one for "working": (a) **wired** is a union of three unrelated signals, one of which (`setupCompleted`) is written by tapping Finish with no check; (b) **verification** does not exist as a state: the guide's live test only colours a badge and does not gate Next or Finish; (c) **health** ("Connected") is computed from the newest `sms_parse_log` row for the user, not for this device, though a per-device value already exists in `user_devices.last_sms_at`. Onboarding and Settings share one guide component, but onboarding adds its own pre-sheet and never knows whether the guide finished. |
| Evidence | See "Current model" below. |
| Shared causes | BDG items about notifications / devices list (per-device `last_sms_at` reuse); any item about "SMS stopped working" (no health state); Android has the same `enabled`-only display. |
| Proposed solution | See "Proposed state machine" and "Options for Council". Minimal fix set: derive four separate states, gate the Done screen on the live test, read health from `/api/devices` `lastSmsAt` for `thisDeviceId`, add a "Shortcuts already exist? Skip" confirmed path, add one column `user_devices.first_sms_at`. |
| Regression risk | Account switch on a set-up phone must keep the switch (today's `wired` survives `clearCredentials`); the AppShell auto-arm path keys on `wired`; `useSetupProgress` keys on `useSmsArmed`; onboarding analytics read `settings.smsTrackingEnabled`. |
| Test that proves it | Unit, `src/components/onboarding/smsGuide.render.test.ts`: render the guide, advance to the done step without a `lastRunAt` newer than the test start; expect Finish to be absent/disabled (or the done copy to say "not confirmed yet"). Fails today (`SmsTrackingGuide.tsx:216-221`). Unit, new `useSmsTracking` test: two devices, mock `/api/devices` returning `lastSmsAt` null for this device and a recent `sms_parse_log` row from another; expect `lastReceivedAt` null. Fails today (`useSmsTracking.ts:124-131`). Native: device test on iPhone for reinstall (owner review). |
| Confidence | High for the code facts; medium for the reinstall behaviour (depends on Keychain survival, which Apple does not document). |
| Missing evidence | Live row counts (queries below); behaviour of an existing Shortcuts automation after the app is deleted and reinstalled (needs a device test). |

### 1. The current model, from code

**Fact 1, account preference ("intent")**
- `user_settings.sms_tracking_enabled`, mirrored in the store as `settings.smsTrackingEnabled`. Written by `updateSettings(...)` in `useSmsTracking.ts:184` (Android toggle), `:213` (iOS toggle), `:221` (web), `:245` (`completeIosSetup`).
- Read by: AppShell start-up only as the last fallback (`AppShell.tsx:74-87,122`, `resolveStartIntent(pending, device, account)` at `devices/client.ts:101-103`); `useSmsArmed` before the native read lands (`useSmsTracking.ts:54`); web display (`:76`); onboarding analytics (`StepAutomate.tsx:39`).

**Fact 1b, per-device role (added after the three-fact note)**
- `user_devices.collects_sms` (migration 0179). Written only through `/api/devices` PATCH via `setDeviceCollectsSms` (`useSmsTracking.ts:186,215,246`), with a localStorage replay `sms.rolePending` (`devices/client.ts:75-123`).
- Also written on first insert by the heartbeat: `registry.ts:74` sets `collects_sms = report.collects` where `collects` is `status.enabled` from `AppShell.tsx:106`. On a fresh install that is `false`.
- Read at start-up: `fetchDeviceCollectsSms` (`devices/client.ts:126-136`) beats the account setting (`resolveStartIntent`). So the project note's "intent = account" is out of date: the device row wins whenever it exists, and the account setting is used only for a phone the server has never seen.

**Fact 2, device capability ("wired")** — native, iOS
- `SmsCredentialStore.isWired = isSetupCompleted || lastRunAt != nil || token != nil` (`SmsCapacitorPlugin.swift:531`).
- `buddget.sms.setup_completed` (UserDefaults) written only by `setSetupCompleted` (`:58-61,483-485`) from `setIosSetupCompleted` (`smsTracker.ts:304-306`), called only in `completeIosSetup` (`useSmsTracking.ts:243`), which runs only from the guide's Finish (`SmsTrackingGuide.tsx:172,220` via `SmsIosSetupCard.tsx:73` and `SettingsSmsTrackingSection.tsx:9`).
- `buddget.sms.last_run_at` (UserDefaults) written by `recordRun` (`:513-517`), which the intent calls first thing on every run, before the enabled gate (`CatchBankSmsIntent.swift:35`), and the background drain on delivery (`SmsCapacitorPlugin.swift:595`).
- Ingest token: Keychain service `app.buddget.sms`, account `ingest_token`, `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly` (`:209-265,471-477`). Owner stamp `buddget.sms.token_user_id` and `buddget.sms.api_url` in UserDefaults (`:476`).
- Read by: `useSmsTracking.isSetup` (`useSmsTracking.ts:80`) -> `SmsCard.needsGuide` (`SmsCard.tsx:19`); AppShell `canArm` (`AppShell.tsx:109`).

**Fact 3, armed now** — native
- `buddget.sms.enabled` (UserDefaults), `setEnabled` (`SmsCapacitorPlugin.swift:479-481`). Read by the intent gate (`CatchBankSmsIntent.swift:36`) and by Settings `isEnabled` (`useSmsTracking.ts:76`) and `useSmsArmed` (`:31-55`).

**Token writers.** `saveSmsToken` (`smsTracker.ts:265-272`) is the only JS path to native `saveToken`, and `SmsCredentialStore.save` is only reached from the plugin method (`SmsCapacitorPlugin.swift:38-49`). Callers of `saveSmsToken`: `useSmsTracking.ts:113,205,241,259,269` and `ensureIngestToken` (`smsTracker.ts:240`, called from `AppShell.tsx:125` and `useSmsTracking.ts:169`). The "sole writer" claim holds. Tokens are device-scoped server-side: `setup-token/route.ts:66-86` inserts `device_id` from the `X-Buddget-Device-Id` header and caps active tokens per device.

**Owner stamp and account switch.** `reconcileSmsOwner` (`smsTracker.ts:281-291`) clears the native token when `tokenUserId !== userId`, including the empty legacy owner; `clearCredentials` keeps `setupCompleted`, `lastRunAt` and the queue (`SmsCapacitorPlugin.swift:490-497`). Sign-out also calls `clearSmsCredentials` (`AuthProvider.tsx:478-483`). This matches the project note.

**What Settings reads.** `SmsCard` (`SmsCard.tsx:17-32`): `isSetup` (= native `wired`) picks "Set up" row versus switch; `isEnabled` (= native `enabled`) is the switch; a "Setup guide" row appears once wired. The `/settings/sms` page (`settings/sms/page.tsx`) shows `SmsIosSetupCard`: a pill "Connected · last SMS Xm ago" when `lastReceivedAt` is under 7 days (`SmsIosSetupCard.tsx:26-34`), else "Waiting for your first SMS…", plus a button "Set up SMS tracking" / "View setup guide".

**What onboarding reads.** `StepAutomate` (`StepAutomate.tsx`): shows "done" when `sms.isEnabled` (`:93`), else "Turn on". On iOS "Turn on" opens a local sheet (`:138-154`); its "Set up" advances onboarding and navigates to `/settings/sms` (`:42-46`). So the guide itself is one implementation, reached from both places; the entry points differ (onboarding sheet versus Settings row). There is no separate "onboarding screen 2" guide in current code; if the owner means the iOS sheet in `StepAutomate`, that is where a "Skip guide" banner would go.

**Where "setup completed" is recorded.** Only `buddget.sms.setup_completed` in device UserDefaults, plus the side effects of `completeIosSetup` (`enabled=true`, account `sms_tracking_enabled=true`, device `collects_sms=true`). Nothing on the server records "this device completed the guide".

**Can leaving midway mark it complete?** The X calls `close` only (`SmsTrackingGuide.tsx:171,178`), never `onComplete`. But `wired` also turns true from `lastRunAt`, and the intent stamps it on every run, before checking `enabled` (`CatchBankSmsIntent.swift:35-36`). So a user who builds the automation, sends the test text and presses X gets the switch (OFF) instead of "Set up". Arguably correct (the automation demonstrably exists), but it is not "completion by the last CTA".

**Completion is only a claim, confirmed:**
- Next is never gated on the test: `SmsTrackingGuide.tsx:225` enables Next on every step except the last; the test screen's `connected` only changes a badge (`:100-126`).
- The Done scene says "Automation active" unconditionally (`:128-136`, copy `en.ts:3025`).
- `completeIosSetup` sets `setupCompleted` and `enabled` even when the token fetch failed (`useSmsTracking.ts:237-245`: the token block is skipped on `!res.ok`, the next three lines run anyway). The intent then queues every SMS with `no_token` until AppShell self-heals on the next start (`AppShell.tsx:115-125`).

**Health pill uses the wrong scope, confirmed.** `fetchLastReceived` filters `sms_parse_log` on `user_id` only (`useSmsTracking.ts:124-130`) though its comment says the opposite (`:117-119`). Another phone's SMS makes this iPhone show "Connected". It also counts refusal rows (`ingestRefusal.ts:22-31` inserts `status='failed'` rows into `sms_parse_log`). `/api/devices` already returns `lastSmsAt` per device and `thisDeviceId` (`devices/route.ts:39`).

**Reinstall race, confirmed in code, impact hypothesis.** On a fresh install the device id is new (`deviceId.ts`, Capacitor Preferences = UserDefaults, wiped on uninstall). The heartbeat is fired with `void` (`AppShell.tsx:106`) and inserts the new row with `collects_sms = false` (`registry.ts:74`). If it lands before `fetchDeviceCollectsSms` (`AppShell.tsx:121`), the device value `false` wins over the account preference `true`. This only matters once `canArm` is true, i.e. after the first Shortcut run on the reinstalled app, and then the phone stays OFF until the user flips the switch. Whether a pre-existing automation still runs after reinstall is unverified.

### 2. What the server already knows per device

| Signal | Where | Durable? | Notes |
|---|---|---|---|
| Token issued for this device | `sms_ingest_tokens(user_id, device_id, created_at, is_active)` | yes (retired ones trimmed by `trimRetiredIngestTokens`) | **No last-used column.** Issuing a token proves the app asked, not that a Shortcut exists. |
| Latest SMS delivered from this device | `user_devices.last_sms_at` | yes | Written only at `parse/route.ts:807`, when a log row was claimed. OTP, non-money and disarmed runs are dropped on the phone (`CatchBankSmsIntent.swift:36-48`) and never reach it. |
| Every delivered SMS by device | `sms_parse_log(user_id, device_id, received_at)`, index `sms_parse_log_device_idx` (0180) | mostly | Retention (0229) **blanks** `raw_body` on parsed/rejected rows and **deletes** only `status='failed'` rows with no linked expense/income/debt/savings/pair after `v_failed_days`. So `min(received_at)` per device over non-failed rows is a usable "first SMS seen" for history, but not guaranteed forever. Refusal rows (`failure_code` in the refusal codes) also carry `device_id`. |
| Last forward outcome, queue backlog | `user_devices.sms_last_result`, `sms_queue_pending`, `sms_queue_oldest_at`, `sms_evicted_count`, `sms_queue_reported_at` (0259/0260) | yes | Reported by `reportSmsQueue` after each drain (`AppShell.tsx:137-140`). `lastResult` can be `detected`, `skipped_otp`, `skipped_not_money`, `no_token`, `queued`, `delivered` (from `recordRun`) or a drain outcome. |
| Device alive | `user_devices.last_seen_at` | yes | Heartbeat every 4 h or on push-permission change. |

Conclusion: "first SMS seen" and "working" can be derived today from `user_devices.last_sms_at` (latest) plus `sms_parse_log` (first). A cheap, durable "first SMS seen" needs one additive column `user_devices.first_sms_at`, set with `coalesce(first_sms_at, now())` in the same update at `parse/route.ts:807` and back-filled once from `sms_parse_log`. "Suspected inactive" is derivable from `last_sms_at`, `last_seen_at` and the account's own SMS rhythm (for example: device collects, app opened in the last 2 days, `last_sms_at` older than N times the account's median gap, or older than 7 days while other sources show spending). "Automation fired here but filtered" is only on the phone (`lastRunAt`, `lastResult`) and reaches the server through the queue report's `sms_last_result`; it is not a timestamp there. No new table is needed.

### 3. What iOS can actually detect

| Question | Answer | Source |
|---|---|---|
| The required Shortcut / automation exists | **Not detectable.** No App Intents or Shortcuts API lists a user's shortcuts or personal automations. `INVoiceShortcutCenter.getAllVoiceShortcuts` returns only "shortcuts added to Siri for your app" (Add to Siri and Settings), not Shortcuts-app personal automations. | https://developer.apple.com/documentation/intents/invoiceshortcutcenter/getallvoiceshortcuts(completion:) (fetched). The negative for personal automations is **unsourced** (no Apple page states it; it is the absence of an API). |
| The shortcut was deleted | **Not detectable.** Only inferable: no run for a long time while the user otherwise spends. Silence is not proof (no bank SMS, keyword mismatch, phone off). | Unsourced (absence of API). |
| The automation is enabled | **Not detectable** by the app. Apple's guide shows the user can filter automations by "Turned On or Turned Off" inside Shortcuts; nothing is exposed to apps. | https://support.apple.com/guide/shortcuts/apdfbdbd7123/ios (fetched). Negative unsourced. |
| SMS-triggered automation runs | **Detectable when it runs**: the App Intent's `perform()` executes and the app records `lastRunAt` (`CatchBankSmsIntent.swift:35`). Apple's guide: some personal automations "can run without asking you for confirmation"; once set, "The automation will not notify you when it's triggered". Message trigger options (Sender, Message Contains) are described in Apple's guide (seen in search summary only, page body not fetched: https://support.apple.com/en-gu/guide/shortcuts/apdd711f9dff/ios). | https://support.apple.com/guide/shortcuts/apdfbdbd7123/ios (fetched); https://developer.apple.com/documentation/appintents/appintent (perform model; not fetched in full) |
| Previous install completed setup | **Not detectable from UserDefaults** (wiped on uninstall). **Inferable** from: (a) a Keychain item surviving reinstall (undocumented, see next row); (b) the server: the same account has an older iOS `user_devices` row with `last_sms_at` set; (c) the first Shortcut run after reinstall (`lastRunAt`). | see below |
| Keychain survives uninstall/reinstall | **Inferable, not guaranteed.** Apple DTS (forum post, not documentation): "Our keychain documentation has never specified what would happen in this case", and "I don't think it would surprise anyone if the 10.3 behaviour [deletion] returned". `...ThisDeviceOnly` items "do not migrate to a new device". | Forum: https://developer.apple.com/forums/thread/36442?page=2 (fetched). Docs: https://developer.apple.com/documentation/security/ksecattraccessibleafterfirstunlockthisdeviceonly (fetched) |
| identifierForVendor survives | **No** once all the vendor's apps are deleted: "The value changes when the user deletes all of that vendor's apps from the device and subsequently reinstalls one or more of them." It can also be nil before first unlock. buddget has one app, so a reinstall changes it. (The app does not use it; it uses its own Preferences UUID, which is wiped too.) | https://developer.apple.com/documentation/uikit/uidevice/identifierforvendor (fetched) |
| iCloud key-value store | **Survives reinstall and follows the Apple account to new devices** (sync "to devices with the same Apple account"), needs the iCloud KVS entitlement (not in `ios/App/App/App.entitlements` today) and an Apple account; Apple says not to store personal or sensitive data there. It would carry a "this Apple ID set up buddget SMS" hint, which is wrong for a second iPhone (the automation is per device). Survival after deletion is not stated on the page. | https://developer.apple.com/documentation/foundation/nsubiquitouskeyvaluestore (fetched) |
| DeviceCheck bits | Two server-side bits per device, "stored on an Apple server", suggested by Apple DTS for state that must outlive deletion. Pages fetched do not state reset semantics. Overkill here. | https://developer.apple.com/documentation/devicecheck/accessing-and-modifying-per-device-data (fetched) |

### 4. Proposed state machine and data model

Four independent facts, each with one owner:

| Fact | Scope | Store | Writer | Values |
|---|---|---|---|---|
| A. Preference | account | `user_settings.sms_tracking_enabled` (exists) | Settings switch | on / off |
| B. Setup claim | device | native `setup_completed` (exists) + new `user_devices.sms_setup_claimed_at` (optional, for reinstall/new-device hints and support) | guide last CTA, or confirmed "Shortcuts already exist" skip | none / claimed(at) |
| C. Verified | device | native `lastRunAt` (exists, proves the automation fired) and server `user_devices.first_sms_at` (new column, proves delivery) | intent / parse route | unverified / fired / delivered(first_at) |
| D. Health | device | derived from `user_devices.last_sms_at`, `last_seen_at`, `sms_last_result`, queue, native `enabled`, token present | nobody writes it; computed | receiving / quiet / suspected inactive / broken (no token, queue stuck) |

Plus E. Armed (native `enabled`), which is the device switch and follows `collects_sms`.

Display states for Settings on iPhone:

```
not_set_up      : !wired                             -> "Set up" button, no switch
claimed         : setup_completed && no run here yet -> switch + "Waiting for the first bank SMS" + View guide
fired           : lastRunAt set, no delivery yet     -> switch + "Shortcut ran, waiting for a bank SMS"
working         : last_sms_at for THIS device recent -> switch + "Last bank SMS 2h ago" + View guide
quiet           : last_sms_at older than the account's usual gap, phone active
                                                    -> "No bank SMS for 9 days. If you deleted the Shortcut, set it up again" (never "deleted")
broken          : armed but no token / queue stuck   -> error row (exists as native-error banner)
```

Which of the owner's proposed states can be shown truthfully:
- "Set up" with no switch when never set up: **yes**, keyed on `wired` (but `wired` must stop counting a bare token; see reinstall).
- "View guide" left of the switch when set up before: **yes**, "set up before" = claim or a run on this device.
- "Shortcuts already exist? Skip guide" banner: **yes**, as a user claim; it must land in `claimed`, not `working`.
- Completion only by last CTA or confirmed skip: **yes**, already true for `setup_completed`; the `lastRunAt` side door should stay (it is stronger evidence than a claim) but be shown as "fired", not as "set up".
- "claimed", "first SMS seen", "working", "suspected inactive" as separate states: **yes** with the data above.
- "Shortcut deleted" / "automation disabled": **cannot be shown truthfully**. Only "no bank SMS seen for N days" can.
- "Automation active" on the Done screen: **cannot be shown truthfully** unless the test step saw a run; today it is always shown.

Scenarios:
- **Reinstall, same phone.** UserDefaults and Preferences gone: `setup_completed`, `lastRunAt`, `enabled`, token owner, device id. Keychain token may survive (undocumented). On sign-in `reconcileSmsOwner` sees `tokenSaved` with owner `''` and clears it (`smsTracker.ts:288-289`), so the card shows "Set up". If the automation still exists, the first bank SMS runs the intent, stamps `lastRunAt`, and the phone becomes wired but OFF (and the heartbeat race can keep it OFF over an account preference of ON). Proposed: on "Set up" for a phone whose account already has an iOS row with `last_sms_at` (server hint), show the "Shortcuts already exist? Skip guide" banner first. Do not auto-arm on a guess.
- **New device, same account.** Nothing native. Server knows the account set up another iPhone; the automation does not move between phones (Shortcuts automations are per device; unsourced, needs a device check). Show "Set up" with the skip banner; never "working" until this device's `first_sms_at`.
- **Account switch on one device.** Keep today's behaviour: `clearCredentials` keeps `setup_completed`/`lastRunAt` (device facts) and drops token + `enabled`. New account sees the switch OFF with "View guide"; its own preference and `collects_sms` decide arming. Health must read this account's row for this device id (same device id across accounts, separate `user_devices` rows per user).
- **Two devices.** Health and "first SMS seen" per `(user_id, device_id)`. Fix the pill to this device's `lastSmsAt`.
- **Lost local storage (Preferences/UserDefaults cleared, Keychain kept).** Same as reinstall. The Keychain token with empty owner is cleared; server-side that token row stays `is_active` until capped/trimmed (orphan; the lead may want it revoked by device id on the next setup-token call for a new device id, see Council).
- **RLS.** `user_devices` is service-role only (0179); keep reads through `/api/devices`. A new column needs no policy change. `sms_parse_log` is read directly by the client today (`useSmsTracking.ts:124`); moving the pill to `/api/devices` removes that client read.

---

## BDG-008b: Guide close (X) sits above the header on iPhone

| Field | Content |
|---|---|
| Issue ID | BDG-008 (X button part) |
| Summary | The guide's X is absolutely positioned 16px from the top of a box whose header is pushed down by `safe-area-top` padding, so the X lands in the status-bar zone, above and higher than the "B" logo row. |
| Severity | P2 |
| Reproducibility | Consistent on any iPhone with a top inset (notch / Dynamic Island): Settings > SMS tracking > Set up. |
| Platform | iOS |
| Affected components | `src/components/onboarding/SmsTrackingGuide.tsx:176-178` (same at `75e4ce8c`); `.safe-area-top` in `src/app/globals.css:529-531` |
| Backend dependencies | none |
| Root cause | Confirmed. `:177` gives the inner box `relative ... safe-area-top` (`padding-top: env(safe-area-inset-top)`). `:178` places the X `absolute end-4 top-4`. An absolutely positioned child is offset from the containing block's padding box, so `top: 1rem` is measured from the top edge, ignoring the safe-area padding that moves the in-flow header (`:181-185`, `pt-5` after the inset). With a ~59px inset the X centre is ~32px from the top while the logo row is ~95px down. The steps header reserves `pe-12` for the X (`:195`) but the X is not in its row. On phones taller than 844px the `max-h-[844px]` box is centred (`:176`), which moves the box down and can hide the bug there; on 844px-class phones it shows fully. No transformed ancestor: the overlay is `fixed inset-0` at `z-[var(--z-dialog)]` (140). |
| Evidence | `SmsTrackingGuide.tsx:177` `relative flex h-full max-h-[844px] ... safe-area-top safe-area-bottom`; `:178` `className="absolute end-4 top-4 z-10"` |
| Shared causes | Any other overlay using `absolute top-N` inside a `safe-area-top` box. Existing correct pattern: `top-[calc(env(safe-area-inset-top)+1rem)]` in `ActionToast.tsx:101`, `StatusPill.tsx:48`. |
| Proposed solution | Change the X offset to `top-[calc(env(safe-area-inset-top,0px)+1rem)]`, or better put the X in flow in each header row (intro brand row and steps title row, which already reserves `pe-12`) so it aligns vertically with the logo/title. Reuses `IconButton`; no component reshaped. |
| Regression risk | Web/Android (inset 0): unchanged. Intro hero height shrinks by nothing. |
| Test that proves it | Owner review on device (visual). Optional unit: assert the X's class contains `safe-area-inset-top` or that it is a child of the header row. |
| Confidence | High |
| Missing evidence | Screenshot on a 932px-tall iPhone to confirm the centred-box case. |

---

## Existing tests covering the area
- `src/components/features/settings/hub/SmsCard.test.tsx` (switch vs guide row by `isSetup`).
- `src/components/onboarding/smsGuide.render.test.ts`, `src/components/onboarding/smsGuideSteps.test.ts` (scenes render, step/copy lengths).
- `src/lib/native/smsTracker.test.ts` (token never JWT, owner reconcile, drain).
- `src/lib/native/nativeHardening.test.ts`, `src/app/api/sms/setup-token/route.test.ts`, `src/app/api/devices/*.test.ts`, `src/lib/sms/queueWatch.test.ts`, `src/lib/sms/ingestRefusal.test.ts`.
- `e2e/`: no journey covers the iOS guide or Settings SMS states (only `e2e/ui/sweep.mjs` visits `/settings/sms`; it redirects off-iOS). The guide is native-only, so device tests are owner review.

## Options for Council (Architect, Skeptic, Pragmatist, Critic)

1. **Derive only, no schema change.** Four display states computed client-side from native `setup_completed`/`lastRunAt`/`enabled` and `/api/devices` `lastSmsAt` for `thisDeviceId`; first-SMS from `sms_parse_log` via an RPC. Cheapest; "first SMS seen" survives only as long as retention keeps rows; reinstall hints need an extra query.
2. **Derive plus one column (recommended).** Option 1, plus `user_devices.first_sms_at` (set in the existing update at `parse/route.ts:807`, back-filled once), plus gating the Done screen and Finish on the test step having seen a run (with a "I already have the Shortcut / test later" confirmed skip that records a claim), plus the pill moved to per-device `lastSmsAt`, plus `wired` no longer counting a bare token with no owner. One migration, no new table, no new native key.
3. **Server-recorded setup claim.** Option 2 plus `user_devices.sms_setup_claimed_at` written by `completeIosSetup`. Gives support and reinstall/new-device banners a fact instead of a guess; costs one more column and a write path. Useful but not required for truthful UI.
4. **Persist setup across reinstall (Keychain flag or iCloud KVS).** Rejected: Keychain survival is undocumented (Apple DTS warns it may change), iCloud KVS follows the Apple ID to other phones where no automation exists (would show a false "set up"), needs a new entitlement and a native build. The server already knows enough for a "skip guide" hint.

Recommendation: Option 2, with Option 3 if the owner wants support visibility. Fix the X separately (one-line, safe). Do not build any "Shortcut deleted" or "automation disabled" state; replace it with "no bank SMS from this phone for N days" plus a re-setup link.

## Queries for the lead
All bounded, counts and ids only.

```sql
-- 1. iOS devices: how many collect, how many ever delivered, how many delivered in the last 7 days
select count(*) filter (where collects_sms) as collecting,
       count(*) filter (where collects_sms and last_sms_at is not null) as ever_delivered,
       count(*) filter (where collects_sms and last_sms_at > now() - interval '7 days') as delivered_7d,
       count(*) filter (where collects_sms and last_sms_at is null) as collecting_never_delivered
from user_devices where platform = 'ios' and revoked_at is null;

-- 2. Accounts with more than one live collecting device (the pill bug population)
select count(*) from (
  select user_id from user_devices where revoked_at is null and collects_sms group by user_id having count(*) > 1
) t;

-- 3. sms_parse_log rows in the last 30 days with and without device_id (can first-SMS be derived?)
select count(*) filter (where device_id is not null) as with_device,
       count(*) filter (where device_id is null) as without_device
from sms_parse_log where received_at > now() - interval '30 days';

-- 4. Active ingest tokens per scope: device-bound vs null, and devices holding more than one
select count(*) filter (where device_id is not null) as device_bound,
       count(*) filter (where device_id is null) as unbound
from sms_ingest_tokens where is_active;
select count(*) from (select user_id, device_id from sms_ingest_tokens where is_active and device_id is not null
                      group by 1, 2 having count(*) > 1) t;

-- 5. Orphan tokens: active tokens whose device row is missing or revoked (reinstalls leave these)
select count(*) from sms_ingest_tokens t
left join user_devices d on d.user_id = t.user_id and d.device_id = t.device_id
where t.is_active and t.device_id is not null and (d.device_id is null or d.revoked_at is not null);

-- 6. Last forward outcome on iOS devices (is no_token / queued common?)
select sms_last_result, count(*) from user_devices
where platform = 'ios' and revoked_at is null and sms_queue_reported_at > now() - interval '30 days'
group by 1 order by 2 desc limit 20;
```
Run `EXPLAIN` first per the DB rules; query 5 joins on the `user_devices` primary key.

## Decisions that need the owner
- Whether the guide's Finish should be blocked until the test SMS is seen, or allowed with "Not confirmed yet" wording. (Blocking is stricter; some users cannot send themselves a test text right now.)
- Copy for "quiet" (never say "deleted").
- Whether a reinstalled phone of an account that collected on iOS before may show the "Shortcuts already exist? Skip guide" banner first.
- Whether account preference ON should re-arm a phone whose device row says OFF (today the device row wins, and a fresh install writes OFF).

## Decisions that need Council
- Option 2 versus 3 (store the setup claim on the server or not).
- Whether `wired` keeps counting `lastRunAt` from a run while disarmed (strong evidence, but it bypasses "completion only by last CTA").
- Whether the heartbeat should stop writing `collects_sms` on insert (send `collects` undefined when the phone is not wired) so a new device row defers to the account preference.
- Whether orphan ingest tokens (reinstall, lost storage) should be revoked when the same account issues a token for a new device id on the same platform.
