# S2b2: second, adversarial review of the SMS pipeline and of S2b

Date 2026-11-14. Fable 5.2 did the judgment, verification and ranking; six Sonnet readers did the file sweeps. Read-only: SELECT on the database, no source edit, no migration, no commit. Tree `60c7077d`. Data: 952 `sms_parse_log` rows, latest 2026-11-13, 245 migrations live. No personal names or message text appear here; rows are cited by the first 8 characters of the log id.

"Confirmed" means I read the lines or the live rows myself. "Reader-confirmed" means a Sonnet reader read the lines and I did not re-read them. "Suspected" means the path exists and nothing proves it happens. Everything a P0 or P1 conclusion rests on was re-read by Fable.

The review being checked is `docs/launch/S2b-sms-review.md` (in the worktree `fable-5-prioritization-c5372d`, uncommitted). Its numbering (P0-1 to P3-11) is kept. New findings are numbered N1 onward.

## 1. What changes before the fix session starts

1. **Three proposed fixes would hide or double real money as written.** They must be replaced, not implemented:
   - P0-1 "a decline may reverse a charge from the 10 minutes before it". Live rows show the normal pattern is a decline followed by a successful retry of the same amount seconds later. If the two messages are processed in the other order, the rule reverses the successful one. A decline must never touch another row.
   - P1-7 "a card repayment with no card or debt is booked as spending". Most new users will not have registered a card debt. Every statement payment would then be counted on top of the card purchases it settles.
   - P1-7 "an unpaired own transfer with no registered destination is booked as spending". This undoes the wallet top-up rule, whose destination is known by name, not digits.
2. **The live evidence for P0-4 is wrong, and better evidence exists.** The eight rows S2b lists as possible duplicates are provably different messages (section 2). One real double booking does exist and S2b missed it: `76184aa7` and `4a382257`, one message with one capture time, booked on 2026-10-26 and again on 2026-10-29. It was a re-send of the same capture three days later, so a 3-minute window would not have caught it. The safe key is "same text and same capture time", with no time limit.
3. **The reason the old content check was removed is documented.** Until 2026-10-27 the retry identity was the message text alone, for ever, so the second of two identical genuine messages was dropped (QA round 2, finding N8, `docs/qa-round-2/sms.md:46`). The per-capture id replaced it on 2026-10-28 (`044d99ce`). The second-capture gap was seen the same week and deferred "for a product call" (`docs/qa-round-2/REVIEW_B4.md:62,129`). The two-automation case was a real ticket earlier (BUD-63, `a395486d`); that protection is what was lost. The iPhone setup guide still tells users to add a second automation (`src/lib/i18n/dictionaries/en.ts:3028`).
4. **Two S2b findings are wrong and one exposure is a non-issue.** P2-1 first half (a database trigger already excludes new rows on an excluded account), P2-14 as a current defect (a failed row is re-claimed on retry; the one lost row predates that fix), and the "two phones collecting" exposure (the second phone has never delivered a message).
5. **Two council decisions should be reversed or narrowed.** Cash withdrawals as spending would double count for users who log cash spending by hand (one SMS user already does; 76 manual rows of SMS users have no account, which the app shows as cash). "Hold" for a second identical capture hides a real second purchase until the user acts; "book it and flag it" is the safer default.
6. **Two structural causes that S2b did not name sit under several findings and under the fixes.** (a) A row retracted by the pairing code and a row deleted by the user look the same (`deleted_at`), so every restore risks bringing back something the user removed (N3). (b) A value the server stamps on an existing row (refund mark, Transfer retag, any new flag the fixes add) can be overwritten by a phone that edits its older copy of that row (N4). Both must be settled before the pairing and undo fixes are written.
7. **New findings** (section 4): 4 at P1, 11 at P2, and smaller ones. The largest: a message whose date cannot be read is answered with success and deleted from the phone (N1); refunds beyond the exact-amount case (N2); the retraction marker (N3); the stale-copy overwrite (N4).

## 2. Verdict on every existing finding

### P0

| Id | Verdict | Evidence and corrections |
|---|---|---|
| P0-1 declined reverses an unrelated expense | **Confirmed, understated in scope, partly mis-counted** | `dispatch.ts:520-551`; `createSmsExpense.ts:766-799`. The match has no category or origin filter, so it can also stamp a hand-entered expense, an ATM row, a transfer or a card repayment. Of 14 declined rows: 9 standalone, 3 acknowledged against an earlier standalone decline (`b4dba45d`, `4d5206be`, `8bc752a7`), and **2** stamped another message's expense, not 5: `0fe8887c` on `9e75b537` (as reported) and `4a7d7250` on `572aaf39` (same second, same card, same merchant: the bank sent "charged" and "declined" together). `0fe8887c` is a wrong-PIN reject at a cash machine; the successful withdrawal of the same amount (`1ccc2355`) came 31 seconds later. The stamped row is a cash withdrawal, which is non-spend, so the live money effect is on cash views, not on spending. |
| P0-1, the three refunds on transfers | **Overstated** | The three bodies are "instant transfer returned to your account" notices carrying a payment reference. `fb2d543a` arrived 16 s after its transfer and `e66b72ae` 17 s after: both are true bounces and the match is right. Only `baab5343` (40 hours) is doubtful. |
| P0-2 card repayment deletes a similar outgoing transfer | **Confirmed in code, no live case** | `dispatch.ts:450-467`, `pairing.ts:405-417` and `:528-564`, `0235:34-73`. The two live repayment pairs (`30657ada` with `a602aba1`, `346f56a6` with `34a081d4`) match to the cent within 23 s and are true. |
| P0-3 four digits make an own transfer | **Confirmed in code; P1 is the fairer rank** | `dispatch.ts:299-305`, `pairing.ts:76-94`. It needs a digit collision (about 1 in 10,000 per account and counterparty). It is silent when it happens, which is why it stays near the top. |
| P0-4 same message booked twice | **Mechanism confirmed; live evidence disproved and replaced** | `ingestGuards.ts:28-36` and `:55-56`; `SmsReceiver.kt:78`; `CatchBankSmsIntent.swift:52`. S2b's candidates (six 1,500 EGP rows on 2026-09-09, two 700 SAR rows on 2026-08-10) all predate 2026-10-27, when the identity was the text alone, and they carry different identities. Different identity then meant different text, so they are separate messages. Real case: `76184aa7` (posted 2026-10-26 16:41:29, with a device id) and `4a382257` (posted 2026-10-29 12:02:22, no device id): identical text, identical capture second, two expenses. Both expenses are deleted now. Among the 188 rows that still hold raw text, this is the only same-text pair inside a day, so two automations firing together has not been seen since the change. Exposure by route: a queued copy re-sent under a new identity (proven once), two iPhone automations (the guide recommends it; not yet seen), two phones (the one such user's Android has never delivered a message). |

