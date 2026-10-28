# QA round 2 - SMS pipeline (read-only). Finding prefix N.
Method: code read + live SELECTs (project ydihurtbcnoflhormgzi) + throwaway vitest probes (deleted). All data below is aggregate/masked; no bodies, names, numbers or amounts recorded.
Not re-reported: anything in docs/QA_ROUND_PLAN.md Parts 3-6.

## P0 / P1

### N1 P1 - Salary "confirm" decision posts nothing and is marked confirmed, so it can never be confirmed (income silently lost)
- File: src/app/api/sms/parse/route.ts:962-1007 (intentionalNoPost, preAck, awaiting_confirmation = addFailed||provisionalConfirm), src/lib/sms/dispatch.ts:510-511, src/app/api/sms/confirm/route.ts:~58 (claim needs awaiting_confirmation=true), src/components/layout/AppShell.tsx:377.
- Problem: since the evidence-score change, matchSalary returns `confirm` for any weaker match. dispatch returns `income_matched` and posts no income row. The parse route treats `income_matched` as "intentionally no post": status='confirmed', acked/confirmed stamped, awaiting_confirmation=false. The push says to confirm, but /api/sms/confirm only claims rows with awaiting_confirmation=true, so it answers 404. The push tap only navigates to /paydays (comment still says "matched to declared salary"). The credit is never recorded and the payday shows as missed.
- Masked scenario: salary-sized credit in the same currency, within 2%, from a sender with weak salary evidence (no salary wording, unknown counterparty) inside the payday window.
- Evidence: live, 12 sms_parse_log rows are status=confirmed, parsed_ok, not duplicate, no expense/income/paired/debt link and no expenses/income_events row with sms_log_id. 8 of them kind=income (ai_new 3, curated_db 3, template 2, 2026-06-29..09-22), plus 2 instant_transfer_in, 1 ATM, 1 purchase. Cannot separate this from a user deleting the ledger row (FK is ON DELETE SET NULL, no tombstone), so partly inferred. Code path is certain.
- Fix: for outcome income_matched/confirm set awaiting_confirmation=true and status 'logged' (let /confirm run with userConfirmed=true), or post the event unlinked and offer link on tap. Only paired legs and refund_matched are true no-post cases.

### N2 P1 - sms-retention cron fails every night, so raw SMS bodies are never purged (privacy)
- Live: cron.job_run_details shows `sms-retention` failed 3/3 runs: "null value in column raw_body ... violates not-null". Function (public.sms_retention) does `UPDATE sms_parse_log SET raw_body = NULL` but raw_body is NOT NULL. The same function's second statement (sms_corpus cleanup) is rolled back too.
- Evidence: 859 of 859 rows still hold raw_body; 667 older than 30 days, 113 older than 90 days, oldest 2026-06-16. 679 harvested rows are past the 30-day line. push_result (jsonb) also never cleared (663 rows).
- Fix: `ALTER COLUMN raw_body DROP NOT NULL` (or set to ''), re-run, add a cron failure alert; also consider shorter life for rejected/OTP rows (N3). Check generated types/TS that assume string.

### N3 P1 - Rejected and non-transaction SMS (OTP, personal text) are stored in full and fed to Gemini; OTP codes persist
- Files: parse/route.ts:679-687 (pre-filter reject keeps raw_body, only sets status), SmsReceiver.kt isBankishMessage.
- Live: 123 rows rejected not_transaction; 25 of them match OTP/verification wording and still hold the body (codes included). With N2 they live forever.
- Fix: on pre-filter reject, redact digits/clear raw_body immediately (corpus gets the skeleton); do not send to AI.

### N4 P1 - Android forwards personal SMS because keyword gate is substring-based
- File: android/.../SmsReceiver.kt:isBankishMessage (`lower.contains("sar")`, "aed", "egp", "omr", "bhd", "kwd", "qar", "deposit", "fawry").
- Problem: any personal message containing e.g. a name with "sar" (case-insensitive) from a long numeric sender passes the gate, leaves the phone, is stored in sms_parse_log and sent to Gemini. 61 ai_new rows were rejected as not_transaction (consistent with this plus business-sender traffic).
- Fix: word-boundary / digit-adjacent match (`\b(EGP|SAR)\s*\d` or `\d\s*(EGP|SAR)`); keep it in sync with iOS.

