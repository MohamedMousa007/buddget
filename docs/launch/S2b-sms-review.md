# S2b: whole-pipeline SMS review (read-only)

Date 2026-11-14, model Fable 5.2 (judgment, verification, ranking) with Sonnet 5.5 subagents for the file sweeps and tabulation. Nothing was changed: no source edit, no migration, database read with SELECT only. Tree reviewed: `60c7077d` (`origin/main` = `origin/dev`). Data: 952 `sms_parse_log` rows, 10 users, 2026-06-16 to 2026-11-13. No personal names or message text appear here; rows are cited by the first 8 characters of the log id.

"Confirmed" means the cited lines demonstrably do it, or live rows show it. "Suspected" means the code path exists but nothing in the data or tests proves it happens. Items the six QA rounds or S1/S2 already closed or listed are not repeated; where S2 listed something as open it is referenced, not re-reported. Line numbers from the subagent sweeps are within about five lines; the ones behind every P0 and P1 were re-read by Fable.

## 0. Gate on the current tree

`npm run verify` on `60c7077d`: **passed** (exit 0). Lint 0 errors (56 warnings), types clean, 5263 tests passed in both time zones (189 skipped), migration check, dependency audit, production build. The four commits pushed after S2's recorded gate are therefore covered.

## 1. What matters most

1. **Three confirmed ways a real expense or real income disappears with no prompt** (P0-1, P0-2, P0-3): a "declined" message reverses any earlier expense of the same amount (one live case, a 4,000 EGP withdrawal); a card-payoff message deletes any outgoing transfer of a similar amount within five minutes; four matching account digits turn a payment to another person into an own transfer.
2. **The same SMS captured twice is booked twice** (P0-4). The retry identity became a per-capture id, and the older content check was switched off with it. Two iPhone automations, or two phones on one account (one user has an Android and an iPhone both collecting), double every message.
3. **S2's "possible pass-through: Yes" keeps hiding new pairs forever, and its Undo does not hold** (P1-1). This is the one part of S2's own logic that can hide a real expense.
4. **Wrong direction and wrong kind exist in live rows beyond the four S1 symptoms** (P1-5, P1-7, section 4): cash deposits booked as transfers in or as a withdrawal, remittance pick-up notices booked as income by a learned template, a "will be charged tomorrow" reminder booked as a purchase, and 7 Saudi card messages typed as card repayments (non-spend) that read like payments made with the card.
5. **Saudi coverage is one user, 99% through templates and the AI, with the issuing bank never named.** No code-tier pattern matches any Saudi format in use. The phone gate and the server pre-filter do not know "SR", "ريال" or "ر.س" (P1-3), so some Saudi messages can be dropped before they are logged, and nothing in the data can show how many.
6. **The AI share (57%) has two concrete causes.** (a) 210 of 478 AI-parsed transactions failed template learning on one date gate between July and October; QA6 fixed it and November shows 0 such failures. (b) Two formats carry 60% of all AI calls and have no pattern: the Egyptian card-style instant transfer (131 rows, one user) and the compact Arabic Saudi format (184 rows, one user). Two curated pattern families would do more than any promotion rule.
7. **Nothing S2 shipped has run on a live message yet.** No row carries `bank_source` or `shape_key`, and there are 0 provisional accounts. Every S2 number is a replay.

## 2. Findings

Sizes: S = under half a day, M = one to two days, L = more. "Test" is the failing test to write first.

### P0: wrong money, confirmed

**P0-1. A declined message reverses an unrelated real expense.** Confirmed in code and in live data.
- Where: `src/lib/sms/dispatch.ts:520-536` sends both `refund` and `declined` through `matchOriginalExpense` (`src/lib/sms/createSmsExpense.ts:766-799`): the most recent un-refunded expense with the same amount and currency in the last 90 days is stamped `refunded_at`. When the message's digits do not resolve to an account (most rows today), the account is not compared at all (line 787).
- Live: `0fe8887c` (declined, 4,000 EGP) stamped `9e75b537`, a cash withdrawal from 16 days earlier, as reversed. That withdrawal left the account and is now out of every total. All 14 declined rows went through this path; 5 attached to an existing expense.
- Effect: any declined attempt for a round amount hides an earlier real purchase of that amount. No prompt, no badge the user would connect to it.
- Fix (S): a decline never reverses an earlier settled charge. For `refundKind === 'declined'` match only an expense created from a message received within about 10 minutes before it, on the same account or merchant (the "charged then declined" double message); otherwise always write the standalone net-zero declined row. For true refunds: require the same account when either side has one, prefer a merchant match, and when the only candidate is "same amount, different or unknown merchant" book the refund as its own credit row and ask, instead of stamping.
- Test: given a 45 EGP purchase yesterday and a "declined 45 EGP" message today, expect the purchase still counted and one net-zero declined row. `matchRefund.test.ts` has no such case.
- Repair (S3): restore `9e75b537`; re-check the 3 refunds that matched transfers (`fb2d543a`, `e66b72ae`, `baab5343`; the last matched a transfer 40 hours earlier).

**P0-2. A card payoff deletes any outgoing transfer of a similar amount.** Confirmed in code; no live instance found (the 3 live payoff pairs are true funding legs).
- Where: `dispatch.ts:454-466` calls `tryPairLeg` with kind `cc_payoff`; default match kinds are `own_transfer` and `instant_transfer_out` (`pairing.ts:411-417`); `sms_try_pair` (0235) accepts any such row within ±300 s whose amount is within the fee tolerance, with no account, counterparty or currency check; `reconcileCcPayoffFundingLeg` (`pairing.ts:530-558`) then soft-deletes that expense and a "Transfer fee" row is booked for the difference.
- Effect: pay a person 12,100 and pay the card 12,000 within five minutes: the 12,100 expense is deleted and replaced by a 100 fee.
- Fix (S): the funding leg must name the card (counterparty digits equal the card's digits, or the payoff's reference), or be an `own_transfer`; a plain `instant_transfer_out` to a named person is never a funding leg. Add currency equality in SQL.
- Test: payoff 12,000 plus an unrelated transfer out of 12,100 three minutes earlier: expect both rows alive.