### P1

| Id | Verdict | Evidence and corrections |
|---|---|---|
| P1-1 pass-through Yes and Undo | **Confirmed** | `useFlowLedger.tsx:133-141` re-applies on every render; `spending/passThrough.ts:57-70` Undo clears flags only; `:31` one bucket for all unplaced rows. Not re-checked: the net-worth second effect. |
| P1-2 pair SQL claims unreal rows | **Confirmed, and wider** | `0235:34-73` has no duplicate, status, currency or direction filter. Also: the default match list for an own-transfer leg includes transfers in both directions and repayments (`pairing.ts:411-417`), and the wallet step uses the exact-amount rule against any transfer in the window (`dispatch.ts:273-288`), so two unrelated outgoing payments of one amount can pair and one of them posts nothing. |
| P1-3 Saudi currency spellings | **Overstated** | Reader-confirmed: no gate requires a currency word. On the phone and in the server pre-filter the word only rescues a message that already looks like a one-time code or an advert (`SmsGate.kt:80`, `preFilter.ts:116-133`). `patterns/currency.ts:20-21` does know the Arabic riyal word and its abbreviation; only "SR" and glued forms are missing. Real gaps: `deviceOtpGate.ts:10-11` lacks USD, EUR and GBP that both native gates have; the Android digit test is ASCII-only. P2, not launch-blocking by itself. |
| P1-4 Android worker stops at 8 attempts | **Confirmed, with the mitigation S2b gave** | `SmsForwardWorker.kt:88-92`. The message stays in the queue and goes out at the next app open. Delay, not loss, unless the 30-day or 200-item eviction hits. |
| P1-5 wrong direction and kind, templates unchecked | **Confirmed** | `818b0736` is a deposit booked as a withdrawal; `65921ad1` is a "your transfer has been collected" notice booked as income. Reader-confirmed: curated-table templates are tried on every message with no sender scope (`route.ts:263`). |
| P1-6 undo loses the other leg | **Confirmed, understated** | `undo/route.ts:60-117` retires its own rows, clears a refund stamp and unpairs; it restores nothing the pairing retracted and leaves the fee row and balance report. `public/sw.js:89-99` reads a key the server does not send. Reader-confirmed additions: a debt that the payment auto-cleared is not reopened (`0210:141-148`); the subscription's pending-plan fields stay. |
| P1-7 the AI's kind alone makes a row non-spend | **Overstated** | Of the 8 own-transfer rows: `a602aba1` and `34a081d4` are the proven funding legs above; the four Saudi card-to-account rows name the user's own account as destination digits (for example `8a94eede`), so they are true own transfers; `6ad46d1d` paired. Only `ff52e170` (a recharge) is wrong. "7 of 8 questionable" should read 1 of 8. The 7 Saudi "repayment" rows are ambiguous, see 3.3. |
| P1-8 raw text kept in the template table | **Confirmed, understated** | `route.ts:535`. Reader-confirmed additions: the same unmasked sample is sent to the model that writes the pattern (`route.ts:481`), and the admin template list returns it under the view permission without the reveal gate the log view enforces (`admin/sms/templates/route.ts:45`, `TemplatesPanel.tsx:157`). |

### P2

| Id | Verdict | Note |
|---|---|---|
| P2-1a "Not mine" does not stop later rows | **Wrong** | Trigger `expenses_inherit_exclusion` (migration 0178, present live) stamps the exclusion on every insert, including the server's. Client totals also read the account flag (`spending/exclusion.ts:12-40`). Residuals: the flag must have synced before the next message; credits into an excluded account still count as income (reader-confirmed; the trigger covers expenses only). 0 accounts are excluded today. |
| P2-1b provisional account as a transfer signal | Confirmed, low impact | `pairing.ts:96-101`. It still needs the pair on one device. |
| P2-2 server overwrites the user's category | Confirmed | `route.ts:1062-1074`. The line cited in `merchantCategory.ts` is imprecise. |
| P2-3 two formats carry 60% of AI calls | Not re-checked | Data claim; plausible from the tier table. |
| P2-4 learner retries three times per message | Confirmed | `route.ts:476-483`. Each attempt is metered. |
| P2-5 AI limit counts every parse | Confirmed, overstated effect | View in `0211:243-251`. The limit is only tested when a message reaches the AI tier (`route.ts:864`), and the answer is "try later": the phone keeps the message. Nothing is lost. |
| P2-6 currency falls back to base | Confirmed | `currencyResolver.ts:36-39, 60-67`. Sender currency is "last confirmed wins". |
| P2-7 corrections cannot quarantine; one disagreement retires | Confirmed | `0098:186-191`, `0211:78-95`, `0140:121-162`. |
| P2-8 negative cache can blind a format | Confirmed as a path | `negativeCache.ts:23-37`. No expiry. |
| P2-9 five digits read as a hotline | Confirmed, lines wrong | Real lines: `providerFromBody.ts:60-62`, `routingKey.ts:22-45`. |
| P2-10 Arabic merchants have no key | Confirmed, mitigated | The dictionary and the AI still categorise Arabic names; only learning is skipped. |
| P2-11 remembered answers too strong | **Overstated** | "No" beating a matching reference is confirmed (`ownTransferDecision.ts:60`). "Yes needs only amount and device" is not: the candidate search takes opposite-direction kinds only (`pairing.ts:131`) and the answer is keyed on the two account tails. |
| P2-12 iPhone waits for app open | Confirmed | |
| P2-13 dropped while disarmed | Confirmed, wider | Reader-confirmed: the native layer already reports the live permission and no screen reads it; a refusal at enable time is silent (`useSmsTracking.ts:152-157`). |
| P2-14 a timed-out parse is final | **Wrong as a current defect** | A failed row is stale and is re-claimed on the next attempt (`ingestGuards.ts:88-91`, `route.ts:716-737`). `af7e8c15` was lost on 2026-10-26 during a backlog drain, two days before the "in progress" answer stopped the phone deleting such items. Repair-only. |
| P2-15 cash withdrawals | Decision, see 3.8 | Corrections: 1 of 22 rows has a destination, not 0; the code does set Cash as destination when the user has a cash account (`createSmsExpense.ts:577`). |
| P2-16 own-transfer question can stick | Confirmed in part | Reader-confirmed for the list and the 409. How the screen reacts was not run. It becomes urgent because other fixes create more questions (3.6). |

### P3

P3-2, P3-7 and P3-9 are reader-confirmed (P3-9 with a mitigation: the message is queued before the oversized enqueue fails, so it waits for app open). P3-6 is reader-confirmed and wider: the "expense added" push also goes out for a matched refund and a net-zero decline. **P3-11 is understated**: it is not only Hijri, and the message is not only rejected, it is deleted from the phone (N1). The rest were not re-read.

