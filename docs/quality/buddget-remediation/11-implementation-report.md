# Implementation report

Labels follow `CLAUDE.md`: **Automated verification** (tests written and passed), **Manual verification required**, **Native verification required**, **Blocked**.

## Step 1: server-only fixes (2026-11-20)

Branch `claude/risk-based-testing-philosophy-9bacd9`. **Not merged to dev or main**: the server code reaches users, including builds already installed, only when it is deployed, and the coordinating session sequences merges to main after the sync, S8a and S-2 branches. Migration 0337 is already **applied on live** (approved plan, item 1.1 slice 1).

| Item | What changed | Files | Status |
|---|---|---|---|
| BDG-011 slice 1 | A call that put nothing in front of the user is logged with its cost but not charged: no credits, no units in any window, nothing on the chat's counter, no Sparks. Covers provider errors, empty replies, safety blocks, and a stream cut or Stop before any text (new status `aborted_empty`). A Stop after text stays charged, and its output is now estimated from the text sent, so Spark users pay for what they read. The per-minute rate limit still counts every call. Budget builds, receipt scans and voice entries that return nothing are free too. | `supabase/migrations/0337_ai_failed_calls_not_charged.sql`, `src/lib/server/ai/buddgy/turn.ts`, `src/lib/server/ai/quota.ts`, `src/app/api/buddgy/turn/route.ts` | SQL: proven on live in a rolled-back transaction, then applied and checked (one function, same signature, `service_role` only). Code: **Automated verification** (runner jobs 3 and 4, `npm run verify` green on `3f57e6ac`). |
| BDG-013 server part | The server never sends the spend flag, so no client cuts Buddgy's memory to 2 items or shows "this chat is getting long", including builds already installed. | `src/app/api/buddgy/turn/route.ts` | **Automated verification** (runner jobs 3 and 4). |

What changes for users at once: since 0337 is live, today's deployed server already stops charging `error` calls. `aborted_empty` and the spend-flag change take effect when this branch is deployed.

Known limit, marked in the migration: a prompt the provider blocks on safety is now free, so it can be repeated at no credit cost. The per-minute limit (10 a minute on Free) still applies.

## Tests for step 1
| File | Case | Result |
|---|---|---|
| `src/lib/server/ai/buddgy/__tests__/gateway.test.ts` | stall before text settles `aborted_empty` (expectation changed from `aborted` on purpose) | passed (runner jobs 3 and 4) |
| same | stall after 40 characters settles `aborted` with 10 output tokens | passed (runner jobs 3 and 4) |
| same | user Stop before text `aborted_empty`, after text `aborted` with output above 0 | passed (runner jobs 3 and 4) |
| `src/app/api/buddgy/turn/route.test.ts` | chat past its spend line still gets `soft: false`, the turn ends `done`, settles `ok` | passed (runner jobs 3 and 4) |
| live SQL, rolled back | `ok` and `aborted`: 5000 units, 2.5 credits each. `error` and `aborted_empty`: 0 units, 0 credits, cost still logged. Chat counter 10000. Rate limit counted 4 rows. | **passed** |

## Step 2: Buddgy usage, limits and label (2026-11-20)

Client and server code. Reaches phones only with the next native build; the server part (label on the meta frame) when this branch is deployed.

| Item | What changed | Files | Status |
|---|---|---|---|
| BDG-009, 016 | The usage ring in the chat opens the existing limit sheet on top of the chat (new notice key `usage_view`): both meters with reset lines, the plan, and the offers a limit would make (Free: Sparks and Pro; Pro and trial: Sparks only), plus "See all usage". The chat, its draft and a streaming reply stay as they are. Any button in that sheet that opens a page ("Go Pro", "See all usage") closes the chat first, so nothing opens behind it. | `QuotaWheel.tsx`, `NoticeHost.tsx`, `usageNotices.ts`, `usageCopy.ts` | Rules: **Automated verification** (runner jobs 3 and 4). The visible sheet: **Manual verification required** (no browser test written: the chat needs a signed-in, billing-on session; the 10-screens journey is the place to add one). |
| BDG-012 | One formatter for "when it is back": a clock time later today, otherwise day, date and time. Used in the chat's limit message and under each meter; at 100% the meter says "Limit reached · Resets …" instead of only "Limit reached". A per-minute rate block has its own message ("Give me a minute") and keeps Retry. In the chat a blocked turn shows the sheet every time, not once per app session. | `format.ts`, `buddgyChatCopy.ts`, `AIChatMessageList.tsx`, `NoticeHost.tsx`, `usageNotices.ts` | **Automated verification** (runner jobs 3 and 4). |
| BDG-010 | The server says how each reply was made: `thinking` only when the thinking budget is above the minimal level; the free Advisor answer, which runs at the minimal level, is labelled Quick. Shown as a small word on the reply's footer line, before "Checked: …". | `gemini.ts`, `route.ts`, `protocol.ts`, `runTurn.ts`, `chatTypes.ts`, `useBuddgyChat.ts`, `AIChatMessageList.tsx`, `buddgyChatCopy.ts` | Route test checks `mode: 'quick'`: **Automated verification** (runner jobs 3 and 4). The visible label: **Manual verification required**. |

Not changed on purpose: times are shown in the phone's own time zone, which is always the reader's, so no zone name is added. The model's name is not shown, only Quick or Thinking: both tiers run the same model today.

## Step 1.5: SMS setup and device state, BDG-008 (2026-11-20)

Branch `claude/nervous-williamson-065d73`, code commit `5884c3d7`. Owner decision taken before building: a Shortcut run on this phone shows the switch, as a claim does (Council view).