### N5 P1 - Learner is blind to invisible bidi marks and date formats: ~300 SMS stay on paid AI forever
- Live: of 859 rows, 418 ai_new confirmed (about half of all traffic pays Gemini). learn_status: 210 `gate_capture_unsound: datetime group unparseable`; 78 `regex_no_match`, of which 69 (88%) have U+061C/U+200E/U+200F/U+065C marks and 74 have newlines; 161 bodies overall contain invisible marks. 31 learned only.
- Root causes: (a) nothing strips bidi/format control chars before regex generation, matching or hashing (grep of src/lib/sms finds none); `\s+` does not match U+061C. (b) src/lib/sms/patterns/index.ts:58 parseSmsDay accepts only zero-padded `DD[-/]MM[-/]YY(YY)` and DDMMMYY. Probe: `2/9/26`, `12/8/26 23:24`, `2026-09-02`, `8/18/2026` all return null, so every learned template that captures such a datetime fails the gate (and curated patterns lose the real date, falling back to arrival day).
- Also: `05/06/2026` is silently read as 5 June (dd/mm) with no mm/dd detection; a US-style date with day>12 returns null.
- Fix: normalise (strip ‎‏؜‪-‮⁦-⁩﻿ٜ, NBSP to space) once in the route before hash/regex; extend parseSmsDay (1-2 digit parts, ISO, 'at h:mm' suffix, month-first when day>12, per-sender format memory).

### N6 P1 - European/space-grouped amounts parse to the wrong value (probe confirmed)
- File: src/lib/sms/templateApply.ts:94 and patterns/index.ts:105 (strip every comma, parseFloat).
- Probe: `1.250,00` gives 1.25; `1 250,00` gives 1; `1,25,000.00` gives 125000 (ok). Arabic separators U+066B/U+066C are handled, U+060C (Arabic comma) and fullwidth digits are not. smsPlausibilityIssue only checks >0 and <1e9, so a 1000x error posts.
- Fix: locale-aware amount parser (last separator followed by exactly 1-2 digits is decimal), reject ambiguous.

## P2

### N7 P2 - sms_ingest_tokens UPDATE policy lets a user re-activate revoked tokens or unbind device_id
- Live pg_policies: `sms_ingest_tokens_update_own` (authenticated, qual user_id=uid, no with_check) with full-column UPDATE grant. Device removal, admin reset_sms_tokens and rotate all work by setting is_active=false / device_id scoping. A thief holding a removed phone's JWT can PATCH their own row via PostgREST (is_active=true, device_id=null) and keep ingesting (null device id skips isRevokedDevice).
- Fix: drop the UPDATE policy (all writes already use service role), or column-restrict.

### N8 P2 - Twin purchases within ~4 minutes are dropped as duplicates
- File: ingestGuards.ts:19-37 and route.ts:617-627. Hash is body + 2-minute bucket, and neighbour buckets (+/-1) count as live. Probe: identical body at +90s gives the same hash; bank SMS with no time-of-day (identical kiosk purchase twice) lose the second. Window is effectively up to 4 minutes.
- Fix: include sender/receivedAt exact second only for retries (client-generated idempotency key from native: hash of body + receivedAt second, which the native queue already has), instead of time buckets.

### N9 P2 - Pairing concurrency fix (publish kind/parsed_ok) is incomplete: amount and account_last4 stay NULL
- File: src/lib/sms/pairing.ts:262-269 publishes only kind and parsed_ok; sms_try_pair (live def) compares `abs(s.amount - p_amount)` and `pm.last4 = s.account_last4`; both columns are written only at the final promote (route.ts:1000+). For own_transfer / cc_payoff / registered-sibling pairing (all require equal amount) an in-flight sibling has NULL amount, the comparison is NULL, so concurrent legs still do not find each other. Only the reference path (ILIKE on raw_body) works.
- Fix: publish amount and account_last4 together with kind.

### N10 P2 - Undo of a refund/declined-matched SMS soft-deletes the ORIGINAL purchase
- File: sms/undo/route.ts:63-80. For refund_matched/twin outcomes the log's expense_id points at the original expense (live: 5 expenses referenced by 2 log rows each, kinds refund x4, declined x1; same pattern for instant_transfer_out/ATM/online purchase). Undo deletes whatever expense_id references, and never un-sets refunded_at/refund_kind.
- Fix: undo should reverse the refund mark when expenses.refund_sms_log_id = log id, and delete only rows with sms_log_id = log id.

### N11 P2 - Partial post then retry duplicates debt payments
- File: createSmsExpense.ts (createSmsInstallmentPayment ~line 380-420; createSmsDebtPayment similar): debt_payments row is inserted first, the expense second, with no transaction. If the expense insert fails the route sets add_failed/awaiting_confirmation; the user's /confirm re-runs createSmsTransaction and inserts a second debt_payment (debt reduced twice). Same for postTransferFee (error ignored, no sms_log_id uniqueness; there is no unique index on expenses.sms_log_id or income_events.sms_log_id at all - live pg_indexes shows none).
- Fix: single RPC for debt payment + expense; partial unique index on (sms_log_id) for non-fee rows; confirm must reuse debt_payment_id already on the log.

