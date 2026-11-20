# Issue register

Source: owner brief of 2026-11-20 (28 issues, workstreams A to H). Status of every row: **investigating**, nothing changed in product code.

Test tier follows `CLAUDE.md` "What to test: by risk, not everything":
- **UI** = UI-only: before-and-after mockup, owner approves, build, screenshot, owner tests. No new automated test.
- **CX** = complex interaction: targeted test only where it can really fail.
- **DT** = deep technical: tests mandatory.
- **N** = also needs a real device or simulator.

Root cause, severity, fix and test cases are filled in from the findings files (`findings/`) into `03-root-cause-analysis.md` and `05-fix-plan.md`.

## A. Settings, state persistence, profile

| ID | Reported | Owner expects | Tier |
|---|---|---|---|
| BDG-001 | Theme set to light holds on the first refresh, then some time later (often while moving between Settings pages) the app goes back to dark. | Latest user choice wins everywhere; local and server converge; a failed request never restores a default; correct theme on another device; no flash. No workaround that only hides dark mode. | DT |
| BDG-002 | Settings shows a profile completion bar with no explanation. | Percentage, a clear label ("Profile completion"), what counts toward it, optional detail. Percentage built from meaningful, actionable fields only, and stable across refreshes. | UI (unit test only if the calculation changes) |
| BDG-023 | Biometrics sits under Sign In & Security. | Move it to Privacy & Data, one preference, same iOS/Android capability checks. | UI |

## B. Invitations, referrals, rewards

| ID | Reported | Owner expects | Tier |
|---|---|---|---|
| BDG-003 | Back of the invitation card shows front text; some sentences mirrored or overlapping. | Front and back independent, only one side visible, both flip directions, RTL and LTR. Check every other flipping card (Pro card). | CX |
| BDG-004 | Weak hierarchy on the invitation card. | Headline "37 Days of Pro", then "From [real inviter or source]", a much shorter sample code, premium look, small text "Invite a friend and you both earn an extra week of Pro." Copy must match the real reward rules; do not change the economics to fit the copy. | UI (facts checked against backend) |
| BDG-005 | Idea: share the invitation as an image, valid for three days. | Council decides. If expiry is shown it must be real: server timestamps, expired links stop working. No fake urgency. "No credit card required to start your trial." belongs on the landing page or trial info, not the artwork, unless Council says otherwise. | DT if expiry is built, else UI |
| BDG-006 | Referral benefit is hard to understand. | Answer from the code: who gets 37 days, when the inviter gets 7, what counts as success, existing users, self-referral, reuse, friend who never qualifies. Copy matches logic. | UI (facts from backend) |
| BDG-007 | Rewards page at a zero-week streak highlights the last digit instead of starting at zero. | At 0 the indicator is in its start state and implies no progress. Correct at 0, 1, 9, 10, 11 and above, in both directions. | UI (unit test if the maths changes) |

## C. iOS SMS shortcut setup and device state

| ID | Reported | Owner expects | Tier |
|---|---|---|---|
| BDG-008 | Settings mixes up account SMS preference, "set up on this device", "verified working" and "receiving now". Guide X button sits above the header, higher than the logo. | Find what iOS can really detect (cite Apple docs). Proposed UI: set up before = "View guide" left of the switch; never set up = "Set up" button and no switch; first guide screen gets a slim "Shortcuts already exist? Skip guide" banner (also in onboarding screen 2); leaving midway keeps "Set up". Completion only by the last CTA or the confirmed skip. A user claim is not proof: "claimed", "first SMS seen", "working", "suspected inactive" are different states; no SMS is not proof of deletion. One implementation for onboarding and Settings. Council on the state machine and data model (reinstall, new device, account switch, Keychain, RLS). | DT + N |

## D. Buddgy: usage, limits, conversation