The model is now five separate facts, derived in one place (`src/lib/sms/setupState.ts`): preference (account), claimed (Finish or confirmed skip, on this phone), run seen (the Catch Bank SMS action ran here), verified (`user_devices.first_sms_at`), health (time since this phone's `last_sms_at`; quiet after 7 days). A stored token counts as none of them, and that includes the start-up arming in `AppShell`.

| Item | What changed | Files | Status |
|---|---|---|---|
| Migration 0339 | `user_devices.first_sms_at`. Backfilled from `sms_parse_log`: the earliest row per `(user_id, device_id)`, refusal rows excluded, keyset batches of 500, `statement_timeout` 15s. `EXPLAIN` on live first: one index scan on `sms_parse_log_device_idx` per phone. Applied with `execute_sql`; `database.types.ts` gained only the three `first_sms_at` lines. The live types also carry another session's 0338 tables, left for that session to commit. | `supabase/migrations/0339_sms_device_first_sms.sql`, `database.types.ts` | **Applied and checked on live**: 15 phones, 7 with `first_sms_at`, 0 with a last SMS but no first, 0 with first after last. The 2 collecting iPhones that never delivered are exactly the 2 unverified ones. Number 0338 was skipped because an uncommitted file in another worktree holds it. |
| Parse route | Sets `first_sms_at` once, next to `last_sms_at`, with a second update filtered `first_sms_at is null`. It never moves. | `src/app/api/sms/parse/route.ts` | **Automated verification required on the runner**: tests written (`route.capture.test.ts`, `e2e/sms/first-sms.mjs`), not run yet. |
| New device row | A heartbeat's `collects` (the armed flag, false on every fresh install) no longer decides a new row. The row takes the account preference unless the user's own switch (`collectsSms`) was sent. Installed builds benefit as soon as the server deploys. Side effect: an unset iPhone on an account with tracking on now counts as collecting, which `nextMain` prefers. It arms only after a claim or a run. | `src/lib/server/devices/registry.ts` | Tests written (`registry.cap.test.ts`), not run yet. Device check below. |
| Settings and onboarding | One derivation. Settings shows the switch on a claim or a run. Onboarding's green "done" now needs a verified phone; armed but unverified reads "Not confirmed yet". | `useSmsTracking.ts`, `SmsCard.tsx` (unchanged, reads `isSetup`), `StepAutomate.tsx`, `AppShell.tsx` | Tests written (`setupState.test.ts`), not run yet. |
| Guide | Done screen says "Not confirmed yet" until this phone is verified, and never "Automation active". Finish and the new "Shortcuts already exist? Skip guide" (with a confirm dialog, `useConfirm`) both record the claim only after the token is issued and stored for this user. Otherwise the guide stays open with "Setup could not finish". The X is inside the header row on both screens. | `SmsTrackingGuide.tsx`, `claimIosSetup` in `useSmsTracking.ts`, copy in `en.ts`, `ar.ts`, `types.ts`, `settingsHubCopy.ts` | Rules: tests written (`claimIosSetup.test.ts`, `smsGuide.render.test.ts`), not run yet. Look: **Manual verification required** (no mockup was made for the copy and layout changes, which the plan itself specified). |
| Pill | Reads this phone's `last_sms_at` (new `thisDeviceSms` on `GET /api/devices`). Only while this phone has no SMS of its own does it fall back to the newest account SMS with no device id (an older token). The fallback query is an index scan on `sms_parse_log_user_received_idx`, checked with `EXPLAIN`. Copy is neutral: "No bank SMS from this iPhone for N days…", never "deleted". | `SmsIosSetupCard.tsx`, `SettingsSmsTrackingSection.tsx`, `devices/route.ts`, `devices/client.ts` | Tests written (`setupState.test.ts`), not run yet. On device: **Native verification required**. |

Tests (all written, none run, because tests run on the cloud runner only):

| File | Cases |
|---|---|
| `src/lib/sms/setupState.test.ts` | never set up, token alone, exit midway before and after a run, finished or skip, token failure, first SMS, second phone, account switch, quiet for 9 days, old token keeps the account reading, own reading beats legacy |
| `src/hooks/claimIosSetup.test.ts` | claim and arm only after the token is stored for this user; nothing on a failed request, offline, a token not stored, another account's token, or no user |
| `src/components/onboarding/smsGuide.render.test.ts` | Skip guide offered; X inside the header row; done screen "Not confirmed yet" until verified, never "Automation active" |
| `src/lib/server/devices/registry.cap.test.ts` | new row: `collects=false` takes the account preference on; stays off when the account is off; the explicit switch wins |
| `src/app/api/sms/parse/route.capture.test.ts` | first SMS sets `first_sms_at`, a second moves only `last_sms_at`, another phone is untouched; a device-less token writes no device row |
| `e2e/sms/first-sms.mjs` (listed in `e2e/README.md`) | the same against the real route on the 3100 server, own synthetic user, deleted at the end |

**Native verification required** (owner, next build; see `10-native-test-requirements.md` BDG-008 rows): "Set up" before any run, the switch after a run, "Not confirmed yet" turning into confirmed after the first bank SMS, the pill showing this phone's last SMS, reinstall not silently off against the account preference, two iPhones each with their own reading, the X position on a notched iPhone and an SE.

To do after deploy: re-run the DO block of 0339 once. It is idempotent and catches phones that delivered between the apply and the deploy. Not changed: the notifications page still shows the account-level last SMS. Android is unchanged.