### N12 P2 - Queue drain treats "claim is being processed" as success
- Files: route.ts:617-627 and 656-670 return 200 duplicate:true for a live `processing` claim; smsTracker.ts:280 and SmsForwardWorker remove the item on any 2xx. If the first function is killed (row goes stale, sms_heal_stuck marks failed after 2 min), the SMS is gone from the device queue and no retry happens. Live: 13 rows failed `timed_out`.
- Fix: return 202/409 `in_progress` for a live claim so the client keeps the item.

### N13 P2 - sms_corpus keeps names that redaction does not catch, forever when seen 3+ times
- Files: adjudicator.ts:178 redactBody (only Latin ALL-CAPS 2+ word names, digit runs of 4+), skeleton.ts. Live (shape counts only): 516 corpus rows, 63 with seen_count>=3 (exempt from the purge), 147 containing a Capitalised-Word pair, 193 containing an Arabic "to/from + two words" shape. Arabic names and mixed-case names pass. Same redacted text is also copied to sms_corrections and quoted into other users' AI prompts.
- Also: purge keeps rows seen >=3 times from ONE user (no distinct-user floor), so a user's recurring payee persists.
- Fix: redact Arabic and Title-Case token runs after known keywords (from/to/لـ/من/الى), keep only skeletons seen by >=3 distinct users.

### N14 P2 - learn_status stores learned regex text with per-user literals
- File: route.ts:385, 398 (`status: regex_no_match: ${regex}` slice 200 stored on the log row, readable by the owner via RLS and by admins). Live values contain card last4 digits and full date/time literals copied from the user's SMS (e.g. last4 `9379`, concrete dates), i.e. the learner emits regexes with transaction-specific literals that cannot generalise, and the column becomes a second copy of personal data. Not covered by retention.
- Fix: store a short code only; add a gate rejecting digit literals in regex (beyond \d{n}).

### N15 P2 - 10-per-sender template cap counts retired/quarantined rows
- File: route.ts:429-466. `siblings` comes from all statuses; retired templates are never removed, so a sender with 10 retired/quarantined rows can never learn again (learn_status cap_reached). Fix: count status in (active, quarantined) only, and archive retired rows.

### N16 P2 - A single hard signal quarantines a global (curated_db) template for every user
- Live def of bump_sms_template_failure + dispatch.ts:197. One direction-guard override (a regex heuristic on body wording) calls p_hard=true and quarantines a curated_db template immediately; all users fall back to AI (cost) until shadow agreements restore it. A spoofed or odd SMS can therefore degrade a trusted template for everyone. Fix: require N hard signals from >=2 users or an AI adjudication before quarantine of curated_db.

### N17 P2 - Notification-listener forward path is dead code with unsafe design
- File: src/lib/native/notificationParser.ts. No caller of startNotificationListener exists. If wired: it captures a JWT in a closure (expires ~1h, then every forward 401s silently), no queue/retry (failure only console.warn), body "title - text" differs from the SMS text so SMS+app notification of one transaction book twice (hash is body-based; sms_parse_log_time_dedup_idx exists but no code uses it). Remove or fix before enabling.

### N18 P2 - Sender is never verified against the matched bank (spoofing / smishing books fake transactions)
- Files: patterns/index.ts:137-155 (sender only reorders), route.ts curated tier confidence 1.0. Any alphanumeric sender ID is spoofable, and iOS sends none. A smishing SMS shaped like a bank credit is auto-booked as income (or a purchase) with push, no confirmation.
- Fix: for curated patterns with known senderIds and a non-empty sender, require the sender to match; otherwise route to awaiting_confirmation.

### N19 P2 - Failed attempts accumulate full raw bodies
- route.ts:758, 775, 793, 809: each retry of a 429/502/not-configured creates a new log row (is_duplicate=true) with raw_body. Live: 54 gemini_error + 13 timed_out + 32 skipped_no_key. With N2 these are permanent copies. Fix: reuse the claim row on retry or blank body on terminal failure.

## P3

