# Exclusions, multi-device SMS collection and the devices list (plan, no code yet)

Written 2026-10-23 from the code, the live schema and a market pass. Items marked *(unverified)* could not be confirmed from a source and need a device or console check.

## 0. The short answer

1. **Exclude from spending**: two switches that both change reporting only, never the real balance: one on the payment method (Settings), one on the transaction (inside the existing edit form, no new section).
2. **Collect SMS on one phone, see it on the other**: the server already does most of this. SMS goes phone to ingest endpoint to the account's ledger, then a realtime broadcast and a push reach every signed-in device, and confirming a pending item is a server call that works from any phone. What is missing is the control layer: a per-device role, attribution (which phone collected it), a health view, and quieter pushes on the collector. So the work is small and low risk.
3. **Devices list**: needed, and small, because it is where you see the collector's health and remove a lost phone. It is the control plane for feature 2, so build them together.

## 1. What the code does today (relevant facts)

- **Ingest is account-level, not phone-level.** `POST /api/sms/parse` resolves the user from the device's ingest token, writes `sms_parse_log` and the expense/income, then calls `nudgeUser` (private broadcast on `user:<id>`, event `sms`) and `sendNativePush` (every row in `push_tokens` for the user). Other phones answer the nudge with one delta pull.
- **Pending items are server rows.** `sms_parse_log.awaiting_confirmation`; `/api/sms/confirm` takes a session, not a device. A pending item collected on the iPhone can be confirmed on the Android phone today.
- **Device-scoped tokens already exist** (`sms_ingest_tokens.device_id`, migration 0093; header `X-Buddget-Device-Id`). `sms_parse_log` has no device column, so nothing records which phone collected a message.
- **SMS intent is one flag per account** (`user_settings.sms_tracking_enabled`). Armed = this phone is wired AND the account intent is on. Turning SMS off on one phone therefore turns it off for every phone. That is the one real conflict with the two-phone case.
- **`push_tokens` has no device id**, so the collector phone gets a push for its own SMS and a revoked device cannot be targeted precisely.
- **`trusted_devices` and `biometric_devices` exist** for login security; there is no general device registry.
- **Spending is decided in one place by category**: `isNonSpendCategory` (`src/lib/constants/categoryMeta.ts`), called from about twelve spots (calculations, budget plans and facts, Flow ledger, expense list/form, widget sync, card balance, Buddgy reports). `payment_methods.track_sms` already exists and only governs SMS.

## 2. Feature 1: exclude from spending

**What leaders do.** Account-level switch plus transaction-level switch (Copilot "Exclude", Monarch hide-from-budget, Wallet "Exclude from statistics", Rocket Money "ignore", Actual off-budget accounts). They agree that excluded items stay visible with a badge and a filter, and that exclusion affects spending and budget totals, not the account's real balance. The known pitfalls are balance drift, double counting when the relative repays, and silent exclusion that makes totals look wrong.

