# QA Round 2 - Fix Ledger (every finding assigned)

Status: PLANNING ONLY. Nothing here is fixed. Inputs: QA_ROUND_2_PLAN.md, QA_ROUND_2_DECISIONS.md incl. its Addendum (binding), QA_ROUND_PLAN.md (round 1, already fixed), the 15 area reports in docs/qa-round-2/. Companion file: FILE_OWNERSHIP.md (files, migrations, conflicts).

Every batch ends with: npm run lint (0 errors in src/), tsc, npm run test, npm run build with dummy Supabase env, code audit of the diff, commit, push dev + main. Never `git add -A` (parallel sessions share the worktree). No native build/upload unless the owner asks.

## Legend

- Disposition: FIX = fix per the area report; FIX-WITH-DECISION = fix as fixed by a DECISIONS.md entry (cited); DEFER = not fixable now (reason given, batch B12 re-verifies/backlogs); DUPLICATE-OF X = same root cause, fixed by X (listed in the batch of X; verify there).
- Mig: Y + number = needs a SQL migration (numbers in FILE_OWNERSHIP.md, applied in order from 0197). DUPLICATE rows carry no migration; the primary does.
- UI: N = no visible UI/flow change; "Y (covered by DECISIONS)" = owner already decided; "Y (NOT in DECISIONS)" = visible/flow change the owner has not decided: follow the report recommendation and tell the owner in the batch report (section 6).
- Cross-audit duplicates follow QA_ROUND_2_PLAN.md. Where two IDs share only part of a fix both stay FIX and the Note says which part is shared.

## 1. Totals

Total IDs: **405** = 395 report findings (L25 W29 D28 R34 C25 I24 N31 O19 V29 T20 F20 Q20 U50 X20 Z21) + 10 addendum IDs (LF1-LF7, PR1-PR3). No ID is unassigned.

| Disposition | Count |
|---|---|
| FIX | 302 |
| FIX-WITH-DECISION | 55 |
| DEFER | 23 |
| DUPLICATE-OF | 25 |
| **Total** | **405** |

| Batch | Title | IDs | FIX | FWD | DEFER | DUP | P0 | P1 | Migrations (primary) |
|---|---|---|---|---|---|---|---|---|---|
| B1 | Money engine (calc, store, RPC, data repair) | 37 | 33 | 2 | 0 | 2 | 3 | 14 | 0197, 0198, 0199, 0200 |
| B2 | Money flows UI (pay-debt, deletes+undo, zakat, amount parser, receipts, cards) | 37 | 29 | 7 | 0 | 1 | 0 | 12 | - |
| B3 | Privacy + security (DB/auth) | 43 | 34 | 2 | 0 | 7 | 0 | 8 | 0201, 0202, 0203, 0204, 0205, 0206, 0207, 0208 |
| B4 | SMS pipeline + data lifecycle + learning funnel + pattern review | 47 | 27 | 14 | 0 | 6 | 0 | 12 | 0209, 0210, 0211 |
| B5 | Budget / reports / cycle consistency | 31 | 27 | 2 | 0 | 2 | 0 | 3 | 0212 |
| B6 | Native + platform | 33 | 29 | 4 | 0 | 0 | 0 | 5 | 0213 |
| B7 | Dependencies, CI, tests | 21 | 21 | 0 | 0 | 0 | 0 | 2 | - |
| B8 | Performance | 18 | 18 | 0 | 0 | 0 | 0 | 3 | 0215, 0216 |
| B9 | i18n, week start, Arabic | 21 | 13 | 5 | 0 | 3 | 0 | 1 | 0217 |
| B10a | Accessibility + tokens | 26 | 16 | 7 | 0 | 3 | 0 | 3 | - |
| B10b | Component merges (per DECISIONS) | 10 | 0 | 9 | 0 | 1 | 0 | 0 | - |
| B10c | Dead code removal | 10 | 7 | 3 | 0 | 0 | 0 | 0 | 0218 |
| B11 | Remaining P2/P3 sweep | 47 | 47 | 0 | 0 | 0 | 0 | 1 | 0219, 0220 |
| B12 | Live UI verification, docs, round-3 backlog (incl. all DEFER items) | 24 | 1 | 0 | 23 | 0 | 0 | 0 | - |

Per area: Ledger 25; Wealth 29; Debt 28; Budget+reports 34; Account+security 25; AI 24; SMS 31; Learning funnel (addendum) 7; Pattern review (addendum) 3; Backend ops 19; Native 29; i18n 20; Performance 20; Database 20; Design system 50; Live UI 20; Suite/supply chain 21.

UI/flow change not covered by DECISIONS: 48. Covered by DECISIONS: 36. Rows with their own migration: 48.

## 2. Cross-audit duplicates (primary owns the fix)

| Primary | Batch | Duplicates | Note |
|---|---|---|---|
| C2 | B3 | Q3 | C1 (server enforcement) stays separate and depends on C2. |
| C4 | B3 | V3 | V7 (secure storage) stays separate in B6. |
| C6 | B3 | Q5 | Migration 0203 carries the Q5 FKs. |
| D8 | B4 | D21 | N11 stays separate (unique index, confirm reuse). |
| I1 | B3 | Q4 | Q16 stays separate (same migration). |
| L1 | B1 | R3 | Data repair migration 0197 included. |
| L2 | B2 | T2 | N6 (SMS parser) stays separate in B4 and reuses the shared parser. |
| N11 | B4 | Q18 | Q18 index must exempt fee rows. |
| N2 | B4 | C3, O3, Q1 | Retention root cause. N3, N19, N13, N14, Q17 are separate pieces of the same lifecycle and stay separate rows in B4. |
| N31 | B4 | I22 |  |
| O10 | B3 | C24 | N24 and Q19 are the other parts of C24 (migration 0201). |
| Q11 | B3 | N25 |  |
| Q2 | B3 | N7 |  |
| Q6 | B1 | W8 | W9 (unique index/idempotency) stays separate in the same migration 0199. |
| R6 | B5 | L5 | R7 covers the rollover part. |
| R9 | B5 | L6 |  |
| T16 | B9 | W24 | T12 (server notifications) stays separate in B9. |
| T8 | B9 | L18 |  |
| U18 | B10a | X5 | X5 re-measured in B12. |
| U24 | B10a | U17 |  |
| U41 | B9 | T17 |  |
| U8 | B10b | U36 | TrophyHero/Reports/Income hero restructure NOT done (alert to owner). |
| X4 | B10a | U20 |  |

Partial overlaps kept as separate FIX rows: O1/W19 (cadence only), R14/C11 (injection only), N6/L2, N5/LF1/LF2 (same root cause: bidi + date formats; LF rows are the owner-requested scope), N13/N14/LF6, W8/W9/Q6, Q12/F9/F10/F13, Z14/V22, T11/X14.

## 3. Work derived from DECISIONS.md without a finding ID

| Task | Batch | What | Mig | UI |
|---|---|---|---|---|
| DT1 | B6 | Prominent in-app SMS disclosure + explicit consent screen before SMS tracking is enabled; optional sms_consent_at record | Y 0214 (optional) | Y (covered: store checklist) |
| DT2 | B4 | Corpus stores masked shape + counts + parser outcome; harvested_at; AI call receives masked text where amount/merchant not needed | in 0209 | N |
| DT3 | B4 | Retention periods in platform_settings (7d rejected/OTP, 30d parsed, 60d never-harvested cap, 180d for shapes seen <3x) with alerts when the cap fires | in 0209 | N |
| DT4 | B1 | Read-only audit report of historical gold conversions for owner approval (no write) | N | N |
| DT5 | B1 | Backup tables (qa2_backup_*) before any automatic repair | in 0197 | N |
| DT6 | B9 | Produce the ~156 Arabic strings as a review list; Arabic ships only after owner review | N | Y (covered: Arabic) |
| DT7 | B9 | Week-start default by timezone applied once to existing users, then changeable | 0217 + client | Y (covered: Week start) |
| DT8 | B10b | Before/after screenshots for debt cards; revert any card that shifts | N | Y (covered) |
| DT9 | B12 | Play Permissions Declaration, Data Safety form, App Privacy label: dashboard-only, owner action | N | N |
| DT10 | B12 | Round-3 backlog doc (Not-reached lists of all 15 reports + DEFER rows) | N | N |
| DT11 | B2 | Receipt photo deleted when expense is deleted (part of L10) | N | Y (covered) |

## 4. Batch tables

### B1. Money engine (calc, store, RPC, data repair) (37 IDs)

Order inside the batch: W1, then D1/D2/D3, Q6/W9/W7, W2/W12, L1/L3/R11, rest. Owner check-in before any DB apply.

