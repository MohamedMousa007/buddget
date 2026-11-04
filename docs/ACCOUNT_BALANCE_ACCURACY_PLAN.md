# Account balance accuracy: root causes and fix plan

Date: 2026-11-02. Trigger: owner report that account balances drifted from the bank after tracking started, and that the "available balance" in bank SMS never confirmed anything. **Investigation only: no code, schema or production data was changed.** All database access was read-only SELECT (plus one `EXPLAIN`, which does not execute).
Evidence tags: **[live]** read-only query on production, **[code]** read in source, **[probe]** executed check, **[ref]** external reference.

## 1. What happened to the reporting account (HSBC ••0001, EGP)

| Item | Value | Evidence |
|---|---|---|
| Opening balance (25 Oct) | 1,627.49 | [live] |
| Incoming (2 transfers) | 7,500.00 | [live] |
| Expenses linked to the account (11) | 4,302.32 | [live] |
| App balance | about 4,825 | computed |
| Bank balance in the last SMS (31 Oct 22:09) | **2,075.43** | [live] |
| Expenses saved with no account (4 purchases/ATM on 31 Oct) | 2,499.24 | [live] |
| Spend that never reached the app at all | about 250.50 (0.50 by 27 Oct, 250.50 by 31 Oct 13:00) | [live] derived from the bank's own balance chain |

Correction to my earlier message: there is **one** declined-charge expense, not four. My query joined four SMS rows to one expense. The four "declined 199" messages are one recurring failed charge, and the duplicate guard worked. The balance is not affected by it.

The bank's balance chain is internally consistent (4,270.17 after 765, 3,270.17 after 1,000, 2,785.17 after 485, 2,324.67 after the 460.50 transfer, 2,075.43 after 249.24). So the bank numbers can be trusted as the reference, and the app is the side that drifted.

## 2. Root causes (layered; every one is needed to explain the loss)

**RC1. The account number in the message is never captured when it is not exactly 4 digits.**
HSBC debit-card and ATM messages read "Purchase from 103-104\*\*\*-001". The account ends in 3 visible digits. [code] Three places enforce "exactly 4":
- the AI parser prompt (`aiParserPrompt.ts`): "Extract ONLY the final 4 digits… return a 4-character string… NEVER more than 4";
- the route (`sms/parse/route.ts:919`): `replace(/\D/g,'').slice(-4)`, which truncates but never pads or widens;
- curated patterns (`hsbc.ts`): `(\d{4})`.
Result [live]: purchases stored `account_last4 = NULL`; ATM stored `"001"`; other cases `"301"`, `"0301"`. The registered account is `"0001"`.

**RC2. Matching is exact equality, so even a captured short number cannot match.**
`findUniqueByLast4` does `.eq('last4', last4)` (`createSmsExpense.ts:346`). `"001"` never equals `"0001"`. [live] 11 balance-bearing messages carry an `account_last4`; **0** resolved to an account. The same equality is used by `resolveExactPaymentMethod`, refund matching, pairing and the CC-payoff funding lookup.

**RC3. The fallback chain does not cover banks.**
`resolvePaymentMethodByLast4` tries last4, then provider, then the default method. The provider step is limited to wallets (`brand.type !== 'wallet'` returns nothing), so a bank sender never attributes. If the user has no default method, the result is null. [live] 5 of 16 of your expenses and **417 of 504 SMS expenses across all 8 users (82.7%)** have no account.

**RC4. Unattributed SMS spend is silently excluded from every balance.**
`accounts/balance.ts`: `if (unfunded && (CC Payoff || e.smsLogId)) continue`. This was deliberate ("must not drain Cash"), but nothing tells the user. The money simply disappears from the ledger, so balances overstate spending-free cash by exactly the unattributed total. This is the "it was accurate, then lost it" mechanism: accurate at the opening balance, then each unattributed SMS widens the gap.

**RC5. The balance-report resolver has a second, independent matching rule that also fails.**
`recordBalanceReport` uses `resolveReportTarget`: exact last4, else a brand fallback that requires **exactly one** account of that brand (`same.length === 1`). You have two HSBC bank accounts (••0001 EGP and ••0110 USD), so it returns null. Currency is never used as a tie-breaker even though the message states it ("Your available balance is EGP…").