**Design.**
- `payment_methods.exclude_from_spending boolean default false` and `expenses.exclude_from_spending boolean default false`. Both additive; old clients ignore them.
- One new predicate `countsAsSpend(expense, methodsById)` = not a non-spend category, not flagged itself, not on a flagged method. It replaces the twelve `isNonSpendCategory` call sites for spend purposes, with a parity test over the existing fixtures so nothing else changes.
- **Reporting flag only.** Excluded rows still move the account balance and still count toward what a card owes (your father-in-law's hotel on your card is still owed to the bank). They drop out of spending totals, budgets, category charts, insights, Buddgy reports, widget numbers and budget alerts. Goal auto-allocation reads surplus, so excluded items correctly stop shrinking it.
- **Payment method** (Settings, payment method sheet, next to the SMS switch): "Don't count in my spending", with one line of help ("For a card or wallet someone else uses"). Open decision below on net worth.
- **Transaction** (expense edit form): one switch row "Don't count in my spending" in the existing more-options group, so no new space. A small "Not counted" badge on the row, a filter chip in Flow, and an undo toast when toggled from a list.
- **SMS**: a message matched to an excluded method is still recorded (balance stays true) and is created already excluded, without a review prompt or push.
- Recurring templates carry the flag. Refunds of an excluded expense inherit it.
- **Phase 2, optional**: "Paid for someone": attach an owed amount and name to an excluded expense, reusing the debt engine as a receivable, so a later repayment closes it instead of counting as income (the double-counting pitfall).

## 3. Feature 2: collect on one phone, use another

**Platform reality** *(partly unverified)*. iOS has no API to read the SMS inbox; the only supported path is the Shortcuts "Message" automation with Run Immediately, which we already ship, and the message filter extension is not usable as a feed. Android reading SMS is restricted by Google Play policy to approved cases; the existing Play declaration must stay current. Realtime on the Supabase free tier allows 200 concurrent connections, so one channel per foreground device is fine.

**Architecture: one account, many devices, devices have roles.**
1. A device registry (feature 3) with, per device: `collects_sms` and `notify_on_sms` roles.
2. SMS arming becomes per device: a phone collects if it is wired and its own role is on. The account flag stays only as "someone collects", so switching off on the Android phone no longer disarms the iPhone.
3. `sms_parse_log.device_id` (nullable), set from the ingest token. This gives per-collector "last message" and a clean audit.
4. Push policy: notify every device with `notify_on_sms` except the collector by default (the collector can opt in).
5. Delivery path, in order of speed: realtime broadcast to foreground phones (sub-second), high-priority push to backgrounded phones (typically seconds), catch-up pull on open or resume so a missed push never loses anything. The database is the truth; push and broadcast are hints (already how it works).
6. **Collector mode** on the secondary phone: after signing in with the same account, one switch "Use this phone only to collect bank texts". It lands on a single status screen (Connected, last text received, Stop) and the guide ends with "you can close the app". iOS keeps the Shortcut; Android keeps the receiver.
7. **Pairing without friction**: the main phone shows "Collect from another phone" with a link or QR that opens the app's sign-in on the other phone; no codes to retype. Signing in is the consent step and the collector shows what it will read.
8. Security: ingest tokens stay per device and revocable; removing a device kills its token and push token. Raw bodies are already gated in the portal as financial content. PDPL wording for the collector consent should be confirmed with a local lawyer *(unverified)*.

## 4. Feature 3: devices list (needed, keep it small)

Settings, Security, "Your devices": name and model, platform, "This device", last active, role chips ("Collecting texts"), and Remove. Backed by `user_devices` (device_id per user, platform, model, user-editable name, app version, `last_seen_at` updated on open and at most every few hours, `collects_sms`, `notify_on_sms`, `revoked_at`); `push_tokens` gains `device_id`. Remove revokes the ingest and push tokens; signing the device out of Supabase auth is limited to what the Auth API supports, so the first version removes SMS and push access and shows a clear "signs out within the hour" note *(to verify)*. Skip coarse IP location: it adds privacy surface for little value here. Admin portal gets a read-only device count on User 360.

## 5. Build order

| Slice | Content | Risk |
|---|---|---|
| A. Exclusions | migration, `countsAsSpend` + parity tests, method and expense switches, badge/filter/undo, SMS inheritance | Medium (touches many totals; guarded by the parity test) |
| B. Device registry | `user_devices`, heartbeat, `push_tokens.device_id`, Devices screen, remove | Low |
| C. Collector | per-device arming, `sms_parse_log.device_id`, push policy, collector mode, pairing link, guide wording | Medium (native iOS and Android touch points; needs on-device test) |
| D. Paid for someone (optional) | receivable on an excluded expense | Medium |

Slices A and B are independent and can start now. C needs B. Native changes in C mean a build and a real two-phone test; nothing ships to stores without your instruction.

## 6. Decisions for you

1. When a payment method is excluded because it is not yours, should its balance also leave your net worth? Recommendation: a second switch, off by default, shown only when the first is on.
2. Should the collector phone get push notifications for its own messages? Recommendation: no by default, with an opt-in.
3. Do you want "Paid for someone" (receivable) in this round? Recommendation: ship A to C first, add D after you have used A.
4. Is the iPhone Shortcut already set up and working on that phone? If yes, slice C may be mostly UI; I would test the existing path with your two phones before building anything native.