| ID | Sev | Title | Mig | UI/flow | Depends on | Disposition | Note |
|---|---|---|---|---|---|---|---|
| L1 | P1 | Deleting/ending recurring income erases received events from history | Y 0197 | N | - | FIX-WITH-DECISION (Data repair) | calc: orphan events fall through to one-time path; 0197 re-attaches events hidden by deleted sources (backup table first). Same root cause as R3. |
| L3 | P1 | Duplicate payday event 23505 poisons the whole income_events batch | N | N | - | FIX | sync.ts: on 23505 re-query live row, adopt, retry rest; tombstones before upserts. |
| L11 | P2 | Expense category/subcategory/shared plan dropped on sync round trip | Y 0200 | N | W22 | FIX | Add expenses columns + mapper; fixes amountInBaseCurrency hydration. |
| L12 | P2 | Cached amountInBaseCurrency still summed in 3 places | N | N | - | FIX | Use expenseAmountInBase + isNonSpendExpense. |
| L17 | P2 | Unconvertible foreign expense stored 1:1 as base (fail-open) | N | Y (NOT in DECISIONS) | D13,R17 | FIX | One convertOrNull + incomplete flag helper; shows "incomplete" instead of wrong base amount. |
| L23 | P3 | Spend-excluded expenses dropped from calculateCashOutflow | N | N | - | FIX |  |
| W1 | P0 | EGP<->XAU conversion treats troy ounces as grams | N | Y (NOT in DECISIONS) | - | FIX | tryConvertCurrency handles XAU via gram price or returns null; reject/convert in deposit/withdraw/transfer and Buddgy inPocketCurrency. Plus read-only audit of historical conversions for owner approval (DECISIONS data repair). |
| W2 | P0 | Pocket moves carry no account leg: net worth inflated/deflated | N | Y (NOT in DECISIONS) | W1,W12 | FIX | Default leg to primary tracked account; AddSavings/Withdraw/goal add-money/recurring/Buddgy. If no primary account exists a picker may be needed (not in DECISIONS). |
| W5 | P1 | Deleting a pocket withdrawal leaves its income event | N | N | - | FIX |  |
| W6 | P1 | Delete tx clamps balance at 0; ledger and balance diverge | N | Y (NOT in DECISIONS) | - | FIX | Block or go negative visibly; message needed. |
| W7 | P1 | Client upserts absolute current_balance over server RPC deltas | Y 0199 | N | Q6 | FIX | Client stops writing current_balance; route via RPCs. |
| W8 | P1 | Savings RPCs trust client currency/amount | N | N | Q6 | DUPLICATE-OF Q6 |  |
| W9 | P1 | adjust_pocket_balance idempotency check-then-act, no unique index | Y 0199 | N | Q6 | FIX | Unique partial index + ON CONFLICT/advisory lock. |
| W12 | P1 | Recurring savings scheduler double-posts across devices/pre-hydration | N | N | W2 | FIX | Gate on dataReady; per-due-date idempotency. |
| W13 | P2 | Month-carry sweeps projected income that never arrived | N | N | - | FIX | Cron stays unscheduled (owner hold). |
| W14 | P2 | Carry destination priority inverted; vault fallback picks goal pockets | N | N | - | FIX |  |
| W15 | P2 | Goal funding claim-then-pay can strand a goal | N | N | - | FIX |  |
| W16 | P2 | Goal progress inconsistencies; shared pocket; delete-goal move | N | Y (NOT in DECISIONS) | - | FIX |  |
| W17 | P2 | Zakat ignores tracked-account balances; fail-open conversions | N | N | L17 | FIX | zakatInputs.ts, wealthModel, netWorth. |
| W22 | P2 | Mappers lose data (kind coercion, targetAmount/emoji, cancelled goals) | Y 0200 | N | L11 | FIX |  |
| D1 | P0 | Manual/recurring/Buddgy debt payment debits account twice | Y 0197 | N | - | FIX-WITH-DECISION (Data repair) | Set linkedDebtPaymentId (ids generated up front); 0197 links the 21 existing rows after backup table. |
| D2 | P1 | Debt payment amount stored in debt units but labelled with paying currency | Y 0198 | N | W1 | FIX | New columns amount_in_debt_unit + original amount/currency. SMS write path (createSmsExpense) done in B4 with D8. |
| D3 | P1 | Gold-debt payment books grams as EGP | N | N | D2 | FIX |  |
| D7 | P1 | Installment progress counts rows, not amounts | N | N | D2 | FIX |  |
| D10 | P2 | Manual payment advances recurring reminder even if not the scheduled instalment | N | N | - | FIX |  |
| D13 | P2 | Card outstanding fails open on unconvertible currencies | N | N | L17 | FIX |  |
| D14 | P2 | Same-last4/name card merge overwrites debt | N | N | - | FIX |  |
| D16 | P2 | Dust remainder never clears cross-currency debts | N | N | - | FIX |  |
| D18 | P2 | Resume/reactivate backfills charge for paused cycle | N | N | - | FIX |  |
| D19 | P2 | Converted trial never logs/asks | N | N | - | FIX |  |
| D20 | P2 | Cancel deactivates planner row today instead of endsOn | N | N | - | FIX |  |
| R1 | P1 | Plan-line amount patch corrupts lines with subcategories/non-base rows | N | N | - | FIX | lineEdit patchInBase / useBudgetPageActions. |
| R2 | P1 | moveFreeToBuffer corrupts non-base Buffer line | N | N | R1 | FIX |  |
| R3 | P1 | Deleted recurring income source zeroes realized history | N | N | L1 | DUPLICATE-OF L1 | Also fix Buddgy delete_income prompt text. |
| R11 | P2 | filterDebtPaymentsByMonth uses UTC day of ISO stamp | N | N | - | FIX | Also recurringActiveForWindow, flow legacy income, Reports. Must land before F4 key-compare rewrite. |
| R17 | P2 | effectivePlanCategoryAmountInBase fails open | N | N | L17 | FIX |  |
| Q6 | P2 | SECURITY DEFINER RPCs trust ids/currency (deposit/withdraw/correct/debt/sub/income) | Y 0199 | N | - | FIX | Owns W8. Needs owner check-in before DB apply (PLAN). |

### B2. Money flows UI (pay-debt, deletes+undo, zakat, amount parser, receipts, cards) (37 IDs)

| ID | Sev | Title | Mig | UI/flow | Depends on | Disposition | Note |
|---|---|---|---|---|---|---|---|
| L2 | P1 | sanitizeAmount: "1,250" becomes 1.25, 2-decimal cap blocks KWD/BHD/OMR | N | N | - | FIX | One shared parseLocalizedAmount (last-separator rule, per-currency decimals). Reused by L13, T7, N6, W11. |
| L8 | P2 | Editing a savings/debt-linked income event breaks reversal | N | Y (NOT in DECISIONS) | - | FIX | Lock amount/currency on system-linked events (new locked state in EditIncomeEventSheet). Owner awareness. |
| L9 | P2 | Income swipe-delete has no confirm/undo; last source forces noIncomeDeclared | N | Y (covered by DECISIONS) | D4 | FIX-WITH-DECISION (Deleting linked records (Undo toast for income swipe-delete)) | Also stop forcing noIncomeDeclared when events exist. |
| L10 | P2 | Receipt breakdown/photo unreachable; receipts never deleted | N | Y (covered by DECISIONS) | T3 | FIX-WITH-DECISION (Receipt breakdown + photo) | Wire ReceiptDetailSheet into expense detail/edit, add Arabic keys here, cascade delete receipt row + local image with the expense. ReceiptDetailSheet is NOT deleted. |
| L13 | P2 | AmountReceivedSheet bypasses amount sanitising | N | N | L2 | FIX | Use sanitizeAmount. |
| L14 | P2 | Edit expense leaves occurredAt on old day | N | N | - | FIX |  |
| L15 | P2 | Receipt scan: string amounts "1.250,50" parse wrong, unsupported currencies fall back to base | N | N | L2,I10,I13 | FIX | normaliseReceipt SUPPORTED_CURRENCIES to FIAT list; amount>0 guard shared with I13. |
| L16 | P2 | BNPL split silently skipped / bad first due date | N | Y (NOT in DECISIONS) | - | FIX | Needs visible validation message. |
| L21 | P3 | Edit income event link/unlink inconsistent occurrenceDate | N | N | L8 | FIX |  |
| L25 | P3 | Payday undo re-adds event under new id, drops fields | N | N | L9 | FIX | Restore the original row. |
| W3 | P1 | Withdraw sheet "Move to pocket" ignores selected currency | N | N | W1 | FIX |  |
| W4 | P1 | Withdraw-to-debt can debit pocket with no payment | N | N | - | FIX | Compute amountPaid first, abort before withdraw. |
| W10 | P1 | Zakat "Save" stamps lastPaidDate = now | N | Y (covered by DECISIONS) | W11 | FIX-WITH-DECISION (Zakat) | Save stores calculation only; new "Mark zakat as paid" starts next hawl. |
| W11 | P1 | Zakat inputs freeze live values after focus/blur; Arabic digits zero the line | N | N | T7 | FIX |  |
| W18 | P2 | Zakat sheet hardcodes "EGP" (unit) and English copy | N | N | T3 | FIX | Unit fix here; Arabic copy via T3. |
| W20 | P2 | Deleting a pocket rewrites history, orphans links, no undo | N | Y (NOT in DECISIONS) | - | FIX | Confirm with balance, block or Undo (not in DECISIONS). |
| W21 | P2 | Invest-from-pocket leaves cost basis stale | N | N | - | FIX |  |
| W28 | P3 | Zakat override toggled with empty field saves 0 | N | N | W11 | FIX |  |
| D4 | P1 | Deleting a debt payment leaves its expense; no confirm/undo | N | Y (covered by DECISIONS) | D1 | FIX-WITH-DECISION (Deleting linked records) | Pair delete both ways, confirm for money moves, Undo toast, reactivate schedule. |
| D5 | P1 | Recurring "Confirm paid" double-posts, no feedback, <44px | N | Y (covered by DECISIONS) | - | FIX-WITH-DECISION (Deleting linked records ("Confirm paid" hides after success, ignores second tap)) |  |
| D6 | P1 | Credit-card statement day/min% accept values the DB rejects | N | Y (NOT in DECISIONS) | - | FIX | Inline validation 1-31 / 0-100 in form + mapper. |
| D9 | P1 | Pay-debt prefills debt currency but pays base | N | Y (covered by DECISIONS) | D2 | FIX-WITH-DECISION (Pay debt) | Existing CurrencySheet, default to debt currency (XAU for gold). |
| D11 | P2 | Editing a debt can corrupt balance/state | N | Y (NOT in DECISIONS) | - | FIX | Lock currency/gold when payments exist. |
| D12 | P2 | Card edit "Outstanding" is the opening balance | N | Y (NOT in DECISIONS) | - | FIX | Relabel/compute; statement vs due day. |
| D17 | P2 | Subscription "Mark paid" repeats for weekly plans | N | N | D5 | FIX | Disable after success, cap pay-ahead. |
| I2 | P1 | Buddgy add_expense auto-applies with no tap | N | Y (covered by DECISIONS) | - | FIX-WITH-DECISION (Buddgy add_expense) | Max amount, date +-7 days, 5 auto-adds/min, never after a read-tool hop, then ask for tap. |
| I6 | P2 | Legacy update_expense renames to search hint, unvalidated values | N | N | - | FIX |  |
| I7 | P2 | Legacy fuzzy target matching (empty hint hits first record) | N | Y (NOT in DECISIONS) | - | FIX | Needs disambiguation/recap naming the record. |
| I8 | P2 | Legacy add_expense/add_debt_payment accept any date and amount | N | N | - | FIX | Must land before Q8 constraints. |
| I10 | P2 | Receipt schema currencies/categories narrower than app | N | N | - | FIX |  |
| I13 | P2 | Receipt Save re-entrancy and amount 0 | N | N | - | FIX |  |
| I17 | P3 | normaliseReceipt replaces old/future date with today | N | N | - | FIX | Same file as L15. |
| I19 | P3 | Navigation tools run without consent | N | Y (NOT in DECISIONS) | I2 | FIX | Same hop guard as I2. |
| T1 | P1 | Crypto/gold quantities rounded to whole numbers; BTC shows 0.00 | N | N | - | FIX | Unit-aware quantity formatter. |
| T2 | P1 | sanitizeAmount thousands/decimal (duplicate) | N | N | L2 | DUPLICATE-OF L2 |  |
| T6 | P2 | Negative amounts: symbol before sign | N | N | - | FIX |  |
| T7 | P2 | Arabic keyboard digits rejected/zeroed in inputs | N | N | L2 | FIX |  |

### B3. Privacy + security (DB/auth) (43 IDs)

