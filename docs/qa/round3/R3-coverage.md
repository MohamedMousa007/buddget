# QA round 3: end-to-end coverage of the QA night and PR #38 (2026-11-24)

Branch `claude/qa-gaps-e2e` (from main 6c42cb52). Run locally on the owner's instruction (not the cloud runner): `next build --webpack` with `NEXT_PUBLIC_DEV_AUTH_BYPASS=0`, empty `NEXT_PUBLIC_API_BASE_URL`, `TZ=Africa/Cairo`, then `next start -p 3101`, `QA_BASE=http://localhost:3101`, one worker, no retries, phone project (390 px, touch). Live Frankfurt DB; only synthetic `qa-e2e-*@buddget-qa.test` users, all deleted (0 left at the end).

## Final run (after the one product fix, on a rebuilt bundle)

| Group | Specs | Result |
|---|---|---|
| New journeys | `round3/{w-money,j-accounts-flow,p-planner-conflicts,y-buddgy-rules}`, `k-accounts-flow` (K1-K3) | 17 of 17 passed. A second run on the committed tree passed 16 of 17: J9 failed once on a real Buddgy defect (finding 4). J9 then passed 3 of 3 on repeat |
| Regression, same areas | `b-bank-expense`, `c-debt`, `d-pockets`, `f-goal`, `h-cards-link`, `s-system-cash` | 14 of 14 passed |
| API | `api/round3/admin-devices.spec.ts` | 4 of 4 passed |
| SMS | `sms/multi-split.mjs` (13 checks), `sms/first-sms.mjs` (regression for the route change) | all passed |
| Unit files the map leans on | `flushedFingerprint`, `owedToYouVoice`, `defaultMethod`, `smsTracker`, `stepUp`, Buddgy `goals` and `savings` tools | 145 of 145 passed |

## Product fix

**Unsplittable multi-amount SMS was rejected, not held (BUD-104 / QA-32).** PR #38 says a message no curated pattern can cut, but which states two movements, is held for the user (`multi_amount`) and never learned. On the live model, three different two-statement texts all came back `is_transaction: false, confidence: 0`. The route rejected them as `not_transaction` before the multi-amount check ran. The message was lost (the phone forgets a rejected message) and its shape went into the negative cache.
- Root cause: `src/app/api/sms/parse/route.ts`. `if (!parsed.is_transaction)` rejected before `if (multiAmount) return holdForReview('multi_amount')` was reached. The unit test only stubbed a model that said `is_transaction: true`.
- Fix: a message that `looksMultiTransaction` holds as `multi_amount` even when the model refuses it. This is one line before the rejection. Nothing is booked and nothing is learned.
- Test: written failing first, in `src/app/api/sms/parse/route.capture.test.ts` ("a two-movement message the model refuses to read is still held for the user, not rejected"). `tsc --noEmit` is clean, and the SMS route tests and learnGates pass (77).
- Live check: `multi-split.mjs` case 3 now passes.
- Settle path: the held row has no amount, kind or title when the model refused it. That is the same shape as the existing `null_amount` hold. `useSmsConfirmations` reads those columns as nullable, and `/api/sms/dismiss` clears it by log id. The review sheet was not driven with such a row: **Manual verification required**.
- Trade-off: a text that is not a transaction but prints two priced statements in one wording (for example a two-offer promo) is now held and nudged, where before it was dropped. Shapes already in the negative cache (`isKnownNonTransaction`) are still rejected before the model is asked. The fix stops new ones from reaching that cache.

## Findings not fixed (need the owner)

1. **"Close account" confirm button reads "Delete".** `AccountDetailSheet.tsx:87` calls `confirm({ destructive: true })` with no confirm label, so the button gets the default "Delete". The body says the account is only closed and history stays. This is a copy change, so it needs a mockup and approval. W1 clicks "Delete" and names this in a comment.
2. **Creating an "Owed to you" debt takes no money out of any account.** This is a known PR #38 gap and a money-semantics question. W3 checks only the repayment leg, which credits the account.
3. **A global SMS template was learned from a synthetic probe.** While choosing a multi-amount text, one single-statement probe ("Dear Customer, your NBE card ending … QA SHOP NORTH") was booked through the AI tier. It taught a global `NBE` template (`sms_tracking_templates_ai` id 5cf56432…, 0 matches). That template is now `status='retired'`, the reversible path the app itself uses. The suite no longer sends single-statement AI texts. A suite should never post a non-curated single-statement SMS.
   - A retired row also blocks re-learning that exact regex (`route.ts:546`). The owner may prefer to delete it; it has 0 matches, so deleting is safe.