## 3. Attack on the proposed fixes and the council decisions

### 3.1 Tightening the declined and refund match (P0-1)

- **Risk in the proposal.** "Match a decline to a charge from the 10 minutes before" assumes the charge came first. Live order is the reverse: decline, then success (`0fe8887c` then `1ccc2355`, 31 s; two declines then a withdrawal on 2026-09-19 within two minutes). Delivery order is not guaranteed (queue retries, a batch drained at app open), so the successful retry would be the row "before" the decline and would be reversed.
- **The one case in favour of matching.** `4a7d7250` and `572aaf39`: "charged" and "declined" for one amount, card and merchant in the same second. Whether the charge stood is unknown. If a decline never matches, that 5.70 USD stays counted and a net-zero declined row sits beside it: visible and one tap to fix. If it matches, a real charge can vanish. The first error is the cheaper one.
- **Risk in the refund half.** "No merchant on the refund: book it as its own credit and ask" turns the two true bounced transfers into income plus a question. The bounce notices carry no merchant, by nature.
- **Regex risk already in the code.** `dispatch.ts:522` reads "reversed" wording as a decline. A true reversal with no exact-amount original then becomes a net-zero row and the returned money is never booked (N2).
- **Safer variant.**
  1. Kind `declined` (from the tier, and the words declined, rejected, refused): never reads or writes any other row. Always the standalone net-zero row; repeated notices within 3 days still collapse onto that row (the existing twin check, restricted to rows that are themselves declined rows). It must not create a provisional account.
  2. Kind `refund`, including reversal wording: match in this order and stop at the first hit: (a) the same payment reference as an earlier message of this user (store a salted reference hash on the log so it outlives the 30-day text); (b) same account, same amount, same currency, original is a purchase, online purchase or transfer out from a message, within 15 minutes; (c) same account and same merchant, exact amount, within 90 days. Never match a hand-entered row, an ATM row, a fee or a repayment automatically.
  3. No hit: book the credit as a refund that is outside income and outside spending, and ask "which purchase was this for?". Never one-time income by default.
- **Existing data.** Restore `9e75b537`'s expense. Leave `fb2d543a` and `e66b72ae`. Ask the owner about `baab5343` and about `572aaf39` (did the 2026-10-27 charge stand?). The answer to the second tells whether rule 1 needs a same-second exception.

### 3.2 Digits-only own transfer through the decision function (P0-3)

- **It would ask for ever.** `decideOwnTransfer` settles only with the `device` signal, which needs a second leg (`ownTransferDecision.ts:46, 62`), and the remembered answer is read only when a candidate exists (`dispatch.ts:346`). A one-leg transfer to the user's own digits has no candidate. As proposed, every such transfer raises a question, including after the user said yes.
- **It weakens the repayment flow.** Paying the user's own card by instant transfer relies on this step to turn the funding leg into an own transfer. If the card bank's message never arrives, the funding leg becomes spending plus a question each month.
- **The question has a new shape.** `/api/sms/own-transfer` and `useOwnTransferReview` work on a pair. A one-leg question (no sibling) needs its own handling, including setting the destination account on "yes".
- **Aliases.** The digit test is exact equality; see N5.
- **Safer variant.** Keep step 1, add one condition: the first time a counterparty tail equals one of the user's tails with no second signal, book the row as its plain kind and ask once "is ••1234 your own account?". Store the answer per (own tail, counterparty tail). "Yes" settles this row and every later one-leg transfer on that pair silently, with the destination credited as today. "No" never asks again for that pair. A second signal (a sibling on the same device, a matching reference, the bank on the counterparty) settles without asking. Size M, not S.

### 3.3 New `sms_try_pair` guards (P0-2, P1-2) and the "AI kind" rule (P1-7)

Guards that would leave true pairs unpaired, each with the correction:

| Proposed guard | What breaks | Correction |
|---|---|---|
| Funding leg must name the card's digits | Both live true pairs: the funding leg prints no destination digits (`a602aba1`, `34a081d4` have none) | Accept as funding leg: counterparty digits equal the card, **or** exact same amount (fee tolerance only when a reference or the digits match), **or** kind own transfer. Refuse only a transfer out that names a different person or different digits. |
| Equal currency | A sibling still being processed has no currency yet: it is written at the end of the request, and published early only for exchanges (`pairing.ts:439-449`) | Publish currency and counterparty digits with the leg (both `publishTransferLeg` and `tryPairLeg`) before any claim. Treat a null on either side as "unknown, do not refuse". |
| "A live status" | The fix for simultaneous legs deliberately claims a `processing` sibling and waits (`pairing.ts:479-506`) | Allow `processing`. Refuse only `failed`, `rejected`, duplicates, and rows held for confirmation. |
| Opposite direction | An own-transfer leg has no stored direction; only exchanges do | Derive direction from kind where it is certain (transfer in, transfer out, repayment). Unknown passes. Refuse only two certain equal directions. |
| "Sibling has no money row: post this leg normally" | The sibling is already claimed, so when it finishes it posts its plain row too: a Transfer plus an income | Unpair both rows, then post this leg as its plain kind. |
| Claim only the id the decision used | Sound | Add a `p_sibling_id` parameter. |
| Same-account pair refused | Sound for transfers | Keep. |

Two further holes in the same code that the pairing change must close (reader-confirmed, both P2):
- The repayment step retires the funding leg's row **before** it knows whether the repayment needs the user's confirmation (`dispatch.ts:466` against `:473`). When it does, the funding account is forgotten: the confirmed fallback books a repayment with no source, and no account is debited. Decide first, retire second.
- A settled own-transfer pair whose legs name the other side by name only never credits the destination account (`createSmsExpense.ts:576-579`: the destination is taken from counterparty digits, which name-only legs lack), so that account's balance is understated by the amount. Take the destination from the credit leg's own account.

P1-7 as proposed:

- **Repayments.** "No card or debt: spending" is wrong for the common case. `6e9e1e26` is a plain "amount paid into your credit card ending ••" notice for a user with no registered card debt; under the rule its 1,724 EGP is counted again on top of the purchases. Decide by wording, not by registration: a notice that the amount was paid **into** or **to** the card stays non-spend whether or not a debt exists (offer "track this card's balance?" once). Only a repayment kind that came from the AI or a learned template **and** whose wording puts the card as the instrument ("via card ••") goes to spending with a flag.
- **The 7 Saudi rows.** In `8a94eede` the same four digits appear as the source card, so in the 7 rows the digits after "via" are the card, which supports reading them as payments made with the card. Against that: five of seven amounts are round (950, 500, 450, 750, 1,600), which is typical of repayments or bill payments. It cannot be settled from masked text. The council default (spending, flagged) is the cheaper error and stands, limited to this format. `b61afd88` is 19 days old and still holds its raw text; the owner can read that one message and settle all seven.
- **Own transfers.** Key the rule on where the kind came from, not on whether a destination resolved. A kind set by a code rule (own wallet by name, own digits confirmed) stays non-spend. A kind that only the AI or a learned template asserted, with no sibling, no own digits and no own wallet, is booked as spending with the question.
- **A defect next to it.** With exactly one card debt, any repayment-typed message reduces it even when the digits name another card; see N7.