- N20 P3 - IPN_REFERENCE accepts any all-digit 6+ token after "ref/reference" (probe: `Reference: 20261027 for rent` returns the date digits; `Ref# 12345678` returns). Two unrelated same-day own-account legs can pair. dispatch.ts:146.
- N21 P3 - OTP pre-filter false positive (probe): a real purchase with "Auth code 123456" plus a "never share OTP" footer is rejected as otp (preFilter.ts carriesOtpCode).
- N22 P3 - last4 collisions: resolvePaymentMethodByLast4 / resolveExactPaymentMethod use `.limit(1).maybeSingle()` with no order or bank check; two methods sharing last4 attribute nondeterministically; sms_try_pair registered-sibling check has the same ambiguity. Learn gate also rejects 3-digit vs 4-digit last4 (live: 4 `gate_last4_mismatch regex=978 ai=0978`); cleanLast4 should left-pad or treat as prefix-match.
- N23 P3 - /api/sms/health returns ok for a token whose device is revoked (no isRevokedDevice) and ignores JWT; setup-token mints a token for any client-supplied device-id header, even unregistered (isRevokedDevice is false for unknown ids), and GET without device header returns the newest active token of any device.
- N24 P3 - `get_sms_keyword_pool` is executable by anon (live has_function_privilege anon=true). Pool is built from users' transaction SMS tokens; confirm contents are non-personal or revoke anon.
- N25 P3 - Broad table grants: anon and authenticated hold ALL privileges (incl. TRUNCATE, TRIGGER) on every sms_* table; only RLS protects. sms_corpus, sms_corrections, sms_keyword_pool, sms_sender_pool, sms_sender_currency, sms_stats_outbox have RLS on with zero policies (deny, ok). Revoke from anon/authenticated as defence in depth (migration 0163 anon-policy item still open for sms_parse_log, sms_ingest_tokens per D3, but live policies are now authenticated-only).
- N26 P3 - sms_heal_stuck only heals rows with `parsed_at < now()-2min` and `received_at > now()-2 days`; rows with NULL parsed_at or older than 2 days stay `processing` forever (no row currently stuck, but there is no catch-all). Heal sets failed without is_duplicate.
- N27 P3 - sms_parse_today (UTC day, parsed_ok only) drives the 100/day cap: non-transaction spam that reaches Gemini is uncounted by this cap (only the AI quota wheel limits it); UTC rollover differs from the user's zone.
- N28 P3 - Correction exemplar is trusted when ANY row has source_template_id (correctionExemplar.ts:~38), so a single user's adjudicated correction reaches all users' prompts without a second user.
- N29 P3 - iOS/Android: SMS >2000 chars is rejected 400 'Invalid body' forever (zod max 2000); iOS treats it as queued indefinitely (cap 50 evicts oldest), JS drain drops it as permanent. Android PendingSmsQueue cap 50 evicts oldest silently when offline for long.
- N30 P3 - Android worker maps every 4xx to Result.failure with no marker; 429 (rate/quota) and 403 device_required stay in queue until app opens (acceptable) but recordRun only keeps last result, so health cannot show backlog age.
- N31 P3 - Gemini API key is passed in the URL query for all calls (route.ts:347, 1427, 1468, 1510); any proxy/log capturing request URLs leaks it. Use x-goog-api-key header.

## Live data summary (aggregates only)
- sms_parse_log 859 rows: confirmed+expense 502, confirmed+income 135, rejected 123, failed 67, ghost-confirmed (no link) 12 (N1), duplicate-flagged 11, paired 4, add_failed 1 (insert_failed), notified+currency_provisional 1 (income, awaiting).
- No orphan expenses/income_events (sms_log_id with missing log) and no log linked to more than one expense; 5 expenses shared by 2 logs (refund/decline links, N10).
- Templates: 49 global rows, all active except 2 quarantined (max failure_count 5); no hard_fail rows; no stuck learning beyond N5 (13 `pending` learn_status older than 7 days = learner crashed or after() killed; unresolved).
- pg_cron: sms-stats-drain, sms-heal-stuck, sms-zero-variance, housekeeping, analytics all succeeding; sms-retention failing (N2).
- RLS: all 12 sms tables RLS on; owner-scoped SELECT on sms_parse_log, sms_ingest_tokens, sms_template_signals; N7 is the only write policy for users.

## Areas not reached
Admin sms routes and adjudicator run loop end-to-end (runAdjudication, exportTemplates), zero-variance SQL function body, balanceReport, matchSubscription/matchRefund beyond skim, merchantNormalizer/merchantCategoryCache poisoning (global cache written from AI output), iOS SmsCapacitorPlugin.swift and Android SmsCapacitorPlugin.kt internals, correctness of curated bank pattern files (cib/nbe/hsbc/etc.) against real formats, Gemini prompt-injection tests (no live AI calls), load/regex cost benchmarking of 200 curated_db regexes per parse, realtime nudge delivery, multi-part SMS on iOS.