| ID | Sev | Title | Mig | UI/flow | Depends on | Disposition | Note |
|---|---|---|---|---|---|---|---|
| C1 | P1 | Email 2FA client-side and fails open | Y 0208 | Y (covered by DECISIONS) | C2,C9 | FIX-WITH-DECISION (Password change (2FA enforced by the server)) | Gate in private.app_client_gate or session table; fail closed. Highest-risk item (can lock everyone out). |
| C2 | P1 | trusted_devices self-insert bypasses round-1 fix | Y 0201 | N | - | FIX | Drop policies, revoke grants; also biometric_devices review. |
| C4 | P1 | Android allowBackup=true exposes secrets | N | N | V7 | FIX | allowBackup=false + dataExtractionRules/fullBackupContent. Secure storage move = V7 (B6). |
| C5 | P1 | Password change: no current password, no session revoke, biometric/trusted survive | N | Y (covered by DECISIONS) | C7 | FIX-WITH-DECISION (Password change) | Current password, sign out others, clear biometric + trusted bindings, re-trust this device. |
| C6 | P1 | Account deletion/DSR export miss PII tables | Y 0203 | N | - | FIX | Also covers Q5 (orphan sms_template_users, FKs); table-list diff test. |
| C7 | P2 | Sign-out never revokes refresh token server-side | N | Y (NOT in DECISIONS) | C9 | FIX | supabase-js scope local never calls the server; revoke only this session (REST scope=local) so other devices are not signed out. Never call refreshSession. |
| C8 | P2 | "Remove phone" does not cut off biometric/trusted/session | N | N | C4 | FIX |  |
| C9 | P2 | Global signOut on 2FA login kills other devices | N | N | C1 | FIX |  |
| C11 | P2 | CSV formula injection | N | N | - | FIX | escapeCsvField prefix; shared with R14. |
| C12 | P2 | No self-service full data export | N | Y (NOT in DECISIONS) | C6 | FIX | New user-facing export button not in DECISIONS: build the authenticated route, ask owner before adding the button. |
| C13 | P2 | 2FA toggle off needs no re-auth; OAuth/biometric skip 2FA | N | Y (NOT in DECISIONS) | C1 | FIX |  |
| C14 | P2 | Remember-me off signs out on reload; flag tab-local | N | N | - | FIX |  |
| C16 | P2 | Trusted-device id sent to Sentry as tag | N | N | - | FIX |  |
| C17 | P3 | scrub.ts gaps and quadratic regex | N | N | - | FIX |  |
| C18 | P3 | Device id header unvalidated | N | N | - | FIX |  |
| C19 | P3 | /api/auth/password-updated unauthenticated | N | N | - | FIX |  |
| C22 | P3 | Sensitive routes verify JWT locally only | N | N | - | FIX |  |
| C23 | P3 | Delete ordering/partial success reports ok | N | N | C6 | FIX |  |
| C24 | P3 | analytics_touch/get_sms_keyword_pool/profiles columns hardening | N | N | O10,N24,Q19 | DUPLICATE-OF O10 | Fully covered by O10 + N24 + Q19. |
| I1 | P1 | Global merchant->category memory poisoned by one user | Y 0202 | N | Q16 | FIX | N distinct users to promote, never NON_SPEND, per-user override. DECISIONS silent (plan question): follow report. Prompt-escape part runs in B4 (parse route file). |
| N7 | P2 | sms_ingest_tokens UPDATE policy re-activates revoked tokens | N | N | Q2 | DUPLICATE-OF Q2 |  |
| N24 | P3 | get_sms_keyword_pool executable by anon | Y 0201 | N | Q11 | FIX |  |
| N25 | P3 | anon/authenticated ALL privileges on sms_* tables | N | N | Q11 | DUPLICATE-OF Q11 |  |
| O2 | P1 | Auth email templates editable by emails.manage, no step-up/host allow-list | N | N | - | FIX | Owner step-up for auth scenarios; forbid {{link}}/{{code}} in external URLs. |
| O4 | P2 | users.tools bundles harassment-capable actions, no rate limit | Y 0206 | N | - | FIX | Split permission (role seed), per-staff rate limit. |
| O5 | P2 | Role assignment does not check actor holds role permissions | N | N | - | FIX |  |
| O6 | P2 | Audit gaps (PII reads, notes, before/after) | N | N | - | FIX |  |
| O7 | P2 | Auth email hook not idempotent; no suppression list | N | N | - | FIX |  |
| O8 | P2 | min_app_version typo can lock out everyone | N | N | - | FIX |  |
| O10 | P2 | analytics_touch can be inflated; api_rate_hit scans | Y 0206 | N | - | FIX | Owns C24. |
| O11 | P3 | Plan upsert silently resets status to draft | N | N | - | FIX |  |
| O18 | P3 | Admin session/lockout details, ignored suspend errors | N | N | - | FIX | Session IP/UA binding is a design change: not done. |
| V3 | P1 | Android backup exposes SMS token/queue | N | N | C4 | DUPLICATE-OF C4 |  |
| Q2 | P2 | sms_ingest_tokens owner UPDATE, plaintext tokens | Y 0201 | N | - | FIX | Hashing tokens is long-term, not done. |
| Q3 | P2 | trusted_devices direct insert/update | N | N | C2 | DUPLICATE-OF C2 |  |
| Q4 | P2 | merchant_categories poisoned via client sms_log_id | N | N | I1 | DUPLICATE-OF I1 |  |
| Q5 | P2 | Account deletion leaves rows (no FK) | N | N | C6 | DUPLICATE-OF C6 |  |
| Q7 | P2 | Anonymous sign-ins on; cleanup jobs unscheduled | Y 0207 | N | - | FIX | Schedule cleanup crons. Disabling anonymous sign-ins is a dashboard step (owner). |
| Q8 | P2 | No CHECK constraints on money/dates | Y 0204 | N | I8 | FIX | NOT VALID only; risk of permanently failing client syncs (see D6/L3 pattern). Amount>0 first, date window wide. |
| Q9 | P2 | Link columns without FK | Y 0205 | N | - | FIX | NOT VALID then VALIDATE. |
| Q11 | P3 | anon/authenticated ALL privileges on ~55 tables | Y 0201 | N | - | FIX | Re-grant per table; test every client path. Owns N25. |
| Q16 | P3 | record_sms_template_signal trusts client sms_log_id | Y 0202 | N | I1 | FIX |  |
| Q19 | P3 | Users can delete own profile/settings; column grants | Y 0201 | N | - | FIX |  |

### B4. SMS pipeline + data lifecycle + learning funnel + pattern review (47 IDs)

Order inside the batch: LF1/N5 normaliser first, LF2, LF3 + LF6 (harvest/backfill and masking) BEFORE the N2 purge backfill, N2/N3/N13/N14/N19/Q17, then the rest of N*, D8/N11, LF4/LF5/LF7, PR1 (needs 0209 hold key), PR2 last (owner-side).

| ID | Sev | Title | Mig | UI/flow | Depends on | Disposition | Note |
|---|---|---|---|---|---|---|---|
| D8 | P1 | SMS installment/CC payoff not atomic; overpay; never marks cleared | Y 0210 | N | D1,D2 | FIX | RPC idempotent on sms_log_id; also fixes D21, N11. |
| D21 | P2 | SMS plan fallback list.length===1 / BNPL maybeSingle lookup | N | N | D8 | DUPLICATE-OF D8 |  |
| C3 | P1 | sms_retention cron fails nightly; raw SMS kept | N | N | N2 | DUPLICATE-OF N2 |  |
| I22 | P3 | Gemini key in query string (sms/parse) | N | N | N31 | DUPLICATE-OF N31 |  |
| N1 | P1 | Salary "confirm" decision posts nothing and is marked confirmed | N | Y (NOT in DECISIONS) | - | FIX | awaiting_confirmation=true so /confirm works. 12 ghost rows: audit list for owner approval, no blind write. |
| N2 | P1 | sms-retention cron fails; raw bodies never purged | Y 0209 | N | - | FIX-WITH-DECISION (SMS data lifecycle) | raw_body nullable; class-based purge (7d rejected/OTP, 30d parsed to masked shape, 60d hard cap) in platform_settings; backfill purge; cron failure alert. Owns C3, O3, Q1. |
| N3 | P1 | Rejected/OTP SMS stored in full and sent to Gemini | Y 0209 | N | N2 | FIX-WITH-DECISION (SMS data lifecycle) | Mask OTP digits at ingest; no AI call for pre-filter rejects. |
| N4 | P1 | Android SmsReceiver keyword gate is substring-based | N | N | - | FIX | Word-boundary/digit-adjacent; keep iOS in sync. |
| N5 | P1 | Learner blind to bidi marks and date formats | N | N | - | FIX | Normalise once before hash/regex; extend parseSmsDay. |
| N6 | P1 | European/space-grouped SMS amounts parse wrong | N | N | L2 | FIX | Apply the shared amount parser in templateApply/patterns. |
| N8 | P2 | Twin purchases within ~4 min dropped as duplicates | N | N | - | FIX | Native idempotency key; touches Kotlin/Swift. |
| N9 | P2 | Pairing race fix publishes only kind, not amount/last4 | N | N | - | FIX |  |
| N10 | P2 | Undo of refund/declined SMS deletes original purchase | N | N | - | FIX |  |
| N11 | P2 | Partial post then retry duplicates debt payments; no sms_log_id unique | Y 0210 | N | D8 | FIX | Index must exempt fee rows. |
| N12 | P2 | Queue drain treats "claim in progress" as success | N | N | - | FIX |  |
| N13 | P2 | sms_corpus keeps names redaction misses | Y 0209 | N | N2 | FIX-WITH-DECISION (SMS data lifecycle (masking Arabic/Title-Case)) |  |
| N14 | P2 | learn_status stores learned regex with per-user literals | N | N | - | FIX-WITH-DECISION (SMS data lifecycle (learned regexes must not store per-user literals)) |  |
| N15 | P2 | 10-per-sender cap counts retired rows | N | N | - | FIX |  |
| N16 | P2 | Single hard signal quarantines global template | Y 0211 | N | - | FIX |  |
| N18 | P2 | Sender never verified against matched bank | N | Y (NOT in DECISIONS) | - | FIX | Mismatch routes to awaiting_confirmation. |
| N19 | P2 | Failed attempts accumulate full raw bodies | N | N | N2 | FIX-WITH-DECISION (SMS data lifecycle) |  |
| N20 | P3 | IPN_REFERENCE accepts date digits | N | N | - | FIX |  |
| N21 | P3 | OTP pre-filter false positive on purchase with auth code | N | N | - | FIX |  |
| N22 | P3 | last4 collisions; 3 vs 4 digit mismatch | Y 0211 | N | - | FIX |  |
| N23 | P3 | /sms/health ignores revoked device; setup-token unregistered ids | N | N | - | FIX |  |
| N26 | P3 | sms_heal_stuck misses NULL parsed_at / older rows | Y 0211 | N | - | FIX |  |
| N27 | P3 | sms_parse_today UTC day and parsed_ok only | Y 0211 | N | - | FIX |  |
| N28 | P3 | Correction exemplar trusted from a single user | N | N | - | FIX |  |
| N29 | P3 | SMS >2000 chars rejected forever; Android queue cap evicts | N | N | - | FIX |  |
| N30 | P3 | Android worker maps all 4xx to failure; no backlog age | N | N | - | FIX |  |
| N31 | P3 | Gemini API key in URL query (all calls in parse route) | N | N | - | FIX | Also covers I22 and the I1 prompt-escape part. |
| LF1 | P1 | Strip bidi/format marks and normalise Arabic-Indic digits/separators at ingest and before learner | N | N | N5 | FIX-WITH-DECISION (Addendum LF1) | Shared with N5 root cause (69 of 78 regex failures); one normaliser module used by hash, regex, learner. |
| LF2 | P1 | Learner/applier accept every historical date/time format; no reject on year-less datetime | N | N | N5,LF1 | FIX-WITH-DECISION (Addendum LF2) | 210 gate_capture_unsound failures; extends parseSmsDay (N5). |
| LF3 | P2 | Schedule harvestLegacySms daily (batched) and backfill all history into masked corpus + learner queue before launch | Y 0211 | N | N2,LF6 | FIX-WITH-DECISION (Addendum LF3) | cron.schedule in 0211. Backfill must run before the N2 backfill purge masks raw text. |
| LF4 | P2 | Learner retry by failure class with reason in learn_status; admin coverage view per bank/tier + top unlearned shapes | N | Y (covered by DECISIONS) | LF2,PR1 | FIX-WITH-DECISION (Addendum LF4) | Coverage view = new tab inside PR1 page (admin, no end-user UI). |
| LF5 | P2 | Replay harness: stored masked shapes + golden fixtures against a template before promotion/parser release | N | N | LF3 | FIX-WITH-DECISION (Addendum LF5) | Promotion blocked on regression; hooks into runAdjudication/promotion code. |
| LF6 | P2 | Corpus masking quality (Arabic/Title-Case names, account/phone/ref numbers, amounts); leak scanner over sms_corpus + sms_corrections | Y 0209 | N | N13,N14 | FIX-WITH-DECISION (Addendum LF6) | Same fix family as N13/N14; scanner is a test + admin check. Masked shapes seen <3 times dropped after 180 days (0209). |
| LF7 | P2 | Rejected-but-transactional shapes feed filter tuning as examples; never OTP bodies | N | N | LF3,N3 | FIX-WITH-DECISION (Addendum LF7) |  |
| PR1 | P2 | Admin "Pattern review" page: purge countdown/banner, review pack, Copy review prompt, Mark reviewed with notes; purge hold until reviewed (60-day cap) | Y 0211 | Y (covered by DECISIONS) | N2,LF3,LF6 | FIX-WITH-DECISION (Addendum PR1) | New table sms_pattern_reviews (status, notes, reviewer, period) + platform_settings hold key; purge job in 0209 reads hold. Admin UI reuses AdminShell/adminRouter route, views/SmsView.tsx tab pattern, ui/Panel, DataTable, Kpi, Pill, Field, AdminSheet, StepUp (for Mark reviewed), useAdminAction/adminClient; API route under src/app/api/admin/sms/ guarded sms.view/sms.manage. Review pack = masked, no raw text of other users. |
| PR2 | P3 | Monthly scheduled Claude review on the owner's account (read-only SELECTs, writes report the admin page shows) | N | N | PR1 | FIX-WITH-DECISION (Addendum PR2) | Owner-side setup after PR1 ships (scheduled-tasks tool/desktop app). No repo code beyond PR1 report display. |
| O3 | P1 | sms_retention cron fails (duplicate report) | N | N | N2 | DUPLICATE-OF N2 |  |
| V17 | P3 | drainAndSubmitPendingSms no in-flight guard | N | N | - | FIX | Same files as N12/N29. |
| V18 | P3 | SmsForwardWorker URL outside try; 408/429 terminal | N | N | - | FIX |  |
| V19 | P3 | SmsReceiver forwards OTP/business SMS | N | N | N4 | FIX |  |
| Q1 | P1 | sms_retention fails (duplicate) | N | N | N2 | DUPLICATE-OF N2 |  |
| Q17 | P3 | sms_parse_log failure tail, no pruning | Y 0209 | N | N2 | FIX |  |
| Q18 | P3 | Possible duplicate expenses; no unique on sms_log_id | N | N | N11 | DUPLICATE-OF N11 | Their suggested index would break fee rows; follow N11. |