### 3.4 Content duplicate guard (P0-4) and the two council decisions on it

- **Why the old check went.** Section 1.3. Any new check that keys on text within a time window brings N8 of QA round 2 back for messages with no time or balance in them. Live proof that identical text recurs legitimately: `13248a70`, `b4dba45d`, `4d5206be`, `8bc752a7` are four genuine notices with identical text on four consecutive days.
- **Why a 3-minute window is wrong in both directions.** Too narrow for the one proven case (3 days apart). Too wide for two genuine identical purchases in one minute when the text prints hours and minutes only.
- **Race.** Two requests at the same instant both pass a read-then-insert check. The guard needs a unique index or the per-user lock.
- **"Hold" (council).** A held second row that is real stays out of spending until the user acts. The stated principle of the pipeline is that hiding an expense is the worst error. Book and flag instead.
- **Safer variant, three rules.**
  1. **Same capture.** Same user, same normalised text, same capture time to the second: the same message, whatever the capture id, with no time limit. Enforce with a unique index on (user, text hash, capture time) where not duplicate. This catches the proven case and any re-send. On Android the time is stamped once per broadcast; on iPhone it is the run time, see rule 2.
  2. **Two automations on one iPhone.** Fix at the source: the intent keeps the last few (text hash, capture time, capture id) for 15 seconds and reuses the capture id and time for a repeat. The server then sees a plain retry. Change the setup guide: one automation with several keywords if the Shortcuts app allows it, otherwise keep two and rely on this rule.
  3. **Everything else** (same text, different capture time, within 3 minutes, any device): if the text carries a payment reference or a running balance, mark the later one duplicate; hours-and-minutes alone do not count. Otherwise book it and flag "possible duplicate, remove?" with one tap. Never hold.
- **One device per SIM.** No block: agreed. The server does not check that the calling device is the collecting one (reader-confirmed); not needed once rules 1 and 3 exist.
- **Existing data.** No backfill is needed. A data reset wipes the log, and with it the index, while the phone's queue is not cleared (reader-confirmed wiring gap): queued old messages would be booked again after a reset. Clear the native queue on reset.

### 3.5 Pass-through and Undo (P1-1)

- A per-pair opt-out kept in prompt state grows without bound and syncs as one settings blob: two devices answering at once overwrite each other. Store the opt-out on the rows (a "counted by the user" value that the pairing ignores), not in settings.
- "Apply later pairs with a toast each time" still excludes first and asks second. For a user whose rows are all unplaced, that is every coincidence of amounts. Until both legs carry digits and the digits match, later pairs should be labelled only, as before the first answer.
- Existing users: anyone who already answered Yes has rows excluded that no Undo can restore. The fix must ship with a one-off "we left N pairs out of your totals, review" list, not only new behaviour.
- Dropping the pair from cash outflow when the credit is excluded touches net worth for every user; do it behind a test that proves the two legs cancel, or leave it for the net-worth work.

### 3.6 Conflicts between fixes, and the order

- P0-3, P1-7 and the refund variant all create more questions. P2-16 (the question that sticks when its row is gone) is deferred in the council scope. The repayment flow will regularly delete a row that has a question open on it. **P2-16 must be in the first batch.**
- P0-2, P0-3, P1-2 and P1-7 all change which rows may pair. They must land as one change with one migration and one replay, after the invariants are written, or each will be tested against a pairing rule the next one changes.
- P1-6 (reverse function) depends on N3 (retraction marker). Every fix that stamps an existing row depends on N4. Build both first.
- P1-5's wording guard and the "collected" notice: the guard runs at template time, but the remittance notices are matched by a learned template today. Add a code-tier rule ahead of every tier, and quarantine that template, or the guard never sees them.
- P0-4 rule 2 and P1-3/P1-4 need a native build. Rules 1 and 3 are server-only and should not wait for it.

### 3.7 Template wording guard (P1-5)

- **What it would reject.** Purchase notices whose footer says to call "to dispute or reverse" a transaction; repayment notices that mention the amount "due"; notices saying the amount "will be deducted from your limit"; a merchant whose name contains one of the words. A learned pattern usually spans the whole message with wildcards, so "the unmatched remainder" is often empty and the words sit inside a wildcard: the guard as described would either miss them or need to inspect captured spans.
- **Safer variant.** At learn time record which guard words the sample itself contains; those are part of the format. At apply time, a guard word that the sample did not contain sends the message to the next tier (the AI), never to rejection. Run it in count-only mode over the stored masked bodies first and report how many of the 952 it would divert; enforce after that number is read. The cost of a false hit is then one AI call, not a lost message.
- Kind validation against the enum and sender scope for curated-table templates: no objection.

### 3.8 Cash withdrawals as spending (council, 2 of 3)

- **Double count is real in this data.** 3 of the 10 SMS users have a cash account; one logs cash spending against it; 76 hand-entered expenses of SMS users have no account, which the app presents as cash. For those users a withdrawal counted as spending plus the cash purchases entered later counts the same money twice.
- **The destination exists.** The code already credits the user's cash account when there is one (`createSmsExpense.ts:577`); 21 of 22 rows have none because most users have no cash account, not because the model is missing.
- **Safer variant.** Keep withdrawals non-spend. Show one monthly line "Cash withdrawn: X, not in spending". Ask once, at the first withdrawal: "Do you log what you spend in cash?" Yes: keep as is. No: count withdrawals as spending from now on. No backfill either way. This is the Skeptic's position with a switch.

### 3.9 One reverse function for undo, dismiss and delete (P1-6)

