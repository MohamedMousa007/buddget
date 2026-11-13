# Alerts redesign: audit, critique rounds, final plan

Status: proposal, nothing built. Mockups: Claude design canvas "Buddget Alerts System" (7 boards). Written 2026-11-12.

## 1. What exists today (app-wide)

| Surface | Where | Form today |
|---|---|---|
| Offline, sync failed | `OfflineBanner`, `SyncFailureBanner` | `StatusPill`, fixed top, z 58, swipe-up to hide 10 min |
| Gold price feed down | `wealth/page.tsx` | a third `StatusPill`, same fixed spot |
| Update ready (web) | `UpdateToast` | glass card, fixed bottom, z 200, over the tab bar |
| Update required (native) | `UpdateGate` | full-screen `alertdialog` (fine, keep) |
| Questions: late payday, income match, SMS review, unplaced SMS, account found, subscription found, plan change, zakat | `BannerStack` fed by `useRegisterPrompts` | overlay card, fixed top, z 58, up to 3 CTAs, dots, swipe |
| Page nudges: goal behind, debt goal, budget upgrade, subscription nudge, assign payment | inline `PromptBanner` or hand-built | three visual dialects |
| Offline captures waiting | `PendingCapturesChip` | in-flow chip, ✕ **deletes the oldest queued capture** |
| Results and errors | `useActionToast`, 31 non-admin callers | one green ✓ pill, fixed top, z 200 |
| Field and sheet messages | ~20 hand-made `role="alert"` lines and boxes | red text, `*-soft` boxes, no shared component |
| Bell inbox | `NotificationInbox` in `DesktopHeaderBar` | dropdown of local alerts (due, goals, trials); only on pages that show that header |
| Buddgy tips | `BuddgyNudgeWatcher` | bubble by the FAB, daily cap and dwell time (the best-arbitrated surface today) |
| Push pre-prompt | `PushPrePromptSheet` | sheet; "Not now" backs off a month (the precedent for backoff) |

## 2. Verified defects, by severity

P1
1. **Failures shown as success.** 17 non-admin toast calls report failure (`saveFailed`, `moveFailed`, `paidFailed`, `removeFailed`, `deleteBlocked`, `errorMessage(e)`, `sheetUnavailableOffline`, `biometricOwnedByOther`, `undoPocketSpent`, storage full). The non-undo toast is always solid green with ✓. Worst files: `WithdrawSheetV3` (5), `DevicesSheet` (3), `BiometricLoginToggle` (2).
2. **Data loss.** `PendingCapturesChip` ✕ calls `finishJob(jobs[0].id)`: deletes the oldest offline receipt or voice capture and its media, no confirm.
3. **Silent writes.** "Missed" on a late payday writes a missed income event and settles the prompt with no toast and no undo. Income match "Link it" likewise.

P2
4. Fixed-top collision: prompt card, status pill, wealth pill and toast share coordinates; the pill hides the card title, the toast hides both and the header back button.
5. Update card (z 200) covers the tab bar; ✕ and "Not now" are the same action.
6. Six dismissal dialects (3 h snooze, 10 min hide, local permanent, synced permanent, own localStorage key, in-memory `useState` on Goals).
7. Nag loops: single-CTA prompts (SMS review, subscription found, unplaced SMS) can only be snoozed 3 h.
8. Three CTAs break the documented two-CTA contract; one card per detected account; dots row grows with N.
9. Visible card is picked by index, so a new higher-priority prompt shifts what the user is reading.
10. No live region on the stack; swipe-only gestures (cycle, hide pill) have no button or keyboard path.
11. `UnplacedSmsPrompt` duplicates the inline row Accounts already shows; `ZakatBasisPrompt` is a Wealth decision drawn as a global overlay.
12. Toasts fire over open sheets, covering the sheet's own CTA.
13. `DataCard` import result is a permanent `<p role="status">`.

P3
14. Pager dots are `aria-hidden`; the glass update card lowers contrast; admin toasts use hard-coded English.

## 3. Critique rounds

Plan v1 (the first proposal): four forms (strip, in-flow card on Home and Flow, toast at the bottom, inline notice); aggregate kinds; "Not now" 24 h, auto-settle after three.

**Round 1: product and safety.**
- Reach: a card only on Home and Flow means a money question can go unseen. The old overlay showed everywhere, which is also why it annoyed. Fix: accept Home and Flow as the daily money surfaces; add a parked-items count to the bell where the bell exists; push already covers held SMS. Record the residual risk.
- Auto-settle after three snoozes is a silent money decision for obligations (SMS review, unplaced SMS, late payday): the user would stop being asked while balances stay wrong. Fix: two classes. Obligation = never auto-settles, parks in the list. Suggestion = may stop for good.
- Flat 24 h snooze is naggy and arbitrary. Fix: escalating 1 d, 3 d, 7 d (the push pre-prompt already backs off a month).
- `PendingCapturesChip` is a fifth in-flow chip with a destructive ✕. Fix: fold into the needs-you list as an obligation; delete moves inside the scan sheet behind a confirm.
- The bell inbox already exists; v1 ignored it. Fix: keep it for informational alerts; do not duplicate.