**P0-3. Four matching digits make a payment to someone else an own transfer.** Confirmed in code.
- Where: `dispatch.ts:299-305` and `isOwnAccountTransfer` (`pairing.ts:76-94`): counterparty digits equal to the `last4` of any confirmed account of the user, no bank compared, no sibling message required. The row becomes a non-spend `Transfer` and the user's own account is credited as destination. S2's "no single signal decides" rule (`ownTransferDecision.ts`) covers step 1b only, not this step.
- Effect: a friend whose account ends in the same four digits as one of the user's (about 1 in 10,000 per registered account; three-digit tails exist in the data and are 1 in 1,000) has every payment hidden from spending, and every payment received from them dropped from income, plus a phantom credit on the user's account.
- Fix (S): route step 1 through `decideOwnTransfer` as the `account` signal: it settles only together with the pair seen on one device, or a matching bank on the counterparty; alone it asks once (the own-transfer question and Undo already exist).
- Test: user has account ••4321 at bank A; outgoing transfer to ••4321 with no incoming leg: expect spending plus a question, not a Transfer.

**P0-4. The same SMS captured twice is booked twice.** Mechanism confirmed; live instances possible but unproven.
- Where: `src/lib/sms/ingestGuards.ts:29-45` and `:55-56`. With an event id the hash is `body|evt:<id>` and the neighbour-bucket check returns nothing. `SmsReceiver.kt:78` and `CatchBankSmsIntent.swift:52` mint a new id per capture. Nothing later compares content (`dispatch.ts` only has the refund twin check). The comment at `src/app/api/sms/parse/route.ts:741-743` still says two Shortcuts are caught by the unique index; that stopped being true.
- Who is exposed: an iPhone user with a per-sender and a per-phrase automation; an Android phone that delivers the broadcast twice; two phones on one account (user `1f0b4fcb` has an Android and an iPhone, both `collects_sms = true`).
- Live: no row has been flagged duplicate since 2026-07-13. Same-user groups with an identical masked body, equal amount, within 100 s, all booked: four outgoing and two incoming 1,500 EGP transfers (`1271e1f5`, `97fca7d5`, `8ad101f4`, `5bdc7499`, `ab5411e0`, `bdc14d28`) and two 700 SAR credits 34 s apart (`78e0b305`, `cb5fd476`; these read as cash deposits, so two deposits are plausible). Raw text is gone, so none can be proven a duplicate rather than a repeat. Owner can settle it against a statement.
- Fix (M): a content twin guard next to the event-id hash. Same user, same normalized body (the existing body hash without the event id), different event id, within 3 minutes: if the body carries a discriminator (time of day, reference, or running balance; section 4 shows 93% of purchases and 99% of transfers print a date and time) it is the same message, mark duplicate; if it carries none, book it but hold it as "possible duplicate" with one-tap remove. Separately, allow one collecting device per SIM per user (the `is_main` flag exists).
- Test: two POSTs, same body, different event ids, 10 s apart: expect one money row.

### P1: can hide or misstate money, or loses messages

**P1-1. Pass-through "Yes" hides every later look-alike pair, and Undo does not hold (S2 logic).** Confirmed.
- Where: `src/components/features/flow/useFlowLedger.tsx:139-141` re-applies `applyPassThrough` to every pending pair whenever the remembered answer is "yes". The toast Undo (`IncomePrompts.tsx:145`, `src/lib/spending/passThrough.ts:57-70`) clears the row flags only, so the effect excludes them again on the next render. `passThrough.ts:31` puts every row with no account in one "unassigned" bucket, so a credit on one unknown account and a payment from another pair up; the client compares no digits, unlike the server label.
- Effect: after one Yes, receiving 5,000 from anyone and paying 5,000 to anyone within 10 minutes silently removes both from income and spending, for good, with no notice per pair. For the zero-account user (`4fce9265`, 175 messages, the relay user) everything is in the one bucket.
- Second effect (confirmed in code): the excluded expense stays in `cashOutflow` while the credit leaves income (`calculations.ts:245` against `:672-674`), so net worth falls by the relayed amount for users with no tracked accounts.
- Fix (M): Undo also records the pair as "counted" (a per-pair opt-out in prompt state) so the effect skips it; pairs found after the first answer are applied with a visible toast and Undo each time, never silently; the unassigned bucket pairs only when both legs carry the same digits; drop the pair from `cashOutflow` when the credit is excluded.
- Test: answer Yes, tap Undo, re-render: expect both legs counted. Existing `passThrough.test.ts:60` calls `undo()` directly and never runs the effect.

**P1-2. The pair SQL claims rows that are not real, and a leg can vanish.** Confirmed in code.
- Where: `sms_try_pair` (`supabase/migrations/0235_sms_try_pair_race_fx.sql:36-70`) does not filter `is_duplicate`, `status`, currency or direction, and does not require the sibling to have posted. `pairing.ts:617-638` then posts nothing for this leg when the sibling "exists".
- Effect: a debit pairs with a credit that is held, failed or a retired retry: neither is booked, and when the held credit is confirmed later it books as plain income. Two outgoing legs can pair; 100 EGP can pair with 100 USD. The decision is made on one candidate row (`pairing.ts:117-148`) and the claim can take a different one.
- Fix (M): in SQL require `is_duplicate = false`, a live status, equal currency (except FX), opposite direction, and claim only the candidate id the decision was made on; refuse a same-account pair (already an S3 carry). In TS, if the sibling has no money row, post this leg normally.
- Test: debit leg arrives while the credit leg is `awaiting_confirmation`: expect the debit booked.

**P1-3. Saudi and Arabic currency spellings are missing from the phone gate and the server pre-filter.** Confirmed in code; frequency unknowable (a dropped message leaves no trace).
- Where: `android/.../SmsGate.kt:10-13` (egp, aed, sar, qar, kwd, omr, bhd, usd, eur, gbp only; no "SR", "ريال", "ر.س", "LE", "ج.م"; `\d` is ASCII-only so Arabic-Indic amounts fail), `src/lib/sms/deviceOtpGate.ts:5-8`, `src/lib/sms/patterns/preFilter.ts:111-126`, `patterns/currency.ts:21`, `directionGuard.ts:36`. "تم الدفع" is only in the weak verb list. The iOS list adds LE and ج.م but not SR.
- Effect: a Saudi purchase written with "SR" that also carries a "do not share" footer or a marketing word is dropped on the phone, or rejected as OTP or balance-only on the server. The dominant Saudi format in the data (184 rows) writes "SR".
- Fix (S): one shared currency token list (codes plus SR, ريال, ر.س, LE, L.E, ج.م, جم, E£), used by the Kotlin gate, the Swift gate, `deviceOtpGate`, `preFilter`, `currency.ts` and the direction guard; Unicode digits in the Kotlin regex; add the strong Arabic verbs.
- Test: `SmsGateTest` and `patterns.test.ts` cases for an "SR 100" purchase with an OTP-style footer, and an Arabic-Indic amount.