- **Two different intents.** "This is not an own transfer" means both legs come back as plain rows. "Delete this row" on a true own transfer means the pair goes away; restoring the hidden income there would add income the user never saw. One function with one behaviour gets one of them wrong.
- **Deletes come through sync.** A row deleted in the app, possibly offline, reaches the server as a synced `deleted_at`. The reversal has to run from that path and be idempotent. It must not run when the pairing code itself sets `deleted_at`, or a retraction would trigger a restore of the thing just retracted.
- **Restoring what the user removed.** Without N3 the function cannot tell the pairing's retraction from the user's own delete.
- **Provisional account removal.** Only when it is still provisional and no other row, hand-entered or from a message, points at it.
- **Safer variant.** Two operations in one module: `unpair(log)` restores both legs to their plain kinds and clears the link; `discard(log)` retires everything this message wrote (row, fee row, balance report, debt payment and the debt's cleared state, subscription pending fields) and unpairs the sibling back to its plain row. Push Undo and row delete call `discard`; the own-transfer "No" calls `unpair`. Both restore only rows carrying the retraction marker of that pair.

### 3.10 The other council decisions

- Remittance "collected" notices not income: **agree**. `65921ad1` confirms the reading. Implementation note in 3.6.
- Saudi "payment via" rows default to spending: **agree, narrowed** to that format (3.3).
- Scope and who: agree, with the changes in section 7.

## 4. New findings

Sizes as in S2b. "Test" is the failing test to write first.

### P1

**N1. A message whose date or amount fails the plausibility check is answered as success, and the phone deletes it.** Confirmed in code; no live instance (0 such rows).
- Where: `route.ts:994-1000` returns HTTP 200 with `ok: false`; every device path removes the item on any 2xx (`SmsForwardWorker.kt:116-120`; reader-confirmed for the app drain and the iPhone intent). Ways to get there: a body date with a 4-digit year is always read day-first (`parseSmsDay.ts:89-92`), so a month-first date on day 12 or lower is silently mis-dated and one that lands in the future is rejected; a Hijri year; a phone clock more than 2 days ahead or 400 days behind when the body has no date.
- Effect: a real transaction is dropped with a log row staff can see and nothing the user can see. Saudi banks are the likeliest source of Hijri or month-first dates.
- Fix (S): never reject on the date. Fall back from the body date to the capture day, and from an implausible capture day to the server's arrival day, and flag the row "date unsure". Keep the amount check, but answer it as "held for review" and keep it visible in the app.
- Test: a body dated with a Hijri year, captured today: expect a row dated today, flagged.

**N2. Refunds beyond the exact-amount case go wrong in both directions.** Confirmed in code (part read by Fable, part by a reader).
- Where: `dispatch.ts:520-551`, `createSmsExpense.ts:730-799`. (a) Reversal wording with no exact match becomes a net-zero row and the returned money is never booked. (b) A partial refund, a refund in the other currency of a foreign purchase, or a refund processed before its purchase becomes one-time income while the purchase stays full spending. (c) The twin check runs first: a second genuine refund of the same amount on the same card within 3 days is acknowledged against the first and its purchase stays counted. (d) The merchant tie-break compares the raw name with the stored cleaned title, so it often fails and the most recent row wins.
- Effect: spending and income both overstated, or a refund that silently does nothing.
- Fix (M): the variant in 3.1, plus: a refund smaller than the matched purchase reduces it (store the refunded amount, do not stamp the whole row); the twin check applies only when the earlier stamp came from a message with the same reference or within 10 minutes.
- Test: purchase 100, refund 30 the next day, same card and merchant: expect spending 70 and no income.

**N3. A row retracted by the pairing code cannot be told from a row the user deleted.** Confirmed in code.
- Where: `pairing.ts:538-557` and `:621-634` set `deleted_at`, the same column a user delete sets. `own-transfer/route.ts:126-128` restores any soft-deleted income for the log (reader-confirmed).
- Effect: the cause behind P1-6 and P2-16, and a trap for every restore the fix session will write. It also reaches other devices as an ordinary delete, so a client cannot show "merged into a transfer".
- Fix (S, migration): `retracted_by_sms_log_id` on `expenses` and `income_events`, set with `deleted_at` by the pairing code only. Restores touch only rows with the marker of that pair.
- Test: user deletes an income; a later undo of an unrelated pairing on the same log must not bring it back.

**N4. A phone holding an older copy of a row can overwrite what the server stamped on it.** Trigger confirmed by Fable; the client half is reader-confirmed.
- Where: the stale-write rule (`0241_newest_edit_wins_triggers.sql`, function `reject_stale_write`) lets through any write whose `edited_at` is newer than the stored one. Server-side writers deliberately do not move `edited_at`. The client sends the whole row, including `refunded_at`, `refund_kind` and `spend_exclusion` (`expenseMapper.ts:33-36`), and pushes before it pulls.
- Effect: the server marks a purchase refunded, or retags a row as Transfer, or completes an exchange row; the user, on a phone that has not pulled yet, edits that row's category; the push carries the old values with a newer edit time and wins. The refund is lost and the charge counts again. Rare per row, but it hits exactly the columns the fixes in this document add or rely on (refund marks, the retraction marker, a possible-duplicate flag, the server-side exclusion). Also reader-confirmed: `/api/sms/confirm` changes the currency of whatever expense the log points at, which for a matched refund is the original purchase (`confirm/route.ts:101`).
- Fix (M): make the server-owned columns server-owned: in the same trigger, a client write keeps the stored values of `refunded_at`, `refund_kind`, `refund_sms_log_id`, `sms_log_id`, the new marker and any new flag unless the client's copy of them equals what it last pulled; or drop those columns from the client's update payload and give the user actions (un-refund) their own endpoints.
- Test: server stamps `refunded_at`; a client update of `category` with a newer `edited_at` and `refunded_at` null arrives: expect the category changed and the refund mark kept.

### P2

**N5. Own-account digit tests ignore aliases and tail length.** Confirmed. `pairing.ts:83-100` uses exact equality; the account matcher handles aliases and shorter tails (`createSmsExpense.ts:384-412`), and one user holds both a 3-digit and a 4-digit form of one tail. After a provisional account is merged its digits live in `last4_aliases`, so the own-transfer signal disappears (reader-confirmed for the merge path). A closed real account still wins digit matches. Fix (S): use `matchByTail` in both functions. Test: account saved as 0001, counterparty printed as 001.

**N6. A truncated message books a wrong amount with full confidence.** Reader-confirmed by running the code tier on invented text: a body cut inside "1,204.50" books 1.2 or 1. The `truncated` flag the phone can send is accepted and never read (`route.ts:112`, no other use: confirmed). Fix (S): a truncated flag, or an amount that ends at the end of the body, sends the row to "confirm amount".

**N7. With one card debt or one instalment plan, any matching-kind message is applied to it.** Confirmed: `createSmsExpense.ts:845-862` and `:652-656`. A repayment for another card, or an instalment notice from any provider and any amount, reduces the only debt. Fix (S): with one debt, still require the digits, the provider name or the amount to agree; otherwise ask.

**N8. Turning tracking on or off can silently revert at the next start.** Reader-confirmed, not re-read: the switch writes the device row with a fire-and-forget request (`useSmsTracking.ts:176, 203`), the heartbeat does not repair it for an existing row (`registry.ts:73-90`), and at cold start the device row wins over the account intent (`AppShell.tsx:113-122`). An offline switch-off re-arms; a failed switch-on disarms with the switch shown on. Fix (S): await and retry the write, or let the heartbeat carry the state.

**N9. Wallet top-ups with a fee, or to an unregistered wallet, create income.** Reader-confirmed; the fee case is suspected in practice. The wallet step pairs on the exact amount (`dispatch.ts:280`, `0235:47-52`); card debited 105 and wallet credited 100 never pair, so 100 is booked as income. An unregistered wallet gives card spending plus wallet income. Fix (S): fee tolerance for the wallet step when the bank leg names the wallet; a credit whose text names a wallet brand the user has not registered asks instead of booking income.

**N10. Privacy: masked bodies keep a person's name, and the adjudicator sends raw text to the model.** Confirmed for the first (`d84e8bcd`: the bank's own partly-starred counterparty name survives masking; masked bodies are kept without limit). Reader-confirmed for the rest: single-word and title-case names pass `maskPii` and the leak scan, which share detectors (`maskPii.ts:38-39`); `adjudicator.ts:121` sends the unmasked body; its corrections are stored unvalidated and fed to later prompts for every user of that shape (`runAdjudication.ts:132, 216`). Fix (M): mask the name slot after the "to / from" keywords in transfer formats; validate adjudicator corrections against the body; mask before the adjudicator call.