### B5. Budget / reports / cycle consistency (31 IDs)

| ID | Sev | Title | Mig | UI/flow | Depends on | Disposition | Note |
|---|---|---|---|---|---|---|---|
| L4 | P2 | Late-payday prompts skip previous cycle when monthStartDay>1 | N | N | - | FIX | openPaydays uses cycleKeyFor. |
| L5 | P2 | Flow month nav uses calendar month; no rollover refresh | N | N | R6,R7 | DUPLICATE-OF R6 | (a)=R6, (b)=R7. |
| L6 | P2 | Flow band mixes range and month numbers | N | N | R9 | DUPLICATE-OF R9 | Same useFlowBand defect. |
| D15 | P2 | Paid/due this month ignore monthStartDay | N | N | - | FIX |  |
| R4 | P1 | Reports ignores monthStartDay; Total out counts transfers/ATM/payoff/top-up/savings | N | Y (covered by DECISIONS) | R5 | FIX-WITH-DECISION (Left to spend (Reports Total out)) |  |
| R5 | P1 | Two different "Left to spend" figures | N | Y (covered by DECISIONS) | - | FIX-WITH-DECISION (Left to spend) | Hero = budget minus spent everywhere (Buddgy, AI context, savings sheet); cash flow renamed "Net cash flow". |
| R6 | P1 | Month navigation allows a future cycle when monthStartDay>1 | N | N | - | FIX | cycleKeyFor(new Date(), startDay). |
| R7 | P2 | No month/day rollover refresh | N | N | R6 | FIX | visibilitychange/resume hook. |
| R8 | P2 | Pace shows false "Over" from lumpy bills | N | Y (NOT in DECISIONS) | - | FIX | Changes status chip results. |
| R9 | P2 | Hero stats mix range and month; moneyIn by receivedDate vs occurrenceDate | N | N | R5 | FIX |  |
| R10 | P2 | Reports pace panel not tied to report filter | N | N | - | FIX |  |
| R12 | P2 | Reports chart tooltip drops names; unreadable; hardcoded pie palette | N | Y (NOT in DECISIONS) | - | FIX | Tokens --color-cat-*. |
| R14 | P2 | CSV export dead on native; no BOM; revokeObjectURL; UUID in export | N | N | C11 | FIX | Use downloadOrShareFile; injection part = C11. |
| R15 | P2 | "Saved" bar vs Savings panel mismatch; fail-open | N | Y (NOT in DECISIONS) | L17 | FIX |  |
| R16 | P2 | Hero budget includes "grow" block; month close vs history disagree | N | Y (NOT in DECISIONS) | R5 | FIX | Changes budget totals for plans with a grow line. Confirm with owner. |
| R18 | P2 | Month close is per-device (localStorage) | Y 0212 | N | - | FIX | Sync closed cycles via settings/closeMemory. |
| R19 | P2 | useMonthClose returns null when activeBudgetPlanId null | N | N | R22 | FIX |  |
| R20 | P2 | Budget alerts/widget keyed by viewed month; widget ar-EG digits | N | N | V15 | FIX |  |
| R21 | P2 | Buddgy get_summary passes uncounted debts | N | N | R5 | FIX |  |
| R22 | P2 | planForMonth vs selectActivePlan split | N | N | - | FIX |  |
| R23 | P3 | monthResult "Over by 0" | N | N | - | FIX |  |
| R24 | P3 | recordActivation re-switch duplicates span | N | N | - | FIX |  |
| R25 | P3 | isLearning ignores subcategories/currency | N | N | - | FIX |  |
| R26 | P3 | debtFreeMonth optimistic | N | N | - | FIX |  |
| R27 | P3 | moveBuffer silent when free<=0 | N | Y (NOT in DECISIONS) | - | FIX | Add toast. |
| R28 | P3 | Duplicate plan row names double count | N | N | - | FIX |  |
| R29 | P3 | duplicatePlan drops incomeOverride/household/rationale | N | N | - | FIX |  |
| R33 | P3 | daysLeft for past/future months | N | N | - | FIX |  |
| R34 | P3 | closeBudgetCycle keeps last 24; proposal may break locked minimum | N | N | - | FIX | Defensive guard only. |
| X2 | P2 | Reports "Total money in" vs Flow "Money in" vs Paydays | N | Y (NOT in DECISIONS) | R9 | FIX | Label Expected vs Received; one currency format. |
| X3 | P3 | Reports amounts wrap with symbol stranded | N | N | R12 | FIX |  |

### B6. Native + platform (33 IDs)

| ID | Sev | Title | Mig | UI/flow | Depends on | Disposition | Note |
|---|---|---|---|---|---|---|---|
| C15 | P2 | Privacy policy does not match behaviour | N | Y (covered by DECISIONS) | N2 | FIX-WITH-DECISION (SMS data lifecycle (store acceptance)) | Re-date; add Sentry, Resend, Linear, FCM/APNs, Gemini; SMS retention text must match B4 numbers. |
| C20 | P3 | Apple native sign-in omits nonce | N | N | - | FIX | Depends on plugin nonce support. Verify Apple login on device. |
| C21 | P3 | Biometric/app-lock weaknesses | N | Y (NOT in DECISIONS) | V9 | FIX | Re-lock after background timeout is a flow change (not in DECISIONS); web fallback. |
| C25 | P3 | Push permission asked without pre-prompt | N | Y (NOT in DECISIONS) | - | FIX | New pre-prompt screen (not in DECISIONS). |
| O1 | P1 | Vercel crons appear never to have completed (CRON_SECRET) | N | N | O14 | FIX | Code: startup/health check, deep-health last-cron. Owner action: set CRON_SECRET in Vercel (dashboard-only). |
| O9 | P2 | Notification spam and timing | N | Y (covered by DECISIONS) | C10 | FIX-WITH-DECISION (Notifications) | Hourly cron, 09:00 per user timezone, overdue at day 1/3/7 then weekly (max 6), month-end fix, no double push dedupe. Hourly cron needs Vercel Pro; users with NULL timezone need a fallback. |
| O14 | P3 | Health endpoints cannot see cron/outbox failures | N | N | O1 | FIX |  |
| O17 | P3 | Push token lifecycle (stale, null device_id) | Y 0213 | N | - | FIX | Sweeper in housekeeping. |
| O19 | P3 | Notification route body limits; late users wait 24h | N | N | O9 | FIX |  |
| V1 | P1 | Support/inbox/board/votes use relative /api URLs | N | N | - | FIX | apiFetchAuth in 5 sites. |
| V2 | P1 | useAssetPrices self-heal relative URL | N | N | - | FIX |  |
| V4 | P1 | Web layer needs iOS 16.4; target is 16.0 | N | Y (covered by DECISIONS) | - | FIX-WITH-DECISION (iOS floor) | pbxproj + SPM to 16.4; also rewrite lookbehind regexes in quickAddDate/lexicon/text/parseQuickAdd. |
| V5 | P1 | Info.plist CFBundleVersion literal "6" | N | N | - | FIX | Verified in repo: literal 6. Check last TestFlight archive first, then switch to $(CURRENT_PROJECT_VERSION). |
| V6 | P2 | WebView debugging enabled in release | N | N | - | FIX | NODE_ENV=production in cap sync env; Release xcconfig CAPACITOR_DEBUG=false. |
| V7 | P2 | SMS token / biometric secret / queue stored in plaintext | N | N | C4,N4 | FIX | Keychain/EncryptedSharedPreferences; after B4 (same Swift/Kotlin files). |
| V8 | P2 | READ_SMS declared but unused | N | N | - | FIX-WITH-DECISION (SMS data lifecycle (store acceptance: remove READ_SMS)) |  |
| V9 | P2 | Auth effect re-runs on language change and relocks | N | N | - | FIX |  |
| V10 | P2 | Push token refresh uses stale JWT | N | N | - | FIX |  |
| V11 | P2 | Push-tap routing attached only after sync/decision | N | N | - | FIX |  |
| V12 | P2 | Confirm dialog/menus have no Android back guard | N | N | - | FIX |  |
| V13 | P2 | safeLocalStorage loses data after quota | N | Y (NOT in DECISIONS) | F6 | FIX | Quota banner; memory-first reads. |
| V14 | P2 | iOS AppDelegate missing APNs forwarding | N | N | - | FIX |  |
| V15 | P2 | Dead widget sync writes financial snapshot | N | N | - | FIX | Unmount WidgetSync. |
| V16 | P3 | App.addListener cleanup race leaks listeners | N | N | - | FIX |  |
| V20 | P3 | BootReceiver exported; custom scheme claimable | N | N | - | FIX |  |
| V21 | P3 | Status bar style never follows theme | N | N | - | FIX |  |
| V22 | P3 | Unused speech-recognition plugin and usage string | N | N | Z14 | FIX | Removes dep (Z14 covers other deps). |
| V23 | P3 | No PrivacyInfo.xcprivacy | N | N | - | FIX |  |
| V24 | P3 | App Group config without entitlement; aps-environment check | N | N | V15 | FIX | Remove Preferences.group (widget is dead) or add entitlement. |
| V25 | P3 | No minWebViewVersion; windowSoftInputMode unset | N | N | - | FIX | Keyboard overlap verified in B12 checklist. |
| V26 | P3 | FileProvider broad; scanner pendingCall overwrite; OOM | N | N | - | FIX |  |
| V27 | P3 | sms_confirm push no res.ok; online/offline double source | N | N | - | FIX |  |
| V28 | P3 | armv7 capability; landscape; global touch-action script | N | N | - | FIX |  |