**Round 2: on the fixes.**
- Bottom toast collides with the FAB, the numpad and sheet CTAs. Fix: no toasts over a sheet. A failure inside a sheet is an inline notice next to the button; toasts are for results after the sheet closes. This also removes 12 of the 17 failure toasts from the toast system.
- In-flow strip changes layout when offline flaps. Fix: show only after 2 s offline, keep at least 3 s, animate height; strip is the first child of `PullToRefresh` like `PendingCapturesChip` is today.
- Multi-device: a snooze counter stored locally resets on reinstall. Fix: acceptable. Only "settled" is synced, via the existing `promptState`; counters are local.

**Round 3: the card and the list (your feedback).**
- "1 of N / Next" wastes a row and cycling is not a task. Fix: remove both. "Later" hides this one and the next slides up. The count becomes a tab tucked under the card; tapping it opens the full list.
- "Not now" at the same weight as the answer is not an answer. Fix: "Later" lives in the eyebrow; buttons are only real answers, tonal secondary instead of ghost.
- Three buttons: move "Not mine" and "Link existing" into the sheet the card opens. A card has at most two buttons and never a form.
- One card per account: aggregate per kind; the sheet answers every row, then a single Apply and a single Undo.

**Round 4: engineering.**
- Where does arbitration live? Today it is spread across `BannerStack`, `StatusPill`, `useHiddenStatus`. Fix: one pure module `lib/alerts/` (pick strip, pick card, backoff, page suppression) with unit tests; hosts only render.
- Suppression rule: a global card is not shown on the page that already hosts its own inline UI (Accounts for unplaced and accounts found, Subscriptions for subscriptions found).
- Reuse: do not reshape `PromptBanner`, `StatusPill`, `ActionToast`. Add variants with unchanged defaults. New only where nothing fits (`InlineNotice`, the list sheet), and say so.
- Existing storage keys (`dismissedBanners`, `snoozedBanners`, `hiddenStatusUntil`, `promptState`) keep working; add `snoozeCount`. `buddget-debt-goal-dismissed` moves to `settlePrompt` and stays in the `clearBudgetData` list until the migration ships.

**Round 5: risk, a11y, i18n.**
- Arabic and long titles: 2-line clamp, 14-character CTA budget in a two-equal-column row at 375 px, logical properties only; eyebrow wraps under large text.
- Announce only a new top item (polite), not every re-render; errors use `role="alert"`; "Later" and the tab are real buttons; strip ✕ is 44 px.
- Undo toasts: income match, missed payday, accounts Apply, plan change. Not on SMS confirm (a real entry already exists and is editable).
- Shipping: web changes land on PWA immediately; native picks them up on the next local `native-release.sh`. No native code is touched.

**Round 6: what is still weak (kept open on purpose).**
- Merging "Bank messages" and "No account" into one card needs a composed sheet; deferred until the two-card version proves noisy.
- Bell integration (needs-you count in the bell) is optional phase 3: the bell is not on every header.
- Toast placement: bottom above the tab bar is chosen because nothing else is fixed at the top any more; revisit if the FAB overlaps on small phones.

## 4. Final spec

Four forms plus the unchanged blocking gate.

1. **State strip**: in flow, one slot, 48 px, visible ✕ (hides 10 min, returns only if still true). Merges by priority: offline > sync failed > price feed (Wealth only) > update ready. Offline shows "· N SMS waiting" when captured SMS exist.
2. **Needs-you card**: in flow on Home and Flow. Anatomy: eyebrow (kind, "Later"), chip + title + body (2 lines), one full-width or two equal answers, tab with "+N more need you" that navigates to Inbox, Needs you tab (no list sheet). Aggregated per kind. Priority: late payday, payday match, bank messages, no account, accounts found, subscriptions found, plan change, waiting captures.
3. **Toast**: bottom above the tab bar, one at a time, queued; success (green check on a neutral surface), undo, warning (amber), error (red, with Retry when it can retry; stays 6 s minimum or until closed). Never over a sheet.
4. **Inline notice**: in flow, tones info, warn, error, success; no dismiss; `role="alert"` only for error.

Backoff. Obligation: Later returns after 1 d, 3 d, 7 d, then parks in the list (never settled). Suggestion: same schedule, then settled for good and synced. Waking hours rule from `snooze.ts` is kept.

Page-local nudges (goal behind, debt goal, budget upgrade, assign payment, subscription nudge, zakat) use the same card, rendered by their page, and settle through `settlePrompt`.

## 5. Reuse map

Reused as is: `ModalShell`, `V3SheetHeader`, `SheetBody/SheetFooter`, `Button`, `IconButton`, `SelectField`, `SelectableCard`, `BrandMark`, `AccountPicker`, `FoundAccountsSheet`, `UnplacedSmsSheet`, `SmsReviewSheet`, `settlePrompt`, `usePromptStore`, `useRegisterPrompts`.
Additive variants (defaults unchanged): `PromptBanner variant="card"`; `StatusPill` strip form (or a `StatusStrip` if variants reach 3); `ActionToast` `tone`.
New: `InlineNotice` (replaces ~20 hand-made boxes), the Needs you tab on the existing `/notifications` page (replaces the planned list sheet), `lib/alerts/` selectors.
Extended: `FoundAccountsSheet` finds cards too and gets the three-answer row, link picker, Apply and Undo; `SmsReviewSheet` button labels name the answer.

## 6. Slices (each ends with `npm run verify`)