**N11. Template health and admin paths that bypass the gates.** Reader-confirmed. `runAdjudication.ts:63-113` judges only the first of up to 10 signals and applies the verdict to all; admin `bulk_toggle` re-enables every template including killed and retired ones with no cache invalidation (`admin/sms/templates/route.ts:77-82`); the promotion settings accept 1 match, 1 user, 0 days (`promotion/route.ts:26-32`); manual promote skips the count, user and age gates. Fix (S each).

**N12. The Settings CSV export counts everything as spending.** Reader-confirmed: `useSettingsPage.ts:68-92` writes every expense with no refunded, excluded or non-spend marker. The Reports export is correct. Fix (S): add the "counted" column the Reports export has.

**N13. A subscription charge logged by the app and then reported by SMS is counted twice.** Reader-confirmed: the adoption step (`loggedChargesAdopted`) is called only from `upsertServerExpense` (`useFinanceStore.ts:288`), which has no callers; server rows arrive through the delta merge, which matches by id only. Fix (S): run the adoption in the delta path. Test: an app-logged charge and an SMS purchase for the same subscription and day: expect one counted row.

**N14. Spend exclusion is not honoured everywhere.** Reader-confirmed: the budget's committed view and the subscription forecast count excluded rows (`budget/liveLinks.ts:88`, `subscriptions/subscriptionForecast.ts:239`); budget debt lines count excluded and non-spend rows (`budget/lineSpend.ts:24`); the account balance keys on `refundedAt` while spending keys on `refundKind` (`balance.ts:83`). The main spending chain is consistent. Fix (S): one predicate.

**N15. Closed months are not protected or recomputed.** Reader-confirmed: the month-carry job writes its summary once; a late message, a held row confirmed later, a refund stamp or the bulk recategorise change a month after the carry has moved money; net-worth snapshots are written by the client, last writer wins. Fix (M, design): either recompute the carry when a closed month changes, or book late rows in the current month with their true date shown. Owner decision.

### P3 and suspected

- **N16 (suspected).** A foreign purchase reported twice (authorisation in the foreign currency, settlement in the local one) books two purchases; the code tier and the AI disagree on which amount of a one-message "USD 20, equivalent EGP 1,000" to store.
- **N17 (suspected).** The AI prompt defines a fee as including interest (`aiParserPrompt.ts:64`), so an interest or profit credit with no sign can be booked as spending; certificates, brokerage and gold have no guidance. An AI hint of "saving" creates a non-spend Savings row with no savings transaction behind it (`createSmsExpense.ts:82`, reader-confirmed).
- **N18.** Arabic "deposit to account" is booked as income by a generic code pattern; the user's own cash deposit therefore counts as income. Three live rows are of this kind (S2b P1-5). Owner decision 9.5.
- **N19.** The confirm route re-dates a held row from the capture day and drops the body date, the device id and the counterparty facts (`confirm/route.ts:139-143`, reader-confirmed).
- **N20.** The daily canary sends a one-time-code message only, so it never exercises a parse tier, and it is skipped silently when its token is unset (`canary.ts:58`).
- **N21.** Queue hygiene: one item that needs the AI blocks parsable items behind it in the app drain and the iPhone background drain; an iPhone item refused with a permanent error never leaves the queue; raw messages of a signed-out account stay in the iPhone Keychain with no age limit; a data reset does not clear the phone queue.
- **N22.** Normalisation gaps (reader ran them): a dot used as thousands separator reads 1.234 as 1.23; zero-width space, tatweel, non-breaking space and full-width digits are not stripped, and a zero-width space inside "OTP" passes the one-time-code rule.
- **N23.** Fees and VAT printed inside a transfer notice are dropped; the fee on an own-account pair is never booked.
- **N24.** Supplementary and joint accounts have no handling: another holder's spending is the user's, on a provisional account.
- **N25.** A zero or sub-cent amount is rejected with success and no notice.
- **N26.** The assistant's income list ignores the pass-through exclusion (list only; its totals are right). The remembered own-transfer answers survive a data reset (in no deletion list).
- **N27 (suspected).** A failed sync flush can bring back a row the server deleted in between (`flushBaseline.ts:4`, `sync.ts:255`); a payday adoption can clear the SMS link on an income row and sever its undo (`sync.ts:177-185`).

## 5. Wider coverage

### 5.1 Files S2b did not read

| Area | Result |
|---|---|
| `docs/IOS_SMS_TRACKING.md` and the iPhone intent | The intent comment "one id per received SMS" is wrong: it is one id per run. The doc does not mention the two-automation case. Findings: P0-4 rule 2, N21. Sound: Keychain class, lock around the queue, queue written before the network call, drain filtered by owner, "in progress" keeps the item. |
| Adjudicator | Never edits money rows; its bumps are soft, so one AI call cannot retire a template. Defects in N10 and N11. |
| Canary | Cannot block parsing (cron only). N20. |
| Admin pattern review and templates | Pattern review requires the manage permission, step-up and an audit row. The templates route is weaker: N11 and P1-8. The log view masks amounts and text without a grant: sound. |
| Exports | N12. Reports export sound. |
| Assistant | Totals honour refunds, non-spend and exclusions; no raw message text is sent; merchant titles are, by design. N26. |
| Widgets | Retired; no native widget target exists. |

### 5.2 Downstream of SMS rows

Reader-confirmed unless marked; the trigger behind N4 was read by Fable.