4. **Buddgy can put already-saved money "Somewhere else" when the user named the account (J9; 1 of 6 runs).** The user said: "I already saved 8000 EGP … that money is in my QNB Alahli account" (QNB has 5,000). The model then proposed the goal with "Where it is: Somewhere else (not tracked here)" and "Net worth rises". It did this again for 3,000, which QNB could hold. Approving that card would count money already in QNB as new money, which inflates net worth.
   - The tool does refuse more than the account holds (`resolveSavedHome` → `over_available`, unit-tested). The model then chose `elsewhere` instead of asking, against the spec's "ask the user, never guess".
   - The other 5 runs proposed "Set aside in QNB Alahli".
   - **Fixed (follow-up branch `claude/qa-r3-followups`).** Root cause: `resolveSavedHome` (`src/lib/buddgy/tools/exec/goals.ts`) took `saved_in: "elsewhere"` with no check against what the user said, because tools never saw the user's words (`runTurn` built `{ now, locale }` only). The `over_available` hint also suggested "somewhere else", and `saved_in` matched only an exact name or ref. Now `runTurn` passes the user's last 4 messages (`ToolContext.userTexts`). `src/lib/goals/namedHome.ts` matches account name, label, first word and catalogue brand names, in English and Arabic. When the user named one tracked account, that account is the home even if the model sent "elsewhere" or nothing. The amount is still capped at what the account has available. If the user named two accounts, or an account plus "somewhere else", Buddgy asks. The cap refusal no longer invites "elsewhere". Unit tests were written failing first, in `goalPocket.test.ts` (J9 block) and `runTurn.test.ts`. J9 now also asserts that no "Somewhere else (not tracked here)" card appears. It passed 6 of 6 on a production build. The defect was 1 in 6 on the live model, so the unit tests are the proof and the runs only back them up.
5. **Synthetic admin audit rows stay.** `admin_audit_log` has an immutable trigger, so the 16 rows written by the `qa-e2e-pr-r3-admin` actor (and 19 from earlier `adm` and `sup` runs today) cannot be deleted by a suite. They hold no personal data.

## Coverage map

Labels: **AV** Automated verification (tests written and passed), **MV** Manual verification required, **NV** Native verification required, **B** Blocked.

### QA bugs 1-15