**P1-4. The Android worker stops sending after 8 attempts.** Confirmed.
- Where: `SmsForwardWorker.kt:88-92` (`MAX_ATTEMPTS` at `:174`): at 8 attempts `doWork` returns `Result.retry()` before the POST, so nothing is sent again although the comment says it keeps checking. Attempts are used by 5xx, 401/403, `no_token` and `other_account`; with 30 s doubling back-off that is about two hours.
- Effect: a two-hour server problem or a late token means every queued message waits for the next app open; after 30 days it is evicted. Live: 116 rows reached the server more than an hour after capture and 86 more than a day late (both platforms).
- Fix (S): remove the early return (WorkManager's capped back-off is the limit). Treat `no_token` and `other_account` as waits, not attempts.
- Test: worker test with `runAttemptCount = 9` and a 200 server: expect the item sent and removed.

**P1-5. Wrong direction and wrong kind reach the ledger; a learned template can cause it and nothing checks the words after the match.** Confirmed in code; live rows below.
- Where: the learner prompt forbids anchors (`route.ts:597`); `learnGates.ts` never compares `mapping_rules.kind` with the AI's kind or the kind list; `directionGuard.ts` acts only on a trailing +/- sign, which most messages lack. `curated_db` templates are tried against every message from every bank (`curatedDbCache.ts`, `route.ts:263`) with no sender or routing-key scope. Shadow comparison only runs for quarantined or not-yours templates.
- Live (bodies read against the stored kind, section 4): 5 remittance "has been collected" notices booked as **income**, 4 of them by a learned template (`65921ad1`, `4b5d53d7`, `cb25279f`, `93e7ec95`, `d35340ff`); a cash deposit booked as a **withdrawal** (`818b0736`); 3 cash deposits booked as transfers in (`cb5fd476`, `78e0b305`, `0812aa55`); a telecom advance repayment booked as income (`02370960`); a "will be charged" reminder booked as a purchase (`dac3937a`). The owner should confirm the remittance reading; the rest are unambiguous.
- Effect: income overstated, or a credit shown as money out. Nothing quarantines the template, because user corrections only produce soft bumps (P2-6).
- Fix (M): at learn time and at promotion store a "must not contain" guard built from reversal, decline and future wording (declined, reversed, refund, rejected, will be, due, مرفوض, رفض, عكس, استرجاع, سيتم) unless the template's own kind is one of those; reject at apply time when the unmatched remainder of the message contains it. Validate `kind` against the enum and the AI's kind in `runLearnGates`. Scope `curated_db` lookups by routing key. Add a wording-based direction check for the AI tier (deposit, إيداع = credit; "collected by the receiver" = debit) and a `cash_deposit` kind or mapping to income.
- Test: template learned from a purchase message; feed the same message with "was declined" appended: expect no template match.

**P1-6. Undo and delete of one leg of a settled pair lose the other leg.** Confirmed in code.
- Where: `src/app/api/sms/undo/route.ts:60-117` retires only the log's own rows. Rows that pairing soft-deleted (`pairing.ts:617-634`, `:538-558`) stay deleted; undo on the leg without a row returns `alreadyUndone` and changes nothing. Only `/api/sms/own-transfer` restores, and only for pairs with a `settle` verdict (steps 0, 1, 2 and 3 have none). Undo also leaves: the "Transfer fee" row (`dispatch.ts:128`), the balance report, the salary occurrence stamp, `subscriptions.pending_plan_*`, a provisional account created by that message.
- Also: `public/sw.js:89-99` reads `parseLogId` while the server sends `logId`, so the web push Undo action never works; `/api/sms/undo` has no other caller in `src`. In the app the user's only undo is deleting the row, which has the same one-leg effect.
- Also: undo then confirm on a currency-provisional row books it again (`confirm/route.ts:58-134`; undo never clears `awaiting_confirmation`).
- Fix (M): one "reverse this message" function used by undo, dismiss and row delete: restore the sibling's retracted row (or delete both and unpair), remove the fee row, the balance report and the provisional account if this message was its only source; clear `awaiting_confirmation`; set status `undone`. Fix the service-worker key.
- Test: out leg then in leg settled as a Transfer; undo the out leg: expect the income restored and no Transfer row.

**P1-7. An AI-chosen kind alone takes a row out of spending.** Confirmed in data.
- Where: `own_transfer` with no sibling still books a non-spend `Transfer` (`dispatch.ts` step 2); `cc_payoff` with no debt match books a non-spend `CC Payoff` (`dispatch.ts:474-478`).
- Live: 7 Saudi rows typed `cc_payoff` whose wording reads as a payment made with the Visa card and a balance line, not a repayment of it (`51966294`, `5fe0a498`, `82133010`, `6cde6c02`, `81144634`, `c18dabf3`, `b61afd88`; owner to confirm the reading); 8 of 10 payoff rows have no debt link (6,205 in total). `own_transfer`: `ff52e170` is a mobile recharge (its 10 siblings are purchases); `a602aba1` and `34a081d4` are "transfer to another account"; 4 card-to-account transfers have no destination (`8a94eede`, `97cbe48e`, `f160ed74`, `2c9dc6b3`).
- Effect: real spending is silently non-spend on the AI's word.
- Fix (S): an unpaired `own_transfer` with no registered destination, and a payoff with no card or debt, are booked as spending with the existing ask-once question, not as non-spend.

**P1-8. Raw message text is kept forever in the template table.** Confirmed in code and data (privacy; contradicts the 30-day promise).
- Where: `route.ts:535` writes `template_sample: message.slice(0, 500)`, the first learner's raw message. No retention job touches `sms_tracking_templates_ai`. Live: 59 templates carry a sample, none is masked, 44 contain runs of 4+ digits, 38 are older than 60 days. It is shown in the admin Templates panel, and `exportTemplates.ts` `redactSample` (ASCII upper-case names and 5+ digit runs only) writes it into a repo-bound export.
- Fix (S): store `maskPii(message)` instead; a one-off script re-masks the 59 rows; the exporter uses the same masker.
- Related, already on S2's list for S4: `clean_title` keeps the counterparty name. New consequence: the push title is `cleanTitle ?? merchant` and push masking is opt-in (`src/lib/privacy/pushMask.ts`), so by default the other person's name is shown on the lock screen.

### P2: wrong in some cases, cost, or quality

**P2-1. "Not mine" on a provisional account does not stop new messages counting; and a provisional account still settles transfers (S2 logic).** Confirmed in code. `provisional.ts:109` sets `excluded`, but the server inserts later expenses with `spend_exclusion` null (`createSmsExpense.ts:582-601`) and totals read only the row flag, so new messages on those digits count as spending. Separately `countersOwnAccountDigits` (`pairing.ts:97-101`) counts a provisional account as the decisive `account` signal, against the stated rule. Fix (S): stamp `spend_exclusion = 'method'` server-side when the account is excluded; make `account` decisive only for confirmed accounts.

**P2-2. Server writes overwrite the user's category (S2 logic).** Confirmed in code. `route.ts:1070` updates by id after a multi-second AI call with no `category = 'Other'` predicate; `route.ts:1073` and `merchantCategory.ts:24` treat any "Other" row as uncategorised, including one the user chose, and reach closed months. Every SMS expense has `edited_at` set (567 of 567), so that column cannot tell a user edit. Fix (S): add `.eq('category','Other').is('category_source', null)` to both writes; never touch `user_confirmed` or `user_changed`.

**P2-3. Two formats carry 60% of all AI calls and have no pattern.** Confirmed in data (section 5). The Egyptian card-style instant transfer, out and in (131 rows, AI only; the account-style sibling is in code and one card-style pattern, `nbe-ipn-in-card-ar`, already exists), and the compact Arabic Saudi format (purchase, online purchase, transfer in: 161 AI rows of 184). Fix (M): write the curated patterns from the stored masked bodies and the 205 raw bodies still held; replay on the gold set. Expected AI share after: about 25% on this data.

**P2-4. The learner retries a failing shape three times on every message, charged to the user.** Confirmed in code and data. `route.ts:461-490`; `decideLearnRetry` is used for the hint only. Live outcomes for 478 AI-parsed transactions: 44 learned or merged (9%), 210 date-gate failures (July to October, 0 in November), about 110 regex-does-not-match-its-own-sample (mostly multi-line Saudi bodies), 45 no JSON, 32 no key. Fix (S): before learning, read the last `learn_status` for the same `shape_key`; skip inside the class's cool-down; one attempt per message.

**P2-5. The "AI calls today" limit counts every parsed message.** Confirmed (live view definition). `sms_ai_today` counts `parsed_ok = true OR (ai_new AND rejected)`, so code-tier and template parses use the 100-a-day AI allowance. Busiest user-day so far is 20; a backlog drain after an outage would hit it. Fix (S): count `parse_method = 'ai_new'` only.

**P2-6. Currency falls back to the user's base currency when the body has no known token.** Confirmed in code. `currencyResolver.ts:41-43`: a pattern's literal currency is trusted only if `patterns/currency.ts:21` finds a token; no "SR", and `\b` fails on "SAR100". A SADAD payment for an EGP-base user becomes EGP (flagged provisional), an Egyptian transfer for a SAR-base user becomes SAR. Learned sender currency is last-confirmed-wins and keyed on the hotline (`0140_sms_v2.sql:85-91`). Live: 2 provisional-currency rows (`1d8a9006`, `0304039f`); the body-versus-stored currency check found 0 mismatches. Fix (S, with P1-3's list): trust a curated literal without a token; make sender currency a majority.

**P2-7. User corrections cannot quarantine a wrong template; one AI disagreement can retire a good one.** Confirmed in code. Adjudication bumps are always soft and need `match_count >= min_matches_before_retire`; a single shadow disagreement retires even a `curated_db` template with the AI as the reference; exoneration leaves `sms_template_hard_signals` rows, and the hourly zero-variance sweep (`0140:109-131`) re-quarantines fixed-amount templates after every exoneration. `template_revoked_at` is written but read by nothing. Fix (M): two independent hard signals to retire; exempt constant-amount templates from zero-variance; delete hard signals on exoneration; show revoked rows in the admin log and in Flow as "check this".

**P2-8. The negative cache can blind a real format for everyone.** Suspected; not happening today. `negativeCache.ts:26-37`: two AI rejections of one masked shape, no parsed row with that shape, global scope, and once cached the AI is never asked again. Live: 6 shapes have 2+ AI rejections; none of the wrongly rejected rows in section 4 was rejected by the AI, so the cache holds no real format yet. Fix (S): require 2 distinct users or 3 messages over 2 days; expire after 30 days; write `masked_body` at insert for parsed rows so success evidence exists the same day.

**P2-9. A 5-digit number is read as a bank hotline.** Confirmed regex, suspected frequency. `providerFromBody.ts:223`, `routingKey.ts:46`: an amount or reference equal to a known hotline names that bank with authority and keys template lookup and currency learning. Fix (S): accept a hotline only next to call wording, never adjacent to a currency token or decimal point.

**P2-10. Arabic merchants are never learned or asked about.** Confirmed. `merchantKeyOf` (`merchantCategory.ts:6`, and the trigger in 0267) strips everything but a-z0-9, so an Arabic-only name has no key. Fix (S): Unicode letters and digits in both places.

**P2-11. A remembered "No" blocks true own transfers for good; a remembered "Yes" needs only same amount and device (S2 logic).** Confirmed in code. `ownTransferDecision.ts:60`: `answered === false` returns `none` even with a matching reference. With `answered === true`, any credit on A and debit on B of equal amount within 300 s settle (salary in, rent out), direction and counterparty unchecked. Fix (S): a matching reference turns "No" into a question; "Yes" plus device still requires opposite directions and a debit that does not name a different person.

**P2-12. iPhone delivery waits for the app to be opened.** Confirmed in code and data. One 15 s attempt in the intent, then a `BGProcessingTask` the system may not run for days (`SmsCapacitorPlugin.swift:462-481`). 86 rows arrived more than a day late. Dates stay right (capture time is kept); the user sees nothing until they open the app. Fix (M): one more attempt inside the intent after a short wait; also schedule a `BGAppRefreshTask`; show "N messages waiting" on app open.

**P2-13. Messages that arrive while tracking is disarmed are dropped without a trace.** Confirmed by design. Sign-out, account switch or a Keystore wipe set `sms_enabled = false` (`SmsReceiver.kt:37`, `CatchBankSmsIntent.swift:34`). Revoked permission is never detected after setup (`useSmsTracking.ts:155` checks only on toggle). Fix (S): on app open compare OS permission with the armed state and show one banner; count dropped-while-disarmed locally and report it with the queue stats.

**P2-14. A timed-out parse is final.** Confirmed in data. 3 rows have status `failed`, `timed_out`, no tier (`38ff07ea`, `af7e8c15`, `2e1a674f`). `af7e8c15` is a real Saudi card purchase of a shape that parses 121 times elsewhere; it was never booked and never retried. Fix (S): a timed-out row is retired like the AI-error path (`route.ts:896-904`) so the phone retries, or a cron re-parses failed rows while the raw body exists.

**P2-15. Cash withdrawals leave spending and go nowhere.** Design question for the owner. `ATM Cash Withdrawal` is non-spend and Cash is meant to be the destination, but 0 of 22 live ATM rows have a destination set, and cash spending is not captured by SMS. About 60,000 EGP of withdrawals are in no total. Options: count withdrawals as cash spending by default with a one-tap "still holding it"; or keep as is and say so in the UI.

**P2-16. Own-transfer question can stick.** Confirmed in code. `useOwnTransferReview.ts` lists `ask` rows whose expense was deleted; the route answers 409, the prompt shows again and blocks the queue. Undo there can resurrect an income the user deleted, and recreates income on the UTC day with no account (`own-transfer/route.ts`). Fix (S).

### P3: low impact, latent, or repair-only

- **P3-1. Retention can be blocked silently.** `sms_retention()` returns 0 unless the leak-scan stamp is under 7 days old; the sweep restarts from the first store each run with about 15 s left, so at scale it never completes. Healthy today: stamp 2026-11-13, no raw body older than 30 days. Fix (S): resume cursor; alert when the stamp is older than 3 days.
- **P3-2. Promotion checks that check nothing.** The replay passes with an empty corpus (`promotionChecker.ts`, admin `promote` with `cases = []`); the failure-rate subselect in `check_sms_promotion_eligibility` joins `l.sender = t.sender`, which never matches hotline or body keys, so the rate is always 0. Admin `update` (regex edit on a `curated_db` template) and `bulk_toggle` skip the gate and cache invalidation; other serverless instances keep a killed template for up to 60 s. Fix (S): empty corpus blocks promotion; join on `matched_template_id`.
- **P3-3. Time zone default.** 6 of 10 SMS users have no stored time zone and get Cairo; a Saudi user without one gets the previous day for the first hour after midnight in winter. Historic: 49 SMS expenses (June to October) sit on the previous day, 1 in the wrong month; 0 since November (QA6 fix). Repair in S3; default from the message currency when no zone is stored.
- **P3-4. Lost rows, repair only.** Three July originals have no money row while their twin was flagged duplicate at the same instant: `fa2a8ec2` (purchase 499.05 EGP), `ad8523cb` (ATM 1,000 EGP), `029bb171` (400 SAR; a top-up, so only the first two matter). Today's claim returns 409 to the second request. Also no money row and no trace: `540077ff` (online purchase 99.99 SAR), `acbe9dd7` and `916e58d4` (credits of 100 SAR), `aa5ece0a` (`add_failed`, 22 SAR, never surfaced). One wallet transfer receipt was rejected by the code tier as not a transaction: `10ac8181`.
- **P3-5. Admin views.** `queueWatch.ts` "silent" compares `last_seen_at`, not `last_sms_at`, so a phone opened daily whose capture died is never flagged. `smsDisplay.ts` shows "No transaction" for undone, held and debt-only rows. `bank_source`, `shape_key`, `category_source`, `template_revoked_at` and `debt_payment_id` are not in the admin log columns. `coverage.ts` counts legacy tiers as none.
- **P3-6. Push wording.** A paired leg that posts nothing gets "expense added" with an empty id (`route.ts:1283-1292`).
- **P3-7. Confirm claim is not released on a crash** (`confirm/route.ts:74-92`): the row is neither held nor posted. A held credit still writes a balance report (`route.ts:1007-1021, 1346`), and undo or dismiss never remove it.
- **P3-8. Errors ignored on pair bookkeeping** (`pairing.ts:336-340, 538-558, 626-633`, `dispatch.ts:125`, `createSmsExpense.ts:716`): the log says paired while a row was not retired or a fee not written. Check and fail the leg.
- **P3-9. Small device items.** A multipart body over about 10 KB breaks the work enqueue (`SmsReceiver.kt:80-86`); a null PDU part yields a partial body sent as complete; a queued message with owner "" is delivered to whichever account signs in first (`CatchBankSmsIntent.swift:57-64`).
- **P3-10. Data hygiene.** `bank_name` is `''` on 69 template-tier rows and null elsewhere. `parsed_at` is earlier than `created_at` on every row, so parse time per tier cannot be read. The assistant's income totals ignore `income_events.exclusion` (`buddgy/tools/exec/income.ts:94`). The merchant question is counted as answered when the sheet opens (`MerchantCategoryPrompt.tsx`), which inflates the answer rate the council wants to read.
- **P3-11. Hijri dates.** `parseSmsDay.ts:75` reads any `yyyy/mm/dd`; a Hijri year would fail the plausibility check and the message is rejected for good. Suspected; none seen in the data.

## 3. Every stage: what can go wrong, and whether it does

| Stage | Main risk | Shown by | Finding |
|---|---|---|---|
| Android capture | Gate drops SR and Arabic amounts; disarmed windows; receiver swallows exceptions | Code; no trace possible | P1-3, P2-13, P3-9 |
| iPhone Shortcut | No sender; two automations double-send; waits for app open | Code; 86 rows a day late | P0-4, P2-12 |
| On-device queue and retry | Worker stops at 8 attempts; eviction is silent (cap 200, 30 days) | Code; 116 rows over an hour late; 0 evictions reported | P1-4 |
| Ingest gates and tokens | AI allowance counts all parses; timeouts and rejects are final | Live view; 3 timeouts, 1 real | P2-5, P2-14 |
| Dedupe | Retry identity is per capture; no content check | Code; 0 duplicates flagged since July | P0-4 |
| Parse tiers | Unscoped global templates; wrong-kind match; hotline misread | Code; 9 live rows | P1-5, P2-9 |
| Direction guard | Acts only on a trailing sign; no SR | Code; 5 live rows | P1-5, P1-3 |
| Date | Cairo default; Hijri | 49 historic rows | P3-3, P3-11 |
| Currency | Base-currency fallback; last-wins sender currency | 2 rows; 0 mismatches | P2-6 |
| Dispatch | Declined and refund matching; AI kind decides non-spend | `0fe8887c`; 14 rows | P0-1, P1-7 |
| Pairing | Claims unreal rows; payoff funding leg; digits alone | Code | P0-2, P0-3, P1-2 |
| Writes | Atomic and idempotent per log id | Checked, fine | none |
| Confirm, undo, dismiss | One-leg undo; dead web undo; undo then confirm | Code | P1-6 |
| Push | Counterparty name on lock screen; wrong text for paired leg | Code | P1-8, P3-6 |
| Learning funnel | 9% learn rate; no back-off | Live `learn_status` | P2-4 |
| Promotion and quarantine | Flap; soft-only corrections; empty-corpus gate | Code; 1 quarantined, 1 retired | P2-7, P3-2 |
| Retention and masking | Raw sample kept; scan can stall | 59 raw samples; scan healthy | P1-8, P3-1 |
| Admin views | Wrong "silent" rule; missing new columns | Code | P3-5 |

Checked and found sound: bearer and device gating; concurrent identical event ids (the second gets 409 and stays queued); stale claims never re-post; an AI error retires the row and the phone retries; atomic booking keyed on the log id with unique indexes for expense, fee, income and debt payment; ownership filters on confirm, undo, dismiss, ack and own-transfer; push token ownership on register; cron routes authorised; retention never deletes a log row a money row points to; learn-time gates (balance clause, greedy wildcard, per-user literals); merchant memory never crosses users below the thresholds S2 set; multipart parts joined in order; the queue is written before any network work on both platforms; another account's queued messages are never sent under the current token; direction of instant transfers in and out agrees with the body on all 304 rows.

## 4. Every kind, on live data

Counts exclude the 11 flagged duplicates. Tier columns: code / curated table / learned template / AI.

| Kind | Rows | Tiers | What is written | Issues found |
|---|---|---|---|---|
| purchase | 287 | 57 / 1 / 81 / 148 | expense, spend | account and category are S2's; 1 lost to a timeout (P2-14) |
| online purchase | 71 | 0 / 5 / 9 / 57 | expense, spend | 1 future-charge reminder booked (`dac3937a`) |
| transfer out | 169 | 71 / 0 / 4 / 94 | expense (Instapay or Remittance), spend | P0-2, P0-3, P1-1; direction correct on all |
| transfer in | 135 | 42 / 1 / 3 / 89 | one-time income | 3 are cash deposits; P0-3, P1-1 |
| own transfer | 8 | 1 / 0 / 0 / 7 | non-spend Transfer | 7 of 8 questionable (P1-7) |
| currency exchange | 4 | 4 / 0 / 0 / 0 | one row per pair (after S2) | old rows await S3; rate not stored |
| ATM | 23 | 12 / 0 / 2 / 9 | non-spend | 1 is a deposit (`818b0736`); 1 hidden by P0-1; 0 have a destination (P2-15) |
| card payoff | 10 | 0 / 0 / 1 / 9 | non-spend; debt payment when matched | 7 read as card payments (P1-7); 8 without a debt link |
| instalment | 0 | none | debt payment | no live sample; 2 instalment reminders correctly rejected |
| salary and other income | 35 | 0 / 17 / 6 / 12 | income event | 24 are wallet top-ups (S2 fixed forward, repair in S3); 5 remittance notices and 1 repayment are not income (P1-5); no salary seen by SMS |
| refund | 6 | 0 / 0 / 0 / 6 | original stamped, or income | 3 matched transfers by amount only (P0-1) |
| declined | 14 | 0 / 0 / 5 / 9 | original stamped, or net-zero row | P0-1; 9 standalone rows are correct net-zero |
| fee | 5 | 0 / 0 / 2 / 3 | spend | 3 are bills (S2 fixed forward) |
| subscription match | 0 | none | linked expense | no live sample |
| balance report | 22 reports | n/a | `account_balance_reports` | 165 parsed bodies mention a balance, 26 rows captured it |
| rejected | 173 | 94 code / 76 AI / 3 timeouts | nothing | below |

**Rejected rows, each body read and classified.** Marketing 93, delivery or telecom 33, OTP 28, wallet balance-only 12, payment reminders 2, service notice 1, declined 2, **real money movement 2**. The filter is right on 169 of 173.
- Real and lost: `af7e8c15` (card purchase, timed out) and `10ac8181` (wallet transfer receipt with fee and balance, rejected by the code tier).
- Declined but logged as failed or rejected: `38ff07ea`, `978e8bc3`. No money effect.
- Borderline, left as rejected: `64c5a3ac`, `b93d9787`, `4f87b8c6`, `1c65a81a`, `725cb314`.
- The 12 wallet balance-only messages carry a balance, a date and a transaction id; they could feed balance checks.
- S1's `a6299757` was not flagged as a real movement by this pass; it stays with the owner's 15.

**Could not be checked on kinds:** amounts against the body (every digit is masked), so "balance read as the amount" and "fee read as the amount" are untested on live rows.

## 5. Coverage matrix

Bank is the stored name, else a brand word in the body, else the house format ("inferred"). No Saudi message names its issuing bank except one wallet, so Saudi rows are grouped by format family; one family may be more than one bank. Cells are code / curated table / template / AI.

**Language.** Arabic bodies 670, of which 61% went to the AI; English bodies 282, of which 40% did.

**Egypt**

| Bank or format | Rows | Arabic | With digits | Types and tiers |
|---|---|---|---|---|
| CIB | 133 | 122 | 96% | purchase 55 (55/0/0/0); transfer out 38 (37/0/0/1); transfer in 23 (22/0/0/1); ATM 12 (12/0/0/0); declined 1 (AI) |
| NBE-style card instant transfer, no brand in body (inferred) | 134 | 134 | 100% | transfer out 76 (AI); transfer in 55 (AI); refund 3 (AI) |
| NBE (account style) | 26 | 26 | 100% | transfer out 12 (code); transfer in 13 (code); online 1 (AI) |
| HSBC | 60 | 0 | 85% | purchase 15 (0/0/8/7); transfer out 22 (code); transfer in 7 (code); own 1 (code); FX 4 (code); ATM 3 (0/0/2/1); wire credit 3 (AI); declined 4 (0/0/3/1) |
| CIB-style debit card, no brand (inferred) | 27 | 27 | 29% | purchase 23 (0/0/19/4); online 4 (0/0/3/1) |
| Vodafone Cash | 44 | 31 | 0% | recharge 10 (0/1/5/4); own 1 (AI); 33 rejected (promos, balance-only) |
| Unbranded English, "available balance" line | 16 | 0 | 43% | purchase 9 (0/0/8/1); transfer out 5 (AI); transfer in 1 (AI); other 1 (AI) |
| Unbranded Arabic debit notice | 5 | 5 | 100% | purchase 4 (AI); online 1 (AI) |
| Arabic stamp-duty or service fee | 4 | 4 | 0% | fee 4 (0/0/2/2) |
| Arabic card repayment | 3 | 3 | 100% | payoff 3 (0/0/1/2) |
| QNB | 3 | 0 | 100% | purchase 2 (code); transfer in 1 (curated) |
| Banque du Caire | 1 | 0 | 100% | ATM 1 (AI) |
| Other single-row formats | 4 | mixed | mixed | AI |

**Saudi Arabia** (one user)

| Format family | Rows | Arabic | With digits | Types and tiers |
|---|---|---|---|---|
| Compact Arabic (point of sale, online, transfer, repayment) | 198 | 198 | 77% | purchase 121 (0/0/14/107); online 33 (0/0/2/31); transfer in 26 (0/0/3/23); transfer out 3; own 4; ATM 1; payoff 7; refund 1; fee 1 (all AI) |
| English labelled lines (card, online, refund, rejected, internal transfer) | 47 | 0 | 76% | purchase 7 (AI); online 8 (0/3/1/4); transfer out 4 (0/0/3/1); transfer in 9 (AI); ATM 6 (AI); income 4 (AI); refund 2 (AI); declined 7 (0/0/2/5) |
| English card line with Apple Pay | 38 | 0 | 100% | purchase 38 (0/0/26/12) |
| Wallet (Barq) | 28 | 1 | 25% | top-up 21 (0/17/2/2); online 7 (0/2/3/2) |
| Arabic labelled lines | 22 | 22 | 90% | online 16 (AI); purchase 3 (0/0/1/2); declined 1 (AI) |
| English remittance | 15 | 0 | 26% | transfer out 9 (0/0/1/8); "income" 5 (0/0/4/1) |
| Instalment provider | 3 | 0 | 0% | online 1 (AI); 2 reminders rejected |
| Telecom advance | 2 | 0 | 0% | "income" 1 (AI); 1 rejected |

**Gaps.**
1. All 290 code-tier rows are Egyptian (CIB, NBE account style, HSBC, QNB). **No Saudi format has a code-tier pattern.**
2. AI-only cells by volume: NBE-style card transfer out 76 and in 55; Saudi Arabic labelled online purchase 16; Saudi English transfer in 9, purchase 7, ATM 6, income 4; Saudi compact payoff 7 and own transfer 4; unbranded English transfer out 5; unbranded Arabic purchase 4. Mostly-AI cells: Saudi compact purchase 107 of 121, online 31 of 33, transfer in 23 of 26; remittance out 8 of 9.
3. **Banks and wallets with no message at all in the data**, so untested: Egypt: Banque Misr, AAIB, ADIB, Alex Bank, Orange Cash, e& Cash, Fawry, valU, Telda, Halan, Emirates NBD and Mashreq (patterns exist, never matched). Saudi: every bank by name (Al Rajhi, SNB, Riyad, SABB, Alinma, BSF, ANB, AlBilad, AlJazira), STC Pay, urpay, D360. The Saudi families above belong to at most three issuers.
4. Message types never seen: instalment deducted, salary, standing order, subscription renewal identified as such, cheque, loan repayment.
5. Accuracy per cell beyond kind and direction (amount, merchant) cannot be scored: digits are masked and 747 raw bodies are gone.

## 6. Cross-checks

- **Ledger against bank balances.** Not possible today. `balance_after` is stored on 26 rows (2 users, 4 accounts) although 165 parsed bodies carry a balance line (113 of 287 purchases, 22 of 23 ATM rows). Of 21 consecutive pairs on one account, 8 chain exactly and 13 do not (`89b29c3b`, `1b2f57f0`, `16c5d718`, `fe626ae2`, `cafcae46`, `20d7c190`, `ae09c3a4`, `7fc1be33`, `fc52750e`, `c11c3dfe`, `f08c9b48`, `9198fa23`, `2a4f0fb7`); three of those gaps are within minutes of the previous message, which points at a missed message or at two instruments sharing digits. Capturing the balance on every tier would turn this into an automatic daily check, and it is the only way to measure lost messages. Suggested addition (M).
- **Duplicates across tiers.** No log row has two live expenses; no flagged duplicate has a money row; no expense lacks its back-link. Double booking can only come from two captures (P0-4).
- **Order of arrival and races.** Simultaneous identical requests are safe now (409). The July losses are in P3-4. Reverse-order legs pair symmetrically; legs more than 300 s apart never pair and are both counted; a crash between claiming a sibling and posting leaves the sibling retracted (P1-2).
- **Time zones.** 0 wrong days in November; 49 historic rows; default issue in P3-3.
- **Multiple devices.** One user has two collecting devices on two platforms. Step 1b settles only on one device, so a real own transfer seen by two phones is asked about; every plain message seen by both would be doubled (P0-4).
- **User with zero accounts.** `4fce9265`: 175 messages, 0 accounts, 0 provisional accounts (S2 not yet exercised), 87% AI. Everything is Unassigned and, on the client, one pass-through bucket (P1-1). Across all users 590 of 726 money rows are unplaced; two users hold 475 of them.
- **Arabic against English.** Section 5; the difference is coverage (which formats have patterns), not a language defect, except P2-10 (Arabic merchant keys) and P1-3 (Arabic currency words).
- **Latency per tier.** Cannot be measured from the table (P3-10). Capture-to-server median is 7 to 12 s on every tier; the long tail is device delivery, not parsing. 3 AI timeouts in October (P2-14).

## 7. Second look at what S2 shipped

| S2 part | Verdict | Finding |
|---|---|---|
| Provisional accounts | Totals safe (no balance, no net worth). "Not mine" does not stop later rows counting; a provisional account is still a decisive transfer signal; first-message currency (S2 listed) | P2-1 |
| Provider cascade | Body stage inherits the hotline misread; history and format stages are conservative. Not exercised live | P2-9 |
| Own-transfer decision | Sound for step 1b. Step 1 bypasses it; remembered answers are too strong in both directions; candidate and claim can differ | P0-3, P2-11, P1-2 |
| Pass-through | Hides later pairs silently; Undo does not hold; net worth inconsistent | P1-1 |
| Currency exchange | One row in both orders. A leg with unreadable direction posts as the debit; destination credited at app rate, spread never booked (S2 listed) | none new |
| Category learning | AI write can overwrite a user choice; user-chosen "Other" is treated as empty; Arabic names have no key; answer rate is inflated | P2-2, P2-10, P3-10 |
| Promotion gate | Every path calls the gate, but an empty corpus passes and the failure-rate check is always 0 | P3-2 |
| Negative cache | Fails open and is cheap; can blind a real shape permanently; holds no real format today | P2-8 |

## 8. What could not be checked, and why

1. **S2 on live traffic.** No message has arrived since the deploy (latest 2026-11-13; no row has `bank_source` or `shape_key`; 0 provisional accounts). All S2 behaviour here is from code reading and replay.
2. **Messages dropped on the phone.** The gate leaves no record, so the loss rate from P1-3 and P2-13 is unknown. A local counter reported with queue stats would make it measurable.
3. **Whether the possible duplicates are duplicates.** Raw text is deleted after 30 days and masked bodies hide references.
4. **Amount accuracy.** Masked bodies hide every digit; only kind, direction and currency could be compared with the body.
5. **Native behaviour on a device.** Double broadcast, Doze, force-stop, battery kill, the iOS background task and the two-automation case were read, not run.
6. **Parse time per tier** (P3-10) and **push delivery truth** (22 November code-tier rows have no `pushed_at`; not traced).
7. **Instalment, salary match and subscription match on real messages.** No live sample of any of the three.
8. **Banks with no data** (section 5, gap 3): most of the Saudi market and half of the Egyptian one.
9. **Old rows' bank.** 621 of 952 rows have no stored bank; the matrix derives it from masked bodies and is approximate where the text carries no brand.
10. **Not read in full:** `docs/IOS_SMS_TRACKING.md`, the first 240 lines of `SmsCapacitorPlugin.swift`, `adjudicator.ts`, `canary.ts`, the pattern-review admin route, Buddgy context, widgets and exports.

## 9. Order of work for the fix session

Money-path items are reviewed by Fable before merge. Each starts from the failing test given above.

1. P0-1 declined and refund matching (S).
2. P0-3 digits-only own transfer (S); P0-2 payoff funding leg (S); P1-2 pair SQL guards (M). One migration replaces `sms_try_pair`.
3. P0-4 content twin guard (M).
4. P1-1 pass-through Undo and silent re-apply (M); P2-1, P2-2, P2-11 (S each): the S2 corrections.
5. P1-5 template remainder guard, kind validation and wording-based direction (M); P1-7 unpaired own transfer and payoff as spending plus a question (S); P2-14 timeouts retried (S).
6. P1-3 shared currency list on phone and server (S) and P1-4 worker attempts (S): both need a native build, which waits for the owner's request.
7. P1-6 one reverse function for undo, dismiss and delete (M).
8. P1-8 mask template samples and re-mask the 59 rows (S).
9. P2-3 curated patterns for the two formats (M): the largest speed gain available.
10. P2-4, P2-5, P2-6, P2-8, P2-9, P2-10 (S each); then P2-7, P2-12, P2-13, P2-16 and the P3 list as capacity allows.

**S3 repair inputs from this review:** `9e75b537` (un-reverse); `fa2a8ec2`, `ad8523cb`, `af7e8c15`, `10ac8181`, `540077ff`, `acbe9dd7`, `916e58d4`, `aa5ece0a` (book or confirm absent); the wrong-direction and wrong-kind rows in P1-5 and P1-7; 49 wrong-day rows; the 24 top-up incomes; the possible duplicates in P0-4 (owner to confirm against a statement).

**Owner decisions:** the remittance and card-payment readings in P1-5 and P1-7; cash withdrawals (P2-15); one collecting device per SIM (P0-4); whether a second capture with no discriminator is held or booked.

## 10. Council on scope and the owner decisions (2026-11-14, coordinating session)

Three outside voices (Skeptic, Pragmatist, Critic); the owner delegated these decisions.

**Scope (3 of 3 on the core).** Fix now: all four P0; P1-1, P1-2, P1-5, P1-6, P1-7; P1-8 (mask going forward and re-mask the stored samples); P2-1, P2-2 and P2-11 (quiet money errors in S2's own logic). P1-3: the server-side currency list now; the phone-side list and P1-4 are written now but reach users only with the next owner-requested native build, and are launch-blocking for Saudi. Everything else in P2 and P3 waits for a second batch.

**Who (3 of 3).** Fable first writes a short invariants spec (what may pair, what may delete or reverse, what undo must restore) and reviews every diff touching pairing, dedupe, kind or a migration. Sonnet subagents implement, failing test first. A full replay over the 952 messages closes the session, reporting how many real pairs the tighter guards leave unpaired.

| Decision | Verdict | Vote |
|---|---|---|
| Remittance "collected" notices | Not income and not a new transaction. Stop booking them; hold the five existing rows, do not delete. The owner skims the five rows before S3 reverses anything | 3 of 3 |
| Saudi card "payment via" messages | Default to spending, flagged for a one-tap fix; never repayment on wording alone | 3 of 3 |
| Cash withdrawals | Count as cash spending by default with a one-tap "still holding it"; no Cash-account model before launch; no silent backfill of old rows | 2 of 3 (Skeptic: keep non-spend with a visible note, since cash spent later could be counted twice) |
| One collecting device per SIM | No block. Warn, and let the duplicate guard do the work | 3 of 3 |
| Second identical capture with no discriminator | Hold as "possible duplicate" with one-tap keep, shown in a visible count so a held row is never a lost row | 3 of 3 |

Raised by two voices: find out why the content duplicate check was switched off before re-adding one, so the old false positive does not return. Raised by the Critic: P0-1, P0-2, P1-1 and P1-6 all end in "undo does not restore", so the undo path is the common weakness and gets its own tests.