| Surface | Verdict |
|---|---|
| Spending totals, category budgets, reports, goals, carry, payment-method breakdown | Sound: one predicate chain (non-spend categories and the refund kind); declined rows are zero everywhere. |
| Budget committed, subscription forecast, budget debt lines | Excluded rows counted: N14. |
| Net worth and account balances | Refunded rows skipped; unplaced SMS rows never drain Cash; provisional accounts untracked: sound. Wrong: an own-transfer pair that names the other side by name never credits the destination; a repayment that needs confirmation loses its funding account (both in 3.3). |
| Debts and card outstanding | Refunds and non-spend excluded; repayments come from debt payments: sound. Wrong: N7; a provisional-currency repayment is never corrected on the debt payment when the currency is confirmed; undo leaves a debt cleared (P1-6). |
| Subscriptions | N13; pending-plan fields survive undo (P1-6). |
| Notifications | Wrong text for matched refunds, declines and suppressed legs (S2b P3-6). Budget alerts are computed live, so a refund or undo clears them: sound. |
| Month close | N15. |
| Sync and offline | Server rows reach clients by a nudge plus pull on open, with a 2-minute overlap; server tombstones beat local pending rows: sound. Wrong: N4; N27 (suspected). |
| Account deletion and reset | Deletion sweeps tokens and the ingest check refuses a deleted account: sound. Reset leaves the remembered own-transfer answers and the phone queue (N21, N26). |
| Admin views | No raw text listed; reveal needs a grant, a reason, an audit row and a rate limit: sound. Template route: N11, P1-8. |

### 5.3 Lifecycle

| Scenario | Verdict |
|---|---|
| First enable | Handled. No inbox backfill exists on either platform. A permission refusal is silent (P2-13). |
| Permission revoked, automation removed | **Mishandled**: no detection, switch stays on; the staff "silent" rule keys on app opens (S2b P3-5). |
| Sign-out, then same or another user | Queue handled (owner-stamped, drain filtered). Messages that arrive while signed out are dropped by design. Suspected: the second user is armed on the first user's phone until the next cold start. An item stamped with no owner goes to whoever signs in next (S2b P3-9). |
| Reinstall, restore | Android handled (no backup; key loss forces re-setup, but wipes the queue without counting it). iPhone: token and queue survive in the Keychain but are not used until re-setup; messages are dropped meanwhile. Suspected: an iCloud restore clones the device id and two phones share one token. |
| New phone, old phone still on | No server check of which device collects; covered by 3.4. |
| Token revoked, account deleted | Handled: clean refusal, queue kept, nothing booked. Raw messages remain on the device. |
| Base currency changed | Existing rows untouched. Suspected: an unconfirmed sender currency learned under the old base sticks until confirmed (the row is flagged). |
| Time zone, clock | Midnight and daylight saving handled. Wrong clock: N1. |
| Account closed or merged | **Mishandled**: N5. Remembered answers are keyed on digits and outlive the account. |
| Off then on | Messages in between are dropped, not back-filled; N8. |
| Plan lapse | Tracking is not plan-gated at ingest. An AI refusal means retry; nothing is dropped; N21 head-of-line. |

## 6. Scenarios

H = handled, M = mishandled, U = unknown. Evidence is in the finding named.

| Scenario | Verdict | Where |
|---|---|---|
| Partial refund | M | N2 |
| Refund in another currency | M | N2 |
| Reversal days later | H within 90 days for an exact amount; M when worded as a reversal with no match | N2 |
| Refund before its purchase | M | N2 |
| Split or multipart message | Android joins parts (H); a dropped part gives a partial body sent as whole (S2b P3-9); truncation M; iPhone concatenation U | N6 |
| Same amount twice in a day | H today (both book); becomes M again if the duplicate guard keys on text and minutes | 3.4 |
| Salary and a transfer the same day | H on the server (an income kind is never a pair candidate; different accounts only ask). M on the client after a pass-through Yes when the salary is not linked to a schedule | P1-1 |
| Fees and VAT lines | Partial: the main amount is right, the fee is lost | N23 |
| Foreign purchase with local settlement | M (suspected for two messages) | N16 |
| Instalment conversion, monthly instalment | U for conversion (no pattern, no live sample); M for assignment | N7 |
| Standing orders, direct debits, loans | U: no pattern; the AI decides; the default is spending | |
| Cash deposit, cheque | M for Arabic deposits (income); U for cheques | N18 |
| Pre-authorisation hold and release | U: no handling; a hold plus the final charge would both book | |
| Wallet to wallet, wallet to bank | H for a registered wallet in both orders; M with a fee or an unregistered wallet | N9 |
| Buy now, pay later | M for assignment; double count between provider notice and card charge suspected | N7 |
| Gold, investments, interest | M or U | N17 |
| Joint accounts, supplementary cards | Shared digits H (ambiguous is never guessed); other holders M | N24 |
| Bank changes its format | The code tier fails safe to the next tier. A loose learned pattern can keep matching with fields shifted; the balance check exists at learn time only (suspected) | P1-5 |
| Arabic-Indic digits | H on the server (normalised before every tier); the Android gate is ASCII-only (matters only for the rescue rule) | P1-3 |
| Mixed-direction text | Bidi marks stripped (H); other invisible characters not | N22 |
| Very large, very small amounts | Up to 10^9 H; zero and sub-cent M (silent) | N25 |
| Weeks late, out of order | Dates and pairing use capture time (H). A late row changes a past month | N15 |
| Clock changes, month boundaries | Midnight, year end and two-digit years H; the four-digit day-first assumption and Hijri M | N1 |
| Two devices, two requests | Same capture id H (409). Two legs at once H (per-user lock, wait for sibling). Same message with two ids M | P0-4 |
| Confirm racing undo | Suspected: undo before the confirm posts returns "already undone" and the confirm still posts | P1-6 |

## 7. Corrected scope and order for S2c

**Before any code: the invariants spec (Fable).** It must state at least:
1. A message never changes a row it did not create, except: a refund with a matching reference or the 15-minute same-account rule, and a pairing that sets the retraction marker.
2. A decline changes nothing but its own row.
3. Nothing is taken out of spending or income on one signal. The signals and which pairs of them settle are listed once.
4. Every retraction carries the marker of the message that caused it, and every restore requires it.
5. A second copy of a capture is never booked; a possible second copy is booked and flagged, never held, never dropped.
6. No server answer that makes the phone delete a message may be given unless the message is booked, a proven duplicate, or classified as not a transaction.
7. Unknown values (currency, direction, digits not yet published) never refuse a pair and never settle one.
8. A column the server stamps cannot be changed by a client row push.

**Batch 1, in this order.**

