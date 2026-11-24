# C. Support and feedback today (read-only inventory, 2026-11-24)

Snapshot of branch `claude/qa-bugs-wealth-logic-905035` (origin/main 830fce82 plus two dependency commits). No code changed.

## 1. User journey

Entry: Settings > Help and feedback (`src/app/(app)/settings/help/page.tsx:10` renders `HelpCard part="support"`). `src/components/features/settings/hub/HelpCard.tsx` has three rows: Send feedback (sheet at :32-110), My requests = inbox (row :142, `SupportInboxSheet`), and the feedback board (`SupportBoardSheet`, :153).

Send (HelpCard.tsx:46-62): segmented Bug / Idea / Question, title (3-200), description (max 5000). POSTs `{chosen, title, description}` to `/api/support/submit`. The client sends NO context: `submit/route.ts:11-24` accepts `context {route, locale, appVersion, platform, device}` but HelpCard never fills it; the route falls back to `x-app-platform` and `x-app-version` headers (:56-57). Success screen shows `#<number>`.

Server (`src/app/api/support/submit/route.ts:30-80`): outdated-client gate, session user, zod, 10/hour rate limit (:47), looks up the verified auth email (:50-54), runs keyword triage (`src/lib/support/triage.ts`: kind, area, severity, confidence, 0.7 auto threshold), then RPC `support_submit` (one round trip: ticket + first message). `p_to_linear: false` (:72): Linear escalation is postponed (QA-57), so nothing is queued.

Replies: it IS a back-and-forth thread, not one-shot.
- Inbox list: `GET /api/support/tickets` (`tickets/route.ts:7-20`), own tickets, newest first, limit 50, via service role filtered by `user_id`.
- Thread: `GET /api/support/tickets/[number]` (`[number]/route.ts:26-42`), public messages only (`internal=false`), limit 200, staff label rewritten to "buddget support".
- User reply: `POST` same route (:45-63), 4000 chars, 20/hour, closed ticket returns 409, a non-open ticket flips back to `open` and clears `resolved_at` (:62).
- UI: `SupportInboxSheet.tsx:27-99`: list (subtitle = status: Open / We replied / Resolved / Closed, copy at `src/lib/i18n/settingsHubCopy.ts:291`), thread bubbles, reply textarea. The thread loads once on open and after the user's own send. No polling, no realtime, no refresh on push.
- Legacy: `POST /api/feedback` (`src/app/api/feedback/route.ts`) writes straight to Linear (no ticket). No in-app caller found; likely dead code kept with its test.
- Feedback board: staff publish a neutral title for an idea; users vote +1/-1 (`/api/support/board`, `/api/support/board/[number]/vote`). Net 10 votes queues a Linear issue (RPC `cast_feedback_vote`, migration 0174:113-135).

## 2. What staff see and can do

Portal route group `src/app/(app)/admin` (view `src/components/features/admin/views/SupportView.tsx`, 222 lines). APIs:
- List `GET /api/admin/support/tickets` (`src/app/api/admin/support/tickets/route.ts`): views active / mine / unassigned / triage (needs_human) / status; filters assignee, priority, search on subject and email; limit 200; counters via RPC `admin_ticket_counts`; email masked unless `users.pii`.
- Create `POST` same route (staff-opened ticket, for a user or an email).
- Detail `GET /api/admin/support/tickets/[id]` (route.ts:17-30): ticket + all messages including internal.
- Actions `POST .../[id]` (route.ts:32-127), ops: `reply` (public or internal note, :44-70), `update` (status, priority, category, assignee, tags, :72-98), `board` (publish/plan/ship an idea, :100-111), `delete` (:113-124). All write an audit row.
- Saved replies (macros): `/api/admin/support/macros` (`macros/route.ts`), up to 50 in `platform_settings.support_macros`; picker shown in SupportView.tsx:157.
- Permissions (`src/lib/admin/permissions.ts:33-35`): `support.view`, `support.reply`, `support.manage` (assign others, delete, board, macros). Agents may only assign to themselves (route.ts:89).
- Linear: `src/app/api/webhooks/linear/route.ts` maps issue state back onto the ticket (status, internal system message) and notifies the user on resolved (category `support_resolved`).
- SLA: `sla_first_response_due` is set at submit (4h urgent, 24h otherwise, resolution 5 days, `support_submit`). Only the first-response due column is selected in the list; no breach alert, no cron, no sort by breach. `first_response_at` is set on first public reply.

## 3. Data model