**RC6. Balance reports can never be stored, even when a target is found.**
`balanceReport.ts` upserts with `onConflict: 'sms_parse_log_id'`, but the only unique index on that column is **partial** (`WHERE sms_parse_log_id IS NOT NULL`, migration 0152). Postgres cannot infer a partial index from a bare column list. [probe] `EXPLAIN INSERT … ON CONFLICT (sms_parse_log_id)` on production returns `42P10: no unique or exclusion constraint matching the ON CONFLICT specification`. [ref] [Postgres partial-index arbiter behaviour](https://betakuang.medium.com/why-postgresqls-on-conflict-cannot-find-my-partial-unique-index-552327b85e1). The code does not read the returned `error`, so the failure is silent. [live] `account_balance_reports` has **0 rows in the whole system**, although 49 of 343 messages contain a balance.

**RC7. The gap detector cannot see a growing drift.**
`accounts/gap.ts` fires only when the two newest reports disagree with the ledger by about the same amount (`|g1 - g0| <= tolerance`) and both exceed the tolerance. For your account the gaps are about -0.50 then -250.50: it would stay silent even if reports were stored. A drift that grows because transactions keep being missed is exactly the case it should catch.

**RC8. A missing transaction cannot be noticed.**
About 250.50 left the bank and no expense exists. Six messages were rejected as `not_transaction` in the window and their bodies were purged, so it cannot be reconstructed. There is no continuity check (previous balance minus amount should equal the next reported balance), so a missed or mis-rejected SMS is invisible.

**RC9. No user-visible "needs an account" path.**
Attribution that is uncertain is dropped (RC4) rather than queued for a one-tap decision, and a decision is never remembered, so the same card is never learned.

## 3. Principles from industry practice
- **Treat an identifier mask as a hint, not a key.** Plaid documents the account mask as the last 2-4 characters, possibly non-unique within an institution and possibly different from what the bank displays; reconciliation should combine institution, mask and account type. [ref] [Plaid account mask description](https://www.diffchecker.com/k3W6v8QW), [Plaid reconciliation](https://plaid.com/docs/payment-initiation/reconciliation/).
- **Balance assertions.** Ledger systems record the balance the bank states as an assertion and fail loudly when the ledger disagrees; the fix is to correct the missing transactions, not to force the balance (a `pad`/adjustment is the last resort, and it is recorded as such). [ref] [Beancount balance directive](https://rustledger.github.io/pta-standards/formats/beancount/v3/spec/directives/balance), [month-end close](https://beancount.io/blog/2025/09/01/month-end-close).
- **Never guess silently, never lose silently.** Ambiguity goes to an explicit review queue; the user's answer becomes a stored rule (alias).
- **Idempotent, observable ingestion.** Every write returns and checks its error; every drop has a counter.

## 4. Fix plan

### Phase 0: data repair for the owner's account (needs owner approval, about 15 minutes)
1. Attach the 4 unattributed 31 Oct expenses (765, 1,000, 485, 249.24) to HSBC ••0001.
2. Add one adjustment (`reason = gap`) for the remaining difference after step 1, and label it. Expected about -250.50. If the owner can identify the missing 250 transaction (statement), add it as a real expense instead and skip the adjustment.
3. Insert the 5 known bank balances as balance reports so reconciliation history starts from truth.
Verify: app balance equals 2,075.43. Nothing here touches other users.

### Phase 1: stop the bleeding (small, safe, ship first)
1. **Fix RC6.** Replace the partial unique index with a plain unique index on `sms_parse_log_id` (NULLs are already distinct in Postgres, so the partial predicate adds nothing), or call the upsert through an RPC. Check `error` on every write in `recordBalanceReport` and log it. Add a test that inserts the same report twice.
2. **Fix RC1/RC2 minimum.** Capture the visible account digits with their count and the raw masked string. Match by **suffix**: a captured value of k digits (k from 2 to 6) matches an account whose stored digits end with the same k digits. Compare as strings (leading zeros matter). Never match on fewer than 3 digits alone (see scoring below).
3. **Fix RC4 visibility.** Count unattributed SMS transactions per account/currency and show "N transactions need an account" on the Accounts screen with the total amount, so drift can never be silent.

### Phase 2: a proper account resolver (one module used by every caller)
Create `src/lib/accounts/identity/` with a pure, unit-tested function:

`resolveAccount(message, candidates) -> { accountId | null, confidence, reason, ranked[] }`

Signals, each with a weight; sum into a score, accept only above a threshold with a margin over the runner-up:
1. **Learned alias** (highest): `payment_method_aliases(user_id, payment_method_id, institution_key, token, token_kind)` created when the user answers a prompt or links a card. A token is the full masked string or its digit run ("103-104\*\*\*-001").
2. **Digit suffix match** with length k = 2..6: accepted weight grows with k; an account with `last4 = 0001` matches captured `001`, `01`, `0001`, `00001`. Leading-zero-safe string comparison. Reject when two accounts of the same institution both match at that k, and fall through to the next signals.
3. **Institution** (sender id, bank name, brand key) must match the account's institution.
4. **Currency** stated in the message vs account currency (separates ••0001 EGP from ••0110 USD).
5. **Instrument type**: card message goes to a card or to the account behind the debit card (parent link); "Account \*\*\*\*" goes to an account.
6. **Linked card**: a card last4 that is a child of an account attributes to its parent.
7. **Balance continuity** (strong tie-breaker): for each candidate, `ledger balance before the message - amount` should be close to the balance the SMS reports; the candidate that explains the reported number wins.
8. **Recency/default** as the weakest signal, never when the institution is known to have several accounts.
Outcome: `auto` (score and margin pass), `suggest` (one clear best, ask once), or `ask` (ambiguous). Only `auto` writes an account; the others create a review item (Phase 4).
Unit/property tests: a corpus of every stored message shape (HSBC 3-digit, 4-digit, Arabic digits, "ending in", "XXXX1234", multiple HSBC accounts, USD vs EGP, card vs account); a generator that renders each format with k = 2..6 digits; assertion that exactly one account is chosen or none, never a wrong one.

### Phase 3: parser changes
- Replace "exactly 4 digits" with an extractor that returns `{ digits, visibleCount, kind, raw }` for any 2-6 visible digits, formatted or unformatted. Remove the `.slice(-4)` truncation and the "NEVER more than 4" prompt rule; keep `account_last4` (for compatibility) and add `account_ref_digits`, `account_ref_masked` columns on `sms_parse_log` (migration, regenerate `database.types.ts`).
- Change the curated HSBC patterns and the shared extractor to read the "Purchase/Withdrawal from 103-104\*\*\*-001" layout.
- Keep the amount-versus-balance guard in `extractBalance`; add Arabic and "Avl bal" formats to its tests.

### Phase 4: reconciliation (the part that keeps balances accurate)
1. **Balance assertions.** Every reported bank balance becomes an assertion stored in `account_balance_reports` (fixed in Phase 1) and is compared with the ledger at that instant (existing `computeBalances(ledger, instant)`).
2. **Alert on the first mismatch, not the second.** Replace the "two reports, same gap" rule (RC7). Show the drift after one report when it exceeds the tolerance, and escalate when it grows. Keep a snooze that expires on a newer report.
3. **Explain before adjusting.** The reconcile sheet lists, in order: (a) unattributed SMS transactions whose total equals the drift (one-tap attach), (b) a gap in the balance chain ("a 250.50 debit is missing between 27 Oct 15:19 and 31 Oct 13:00"), (c) only then a labelled adjustment.
4. **Continuity check on ingest.** For consecutive reports on the same account, `previous balance - amount(s) between = next balance`; a break creates a "missing transaction" review item with the amount and time window. This catches the rejected or never-delivered SMS (RC8).
5. **Rejected-message safety net.** When a message from a known bank sender is rejected as `not_transaction` but contains an amount or balance, keep a masked copy for a short window and surface it in review instead of dropping it.
6. **Review queue ("Needs an account").** One list for ambiguous, unattributed and missing items. A choice creates an alias (Phase 2 signal 1) and re-resolves similar past items.

### Phase 5: back-fill and safeguards
- One-off, owner-approved back-fill: re-run the resolver on existing unattributed SMS expenses (417 across 8 users) in **suggest** mode only; nothing is attached without the user's confirmation.
- Metrics: percent of SMS expenses attributed, unattributed amount per user, report-write error count, drift per account. Alert when attribution falls below a threshold. Add them to the admin SMS panel.
- Invariant tests (property-based): attaching or detaching an expense changes exactly one account balance by exactly its amount; the resolver never returns an account whose institution or currency contradicts the message.

## 5. Order, effort and risk

| Step | Effort | Risk | Why this order |
|---|---|---|---|
| Phase 0 | S | low, one user, reversible | restores trust now |
| Phase 1 (RC6, suffix match, visibility) | S-M | low | removes silent loss immediately |
| Phase 2 resolver + tests | M | medium (money attribution) | one module replaces 4 divergent matchers |
| Phase 3 parser + migration | M | medium (AI prompt, types regeneration) | feeds the resolver richer input |
| Phase 4 reconciliation | M-L | medium (UI, balance semantics) | makes accuracy self-correcting |
| Phase 5 back-fill + metrics | M | low if suggest-only | cleans history, proves the fix |

Risks: a looser suffix rule can attribute to the wrong account, so it ships behind the score and margin, with ambiguity going to review (never auto-pick between two accounts of one bank). Migrations follow CLAUDE.md: check live schema, apply, regenerate types, then code. Production data repair and the back-fill need explicit owner confirmation.

## 6. Decisions needed
1. Approve Phase 0 and the exact adjustment (or provide the missing transaction).
2. Minimum digits to auto-match: recommended 3 with institution + currency, 2 only with an existing alias.
3. Should unattributed SMS spend count against the institution's only tracked account by default (more accurate, slight risk) or stay out until confirmed (current behaviour, visible warning added)?
4. Retention for the masked copy of rejected messages (recommended 7 days).

## 7. Related entries added to the QA register
New P1 (financial correctness): RC6 (balance reports never stored), RC2/RC3 (82.7% of SMS expenses unattributed). New P2: RC4, RC5, RC7, RC8. These supersede the earlier "R7/R8" data findings as the main accuracy risk.