### B7. Dependencies, CI, tests (21 IDs)

| ID | Sev | Title | Mig | UI/flow | Depends on | Disposition | Note |
|---|---|---|---|---|---|---|---|
| Q10 | P3 | Migration ledger gaps | N | N | Z8 | FIX | Ledger rows via execute_sql; do not rename applied files. |
| Z1 | P1 | 35 prod-dependency vulns (next, Capacitor, zod, tar...) | N | N | Z3 | FIX | next 16.4.3, Capacitor 8.5.3, zod 4.6.7. Native shell needs rebuild: only on explicit owner request. |
| Z2 | P1 | pg-backed admin tests never run in CI | N | N | - | FIX |  |
| Z3 | P2 | No npm audit gate or Dependabot | N | N | - | FIX |  |
| Z4 | P2 | Sync layer test asserts nothing | N | N | - | FIX |  |
| Z5 | P2 | No coverage tooling or threshold | N | N | - | FIX | Adds a dev dependency. |
| Z6 | P2 | Untested money/SMS/cron routes | N | N | - | FIX | First three: sms/parse, crons, rpc.ts. |
| Z7 | P2 | Timezone-dependent tests; suite not TZ-pinned | N | N | - | FIX |  |
| Z8 | P2 | Duplicate/gapped migration numbering | N | N | Q10 | FIX | CI uniqueness check for new files only. |
| Z9 | P2 | Env contract undocumented; fail-open middleware | N | N | O1 | FIX |  |
| Z10 | P2 | Live-network eval inside default npm test | N | N | - | FIX |  |
| Z11 | P2 | CI gate thin and after the fact | N | N | - | FIX |  |
| Z12 | P3 | tsconfig leniency | N | N | - | FIX | Low-risk subset only (include/exclude, noFallthrough). |
| Z14 | P3 | Unused/duplicate dependencies | N | N | V22 | FIX | iceberg-js, tw-animate-css; speech-recognition via V22. |
| Z15 | P3 | Version drift | N | N | Z1 | FIX | Patch/minor bumps only. |
| Z16 | P3 | Tracked sensitive files / gitignore gaps | N | N | - | FIX | Firebase key restriction check is owner-side. |
| Z17 | P3 | scripts/ risks (native-release dirty tree, bots) | N | N | - | FIX | Add trap/cleanup only; never run a build. Unloading launchd bot is owner-side. |
| Z18 | P3 | Repo weight (duplicate binaries) | N | N | - | FIX | .vercelignore only. |
| Z19 | P3 | vercel.json/next.config nits | N | N | F3 | FIX | Remove X-XSS-Protection; middleware rename deferred. |
| Z20 | P3 | Test hygiene (time-relative tests, mock-heavy) | N | N | Z7 | FIX |  |
| Z21 | P3 | No engines/.nvmrc/CODEOWNERS; stale CLAUDE.md count | N | N | - | FIX | Report stale CLAUDE.md count to owner; do not edit CLAUDE.md. |

### B8. Performance (18 IDs)

| ID | Sev | Title | Mig | UI/flow | Depends on | Disposition | Note |
|---|---|---|---|---|---|---|---|
| R32 | P3 | PlanHistory/useReportsPage recompute per render | N | N | F4 | FIX |  |
| F1 | P1 | Whole app (~910 KB gz) ships on every route | N | N | F2 | FIX | Constrained: lazy-load the 13 modals/sheets and heavy deps only; keep views static (nav-shell). Gain is smaller than the report estimate. |
| F2 | P2 | zod in main bundle for import JSON | N | N | - | FIX |  |
| F3 | P2 | Root layout headers() nonce makes every page dynamic | N | N | X8 | FIX | Risky (CSP). Restrict to legal/offline route group. |
| F4 | P1 | filterExpensesByMonth date-fns per row, called 2x+ | N | N | R11 | FIX | String key compare; after R11 settles day semantics. |
| F5 | P1 | computeMonthlyStats recomputed 2-4x per route | N | N | F4 | FIX |  |
| F6 | P2 | persist re-serialises whole store; quota overflow | N | N | V13 | FIX | partialize/debounce; persist version migration; high risk. |
| F7 | P2 | Whole-store subscriptions in mounted sheets | N | N | - | FIX |  |
| F8 | P2 | pullAll serial offset paging | Y 0215 | N | - | FIX | Keyset paging + (user_id,id) indexes. |
| F9 | P2 | Realtime WAL poller on sms_parse_log | Y 0215 | N | - | FIX | Verify no subscriber, then drop table from publication. |
| F10 | P2 | app_client_gate adds 35-60 ms per request | Y 0216 | N | C1 | FIX | Must preserve C1 2FA gate and min_app_version logic. Separate migration for easy revert. |
| F11 | P2 | Heavy admin/analytics crons; sms_parse_log seq scans | Y 0215 | N | - | FIX |  |
| F13 | P3 | app_analytics_events spam; analytics_touch slow | Y 0215 | N | O10 | FIX | Preserve O10 caps. |
| F15 | P3 | Oversized PNGs | N | N | - | FIX |  |
| F16 | P3 | Fonts: 16 weight files, Arabic preloaded | N | N | - | FIX |  |
| Q12 | P3 | Hot-path overhead (analytics inserts, gate, realtime, rate-limit cleanup) | Y 0215 | N | F9,F10,F13 | FIX | Unique part: move api_rate_hit cleanup to cron; rest covered by F9/F10/F13. |
| X8 | P3 | React logs script tag in layout head | N | N | F3 | FIX | Same layout.tsx edit as F3. |
| X10 | P3 | /api/rates fetched 8x per load | N | N | - | FIX | Shared in-flight dedupe. |

### B9. i18n, week start, Arabic (21 IDs)

| ID | Sev | Title | Mig | UI/flow | Depends on | Disposition | Note |
|---|---|---|---|---|---|---|---|
| L18 | P3 | Week preset starts Sunday | N | Y (covered by DECISIONS) | T8 | DUPLICATE-OF T8 |  |
| W24 | P3 | Hardcoded English pocket/vault names and cron text | N | N | T16,T12 | DUPLICATE-OF T16 |  |
| R13 | P2 | Reports chart/filter/CSV copy English-only; month names no locale | N | N | T3,T5 | FIX |  |
| R31 | P3 | Budget/reports localization, Arabic-Indic digits, Sunday week | N | N | T5,T8,T13 | FIX |  |
| T3 | P1 | Whole flows have no Arabic (voice, receipt, pocket, zakat, asset form, errors) | N | Y (covered by DECISIONS) | - | FIX-WITH-DECISION (Arabic) | MSA matching existing copy; owner reviews the Arabic list before it ships. Skip files on the B10c delete list. |
| T4 | P2 | Arabic plural forms wrong | N | N | - | FIX | arPlural via Intl.PluralRules. |
| T5 | P2 | Month/weekday names English in Arabic (date-fns no locale) | N | N | - | FIX |  |
| T8 | P2 | Week starts Sunday; Egypt Saturday-first | Y 0217 | Y (covered by DECISIONS) | - | FIX-WITH-DECISION (Week start) | Settings option First day of week; default by timezone applied once. |
| T9 | P2 | Date picker years capped 2035; parallel month tables | N | N | - | FIX |  |
| T10 | P2 | Letter-spacing breaks Arabic joining | N | N | - | FIX | One CSS reset. |
| T11 | P2 | Forced LTR misplaces Arabic punctuation | N | Y (covered by DECISIONS) | X14 | FIX-WITH-DECISION (Arabic (stays LTR)) | Use bidi isolation/plaintext on text blocks, NOT dir=rtl. |
| T12 | P2 | Server notifications English-only for Arabic users | N | N | - | FIX |  |
| T13 | P2 | Arabic-Indic digits leak with ar-EG; device-locale time | N | N | - | FIX |  |
| T14 | P3 | Parallel inline en/ar translation tables (Egyptian dialect) | N | N | - | FIX-WITH-DECISION (Arabic (MSA)) | Migrate COPY tables to dictionaries before B10b merges CurrencyDualSheet. |
| T15 | P3 | Currency symbol/decimal inconsistencies | N | N | T6 | FIX |  |
| T16 | P3 | English-only catalogues in Arabic UI | N | N | - | FIX |  |
| T17 | P3 | Hard-coded aria-labels | N | N | U41 | DUPLICATE-OF U41 |  |
| T20 | P3 | Sorting not locale-aware | N | N | - | FIX |  |
| U41 | P2 | Hard-coded English accessible names (~345 literals) | N | N | T3 | FIX | Owns T17. |
| X12 | P2 | /offline English-only, no retry; lang mismatch | N | Y (NOT in DECISIONS) | T3 | FIX | Retry control is new UI. |
| X14 | P3 | Settings half-mirrored under Arabic | N | Y (covered by DECISIONS) | - | FIX-WITH-DECISION (Arabic (app stays LTR everywhere; settings rows un-mirrored)) |  |

### B10a. Accessibility + tokens (26 IDs)