- S0 (safe, no redesign): toast `tone` + convert the 17 failures (sheet ones to inline); `PendingCapturesChip` ✕ stops deleting; undo for missed payday and match; `DataCard` import result. Test: a toast with `tone:'error'` is not green; chip ✕ leaves the job.
- S1 `lib/alerts/` selectors and backoff, with tests (priority, suppression, 1/3/7 d, obligation never settles).
- S2 Needs-you host in `AppShell` for Home and Flow, tab and parked row link to `/notifications?tab=needs-you`, aggregation; remove the overlay mount.
- S3 Sheets: accounts found (three answers, link picker, Apply + Undo), review-message labels.
- S4 Page-local migration; debt goal to `settlePrompt`.
- S5 Status strip merge, debounce, remove `UpdateToast`.
- S6 Docs: `DESIGN_SYSTEM.md` alerts section; delete dead code; QA harness pass in light, dark, Arabic, 375 px.

## 7. Volume, stacking and "Later" (round 7)

Question: with 4, 5 or 9 pending, must the user press Later on each? Will banners spam and cover the app?

Findings. Material describes banners as persistent, non-modal and one at a time (the one-at-a-time wording comes from a mirror, not Google's page). Apple and Android both say keep interrupting channels few and group the rest (thread identifier, group summary). No authority publishes a snooze interval; Gmail's presets are "later today, tomorrow morning, this weekend, next week", i.e. morning anchors, not "24 h from now".

Decisions.
- Chrome on Home is fixed: one strip, one card, one tab. The tab ("+N more need you") is the only place count appears, so 9 waiting is the same height as 1. Nothing is overlaid; the card scrolls with the page.
- The card shows an item only if its cost grows with delay (Tier A: late payday, held bank messages, unplaced expenses). Suggestions (accounts found, subscriptions found, plan change, zakat, debt goal, upgrade) are Tier B: count only, never a card, never a push.
  - Exception that removes the risk: an undetected account causes unplaced expenses, which is Tier A and its card opens the accounts sheet.
- Nobody presses Later N times. Per item, optional. In bulk: "Move all to later" on the Inbox Needs you tab, explicit, with one Undo toast.
- Swipe on the card = Later for that one card; the Later button is the same action (gesture is never the only path). Tab and rows are not swipeable. No swipe on desktop.
- Arrive on entry, never mid-task: the card slot is decided when the app opens or Home gains focus. An item appearing while the user looks raises the count only; it does not slide in and push content. Removal (answered) animates out. The old stack woke itself on a timer and popped in mid-use.
- Later schedule: next 09:00, then +3 d 09:00, then +7 d 09:00, then park. Obligations park in the list (never settled); suggestions settle for good after the third. Snooze is synced for Tier A keys so a push is never sent for something already deferred on another phone.
- All parked: a muted untinted row "9 waiting · back tomorrow 09:00", no ✕. It is the front door to the list, never a request.

## 8. Where parked items live; desktop; the bell (round 8)

Today: the bell exists only on desktop web (`AuthNavButtons`, `!isNative()`); the mobile header says "No notification bell"; `/notifications` is a web-only page; native has no in-app inbox, so a cleared push leaves no trace. The bell lists informational alerts, with one action (recurring due). It shows nothing the user can act on for money questions.

Decisions.
- One Inbox on every platform, route `/notifications` (kept, extended): tabs **Needs you** (open actions, same data as the card, grouped Now, Suggestions, Later with "Do now") and **Updates** (today's bell content, unchanged).
- Entry points: count badge on the avatar (mobile and desktop, same number), the tab/row under the card, a profile-menu item, push taps; on desktop also the bell, which gains a Needs you section above Updates and an "Open inbox" link, and a count on the sidebar Home item. No new header icon on mobile (no room, no new button).
- Desktop (lg+): strip and card sit in the content column at the page's own max width, not full-bleed across the sidebar. Toasts anchor to the content area (today they centre on the whole window). Keyboard: real buttons, dropdown closes on Escape (already true).
- Web has no push. Tab title shows "(3) Buddget" and `navigator.setAppBadge` is used where supported (installed PWA), both feature-detected.

## 9. Push: what is true, and the plan (round 9)

What exists. Server fan-out is FCM/APNs to `push_tokens` through `emitNotification` (idempotent on `dedupe_key`). The hourly cron evaluates due debts, month end, subscription digest/trial/price and goal alerts inside 09:00 to 21:00 local time. Held SMS has its own push. Device targeting (`pushTargets`) respects the main phone and per-device switches. `public/sw.js` has a `push` handler and `/api/push/register` accepts `platform: 'web'`, but nothing in the web client obtains a web token and nothing sends to one. The Settings switch on web calls `Notification.requestPermission()` and then shows "on": it promises notifications that never arrive.

Gaps.
1. None of the needs-you kinds except held SMS is pushed; they are computed only on the client from the local store.
2. No cross-type daily cap: a trial, a price change, a goal and a due bill can all fire at 09:00.
3. Push settings have four topic switches (due, price, goal progress, goal behind) that do not match the Inbox groups.
4. `pushRoute` has no route for the needs-you kinds.

Plan.
- Extract the pure evaluators (late payday, held messages, unplaced expenses, accounts found, plan change) into `lib/alerts/` so the app and the cron share one definition, like `evaluateAlerts` already does. Card, inbox, badge, tab title and push all read the same result.
- Push only Tier A and bills/trials. Suggestions never push.
- Budget: at most one needs-you push a day, merged into a digest (one collapse key / thread) when several become due in the same run; soft ceiling of 4 pushes a week across all kinds. Held bank messages are exempt because they answer something the user's own phone just did.
- Late payday: first late day 09:00, once more at +3 d, then in-app only.
- Before sending, the cron checks the synced answer (`promptState`) and the synced snooze; an answer on any device cancels the push and the badge everywhere. Because Tier A answers write synced state, this needs no new table.
- Settings (app): master switch plus three groups matching the Inbox (Money questions, Bills and trials, Insights), mapped to Android channels. Insights default off. Existing four switches migrate into the groups.
- Settings (web): switch disabled with an explanation ("Push is in the app. On the web, alerts show in your Inbox and the tab title"). No browser permission prompt. Real web push is a later project (needs a browser token flow and a sender).
- Add routes in `pushRoute` for the new types; unknown types keep the last screen as today.

## 10. Critique rounds 7 to 9

**Round 7 (on the stacking rules).**
- Hiding suggestions could starve account detection, which matters for SMS accuracy. Fix: the harm is unplaced expenses; that is Tier A and names the fix.
- "Never mid-task" could hide a new late payday for a long session. Fix: the count (avatar, tab, tab title) updates live; only the card slot waits for the next entry.
- A muted parked row on Home is still chrome. Fix: untinted, no ✕, only when something is parked or un-snoozed; it is the single front door.

**Round 8 (on the inbox).**
- Merging "Needs you" (stateful, resolves) with "Updates" (read/unread) in one badge confuses semantics. Fix: the badge counts open Needs you items only; Updates keep their own unread dot inside the tab.
- Reusing `/notifications` keeps deep links working; no new route.

**Round 9 (on push).**
- Synced snooze for Tier A keys adds a write per Later. Acceptable: few keys, and it removes the worst push (a nudge minutes after the user said Later).
- A digest hides which item is urgent. Fix: digest title names the top item; the inbox opens on it.
- Weekly caps come from vendor blogs about marketing. They are judgement, not a standard; make them config, not code constants, so they can be tuned.

## 11. Revised slices (each ends with `npm run verify`)

- S0 unchanged (failure toasts, capture ✕, undo for silent writes, import result).
- S1 `lib/alerts/` evaluators and selectors with tests (priority, Tier A/B, suppression, backoff, shared by app and cron).
- S2 Needs-you host (card, tab, parked row; tab and row navigate to Inbox), swipe = Later, "Move all to later", arrive-on-entry rule.
- S3 Sheets: accounts found, review-message labels.
- S4 Inbox: Needs you tab on `/notifications`, avatar badge, bell section, sidebar count, tab title and app badge.
- S5 Page-local migration; status strip merge; remove overlay and `UpdateToast`.
- S6 Push: cron uses shared evaluators, digest, daily cap, answered/snoozed check, group settings and Android channels, web switch disabled, new `pushRoute` entries. Needs a Supabase migration only if a synced snooze column is added to settings; check `supabase/migrations/` first.
- S7 Docs and QA pass (light, dark, Arabic, 375 px, desktop 1280).

## 12. Settled (round 10, user answers)

1. Later schedule: next 09:00, then +3 d, then +7 d, then park (money) or settle (suggestions). Accepted.
2. Push: one needs-you push a day with digest, soft weekly ceiling of 4, Insights off by default. Accepted.
3. Ship S0 alone first as a bug-fix release. Accepted.
4. Web: keep the current structure. Web push stays deferred; the Settings switch is left as is. Known cost: on web it asks the browser for permission and then says "on" while nothing is sent. Revisit when web push is built.
5. Inbox: agreed (two tabs on `/notifications`). Designed against the design system (board 10).
6. No bell is added to any header. Mobile entry is the profile menu only. The desktop bell that already exists is left as is and opens the Inbox.

## 13. "Later" semantics (corrects section 7)

Later is per item, never "all".
- Tapping Later (or swiping) on a card snoozes that one item (next 09:00, then 3 d, then 7 d) and closes the card slot for the rest of this visit. The other items are not snoozed; they appear on the next entry. They stay in the tab and the Inbox meanwhile.
- Answering a card (any real answer) continues the flow: the next Tier A item takes the slot, until none are left. This replaces the earlier "next slides up after Later", which was itself a mid-task pop-in.
- Tier A is usually 0 to 3 items; the 9 in earlier examples are mostly suggestions, which never take the slot.
- The only bulk action is "Move all to later" in the Inbox (Needs you tab), explicit, with one Undo toast.

## 14. Design-system conformance (from the board 10 critique)

- Use existing components only: `SegmentedControl` (with `count`), `Card` with `divide`, `Button` variants by meaning, the page header pattern of the current notifications page, 10px uppercase section labels, `Badge` in the profile menu.
- Money-in answers ("It arrived", "Yes, link it") use `Button variant="success"`; all other answers `secondary` (tonal). Teal `default` is not used inside lists. The card CTA colours on board 5 were updated to match.
- The avatar keeps its setup progress ring and % pill; the needs-you indicator is a dot at the opposite corner, never a second badge. Count is in the profile menu row.
- UI layout stays LTR per the system; Arabic changes the font only. Button labels stay within 15 characters.
- Copy: "Review messages", "Place expenses", empty state "You're all caught up / We'll show anything that needs you here."

## 15. Open items before building

- The tonal fill in mockups uses the elevated token value; implementation uses the real `secondary` variant.
- Weekly push caps and the 1/3/7 schedule should be config, not constants.
- Nothing has been built. Start order once you say go: S0, then S1 to S7 in section 11.

## 16. Council on "Later" (round 11): proposed replacement for section 13, awaiting your OK

Method: no skill named "arena" exists; `ecc:council` was used (my own position written first, then three independent voices given only the question: Skeptic, Pragmatist, Critic).

Findings.
- Section 13 never defined "next visit". It meant "the next time the slot is evaluated" (app opened, Home focused), which differs per device and cannot be tested. All three voices called it the worst option; two of three also rejected my own first preference (one-tap "Later" for the whole slot) because it hides money-affecting items behind a dismissal.
- A Later button on an in-flow card is a redundant control: ignoring the card is already free because it scrolls away and covers nothing. Snooze exists to stop *interrupting* things.
- A schedule that ends by parking an item in the Inbox "for ever" is the way a held bank message or unplaced expense gets lost while balances stay wrong.

Proposed rule (D+).
- No Later button on the card. The eyebrow's right side holds a quiet overflow (44px) with one item, "Remind me tomorrow" (snoozes that item once to the next 09:00). The Inbox is where deliberate snoozing and "Move all to later" live.
- Decay changes density, never visibility. Impression = card in the viewport for at least 1 s, counted at most once per calendar day, stored locally. After 2 impression-days an item becomes a compact one-line row (title plus the cost line, e.g. "balance off by 45.00") and is demoted from the card slot to the count tab, so it never blocks a worse item behind it.
- Money items (late payday, held messages, unplaced expenses) never disappear and never auto-park. They return to a full card when the cost grows (more messages, lateness crosses 3 d then 7 d).
- Slot order is by cost of delay, not arrival.
- Card content is a pure function of state (item, impressions, snooze, cost): no "visit", no per-session surprises.
- Synced: settled answers and snooze-until for these items (so a push is not sent for something deferred). Local: impression counts.
- Push stays as in section 9; the one daily push is reserved for items whose cost grew since the last push.

Risks to watch. Decay by impressions can shrink an item the user never actually read, so the compact row must carry the cost line. Impressions must not count a half-loaded Home. Users who cannot resolve an item today (waiting on a bank) need the overflow "Remind me tomorrow" to be discoverable.

Supersedes: the 1 d / 3 d / 7 d Later schedule in sections 7, 12 and 13, if you approve. Boards 3, 5, 7 and 8 still show a "Later" button and will be updated once you decide.

## 18. Structure review (round 12): sections 7, 13 and 16 are superseded by this

Trigger: user doubted overlay vs inline (Flow is the home tab, an inline card costs space daily), pointed out that "Later until next visit" means a banner never disappears, and asked for a whole-plan review.

Council (second round, three fresh voices plus my own position written first): all four chose **contextual placement** (option O6) with a quiet marker and the Inbox, and rejected a global banner of any kind. Cut by all: Later, decay, impression counting, "+N more", per-visit logic. Strongest dissent: contextual placement can fail silently for a user who never opens the page where an item lives (held messages and unplaced expenses make balances wrong; web has no push). Patches adopted: avatar dot, a mark on the affected figure, held messages on the Flow ledger, one push at 7 days (native), and measuring how often answer items occur before adding anything louder.

Root cause found: the plan treated a pending item (a condition, true until the data changes) like an event (dismissible, snoozable). Conditions are quiet and in place; only events (a new SMS, a threshold crossed) are loud and one-shot.

Recommended structure (boards 11 to 14).
- Forms: state strip (global, one slot), contextual row (one component, on the page where the item changes a number), quiet markers (avatar dot, mark on the affected figure, count in the profile menu), Inbox (existing page, Needs you and Updates), toast and inline notice. Push (native) is a later phase.
- Answer items (late payday, held bank messages, unplaced expenses): not dismissible; clear when the data changes. Escalation: amber dot, red at 7 days, one push at 7 days, then nothing.
- Suggestions (accounts found, subscriptions found, plan change, zakat, goal behind, debt goal, budget upgrade): shown on their own page and in the Inbox. "Not interested" is permanent and synced through the existing `settlePrompt`, with an Undo toast. No snooze anywhere.
- Where items live: Flow In (late payday), top of the Flow ledger (held messages), Accounts (unplaced expenses, accounts found), Subscriptions, Wealth (zakat), Debts, Goals, Budget. Reports and Settings show only the strip. A page never shows an item that does not affect it.
- Removed from the earlier plan: Later, overflow "Remind me tomorrow", decay and impression counting, "+N more" tab and list sheet, parked row, "Move all to later", 1/3/7 schedule, synced snooze, aggregation cards, the global card, tab title and app badge, the desktop bell section (the existing desktop bell is untouched).

Build order (each phase ends with `npm run verify`): P0 bug fixes (unchanged from S0); P1 one row component, contextual rows, state strip, inline notice, remove the overlay; P2 Inbox tabs, avatar dot, figure markers, "Not interested"; P3 push (shared evaluators, one push at 7 days, settings groups, Android channels); optional later: a one-line Flow row only if usage shows misses.

Decisions for the user (defaults in brackets): D1 held messages as a row at the top of the Flow ledger [yes] or dot and Inbox only; D2 late payday on Flow All as a marker on the In figure [marker only] or marker plus a row after 7 days; D3 escalation [dot, then red and one push at 7 days]; D4 "Not interested" [permanent] or 30-day rest; D5 build order [as above].

## 17. Navigation change (user, round 11)

The "+N more need you" tab, the parked row and push taps navigate to the Inbox with the Needs you tab open (`/notifications?tab=needs-you`). There is no list sheet. Sections 4 to 6, 7 and 11 are updated.

## 19. FINAL (round 13, council 3): taps, global events, audit. Supersedes 7, 13, 16 and refines 18 and 17.

Decisions D1 to D5 accepted as recommended (held-messages row at top of Flow ledger; late payday = mark only on Flow All; red dot plus one push at 7 days; "Not interested" permanent; build order P0 to P3).

**Tap rule: the item count decides, never the surface.** One item or one kind: open that item's resolving sheet in place (Flow row, Inbox row, push deep link). Two or more kinds: row copy is "N things need you" and goes to Inbox, Needs you. Avatar dot and menu count go to Inbox. Strip does its own action, never a list. This narrows section 17 (aggregate entry only goes to Inbox).

**Global events, four tiers.** Gate: update required (server flag, kill switch, fails open, shown before session gate), session expired, 2FA challenge. Strip (one slot, in page flow below the header, shell-level, derived, never dismissible, never carries needs-you items; priority storage full > sync failing > offline > maintenance; no "+N"). Needs-you item plus dot: SMS permission revoked (also Flow row, native), new-device sign-in (immediate push, exempt from daily cap, not a gate). Inbox only: push off (suggestion), update available (Updates tab). Progress line in the ledger header: background import. Toast: results of own actions only (red with Retry on failure).

**Engineering rules from the council.** One pending-items selector feeds row, dot, Inbox and push (test asserts equality). Sheet re-queries on open; resolved item closes with "Already done". Offline: server-needing actions queued or disabled with "Queued". Hidden suggestions list in Settings, Notifications (needs owner OK). Rows are buttons with full labels; strip role=status; gates are alert dialogs.

**Open risks.** Version check fail-open policy; Arabic string widths not measured; contrast calculated not measured; mockups not rendered with real components.

Mockups: canvas board 15 (Final.dc.html).

## 20. Sheets, mixed row and Inbox sync (round 14, council 4). Board 16 (Sheets.dc.html).

**Mixed Flow row.** Title is the count ("2 things need you"); subtitle names each kind with its own count, two kinds then "N more" ("Salary late · 5 bank messages · 1 more"); the screen-reader label lists all kinds; tap goes to Inbox, Needs you. Copy is built from the pending-items selector so row, Inbox header and push body agree.

**Duplicates found.** Two components both named `SmsReviewSheet` (`dashboard/` held bank messages, `subscriptions/` found subscriptions). Three header patterns: V3SheetHeader (39 files), ModalTitle (34), SheetFrame (12, Subscriptions only). Four hand-built resolve-a-list sheets: held messages, subscriptions found, `FoundAccountsSheet`, `UnplacedSmsSheet`. The held-messages sheet is also surfaced as the `sms-review` overlay prompt by `SmsReviewChip` (goes away with the banner stack).

**Decision.** One thin `ResolveSheet` shell (V3SheetHeader, selectable rows, pinned footer with primary and optional secondary, optional field slot and note) with four per-job adapters. Not one smart sheet. Rules: held messages start unselected, "Select all ready" picks plain debits only; credits, foreign currency, new instruments and unverified senders are never bulk-selected (unverified is locked); credit matching a payday shows "Links to the Nov 9 payday". Accounts and subscriptions are pre-selected (additive, reversible); accounts have no in-row input. Unplaced has no selection and no secondary. Partial failure keeps failed rows with Retry N; 409 counts as success; server idempotent by message id; Confirm disabled in flight, offline (not queued) and Back blocked while submitting; Undo only for Skip.

**Build order.** (1) rename the two SmsReviewSheet files; (2) Flow row subtitle; (3) ResolveSheet shell; (4) migrate UnplacedSmsSheet, then FoundAccountsSheet; (5) held messages (money path; tests on the real write path); (6) subscriptions last.

**Before building held messages.** Verify what `/api/sms/dismiss` does (message kept? template learner affected?) before relabelling "Dismiss" to "Skip".

**Inbox sync.** Existing `/notifications` is a web-only feed (server alerts, SMS status card); native uses the OS tray. The Inbox needs the page on native (profile-menu entry), a Needs-you tab from the selector, and Updates = today's feed with the SMS card. The old bell dropdown's confirm-paid and snooze buttons become Needs-you rows opening the same debt sheet; its snooze goes with Later.

**Other sheets checked.** AmountReceivedSheet, AssignIncomeSheet, FixGapSheet, ZakatSheet, ActivateSheet, the 12 SheetFrame users, PushPrePromptSheet, NotCountedSheet: not resolve-a-list sheets; unchanged (AssignIncomeSheet's ModalTitle header can align later).

## 21. Merge, header and banner follow-ups (round 15, council 5). Refines section 20.

**Merge the two SmsReviewSheets: no, rename** (unanimous). Different data, hooks and write paths. HeldMessagesSheet and FoundSubscriptionsSheet.

**Sheet header.** V3SheetHeader is the one sheet header (already named in DESIGN_SYSTEM.md). ModalTitle stays: it is the aria-labelledby primitive V3SheetHeader uses and the heading in cards and banners (about 25 of its 34 files are sheet titles). Correction to section 20: SheetFrame has 12 users, 7 in Subscriptions and 5 in Goals, not Subscriptions only. SheetFrame is repointed to render V3SheetHeader inside (frame, panel size, footer stay); its titles go from 18px to 22px, which needs the owner's sign-off under the "never reshape" rule.

**Slice H (early, before the shell).** H1 SheetFrame internals; H2 AssignIncomeSheet to V3SheetHeader with a close button wired to the same handler as Back (owner asked for now; council dissent: stacked z-110 sheet, Back-guard desync risk); H3 remaining ModalTitle-as-sheet-title sheets in batches of 5 or fewer. Safe only with per-sheet aria-labelledby tests, a stacked-sheet Back/close test, and 320px EN/AR screenshots.

**Banner removal.** `SmsReviewChip` also owns the held-messages sheet open state, the push-tap subscription (`subscribeSmsReviewRequests`) with refetch, and the session-only `toLink` map that links a confirmed credit to its payday after the income event syncs; `SmsAccountDetectionBanner` does the same for FoundAccountsSheet. Extract these into a host mounted in the app shell BEFORE deleting either banner, or push taps and payday linking break silently.

**Revised build order.** 1 rename; 2 Flow row subtitle; 3 slice H (H1 to H3); 4 host extraction; 5 ResolveSheet shell; 6 Unplaced then Accounts; 7 held messages; 8 subscriptions; then the banner deletion with the plan's P1.

## 22. Title size and open items (round 16, council 6). Refines sections 20 and 21.

**SheetFrame title.** Move the 12 SheetFrame sheets onto V3SheetHeader at **20px** via an additive `titleSize` prop (default stays 22, so the other 39 sheets are untouched); SheetFrame passes 20. Wrap to at most 2 lines (clamp), full name in the title attribute and accessible label, `dir="auto"`, `min-height` not fixed height. Acceptance: 320px, 200% font scale, 60-char English and 40-char Arabic names; footer stays in view, 44px targets do not overlap the title, no horizontal scroll. Parked: absorb the back chevron into V3SheetHeader and delete SheetFrame's header.

**Dismiss (verified in `/api/sms/dismiss`).** It only sets `awaiting_confirmation=false` on the owner's log row: message kept, learner untouched, no restore endpoint. Two flavours: currency-only row (transaction already counted) labelled "Keep as is"; add-failed rescue (nothing created) labelled "Don't add"; mixed selection "Dismiss". Undo only for "Don't add", as a 5-second client-side hold on the dismiss call, flushed at once when the sheet or app closes. No restore endpoint.

**Idempotency (verified in `/api/sms/confirm`).** Server already claims the row atomically and releases it on failure. Client bug: a repeat call returns 404 `not_found` and `confirmSmsLog`/`dismissSmsLog` report failure. Fix first: 404 = already handled, refetch; 410 `raw_purged` = permanent (remove row, "message text expired", offer manual add, no Retry).

**Arabic widths.** Browser test at 320px with the longest real Arabic strings across the 12 sheets and the held-messages sheet. **Contrast.** Unit test over real token pairs in light and dark (4.5 text, 3 UI), failing the build; device check only for pairs under 5:1 on the next native build. Computed now: amber/soft 4.99, red/soft 4.73, teal/soft 4.99, secondary on white 5.68, white on primary fill (#0D8578) 4.52 (borderline), disabled label 2.27 (exempt). Mockup fixes: unselected marks now use the secondary colour; green uses the real token #0F7635.

**Build order change.** Step 0: fix the 404-as-failure client bug (smallest, most visible). Then as in section 21, with H1 carrying the `titleSize` prop.

## 23. Build log (round 17): what shipped from sections 20 to 22, and what did not

Built and verified (`npm run verify`):
- Step 0: `confirmSmsLog` / `dismissSmsLog` treat 404 `not_found` as already handled (410 and other 404s stay failures). Tests added.
- Step 1: `SmsReviewSheet` renamed to `HeldMessagesSheet` (dashboard) and `FoundSubscriptionsSheet` (subscriptions).
- Step 3: `V3SheetHeader.Title size="compact"` (20px, two-line clamp, `dir="auto"`, full name on the element) and a `leading` slot on the compound form; `SheetFrame` renders `V3SheetHeader` (12 sheets); `AssignIncomeSheet` on `V3SheetHeader` with a close button wired to the same handler as Back. H3 (the other ~23 sheets that use `ModalTitle` as a title) is deferred: it changes 18px titles to 22px on each and needs per-sheet 320px EN/AR checks.
- Steps 4 to 8: `ResolveSheet` / `ResolveRow` / `ResolveGroupLabel` / `ResolveTile` (`src/components/modals/ResolveSheet.tsx`); held messages (unselected start, "Select all ready" for plain debits only, locked unverified senders, credit-to-payday chip, per-row failure with Retry N, offline disables Confirm with a reason, Back blocked while submitting, "Don't add" with an 8-second client-side Undo flushed on close or background, `src/lib/sms/heldReview.ts`), accounts found (pre-selected, "Not mine" settles the prompt), unplaced expenses (one account for all rows) and subscriptions found (pre-selected, "Not subscriptions" settles). `ConfidenceMeter` removed (orphaned).
- Step 2: `src/lib/alerts/pendingSummary.ts` (kinds, mixed-row copy: "N things need you" plus up to two named kinds then "N more"; screen-reader label lists all), `usePending`, `PendingRow`, `FlowPendingRow` above the Flow ledger, and the Inbox "Needs you" / "Updates" tabs on `/notifications` (opens on Needs you when something waits).
- Step 4/9: the shell host `HeldMessagesHost` (was `SmsReviewChip`) keeps the fetch, open state, push-tap request and payday linking, and publishes the count; its overlay prompt is gone. `UnplacedSmsPrompt` (overlay duplicate of the Accounts page row) is deleted.

Not done, and why:
- `SmsAccountDetectionBanner` stays: it offers "Link existing", which `FoundAccountsSheet` does not. It goes when "link to an existing account" moves into that sheet.
- `SmsSubscriptionDetectionBanner` stays until the Subscriptions page has its own contextual row.
- Late payday, plan-change and the other prompts still use the overlay stack (the plan's P1 for those pages).
- Avatar dot, red escalation, push at 7 days, "Not interested" for the remaining suggestions, state strip merge, `UpdateToast` removal (P2 and P3).
- Unplaced expenses open the Accounts page (where the row sits), not the sheet directly.
- Without the avatar dot, held messages are visible on Flow and in the Inbox only; a user who never opens Flow no longer sees an overlay prompt for them.
- Visual check of the new sheets in a browser, Arabic at 320px, and a device contrast check were not run.

## 24. Build log (round 18): avatar dot, menu entry, Subscriptions row

Built:
- Avatar dot on `ProfileAvatarWithMenu` (top-start of the avatar, beside the setup ring and percent pill): amber while a pending kind waits, red once the oldest item has waited 7 days (`pendingSeverity`, `RED_AFTER_DAYS`), hourly clock re-read in `usePendingSeverity`. Held messages report their oldest `received_at` (store `heldSince`); unplaced expenses report their oldest date. The avatar's accessible label adds "N things need you".
- Profile menu: a Notifications entry (Bell, count badge) before Settings. The Inbox was previously reachable on the web desktop bell only; this is the mobile and native entry. No header bell was added.
- Subscriptions page: `SubscriptionsFoundRow` ("N possible subscriptions", opens the review sheet). `SmsSubscriptionDetectionBanner` is deleted.

Not done, with reasons:
- `SmsAccountDetectionBanner` stays: it also offers "Link existing" and adds cards and wallets (`FoundAccountsSheet` lists accounts only and cannot link). Moving those into the sheet is a product change, not a banner swap.
- H3 (the other ~23 sheets with a `ModalTitle` title): each has its own layout (illustrations, steps, custom headers); changing 18px to 22px and adding a close button without per-sheet visual checks at 320px in English and Arabic would be guesswork.
- Late payday, plan-change and the other overlay prompts, the state strip merge, `UpdateToast` removal, push at 7 days and the Needs-you entries for suggestions (accounts, subscriptions) remain.

## 25. Build log (round 19, council 8): detected accounts and the header sweep

Council 8 (final specs). Detected accounts: one sheet, tap a row to open its three answers, nothing pre-selected, Add through the existing prefilled setup sheets, one 30-day detector list for row, dot, Inbox and sheet; "accounts found" becomes a pending kind. Headers: the sweep uses the standard 22px header, compact 20px only for long or user-typed titles, a close on the two form sheets that lacked one (Amount received, Turn off 2FA), none on confirm dialogs, the celebration and the permission prompt.

Built:
- `DetectedAccountsSheet` replaces `SmsAccountDetectionBanner` and `FoundAccountsSheet` (both deleted). `useDetectedAccounts` / `unsettledAccounts` filter settled keys once. New pending kind `accountsFound` (Flow row, Inbox, avatar dot, menu count). The Accounts page gets a row; the settings flag `accountsFoundOpen` lets the Inbox and the dot open the sheet. "Not mine" is held for the 8-second Undo window and flushed on close or background. Accepted regression: the old accounts-only sheet set an opening balance from the SMS; Add now goes through the prefilled setup sheets, and the balance is set after.
- Header sweep onto `V3SheetHeader`: SelectPaymentMethod, ProviderPicker, PaymentMethodSetup (back arrow kept via the leading slot; debt context still has no Back), CurrencySheet (both variants), PaymentMethods, AddDebt, InstallmentProviderPicker, Charges, Cost, AmountReceived (also fixes a dialog left unnamed because its title id was read outside the shell), TwoFactorOff (new close). Guard test `sheetHeaders.test.ts`.

Not migrated, with reasons: ExpenseSheetForm, IncomeSheetForm, PayCycleSheet (controls sit beside the title), GoalDetailSheet and ClearedVaultSheet (hero tile or user-typed hero title), AvatarPickerModal and QuickAddFAB (own layouts), EditIncomeEventSheet (the title is the event card), BaseCurrencyChangeSheet (centred confirm with Cancel), PushPrePromptSheet and MilestoneCheerSheet (permission and celebration). Revisit when each is next edited.
Not verified: no browser or device check of 320px and Arabic; the close buttons are 44px, the titles wrap rather than truncate.