| Bug | What | Test(s) | Result | Label |
|---|---|---|---|---|
| 1 | New card can be assigned to an existing account | `h-cards-link` H1 | pass | AV |
| 2 | Cards added in Payment methods show under accounts | H1 | pass | AV |
| 3 | Missing provider logos | none (asset licensing, 49 brands unsourced) | — | MV |
| 4 | Account sheet scrolls sideways | none (layout) | — | MV |
| 5 | New card attached to the wrong account | H1 (provider switch re-links) | pass | AV |
| 6 | Card actions in account details | H1 (Manage, Edit), J10 | pass | AV |
| 7 | Card layout differs between screens | J10 screenshot `evidence/bug10-account-sheet-menus.png` | taken | MV |
| 8 | Notification prompt every launch; "No" honoured | none: `notifyCheck` returns `ask:false` off native (`useNotifyDecision.ts:24`), so nothing reaches the web | — | NV |
| 9 | Unknown account cannot be removed ("Not mine") | `round3/j-accounts-flow` J7 (real SMS, Not mine, Undo, next SMS on the closed row) | pass | AV |
| 10 | Card management icon unclear | J10: both icons vertical ⋮, `aria-haspopup=menu`, tap area ≥44 px. The card button is drawn 32 px; IconButton's `::after` overlay gives 44 px. Evidence `docs/qa/round3/evidence/bug10-*.png` | pass | AV (owner to look at the screenshot) |
| 11 | Goal "already saved": where is the money | `f-goal` F2/F3 | pass | AV |
| 12 | Flow prompts: All and In not Out; dots; vertical swipe | J12 (segments, dot "2 of 2" brings card 2, sideways drag does not page, swipe up snoozes) | pass | AV for web. NV for a finger swipe on iOS and Android |
| 13 | Time in details only for a real same-day timestamp | J13 (today's entry "Today · h:mm AM/PM"; noon stand-in and back-dated show none). Income-event sheet not driven | pass | AV (expense), MV (income sheet) |
| 14 | Flow "Not counted" moves removed | `k-accounts-flow` K1 | pass | AV |
| 15 | Cash currency | K2 (with balance: amount asked in the new currency), K3 (empty Cash follows a main-currency switch; Undo restores both) | pass | AV |

### PR #38 tickets

| Ticket | What | Test(s) | Result | Label |
|---|---|---|---|---|
| BUD-100 | Net worth = pockets + investments + tracked accounts - debts; closed accounts out | W1 (6,000, then 4,000 after closing CIB, on Accounts and Wealth); W4 | pass | AV |
| BUD-90 | `assets` snapshot basis | W2 (`net_worth_snapshots` row, basis `assets`, -300) | pass | AV |
| BUD-39 / BUD-99 | Repayment received credits an account, "Not income", out of income totals | W3 (one `debt_payments` row, no income event, no expense; QNB 5,200; Flow "Repaid by Omar" + "Not income"; Money in unchanged). The voice path is unit-tested only | pass | AV (voice: unit only) |
| BUD-103 | Cleared non-card debt owes 0 | W4 ("Still owed" 1,000 with a cleared 500 left on another; net worth -1,000) | pass | AV |
| BUD-87 | Goal add-money "left / over target" hint | W5 (600 left, Reaches your target, +500 over; 1,500 saved, not capped) | pass | AV |
| (carousel) | Card details follow the swiped card | W6 (keyboard: the detail line changes card) | pass | AV (touch swipe: NV) |
| (default method) | Explicit choice, else most SMS-booked, else Cash; Cash "Make default" | W7: Cash by default, then the account set as default, then the Cash row's menu. The item reads **"Set as default"**, not "Make default". The SMS-booked branch is unit-tested only | pass | AV |
| BUD-105 | Planner conflict choice screen, one at a time, resume-safe | P1 (income and debts conflicts, "1 of 2" then "2 of 2", the choice saved, a reload resumes at 2 of 2). **The AI reading is stubbed** | pass | AV (real AI reading: MV) |
| BUD-106 | Tappable review rows, small editors | P1 (Gym 500→650, utilities editor without a name field, Gold 50,000→60,000) | pass | AV |
| BUD-104 / QA-32 | Multi-transaction SMS split, per-segment idempotency | `sms/multi-split.mjs` (2 bookings, a retry adds none, own log rows) | pass | AV |
| BUD-104 | Unsplittable multi-amount held, never learned | `multi-split.mjs` case 3, after the fix above | pass after fix | AV |
| BUD-104 | "Caught twice" wording | `multi-split.mjs` case 4 (flag `dup_hint:same_phone`), J14 (the Flow prompt wording, Keep both keeps two) | pass | AV |
| BUD-42 | Offline drain keeps unowned items, clears lastOwner | native drain (`smsTracker.ts`); unit test only | — | NV |
| BUD-94 | Owner/admin in-app confirm | `api/round3` A1 (no proof, `"true"`, `1` → 401, nothing erased), A2 (`confirmed:true` → reset, audit `auth.step_up_inapp`), A3 (own account). The StepUp popup in the portal UI was not driven | pass | AV (portal popup: MV) |
| BUD-107 | install_key merges reinstalls | `api/round3` D1 (one row under the new id, name/main/notify carried, old SMS token off, a repeat beat idempotent). Key generation on device | pass | AV (Keychain / ANDROID_ID: NV) |
| BUD-93 | Sheet padding and chip wrap | visual | — | MV |
| QA-81 | Fingerprint guard scoped to the finance store | `flushedFingerprint.test.ts` (unit) | not run here | MV for an e2e |
| QA-78 | Lazy pastCategory in the Flow ledger | performance, no behaviour to assert | — | MV |

### Guide journeys J1-J9

The guide that numbers J1-J6 is not in the repo: searches of `docs/` and the PR #39 and #40 bodies found none, and the pro-rewards J1-J9 are a different set. The J1-J6 rows are therefore inferred from the brief's "already covered" list. The owner should confirm them.

| Journey | Test(s) | Result | Label |
|---|---|---|---|
| J1-J6 (inferred: card linking, goal already-saved, reserve cap, release, Flow moves, Cash currency with balance) | H1, F2/F3, D5, D6, K1, K2 (PR #40) | pass in the regression group | AV |
| J7 unknown account "Not mine" | J7 | pass | AV |
| J8 full Cash currency | K2 + K3 | pass | AV |
| J9 Buddgy respects pocket/goal rules | `round3/y-buddgy-rules` J9 (real model). Step 2 checks the `saved_in` home: pocket held in QNB with 3,000, QNB still 5,000. Step 1 only shows that no proposal set aside 8,000 in QNB; the `over_available` refusal itself is unit-level (`goals` tool tests) | 5 of 6 runs pass; 1 fails on finding 4. After the fix: 6 of 6 | AV for `saved_in`; refusal unit-only; finding 4 fixed |

## Test-only corrections made on the way (none weakened)
- `multi-split.mjs`: a resend with a **new** capture id is a second purchase by design (QA-31), so "resend" means the same event id.
- The hero "Net worth" value and its label share one paragraph, so `tile()` does not fit it. W uses its own reader.
- Accounts with no account set up show the empty state. J7 enters through "Find my accounts".
- J12 waits for the leaving card's exit animation before reading the front card.