| ID | Reported | Owner expects | Tier |
|---|---|---|---|
| BDG-009 | Tapping the limit circle in chat opens the usage page behind the chat. | A sheet or pop-up on top of the chat: usage, remaining, limits, reset time, plan, upgrade or buy options. No background navigation; chat state kept. | CX |
| BDG-010 | No way to tell whether Buddgy is on Quick or Thinking. | Show the mode; the label must equal the model the backend really used; explain cost or limit differences if the user can switch. | CX (label equals backend) |
| BDG-011 | Messages sometimes get no answer but usage is still deducted until the limit is gone. | Failed or unanswered requests do not consume usage. Policy for provider error, empty output, timeout, network loss, user cancel, interrupted stream, tool failure, refusal, partial stream. Reserve, settle, refund, idempotent, server-authoritative. | DT |
| BDG-012 | At the limit the user is told to come back later, with no reset time. | Say the limit is reached, the exact reset time or countdown and its timezone, and what to do now: Free = upgrade CTA; Sparks-eligible = Sparks; Pro = paid continuation only. No upgrade button for Pro. Stays inside chat. | CX (reset time from backend) |
| BDG-013 | Buddgy says the conversation is too long after a few messages and asks for a new chat, which loses all context. | Find the real overflow cause (prompt size, history duplication, token counting, tool output). Council on compaction, summaries, selective retrieval. Continuity is never lost because context grew; short chats never compact. Measure tokens before and after. | DT |
| BDG-014 | Opening the keyboard pushes the Buddgy window far up and breaks the layout. | Composer and latest messages stay visible, no big jump, restores on close; iOS and Android. | CX + N |
| BDG-015 | Asking Buddgy to set up a budget opens the Budget Builder in the background. | Buddgy offers the choice first ("Open Budget Builder" / "Build my budget here"). Audit every Buddgy action that navigates, opens a sheet, starts a flow, changes data or settings, or starts a purchase. Council on one action-intent protocol: propose, app validates, user confirms where it matters. | CX (DT for data-changing actions) |
| BDG-016 | Usage details must not disturb the chat. | No background navigation, no reset, unsent text kept, stream not killed, no duplicate sheets, repeatable. | CX (with 009) |

## E. iOS navigation and floating Buddgy

| ID | Reported | Owner expects | Tier |
|---|---|---|---|
| BDG-017 | Some pages have no obvious back button on iOS. | Edge-swipe back: native where possible, no clash with carousels, works with nested routes, sheets and overlays, keeps scroll, never leaves the app, sane with no history. | CX + N |
| BDG-018 | Dragging Buddgy does not show it can move to the other side. | Council picks: side to side with a hint, free drag with snap, or hybrid. Simplest discoverable option; never blocks controls; safe areas, keyboard, RTL, remembered position. | CX |

## F. Billing and subscription management

| ID | Reported | Owner expects | Tier |
|---|---|---|---|
| BDG-019 | On iPhone "Keep Pro" does nothing. | Find where it stops (tap handler, product fetch, product id, store state, bridge, verification, entitlement). Clear flow: loading, confirm, cancel, failure, success, verification, restore. Never show success without a verified transaction. | DT + N |
| BDG-020 | "Choose Plan" only scrolls; "Manage subscription" opens a page with no useful action; "Cancel" only shows instructions; too many buttons. | One "Manage Subscription" button at the end of the page opening a sheet with real actions only (cancel, change plan, restore, renewal, billing info). Cancel starts a real journey: optional retention step with a clear way to continue, then the provider's own mechanism (PayTabs API; Apple and Google management screens). Not marked cancelled until the provider confirms. "Choose Plan" does something meaningful. | DT |
| BDG-021 | Subscription sheets look off-system. | Reuse the existing sheet, buttons, type, spacing, loading and error states; iPhone sizes, dark mode. | UI |
| BDG-022 | Subscription state consistency. | Web, Apple, Google; free, Pro, cancelled, expired, payment failure, refund, restore, upgrade, downgrade, cross-device; one user never ends up with two subscriptions. | DT |

## G. Accounts, bank providers, savings sheet

| ID | Reported | Owner expects | Tier |
|---|---|---|---|
| BDG-024 | Bank accounts use letter icons. | Verified official vector logos (Egypt, UAE, Saudi) where licensing allows, neutral bank icon otherwise; same icon in cards, selectors and transactions; light and dark. No invented logos. | UI (licensing check) |
| BDG-025 | Account mini cards do not feel like bank cards. | Modern card look for debit and credit, no full numbers, no CVV, no network brand names, subtle depth, stacked where it fits, themes and currencies. | UI |
| BDG-026 | The Add Savings sheet (from the FAB) lists existing pockets only; no way to create one. | "Add Pocket" action that opens the existing create flow, saves, returns to the sheet with the new pocket selectable and the typed amount intact. | CX |
| BDG-027 | Pockets are a long vertical list; poor at five or more. | Reuse the existing provider-style selector: few, many, empty (with Add Pocket), long names, currencies, new pocket, accessibility. | CX (with 028) |
| BDG-028 | "From account" uses a collapsible list while other pickers use a dropdown. | Same shared selector, no second implementation. | CX (with 027) |

## H. Previous backend work

| ID | Question | Tier |
|---|---|---|
| BDG-H1 | Are "jobs 10 and 12" done? | n/a (status trace) |
| BDG-H2 | Is the "sync rerun" done, and can a retry or rerun lose, duplicate or skip changes? | DT |