| Step | Content | Change from S2b / council |
|---|---|---|
| 1 | N3 retraction marker and N4 server-owned columns (one migration) | **Add.** Everything below depends on them |
| 2 | P0-1 with the 3.1 variant; from N2 the reversal wording and the no-match refund kept out of income | **Change.** Drop the 10-minute decline match. Partial refunds and the twin-check change can follow in batch 2 |
| 3 | One pairing change: P0-2, P1-2 with the 3.3 corrections (including the two holes listed there), P0-3 with the 3.2 variant, P1-7 keyed on provenance and wording, N5, P2-11 ("No" plus a matching reference asks), P2-16 | **Change and add.** P2-16 and N5 move in. P1-7's two rules are replaced. P0-3 is size M |
| 4 | P0-4 rules 1 and 3 on the server | **Change.** Same-capture index with no time limit; book-and-flag instead of hold; a reference or a balance as the only discriminators |
| 5 | N1 date and plausibility answers | **Add** |
| 6 | P1-1 with the 3.5 corrections, including the review list for users who already answered Yes | **Change** |
| 7 | P1-6 as `unpair` and `discard` (3.9); service-worker key | **Change** |
| 8 | P1-5: a code-tier rule for "collected" notices and quarantine of that template; deposit wording to credit; kind validation; sender scope; the wording guard in count-only mode | **Change.** The guard is not enforced until its hit count is read |
| 9 | P1-8 masking, plus the model call and the admin list | **Widen** |
| 10 | P2-2 category overwrite | Keep |
| 11 | Native, written now, shipped at the next owner-requested build: P0-4 rule 2 and the setup-guide text, P1-4, the shared currency list | **Add** rule 2. P1-3 is no longer launch-blocking |

**Dropped from batch 1.** P2-1 first half (not a defect). P2-14 (not a current defect; repair only). The cash-withdrawal default change (replaced by the ask-once switch, batch 2). "Hold" for possible duplicates.

**Batch 2 candidates, in rough order.** N7, N13, N6, N8, N9, N14, the rest of N2, P2-13 with permission detection, P2-4, P2-6, P2-8, P2-9, N11, N12, N10, P2-3 patterns, the cash switch, N15 once decided, then the remaining P2 and P3.

**Closing replay.** As the council asked, over all 952 messages, and it must report, besides unpaired real pairs: the two live repayment pairs still pair; `fb2d543a` and `e66b72ae` still match their transfers; `9e75b537` is untouched by `0fe8887c`; `1ccc2355` is untouched in both arrival orders; `4a382257` is refused as a copy of `76184aa7`; the four daily identical declines still produce one standalone row plus three acknowledgements; `6e9e1e26` stays non-spend; the wording guard's count.

**S3 repair list, corrected.** No action for the eight "possible duplicate" rows (they are separate messages). Keep `9e75b537`. Remove `fb2d543a` and `e66b72ae` from the re-check list. `af7e8c15` stays (book it). `a602aba1` and `34a081d4` leave the wrong-kind list. The owner reads `b61afd88`, `572aaf39` and `baab5343`.

## 8. What still could not be checked

1. Nothing was run on a device: two automations on one message, the order in which a drained iPhone queue is delivered, whether iOS hands a concatenated message to the Shortcut as one body.
2. Whether the 2026-10-27 charge behind `572aaf39` stood, and what the seven Saudi "payment via card" rows are. Both need the owner or a statement.
3. How `4a382257` came to be re-sent three days later (which build, which path). The row has no device id and its user has no device rows left. The mechanism matters less than the rule that would have refused it.
4. Amount accuracy, as in S2b: digits are masked and most raw text is gone.
5. N4's client half (whole-row push, push before pull) and N27 were read by a reader, not run; no live row shows a lost stamp.
6. The net-worth half of P1-1, P2-3's volume claim, and the S2b P3 items not listed as re-read.
7. Reader-confirmed items (N6, N8, N9, N11 to N15, the second half of N10, and the two holes in 3.3) were not re-read by Fable; each names its lines so the fix session can check before acting.

## 9. Owner decisions, restated

1. Declines never touch another row (3.1). The one same-second case, `572aaf39`: did that charge stand? Both of its messages (`572aaf39`, `4a7d7250`) still hold their raw text until about 2026-11-26.
2. Saudi "payment via card" rows: read `b61afd88` while its text still exists (checked present today; the 30-day limit falls around 2026-11-25).
3. Cash withdrawals: keep non-spend with an ask-once switch, instead of spending by default (3.8).
4. A second identical message with no reference or balance: book and flag, instead of hold (3.4).
5. The user's own cash deposits: income, or neither income nor spending (N18)?
6. iPhone setup guide: stop recommending a second automation, or keep it and rely on the on-device rule (3.4 rule 2)?
7. A message that arrives after its month was closed: recompute that month, or book it in the current one (N15)?

## 10. Council verdict on the owner decisions (2026-11-14)

Three voices (Skeptic, Pragmatist, Critic) plus the architect. The owner set item 6 directly.

| # | Decision | Verdict | Vote |
|---|---|---|---|
| 3 | Cash withdrawals | Keep non-spend. Show a monthly line "Cash withdrawn: X, not in spending". Ask once at the first withdrawal "Do you log what you spend in cash?"; unanswered means non-spend. The answer is changeable in settings and from the line. No backfill. Reverses the earlier 2-of-3 vote. | 3 of 3 |
| 4 | Second identical message, no reference or balance | Book it and flag "possible duplicate, remove?" with one tap. Never hold. The flag does not resolve by itself. | 3 of 3 |
| 5 | Own cash deposits (N18) | Stay income, flagged with a one-tap "this was my own cash" that turns the row into a transfer from cash. The fix session checks the three live rows from masked text; if all three are plainly the user's own machine deposits, it reports that before building, since it would support the minority view (neither, with "this was income"). | 2 of 3 |
| 6 | iPhone setup guide | **Owner decision:** keep recommending the second automation. The on-device repeat rule (3.4 rule 2) is therefore required, not optional. | owner |
| 7 | Late message after month close (N15) | Book it in its true month. Do not recompute the carry automatically. Show a notice that a closed month changed and mark the carry as stale where it is shown; recompute on tap or at the next close. Batch 2. | 3 of 3 |
| 1 | `572aaf39` (charged and declined in the same second) | Default if unread: no same-second exception. The charge stays counted and visible; the decline changes only its own row. | 3 of 3 |
| 2 | `b61afd88` (Saudi "payment via card") | Default if unread: spending, flagged, limited to this format. | 3 of 3 |
| - | `baab5343` (return matched to a transfer 40 hours earlier) | Default if unread: undo the match in S3 unless the two rows carry the same payment reference; show the return as its own flagged row. | 3 of 3 |

**Keeping the three questions alive.** Raw text is not kept past its 30 days and is not copied anywhere. The fix session writes a structural note for each of the three rows from masked text only (format key, kind, time gap to the related row, which rule matched), so the question can still be reasoned about after about 2026-11-25. The owner is asked to read the three rows by 2026-11-22; an answer becomes a synthetic test, never a copy of the message.

**Safe when unanswered.** Every prompt above (cash question, duplicate flag, deposit flag, closed-month notice) must leave totals in the stated default if the user never answers.