Migrations: `0124_admin_support_monetization.sql:5-39`, `0165_support_intake.sql`, `0166_support_submit_nulls.sql`, `0174_feedback_board.sql`.
- `support_tickets`: id, number (identity, unique), user_id (SET NULL on delete), requester_email, subject, category (general/bug/sms/sync/billing/account/feature/other), priority, status (open/pending/resolved/closed), assignee_id, source (in_app/email/admin/sms_queue), tags[], first_response_at, resolved_at, plus 0165: kind, area, severity, triage_state, triage_confidence, duplicate_of, app_version, platform, context jsonb, votes, sla_first_response_due, sla_resolution_due; plus 0174: board_state, board_title, board_summary; linear_issue_id and linear_issue_url exist (used by webhook).
- `support_ticket_messages`: id, ticket_id (CASCADE), author_type user/staff/system, author_staff_id, author_label, body (1-10000), internal bool, created_at. No attachment column, no read marker.
- `feedback_votes` (ticket_id, user_id, value -1/1), `integration_outbox` (Linear queue, idempotency key).
- RLS and grants: RLS on, no policies, `REVOKE ALL` from anon and authenticated on every table (0124:152-158, 0165:33-34, 0174:109-110). Every read and write goes through API routes with the service role, with `user_id = session user` filters in code. RPCs `support_submit` and `cast_feedback_vote` are SECURITY DEFINER, EXECUTE for `service_role` only (per migration 0315 rule). The user-ownership check therefore lives only in route code (`[number]/route.ts:13-23`), covered by `[number]/route.test.ts`.

## 4. Notifications

- Staff public reply: `emitNotification` (`src/lib/server/emitNotification.ts`) inserts a `notifications` row (category `support_reply`, metadata `{ticketNumber}`, dedupe key from content) and sends native push via `sendNativePush`. Title "Support: <subject>", body first 300 chars (admin route.ts:56-66). English only: unlike `support_resolved` (`src/lib/notifications/serverCopy.ts:9-25`, localized via `getUserDictionary`), the reply title prefix is hardcoded. The reply text is the staff's own language.
- Push payload carries no `data` (`push` omitted, so `args.push?.data` undefined): a tap cannot deep-link to the ticket. Push taps are queued in `src/lib/native/pushActionQueue.ts` and `pushNotifications.ts:50`; nothing routes `support_reply`.
- Resolved from Linear: localized notification (webhook route :31-41).
- Staff are not notified of new tickets (no email, Slack or push in `support/submit`); they poll the portal. `docs/email-templates/` only holds `confirm-signup`, `invite-admin`, `magic-link`: no support or reply email. A ticket with no app account cannot receive a public reply (route.ts:49).
- No unread badge on the Help row or inbox; the only signal is the generic notifications bell.

## 5. Gaps against an Intercom or Help Scout grade flow

| Capability | Today | Gap |
|---|---|---|
| Threaded conversation | Yes: messages table, user reply reopens | Thread does not refresh live; no typing/seen; thread capped 200 |
| Status | open/pending/resolved/closed shown to user | Closed blocks reply with 409; no "reopen" button; no auto-close of resolved after N days |
| Unread badge | None | No per-ticket `last_read_at` or per-user unread count; list does not mark replied tickets |
| Push on reply | Yes, but not localized and not deep-linked | Add `push.data {route:'/settings/help', ticket}` and a localized template; handle tap in pushActionQueue |
| Attachments / screenshots | None | No storage bucket or column; Receipt photos are device-local by policy (owner memory note on receipt images), so a support screenshot needs a deliberate exception |
| Auto context (app version, device, OS, locale, route, plan, user id) | Columns exist (`app_version`, `platform`, `context`) | Client sends nothing; version/platform only from headers; no device model, OS version, plan, last error, sync state |
| CSAT | None | No rating on resolve |
| Canned replies | Yes (macros, 50) | No variables ({name}), no per-role scope, no localization |
| Internal notes | Yes (`internal` flag) | OK |
| SLA | Due timestamps stored | No breach view, no cron, no alert, no business hours |
| Assignment | Yes, self-assign for agents | No round robin, no auto-assign by area, no collision detection |
| Staff alert on new ticket | None | Needs push/email/Slack on critical or needs_human |
| Email channel | `source` allows `email` | No inbound or outbound email |
| Duplicates / merge | `duplicate_of` column unused in UI | No merge |
| Search | subject and email only | No body search, no saved views |
| Language | Arabic/English UI | Reply language not tracked on ticket; no translation hint |
| Privacy | Staff see masked email by default | Message bodies unredacted |

## 6. Test coverage today
Unit: `src/lib/support/triage.test.ts`, `src/app/api/support/submit/route.test.ts`, `src/app/api/support/tickets/[number]/route.test.ts`, `src/app/api/support/board/[number]/vote/route.test.ts`, `src/app/api/admin/support/tickets/[id]/route.test.ts`, `src/lib/server/admin/__tests__/domain.pg.test.ts:103` (reply notification row). E2E: `e2e/journeys/specs/round2/r1-core.spec.ts:193` mocks `/api/support/submit`; `e2e/api/round2/zz-lifecycle.spec.ts:21,35` deleted-account checks. None covers the end-to-end loop: submit, staff reply, push/notification row, user sees reply in inbox, user replies, status flips.