| ID | Sev | Title | Mig | UI/flow | Depends on | Disposition | Note |
|---|---|---|---|---|---|---|---|
| L20 | P3 | Delete/link only via hidden swipe: no keyboard/screen-reader path | N | Y (NOT in DECISIONS) | U30 | FIX | New visible Delete button in expense/income edit sheets (new UI, not in DECISIONS). |
| U16 | P2 | Hard-coded hex colours in TSX | N | Y (covered by DECISIONS) | R12 | FIX-WITH-DECISION (Accessibility visuals (pale-on-light text to tokens)) | Brand dark surfaces (Landing/Welcome/Lock) stay. |
| U17 | P2 | Colours failing contrast (pointer) | N | N | U24 | DUPLICATE-OF U24 |  |
| U18 | P2 | Buttons under 44px (xs/sm outside admin) | N | Y (covered by DECISIONS) | - | FIX-WITH-DECISION (Accessibility visuals (invisible 44px tap area)) |  |
| U19 | P3 | Switch default size not touch-sized (3) | N | N | - | FIX |  |
| U20 | P3 | Wordmark links 24px, no focus style | N | N | X4 | DUPLICATE-OF X4 |  |
| U21 | P3 | Non-brand Inputs (h-8/h-9/h-10) in forms | N | Y (NOT in DECISIONS) | - | FIX | Small visible height change. |
| U23 | P3 | Arbitrary radii/shadows; raw palette classes | N | N | - | FIX | Fix raw palette classes only; arbitrary radius/shadow sweep deferred to round 3. |
| U24 | P1 | Pale dark-theme colours used on light surfaces | N | Y (covered by DECISIONS) | - | FIX-WITH-DECISION (Accessibility visuals) | Verify surfaces are not always-dark first. |
| U25 | P1 | Focus ring 1.6-2.7:1; inputs no focus border | N | Y (covered by DECISIONS) | - | FIX-WITH-DECISION (Accessibility visuals (ring darkened to 3:1, same neutral hue)) |  |
| U28 | P2 | Category chip text on tint below 4.5 | N | Y (covered by DECISIONS) | - | FIX-WITH-DECISION (Accessibility visuals (category chip tokens nudged)) |  |
| U30 | P1 | ~22 dialogs without accessible name | N | N | U4 | FIX-WITH-DECISION (Sheet headers (every header calls useModalTitleId)) | Hand-rolled titles get useModalTitleId now; B10b then replaces them. |
| U31 | P2 | z-index chaos; toast under nested sheet | N | N | - | FIX | Tokens scale. |
| U32 | P2 | Focus ring convention drift; outline-none without replacement | N | N | U25 | FIX |  |
| U33 | P2 | CSS motion ignores reduced motion | N | N | - | FIX |  |
| U37 | P2 | Backdrop not a button; focus trap leak; no inert | N | N | - | FIX |  |
| U38 | P2 | Form errors not announced; aria-invalid rarely set | N | N | - | FIX |  |
| U39 | P2 | Toast auto-dismiss 2 s, no pause | N | Y (NOT in DECISIONS) | - | FIX | Duration/pause behaviour change. |
| U40 | P2 | BottomNav no aria-label/aria-current | N | N | - | FIX |  |
| U42 | P3 | No h1 on tab pages; heading levels | N | N | X7 | FIX | sr-only h1. |
| U43 | P3 | Labels not associated with inputs | N | N | - | FIX |  |
| U44 | P3 | Sub-44 raw targets, pointer-only handlers | N | N | U18 | FIX |  |
| X4 | P2 | Header logo link unnamed and 24px | N | N | - | FIX | aria-label and 44px hit area; owns U20. |
| X5 | P3 | Touch targets under 44px (measured) | N | N | U18 | DUPLICATE-OF U18 | Re-measure in B12. |
| X7 | P3 | Multiple h1 on notifications/404/legal; /start none | N | N | U42 | FIX |  |
| X18 | P3 | Dark chip/label contrast (9.5-10px) | N | Y (covered by DECISIONS) | U28 | FIX-WITH-DECISION (Accessibility visuals) | Swipe-label part is low confidence. |

### B10b. Component merges (per DECISIONS) (10 IDs)

Order inside the batch: U4 step 1, U5, U6, U7, U9, U10, U11, U15, U4 step 2 (separate commit), U8/U36 LAST.

| ID | Sev | Title | Mig | UI/flow | Depends on | Disposition | Note |
|---|---|---|---|---|---|---|---|
| U4 | P2 | Three sheet headers merged (+~22 hand-rolled titles) | N | Y (covered by DECISIONS) | U30 | FIX-WITH-DECISION (Sheet headers (V3 target, phased)) | Step 1 no visual change; step 2 separate stoppable commit. |
| U5 | P2 | Currency pickers merged (dual prop) | N | Y (covered by DECISIONS) | T14 | FIX-WITH-DECISION (Currency pickers) |  |
| U6 | P2 | Native date inputs replaced by DatePickerField | N | Y (covered by DECISIONS) | T9 | FIX-WITH-DECISION (Date entry) | One small visible change in 3 forms. |
| U7 | P3 | SettingsToggleRow becomes wrapper of SettingsSwitchRow | N | Y (covered by DECISIONS) | - | FIX-WITH-DECISION (Settings rows) |  |
| U9 | P3 | EmptyState extended; six bespoke empties migrated | N | Y (covered by DECISIONS) | T3 | FIX-WITH-DECISION (Empty states) | Additive props only; the 11 existing screens unchanged. |
| U10 | P3 | AuthPasswordField reused by reset-password | N | Y (covered by DECISIONS) | - | FIX-WITH-DECISION (Auth fields) |  |
| U11 | P3 | Money sheet blocks into MoneySheetParts | N | Y (covered by DECISIONS) | L13 | FIX-WITH-DECISION (Money sheet blocks) |  |
| U15 | P3 | Hand-rolled pills to Badge/StatusPill | N | Y (covered by DECISIONS) | - | FIX-WITH-DECISION (Pills) |  |
| U8 | P3 | Debt cards -> DebtCard kind; FlowSummaryBand via HeroBand | N | Y (covered by DECISIONS) | - | FIX-WITH-DECISION (Debt carousel cards (LAST, pixel identical)) | Before/after screenshots; any shift reverts that card. |
| U36 | P3 | Hero rule: Goals/Reports/Income draw own heroes; FlowSummaryBand | N | N | U8 | DUPLICATE-OF U8 | TrophyHero/Reports hero restructure = alert to owner, not done. |

### B10c. Dead code removal (10 IDs)

| ID | Sev | Title | Mig | UI/flow | Depends on | Disposition | Note |
|---|---|---|---|---|---|---|---|
| L22 | P3 | Dead/stale code (orphan comment, unrendered subcategory, isRecurring toggle) | N | N | - | FIX | Remove dead plumbing only; if owner wants subcategory UI it becomes a feature. |
| D22 | P3 | Dead RPC wrappers; live RPCs drift (category, cancel ends_on, trial_end) | Y 0218 | N | D8 | FIX | Delete zero-caller wrappers; drop drifted live RPCs after B4 decides which D8 reuses. Do not wire as-is. |
| R30 | P3 | Dead/duplicated cycle logic (cashflow.ts, budgetUsedPercent, cycle-key helpers) | N | N | - | FIX | Remove dead; merge helpers only if trivial. |
| N17 | P2 | Notification-listener forward path dead and unsafe | N | N | - | FIX | Delete notificationParser.ts. |
| Q13 | P3 | Dead DB objects (ai_tmp_probe, live_market_data, fx_rates, enum leftovers) | Y 0218 | N | - | FIX | Drop ai_tmp_probe now; tables only after row-count SELECT. |
| U1 | P2 | Dead component files (~795 lines) | N | N | - | FIX-WITH-DECISION (Dead code) | ReceiptDetailSheet is NOT deleted (wired in L10). IosSmsSetupClient, RecurringIncomeCard, ProfilePersonalDetailsSection excluded from every earlier batch. |
| U2 | P2 | Dead shadcn primitives (~655 lines) | N | N | - | FIX-WITH-DECISION (Dead code) | tsc is the gate. |
| U3 | P3 | Dead exports/constants (~80 lines) | N | N | - | FIX-WITH-DECISION (Dead code) |  |
| U12 | P3 | Duplicate legal/income/expenses route re-exports | N | N | - | FIX | Verify store listing / external links to /privacy and /terms before deleting. |
| U14 | P3 | One-use wrappers; MoneyDisplay single user | N | N | - | FIX | Inline MoneyDisplay only. |

### B11. Remaining P2/P3 sweep (47 IDs)

| ID | Sev | Title | Mig | UI/flow | Depends on | Disposition | Note |
|---|---|---|---|---|---|---|---|
| L7 | P2 | Amount filter hides everything above 10,000 | N | N | - | FIX | treat max===AMOUNT_MAX as unbounded. |
| L19 | P3 | Flow rows insertion-ordered, not by occurredAt | N | Y (NOT in DECISIONS) | - | FIX | Row order inside a day changes. |
| W19 | P2 | Price freshness vs cron cadence; orphan stock row; BTC/ETH pockets unpriced | N | N | O1,V2 | FIX | Cadence part resolved by O1+V2 (partial duplicate of O1); remaining: self-heal oldest-row logic, BTC/ETH valuation. Dual gold valuation stays a note. |
| W23 | P3 | Net worth trend state not cleared | N | N | - | FIX |  |
| W25 | P3 | Edit sheet lets default carry pocket change type | N | Y (NOT in DECISIONS) | - | FIX |  |
| W26 | P3 | Scheduler month-end drift; hawl 354 days | N | N | - | FIX | Hijri calendar stays out of scope. |
| W27 | P3 | Float rounding, inconsistent tolerances | N | N | - | FIX |  |
| W29 | P3 | DEFAULT_GOLD_PRICE_PER_GRAM=562 after reset | N | N | - | FIX |  |
| D23 | P3 | matchPaymentMethodForExpense substring/closed account fallback | N | N | - | FIX |  |
| D24 | P3 | Brand matcher gaps (Arabic names, Souhoola) | N | N | - | FIX |  |
| D25 | P3 | Subscription mark-paid ignores expenseCategory | N | N | - | FIX |  |
| D26 | P3 | decomposePaymentMethodName drops label | N | N | - | FIX |  |
| D27 | P3 | Recurring debt annual anchor, weekly dueDay, past nextDueDate | N | N | D3 | FIX |  |
| D28 | P3 | ConfirmPaid loading/toast, "+amount" on liability, <44px inbox buttons | N | Y (NOT in DECISIONS) | D5 | FIX | Residual after D5. |
| C10 | P2 | Balance privacy: 2 of 5 surfaces not implemented | N | Y (NOT in DECISIONS) | I5 | FIX | Owner choice: wire server push text + hero masks, or hide dead options. |
| I3 | P1 | Offline voice queue head-of-line blocking | N | Y (NOT in DECISIONS) | - | FIX | Priority first in B11: retry cap, dismiss, TTL. |
| I4 | P2 | hop flag client-controlled bypasses chat limits | N | N | - | FIX | Derive from last message role. |
| I5 | P2 | Privacy mask covers few key names in tool results | N | N | C10 | FIX |  |
| I9 | P2 | Whisper prompt echo makes phantom expense | N | N | - | FIX |  |
| I11 | P2 | Upstream timeouts exceed function budget; reservation unsettled | N | N | - | FIX |  |
| I12 | P2 | Quota-denied 429 shown as Gemini key rate-limit | N | Y (NOT in DECISIONS) | - | FIX | Copy change. |
| I14 | P2 | Payloads exceed 4.5 MB Vercel cap | N | N | - | FIX |  |
| I15 | P3 | Settle under-reports cost on parse failure | N | N | - | FIX |  |
| I16 | P3 | Per-month caps ignore in-flight reservations | N | N | - | FIX |  |
| I18 | P3 | Stream edge cases (SAFETY partial, idle timeout, lost proposals) | N | N | - | FIX |  |
| I20 | P3 | memoryProposals default ON; cap 40; dead learnFromChat | N | Y (NOT in DECISIONS) | - | FIX | Delete dead learnFromChat; default stays unless owner asks. |
| I21 | P3 | Arabic substring intent routing; forced transcribe language | N | N | - | FIX |  |
| I23 | P3 | Legacy prompt entity names unescaped | N | N | - | FIX |  |
| I24 | P3 | /api/ai invalid JSON returns 500 | N | N | - | FIX |  |
| O13 | P3 | AI throttle config writes local disk on serverless | N | N | - | FIX | Move to platform_settings. |
| O15 | P3 | Webhook idempotency/ordering (Sentry, Linear) | N | N | - | FIX |  |
| O16 | P3 | Outbox/Linear duplicate issues; PII in title | N | N | - | FIX |  |
| T18 | P3 | UTC month used for "future" checks in goals | N | N | - | FIX |  |
| Q14 | P3 | Missing/duplicate updated_at triggers | Y 0219 | N | - | FIX |  |
| Q15 | P3 | Tombstone purge vs offline clients; sync_pull unpaginated | Y 0220 | N | - | FIX | needs_full when cursor older than 60 days. |
| U46 | P2 | Delete vs Remove copy mixed | N | Y (NOT in DECISIONS) | - | FIX | Copy change; keep en/ar parity. |
| U47 | P2 | Error tone drift ("Oops") | N | Y (NOT in DECISIONS) | - | FIX |  |
| U48 | P3 | Terminology drift (expense/transaction, saving/savings, plan/budget) | N | Y (NOT in DECISIONS) | - | FIX | Needs owner glossary; default to existing nav terms. |
| U49 | P3 | Vague/developer-voice messages; account enumeration copy | N | Y (NOT in DECISIONS) | - | FIX |  |
| U50 | P3 | Validation timing; CTA hidden while keyboard up | N | Y (NOT in DECISIONS) | - | FIX | Behaviour change on sheets. |
| X1 | P2 | Flow hero big number collides with per-day figure | N | N | - | FIX | Fit-text clamp via additive HeroBand prop, default look unchanged. |
| X6 | P3 | Subscription catalogue images no alt | N | N | - | FIX |  |
| X9 | P3 | useAssetPrices console loop when Supabase not configured | N | N | V2 | FIX |  |
| X11 | P2 | Bare Next.js 404 inside app shell, English-only | N | Y (NOT in DECISIONS) | T3 | FIX | Branded translated page with Back to Flow (new UI, not in DECISIONS). |
| X15 | P3 | Add sheet subtitles truncate; orphan tile | N | Y (NOT in DECISIONS) | - | FIX |  |
| X19 | P3 | Goal with null status invisible in every tab | N | N | - | FIX |  |
| X20 | P3 | Debts card text clipped; they_owe grouping | N | N | - | FIX |  |

