# Council packet: nine decisions

Product: buddget, a personal budget app (Next.js inside Capacitor on iOS and Android, Supabase, RevenueCat). Pre-launch: about 55 internal testers, a small database instance, one owner who reviews visual changes personally. House rules: smallest change that solves the problem, reuse existing components, no speculative features, never show a state the system cannot prove, tests are mandatory for money, sync, auth and device state.

Each decision lists facts and options. No recommendation is given on purpose.

## D1. iOS SMS setup: where the truth lives
Facts: SMS arrives through an Apple Shortcuts automation the user builds by following a guide. iOS gives the app no way to see whether a Shortcut exists, was deleted or is switched off; the app only knows when the Shortcut action actually runs. Today one native flag (`setupCompleted or lastRunAt or token`) decides whether Settings shows "Set up" or the on/off switch; finishing the guide always says "Automation active" without waiting for a test SMS. The server already has, per device, `collects_sms` and `last_sms_at`, and `sms_parse_log.device_id`. Live: 7 iPhones collecting, 2 of them never delivered an SMS, 1 account with two collecting phones. A reinstall creates a new device id.
Options:
- A. Keep the native flag, fix only the wording.
- B. Derive four states (account preference, setup claimed on this phone, verified by a first SMS from this phone, health = days since the last SMS from this phone) from existing data plus one new column `user_devices.first_sms_at`. The claim stays in native storage.
- C. B, and also store the setup claim on the server per device.
Sub-questions: must the guide's Finish wait for the test SMS, or may it finish as "Not confirmed yet"? Should a Shortcut run that happens while tracking is off count as "wired"?

## D2. Buddgy "this chat is getting long"
Facts: the note fires when a chat has cost 30,000 billing units, and the same flag cuts the history sent to the model from 6 items to 2. The model never receives more than about 10 to 15 thousand tokens. Each request resends 67 tool definitions (about 7.6 thousand tokens); live data shows 14% of the prompt served from cache and 7,634 units per successful call, so the line is reachable in 2 to 4 turns. In 30 days: 37 chats, 23 with zero successful turns (an outage), 11 with one turn, the longest 7 turns. The chat is wiped after 30 minutes idle and on reload. Hard cap: 60,000 units or 40 turns.
Options:
- A. Stop trimming history by spend and remove the note; trim by conversation size with a minimum number of turns kept verbatim.
- B. A, and make the fixed prefix cheap: send only the tools relevant to the detected intent, or use explicit provider caching (has a storage cost and an expiry failure mode).
- C. A + B, and a model-written rolling summary carried silently when the hard cap forces a new internal context.
- D. C, and retrieval of relevant older turns, and persisting chats across reloads.

## D3. Buddgy actions: confirmation
Facts: Buddgy has 67 tools. Reads need nothing. Expense adds and cosmetic settings auto-apply within limits. Navigation and flow-start tools show an "Open a screen" card until the user approves one; after that a single global permission (not reset by "New chat") lets every later navigation run with no card, and the chat stays open on top of the new screen. No tool can start a purchase.
Options:
- A. Confirm every non-read action.
- B. An effect class per tool: read = nothing; navigate or start a flow = a card that names the destination (and offers "do it here" where a chat path exists), consent remembered per chat and per destination, chat closes when it navigates; write financial data = existing confirm rules.
- C. B, and build chat-native versions of flows such as the budget builder.
Sub-question: when the user explicitly says "open X", navigate at once (closing the chat) or still show a card?

## D4. Floating Buddgy button: drag
Facts: the button follows the finger only vertically; when the finger crosses the screen's middle it jumps to the other side with no travel or animation. Limits ignore safe areas and the keyboard.
Options:
- A. Side to side: the button follows the finger in both axes, springs to the nearest edge on release, plus a one-time hint.
- B. Free placement anywhere, snapping only away from controls.
- C. A with persistent arrows or a destination ghost shown on every drag.

## D5. Invitation: share image and a three-day expiry
Facts: sharing today is text plus a link. Each user has one permanent personal code. Nothing expires. There is no landing page (`/i/<code>` redirects into the app). Live: 51 codes, 0 completed referrals. Anti-abuse does not depend on the code being secret. A real expiry needs a new table of per-share tokens with `expires_at`, a check in the redeem function, and an "expired" page.
Options:
- A. No image, no expiry; fix copy only.
- B. Share image (generated on the device, a precedent exists) with no expiry.
- C. B plus a real three-day per-share token alongside the permanent code.

## D6. Cancelling a subscription
Facts: subscriptions are sold only through the App Store today (Google Play not configured, no web checkout). An app cannot cancel an App Store subscription itself; it can open Apple's manage page. A once-per-lifetime "stay" discount step already exists. Today "How to cancel" shows typed steps, even to trial users.
Options:
- A. One Manage sheet; Cancel = optional stay step with equal-weight buttons, then the store's own page; the plan shows "cancelled" only after the store's webhook confirms, with a "waiting for the store" state in between.
- B. A, plus in-app StoreKit manage sheet and RevenueCat Customer Center (new native dependency, off-system look).
- C. A, plus server-side cancel for Google through an API.

## D7. Buying on more than one platform
Facts: one entitlement row per user, written by store webhooks, latest event wins, with no check of which store transaction owns the row. Only iOS can sell today. No reconcile job exists. Live: no store event has reached the database in 30 days (setup not finished).
Options:
- A. Leave as is.
- B. Record transaction ownership so one store's events cannot overwrite another's, add a purchase guard, expose `store` to the app, add a daily reconcile job.
- C. Ask RevenueCat on every entitlement read (cached).
- D. iOS sells alone at launch; Android and web only read the entitlement; B is built before a second store is switched on.

## D8. Settings sync (the theme bug)
Facts: `user_settings` is one row per user, uploaded and downloaded whole, with `updated_at` only. The appearance tile has light, dark and System; the column is an enum of light and dark, so System is uploaded as dark and comes back as dark. Other tables in the app carry `edited_at` and a server trigger that rejects stale writes. Old app builds in the field would receive whatever the server holds.
Options:
- A. Remove System from the tile.
- B. Add `system` to the enum and stop the lossy mapping.
- C. B, and put `user_settings` under the same edit-stamp and stale-write rule as other tables, so an older device cannot overwrite a newer choice.
- D. Per-field timestamps and field-level merge.
- E. Make theme device-local and stop syncing it.

## D9. Buddgy charging: who decides a turn's final outcome
Facts: a user message can take several model calls (tool hops). Each call is charged on its own, including failed and stopped ones; Retry is a new charge. Fix direction: tag every call of one user message with a turn id; only the final outcome decides whether the turn is charged; failed turns are logged but exempt.
Options:
- A. Server only: the server marks the turn final when a call ends with an answer, or with actions none of which need another model call. No client call.
- B. The client reports "turn finished" with its outcome.
Sub-question (policy): which outcomes are free? Candidates: provider error, timeout, empty reply, safety block with no text, stream cut before any text, user Stop before any text, user Stop after partial text, a refusal written as text.