### B12. Live UI verification, docs, round-3 backlog (incl. all DEFER items) (24 IDs)

| ID | Sev | Title | Mig | UI/flow | Depends on | Disposition | Note |
|---|---|---|---|---|---|---|---|
| L24 | P3 | Left-to-spend counts unconfirmed paydays as received | N | N | R5 | DEFER: semantic owner call; mostly moot once hero = budget minus spent (R5). Revisit round 3 |  |
| PR3 | P3 | Optional server job using the Anthropic API for hands-off analysis | N | N | PR1 | DEFER: needs Anthropic API key, budget and privacy review (owner decision) |  |
| O12 | P3 | Entitlement edge cases (past_due, null end dates) | N | N | - | DEFER: billing policy not live and entitlements advisory; needs owner policy |  |
| V29 | P3 | Positive checks (no finding) | N | N | - | DEFER: no defect, regression watch only |  |
| T19 | P3 | Delete-account confirmation word stays English | N | N | - | DEFER: intentional friction; revisit with the Arabic review |  |
| F12 | P3 | Index bloat / 52 unused indexes | N | N | - | DEFER: report says do not drop yet (stats window short); revisit round 3 |  |
| F14 | P3 | RLS policy cost verified OK | N | N | - | DEFER: verified OK, no action |  |
| F17 | P3 | Sync snapshot cost verified acceptable | N | N | - | DEFER: verified OK, no action |  |
| F18 | P3 | Serverless config; month-carry cron not scheduled | N | N | W13,W14,W15 | DEFER: month-carry cron unscheduled by owner hold; single region is infra choice |  |
| F19 | P3 | Caching headers verified | N | N | - | DEFER: no issue found |  |
| F20 | P3 | No list virtualisation (not measured) | N | N | - | DEFER: needs browser perf measurement, round 3 |  |
| Q20 | P3 | Backups/PITR/Auth config not verifiable by SQL | N | N | - | DEFER: dashboard-only; owner confirms PITR and Auth settings |  |
| U13 | P3 | SectionLabel primitive for 50 hand-rolled labels | N | N | - | DEFER: new primitive needs owner approval (Component Reuse rule); not in DECISIONS |  |
| U22 | P3 | 31 distinct text-[Npx] sizes, no type tokens | N | N | - | DEFER: large refactor needing token design; round 3 |  |
| U26 | P2 | Field/card boundaries 1.2-1.6:1 | N | Y (NOT in DECISIONS) | - | DEFER: changes every input/card border; not in DECISIONS, owner design call with swatches |  |
| U27 | P2 | text-muted on elevated/sunken below 4.5 | N | Y (NOT in DECISIONS) | U26 | DEFER: token change beyond DECISIONS; decide with U26 |  |
| U29 | P3 | Hero gradient contrast 3.8:1 | N | Y (NOT in DECISIONS) | - | DEFER: hero look change not covered by DECISIONS |  |
| U34 | P3 | Bottom sheets no safe-area padding (verify on device) | N | N | - | DEFER: needs on-device verification (iOS safe-area model uses CSS env) |  |
| U35 | P3 | Stale docs (CLAUDE_CONTEXT tokens, globals comments) | N | N | - | FIX | Docs batch. |
| U45 | P3 | PaydayDetail div onClick (no issue) | N | N | - | DEFER: no defect |  |
| X13 | P3 | /start blank forever in bypass mode | N | N | - | DEFER: dev-bypass artifact; re-test with a real session in B12 |  |
| X16 | P3 | First FAB tap right after load ignored | N | N | - | DEFER: by design 400 ms ghost-click grace; verify on device |  |
| X17 | P3 | Theme default stays light under dark OS | N | N | - | DEFER: matches DESIGN_SYSTEM (Light default); confirm a system option exists |  |
| Z13 | P3 | ESLint presets only | N | N | - | DEFER: type-aware rules cause mass churn; plan separately |  |

## 5. Deferred (23) with reason

| ID | Sev | Reason | Owner/next action |
|---|---|---|---|
| L24 | P3 | semantic owner call; mostly moot once hero = budget minus spent (R5). Revisit round 3 | Re-check after R5 ships |
| PR3 | P3 | needs Anthropic API key, budget and privacy review (owner decision) | Owner decides API key + budget + privacy review |
| O12 | P3 | billing policy not live and entitlements advisory; needs owner policy | Owner billing policy |
| V29 | P3 | no defect, regression watch only | None |
| T19 | P3 | intentional friction; revisit with the Arabic review | Decide with Arabic review |
| F12 | P3 | report says do not drop yet (stats window short); revisit round 3 | Round 3 after longer pg stats |
| F14 | P3 | verified OK, no action | None |
| F17 | P3 | verified OK, no action | None |
| F18 | P3 | month-carry cron unscheduled by owner hold; single region is infra choice | Owner lifts month-carry hold after W13-W15; region is infra |
| F19 | P3 | no issue found | None |
| F20 | P3 | needs browser perf measurement, round 3 | Round 3 browser perf run |
| Q20 | P3 | dashboard-only; owner confirms PITR and Auth settings | Owner confirms PITR/Auth settings in dashboard |
| U13 | P3 | new primitive needs owner approval (Component Reuse rule); not in DECISIONS | Owner approves new primitive |
| U22 | P3 | large refactor needing token design; round 3 | Round 3 type-token design |
| U26 | P2 | changes every input/card border; not in DECISIONS, owner design call with swatches | Owner picks border/muted swatches (U26, U27) |
| U27 | P2 | token change beyond DECISIONS; decide with U26 | With U26 |
| U29 | P3 | hero look change not covered by DECISIONS | Owner hero design call |
| U34 | P3 | needs on-device verification (iOS safe-area model uses CSS env) | On-device check (B12 checklist) |
| U45 | P3 | no defect | None |
| X13 | P3 | dev-bypass artifact; re-test with a real session in B12 | B12 re-test with real session |
| X16 | P3 | by design 400 ms ghost-click grace; verify on device | On-device check |
| X17 | P3 | matches DESIGN_SYSTEM (Light default); confirm a system option exists | Confirm theme "system" option |
| Z13 | P3 | type-aware rules cause mass churn; plan separately | Round 3 lint plan |

Owner-side parts inside FIX rows (not doable from the repo): CRON_SECRET in Vercel (O1), disable anonymous sign-ins (Q7), Play Console declaration + Data Safety + App Privacy label (DT9), Firebase key restriction (Z16), unload linear-bot launchd (Z17), Supabase Auth settings (Q20), PR2 scheduled Claude task after PR1 ships.

## 6. UI/flow changes NOT covered by DECISIONS (follow report; owner should see)

| ID | Batch | Change |
|---|---|---|
| L17 | B1 | Unconvertible foreign expense stored 1:1 as base (fail-open) |
| W1 | B1 | EGP<->XAU conversion treats troy ounces as grams |
| W2 | B1 | Pocket moves carry no account leg: net worth inflated/deflated |
| W6 | B1 | Delete tx clamps balance at 0; ledger and balance diverge |
| W16 | B1 | Goal progress inconsistencies; shared pocket; delete-goal move |
| L8 | B2 | Editing a savings/debt-linked income event breaks reversal |
| L16 | B2 | BNPL split silently skipped / bad first due date |
| W20 | B2 | Deleting a pocket rewrites history, orphans links, no undo |
| D6 | B2 | Credit-card statement day/min% accept values the DB rejects |
| D11 | B2 | Editing a debt can corrupt balance/state |
| D12 | B2 | Card edit "Outstanding" is the opening balance |
| I7 | B2 | Legacy fuzzy target matching (empty hint hits first record) |
| I19 | B2 | Navigation tools run without consent |
| C7 | B3 | Sign-out never revokes refresh token server-side |
| C12 | B3 | No self-service full data export |
| C13 | B3 | 2FA toggle off needs no re-auth; OAuth/biometric skip 2FA |
| N1 | B4 | Salary "confirm" decision posts nothing and is marked confirmed |
| N18 | B4 | Sender never verified against matched bank |
| R8 | B5 | Pace shows false "Over" from lumpy bills |
| R12 | B5 | Reports chart tooltip drops names; unreadable; hardcoded pie palette |
| R15 | B5 | "Saved" bar vs Savings panel mismatch; fail-open |
| R16 | B5 | Hero budget includes "grow" block; month close vs history disagree |
| R27 | B5 | moveBuffer silent when free<=0 |
| X2 | B5 | Reports "Total money in" vs Flow "Money in" vs Paydays |
| C21 | B6 | Biometric/app-lock weaknesses |
| C25 | B6 | Push permission asked without pre-prompt |
| V13 | B6 | safeLocalStorage loses data after quota |
| X12 | B9 | /offline English-only, no retry; lang mismatch |
| L20 | B10a | Delete/link only via hidden swipe: no keyboard/screen-reader path |
| U21 | B10a | Non-brand Inputs (h-8/h-9/h-10) in forms |
| U39 | B10a | Toast auto-dismiss 2 s, no pause |
| L19 | B11 | Flow rows insertion-ordered, not by occurredAt |
| W25 | B11 | Edit sheet lets default carry pocket change type |
| D28 | B11 | ConfirmPaid loading/toast, "+amount" on liability, <44px inbox buttons |
| C10 | B11 | Balance privacy: 2 of 5 surfaces not implemented |
| I3 | B11 | Offline voice queue head-of-line blocking |
| I12 | B11 | Quota-denied 429 shown as Gemini key rate-limit |
| I20 | B11 | memoryProposals default ON; cap 40; dead learnFromChat |
| U46 | B11 | Delete vs Remove copy mixed |
| U47 | B11 | Error tone drift ("Oops") |
| U48 | B11 | Terminology drift (expense/transaction, saving/savings, plan/budget) |
| U49 | B11 | Vague/developer-voice messages; account enumeration copy |
| U50 | B11 | Validation timing; CTA hidden while keyboard up |
| X11 | B11 | Bare Next.js 404 inside app shell, English-only |
| X15 | B11 | Add sheet subtitles truncate; orphan tile |
| U26 | B12 | Field/card boundaries 1.2-1.6:1 |
| U27 | B12 | text-muted on elevated/sunken below 4.5 |
| U29 | B12 | Hero gradient contrast 3.8:1 |

## 7. Fixes that are risky or sit against an owner decision

- C1 (B3): server-side 2FA gate can lock every user out; extend private.app_client_gate behind a rollout flag; F10 (B8) rewrites the same function and must keep it.
- Q8 (B3): CHECK constraints (even NOT VALID) make any later client push of a zero/negative amount or far-future date fail forever, poisoning the batch like L3/D6. Needs I8, D6, L16, L17 first; start with amount>0 only; live rows exist dated 2028/2030/2009 and two zero-amount credit-card debts.
- Q18 (B4): unique expenses(sms_log_id) as suggested collides with transfer-fee rows; follow N11 (exempt fee rows). Q18 is therefore a DUPLICATE of N11.
- W1/W2 (B1): rejecting or re-pricing EGP<->gold moves changes visible behaviour; W2 may need an account picker when no primary tracked account exists (not decided). Owner check-in before DB apply. W7 changes the sync core (client stops writing current_balance): regression risk. D1/D2 repairs match rows by debt_id+date+amount+pm and can mis-link: audit SELECT first, backup tables.
- N2/LF3 (B4): purge is irreversible and retention keeps failing until B4 (4 of 4 runs failed). LF3 backfill into the masked corpus must finish before the backfill purge. Recommend, with owner OK, applying only ALTER raw_body DROP NOT NULL at the start of B3; order was fixed by the owner so not done unasked.
- PR1 (B4): hold until reviewed vs privacy: purge hold is capped at 60 days and the pack is masked; admin page must stay behind sms.view/sms.manage + StepUp for Mark reviewed. PR2 depends on owner computer/app being on; PR3 deferred.
- I1 (B3): the plan question "stop user edits writing the shared table" is not in DECISIONS; ledger follows the report (>=N distinct users, never NON_SPEND, per-user override table = new table).
- T11 (B9): report offers full dir=rtl; DECISIONS says LTR: ledger uses bidi isolation/plaintext only. C7 (B3): report says global sign-out on explicit sign-out, which signs out other devices every time; ledger revokes only the current session server-side.
- T3 (B9): DECISIONS requires owner review of the Arabic list before shipping, which conflicts with auto-push dev+main; hold Arabic keys for sign-off or ship English fallback.
- O9 (B6): hourly cron needs Vercel Pro (Hobby is daily); all 45 user_settings.timezone rows are NULL until the 0192 client reports: UTC fallback needed.
- F3, F6, F10 (B8), V4/V5/Z1 (B6/B7): CSP nonce change, persist partialize (data loss if version migration wrong), app_client_gate rewrite, iOS 16.4 target, Info.plist build number (repo has literal "6" while releases 127-129 reportedly uploaded: verify first), Next 16.4 + Capacitor 8.5.3 bumps (need native rebuild, only on owner request).
- F1 (B8): nav-shell constraint forbids lazy-loading whole views, so the report goal is only partly reachable (sheets, zod, heavy deps).
- R16, R8 (B5): change hero budget totals and Over/On-track results; confirm with owner. L10 vs U1: report calls ReceiptDetailSheet dead, DECISIONS wires it: wired wins, not deleted.
- Q11 (B3): revoking grants can break PostgREST paths; revoke ALL from anon and TRUNCATE/REFERENCES/TRIGGER from authenticated only, then test each client path. Q7: cleanup_abandoned_anon_users deletes users: row-count SELECT first.
- Order hazards: R11 (B1) before F4 (B8); I8 (B2) before Q8 (B3); C1 gate (B3) before F10 (B8); B9 must not translate files B10c deletes; B9 moves COPY tables to dictionaries before B10b merges CurrencyDualSheet.
- Left DEFER, not covered by any decision: U26, U27, U29 (contrast of borders/muted/hero), U13 (new SectionLabel primitive), TrophyHero hero restructure.

## 8. ID to batch index

- Ledger: L1:B1 L2:B2 L3:B1 L4:B5 L5:B5 L6:B5 L7:B11 L8:B2 L9:B2 L10:B2 L11:B1 L12:B1 L13:B2 L14:B2 L15:B2 L16:B2 L17:B1 L18:B9 L19:B11 L20:B10a L21:B2 L22:B10c L23:B1 L24:B12 L25:B2
- Wealth: W1:B1 W2:B1 W3:B2 W4:B2 W5:B1 W6:B1 W7:B1 W8:B1 W9:B1 W10:B2 W11:B2 W12:B1 W13:B1 W14:B1 W15:B1 W16:B1 W17:B1 W18:B2 W19:B11 W20:B2 W21:B2 W22:B1 W23:B11 W24:B9 W25:B11 W26:B11 W27:B11 W28:B2 W29:B11
- Debt: D1:B1 D2:B1 D3:B1 D4:B2 D5:B2 D6:B2 D7:B1 D8:B4 D9:B2 D10:B1 D11:B2 D12:B2 D13:B1 D14:B1 D15:B5 D16:B1 D17:B2 D18:B1 D19:B1 D20:B1 D21:B4 D22:B10c D23:B11 D24:B11 D25:B11 D26:B11 D27:B11 D28:B11
- Budget+reports: R1:B1 R2:B1 R3:B1 R4:B5 R5:B5 R6:B5 R7:B5 R8:B5 R9:B5 R10:B5 R11:B1 R12:B5 R13:B9 R14:B5 R15:B5 R16:B5 R17:B1 R18:B5 R19:B5 R20:B5 R21:B5 R22:B5 R23:B5 R24:B5 R25:B5 R26:B5 R27:B5 R28:B5 R29:B5 R30:B10c R31:B9 R32:B8 R33:B5 R34:B5
- Account+security: C1:B3 C2:B3 C3:B4 C4:B3 C5:B3 C6:B3 C7:B3 C8:B3 C9:B3 C10:B11 C11:B3 C12:B3 C13:B3 C14:B3 C15:B6 C16:B3 C17:B3 C18:B3 C19:B3 C20:B6 C21:B6 C22:B3 C23:B3 C24:B3 C25:B6
- AI: I1:B3 I2:B2 I3:B11 I4:B11 I5:B11 I6:B2 I7:B2 I8:B2 I9:B11 I10:B2 I11:B11 I12:B11 I13:B2 I14:B11 I15:B11 I16:B11 I17:B2 I18:B11 I19:B2 I20:B11 I21:B11 I22:B4 I23:B11 I24:B11
- SMS: N1:B4 N2:B4 N3:B4 N4:B4 N5:B4 N6:B4 N7:B3 N8:B4 N9:B4 N10:B4 N11:B4 N12:B4 N13:B4 N14:B4 N15:B4 N16:B4 N17:B10c N18:B4 N19:B4 N20:B4 N21:B4 N22:B4 N23:B4 N24:B3 N25:B3 N26:B4 N27:B4 N28:B4 N29:B4 N30:B4 N31:B4
- Learning funnel (addendum): LF1:B4 LF2:B4 LF3:B4 LF4:B4 LF5:B4 LF6:B4 LF7:B4
- Pattern review (addendum): PR1:B4 PR2:B4 PR3:B12
- Backend ops: O1:B6 O2:B3 O3:B4 O4:B3 O5:B3 O6:B3 O7:B3 O8:B3 O9:B6 O10:B3 O11:B3 O12:B12 O13:B11 O14:B6 O15:B11 O16:B11 O17:B6 O18:B3 O19:B6
- Native: V1:B6 V2:B6 V3:B3 V4:B6 V5:B6 V6:B6 V7:B6 V8:B6 V9:B6 V10:B6 V11:B6 V12:B6 V13:B6 V14:B6 V15:B6 V16:B6 V17:B4 V18:B4 V19:B4 V20:B6 V21:B6 V22:B6 V23:B6 V24:B6 V25:B6 V26:B6 V27:B6 V28:B6 V29:B12
- i18n: T1:B2 T2:B2 T3:B9 T4:B9 T5:B9 T6:B2 T7:B2 T8:B9 T9:B9 T10:B9 T11:B9 T12:B9 T13:B9 T14:B9 T15:B9 T16:B9 T17:B9 T18:B11 T19:B12 T20:B9
- Performance: F1:B8 F2:B8 F3:B8 F4:B8 F5:B8 F6:B8 F7:B8 F8:B8 F9:B8 F10:B8 F11:B8 F12:B12 F13:B8 F14:B12 F15:B8 F16:B8 F17:B12 F18:B12 F19:B12 F20:B12
- Database: Q1:B4 Q2:B3 Q3:B3 Q4:B3 Q5:B3 Q6:B1 Q7:B3 Q8:B3 Q9:B3 Q10:B7 Q11:B3 Q12:B8 Q13:B10c Q14:B11 Q15:B11 Q16:B3 Q17:B4 Q18:B4 Q19:B3 Q20:B12
- Design system: U1:B10c U2:B10c U3:B10c U4:B10b U5:B10b U6:B10b U7:B10b U8:B10b U9:B10b U10:B10b U11:B10b U12:B10c U13:B12 U14:B10c U15:B10b U16:B10a U17:B10a U18:B10a U19:B10a U20:B10a U21:B10a U22:B12 U23:B10a U24:B10a U25:B10a U26:B12 U27:B12 U28:B10a U29:B12 U30:B10a U31:B10a U32:B10a U33:B10a U34:B12 U35:B12 U36:B10b U37:B10a U38:B10a U39:B10a U40:B10a U41:B9 U42:B10a U43:B10a U44:B10a U45:B12 U46:B11 U47:B11 U48:B11 U49:B11 U50:B11
- Live UI: X1:B11 X2:B5 X3:B5 X4:B10a X5:B10a X6:B11 X7:B10a X8:B8 X9:B11 X10:B8 X11:B11 X12:B9 X13:B12 X14:B9 X15:B11 X16:B12 X17:B12 X18:B10a X19:B11 X20:B11
- Suite/supply chain: Z1:B7 Z2:B7 Z3:B7 Z4:B7 Z5:B7 Z6:B7 Z7:B7 Z8:B7 Z9:B7 Z10:B7 Z11:B7 Z12:B7 Z13:B12 Z14:B7 Z15:B7 Z16:B7 Z17:B7 Z18:B7 Z19:B7 Z20:B7 Z21:B7
