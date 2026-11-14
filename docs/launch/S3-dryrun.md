# S3 dry run: what a repair of the live SMS rows would change

**PROVISIONAL.** Date 2026-11-14. Read-only: **no write was made to the live database** (no INSERT, UPDATE, DELETE, DDL or migration). Every database call was a `SELECT` through the Supabase `execute_sql` tool; the statements are in `scripts/qa/sms-s2c-replay-inputs.sql` and `scripts/qa/s3-live-inputs.sql`. No application code under `src/` was changed. The report must be re-run after the last SMS rule change and before anything is applied (parts 7 and 9).

Rows are cited by the first 8 characters of the log id, users by the first 8 characters of the user id. No personal name, message text, account digits or message figure appears here. Amounts are the stored money amounts of the rows, per user id, in the row's own currency (never converted).

## 0. Summary for the reviewer

- 960 stored messages replayed through today's booking code (46aec162, after the cash-deposit change). 177 differ from the live rows in a way a repair would touch.
- **99 rows are proposed ("apply")**, 58 are **held** for a decision or for evidence the replay cannot see, 20 are **no change** (user-deleted rows, pairs the replay cannot reproduce, three rows booked after the code push).
- Of the 99: 71 are day shifts with no month change except 2 rows; the money-moving ones are 5 collected-notice incomes removed (-7,964.21 SAR income), 3 cash-machine deposits out of income (-1,450.00 SAR) plus one withdrawal row turned transfer, 5 purchases at the user's own wallet turned transfers (-4,282.00 SAR spending), 2 unmatched refunds out of income (-29.23 SAR), one income leg retracted by a new pair (-740.00 SAR), 5 lost rows booked, 2 decline stamps removed (+5.70 USD spending), 1 refund mark moved (net 0).
- **Two default rules should not be applied as written**: the seven "payment via card" rows (the balance check leans the other way, part 6), and the seven purchases carrying a non-spend category (probably the user's own correction, part 3).
- Nothing was promoted; one template passes the replay gate (part 8) but fails the eligibility rule.

## 1. Replay, run again on a fresh export

- Export: `scripts/qa/sms-s2c-replay-inputs.sql` (query A, checksum verified: md5 of all 960 rows equals the database's) saved as `.claude/sms-s2c-replay.json`. Payment methods, debts and own-transfer answers (queries C, D, E) were kept from the export taken earlier today after S2c shipped (re-read today: the same 34 payment-method ids, 7 debt ids and 0 answers). Live money rows (F) and arrival times (G) re-read. Three messages arrived since the S2c export (957 to 960): `04ee053d`, `bee80656`, `d80f99a9`, all created after the S2c code push; they are listed as "no change".
- **Commit replayed: `46aec162`** (origin/main at the time; it contains S2c's cash-deposit change, "transfer from cash, flagged `cash_deposit`", so no overlay was needed for the four deposit rows). Run in a clean detached worktree of that commit so that uncommitted edits in the shared checkout could not leak in. An earlier run on `a76b0d6a` (before the change) gave the same results except the four deposits booked as income.
- Command: `TZ=Africa/Cairo npx vitest run src/lib/sms/gold/closingReplay.test.ts --reporter=verbose` then `TZ=Africa/Cairo npx vitest run -c scripts/qa/s3-vitest.config.ts` (writes `.claude/s3-replay-dump.json`, one entry per message for modes A, B and C) then `python3 scripts/qa/s3-dryrun-report.py` (joins it with `.claude/s3-live.json`, writes `.claude/s3-diff.json` and the tables below).
- Result: 960 exported, 771 dispatched, 184 skipped (172 not a transaction, 7 stored duplicates, 3 failed before parse, 2 no kind or amount), 5 refused as the same capture, 36 flagged `possible_duplicate`. **All eleven closing checks pass in modes A, B and C** (live repayment pairs, the two refund stamps, `9e75b537`, `1ccc2355`, `4a382257`, the four declines, `6e9e1e26`, `572aaf39`, pairs, via-card rows, class totals). 49 of 960 messages change outcome class against the live rows in mode A (closing note: 45 of 957 before the cash-deposit change).
- Modes: A reads a stored `own_transfer` kind as set by code, B as asserted by the model, C restores masked digits to zeros so the wording rules can read them. The report uses A, except the seven via-card rows (C). A and B differ on 5 messages (`2c9dc6b3`, `8a94eede`, `97cbe48e`, `f160ed74`, `ff52e170`: non-spend in A, spending in B). The first four are live non-spend transfers of the wallet user and are not proposed for change; this is the one place where the stored kind's provenance, which the replay cannot see, decides.

## 2. The diff

Decision classes: **apply** (proposed), **hold** (listed with the reason; needs the owner or evidence the replay lacks), **no change**. A row with a strong user-touch signal (part 4) is never "apply". Fields listed are those that would change; `category(info)` and `account(info)` differences (424 messages) are not proposed: the live category and account carry later user and categoriser edits the replay cannot see.

Money effect = proposed minus live, spending and income by currency and month. Spending counts expenses that are neither refunded, excluded nor in a non-spend category (Transfer, CC Payoff, ATM Cash Withdrawal, Installment, Currency Exchange); income counts non-excluded income rows.

### 2.1 Apply, by repair type

| repair type | rows | net money effect (by currency) |
|---|---|---|
| T1 un-reverse (decline stamp removed) | 2 | spend +5.70 USD |
| T11 purchase at own wallet becomes transfer | 5 | spend -4282.00 SAR |
| T15 date: UTC day instead of local day | 71 | income +0.00 EGP; spend +0.00 EGP |
| T2a refund mark moves away | 1 | spend +5000.00 EGP |
| T2b refund mark moves here | 1 | spend -5000.00 EGP |
| T3 collected-notice income removed | 5 | income -7964.21 SAR |
| T4 cash deposit becomes transfer from cash | 4 | income -1450.00 SAR |
| T6 lost row (confirmed, never booked) | 5 | spend +499.05 EGP; income +200.00 SAR; spend +99.99 SAR |
| T7b own net-zero row for a decline or unmatched refund | 2 | none |
| T8 unmatched refund leaves income | 2 | income -29.23 SAR |
| T9 income leg retracted by a new pair | 1 | income -740.00 SAR |

### 2.2 Apply, by user

| user | rows | net money effect (by currency) |
|---|---|---|
| `0c1a609e` | 2 | none |
| `4fce9265` | 35 | income +0.00 EGP; spend +0.00 EGP |
| `6090c8e7` | 2 | spend +5.70 USD |
| `b85f074d` | 2 | spend +499.05 EGP |
| `f923c68b` | 58 | income -9983.44 SAR; spend -4182.01 SAR |

### 2.3 Apply, by user and month (rows with a nonzero effect)

| user | currency | month | spending | income |
|---|---|---|---|---|
| `4fce9265` | EGP | 2026-09 | -310.00 | -155.00 |
| `4fce9265` | EGP | 2026-10 | +310.00 | +155.00 |
| `6090c8e7` | USD | 2026-10 | +5.70 | +0.00 |
| `b85f074d` | EGP | 2026-07 | +499.05 | +0.00 |
| `f923c68b` | SAR | 2026-08 | -1382.01 | -4293.71 |
| `f923c68b` | SAR | 2026-09 | -2800.00 | -4703.39 |
| `f923c68b` | SAR | 2026-10 | +0.00 | -986.34 |

### 2.4 Hold, by repair type (effect if applied)

| repair type | rows | net money effect (by currency) |
|---|---|---|
| T10 non-spend category on a purchase | 7 | spend +3661.78 SAR |
| T15b date differs, not the UTC pattern | 10 | spend +0.00 EGP |
| T16 flag only | 21 | none |
| T2c refund stamp the new rules would not place | 1 | spend +20.40 SAR |
| T5 via-card payment becomes spending | 7 | spend +4481.10 SAR |
| T6a never surfaced (add_failed) | 1 | spend +22.00 SAR |
| T6c income with an equal partner message | 5 | income +692.92 SAR |
| T6d confirmed income with no row | 3 | income +109.55 SAR |
| T6e booked then removed | 2 | income +3.00 EGP |
| T7b own net-zero row for a decline or unmatched refund | 1 | none |

### 2.5 No change, by type

| type | rows | net money effect (by currency) |
|---|---|---|
| B replay-blind pair | 6 | income +8500.00 EGP |
| P post-deploy row (booked by the new code) | 3 | spend -60.00 SAR |
| T15 date: UTC day instead of local day | 1 | none |
| T6 no live row, replay books | 10 | spend +2333.54 EGP; spend +105.74 SAR |

### 2.6 Every row proposed ("apply"), grouped by repair type

| log | user | live state | proposed state | fields | money effect | repair type: reason |
|---|---|---|---|---|---|---|
| `9e75b537` | `f923c68b` | netzero ATM Cash Withdrawal 4000 EGP 2026-08-24 refund<-0fe8887c | nonspend ATM Cash Withdrawal 4000 EGP 2026-08-24 | class, refund mark | none | T1 un-reverse (decline stamp removed): I2: a decline changes only its own row |
| `572aaf39` | `6090c8e7` | netzero Subscription 5.7 USD 2026-10-27 refund<-4a7d7250 | spend Other 5.7 USD 2026-10-27 | class, refund mark | spend +5.7 USD 2026-10 | T1 un-reverse (decline stamp removed): I2: a decline changes only its own row |
| `08ca4f8f` | `f923c68b` | spend Utilities 1020 SAR 2026-08-20 | nonspend Transfer 1020 SAR 2026-08-20 | class | spend -1020 SAR 2026-08 | T11 purchase at own wallet becomes transfer: I3: own_wallet_exact settles alone |
| `101646f0` | `f923c68b` | spend Utilities 1500 SAR 2026-09-01 | nonspend Transfer 1500 SAR 2026-09-01 | class | spend -1500 SAR 2026-09 | T11 purchase at own wallet becomes transfer: I3: own_wallet_exact settles alone |
| `170910a1` | `f923c68b` | spend Utilities 560 SAR 2026-09-02 | nonspend Transfer 560 SAR 2026-09-02 | class | spend -560 SAR 2026-09 | T11 purchase at own wallet becomes transfer: I3: own_wallet_exact settles alone |
| `42136093` | `f923c68b` | spend Utilities 740 SAR 2026-09-02 | nonspend Transfer 740 SAR 2026-09-02 | class, pairing | spend -740 SAR 2026-09 | T11 purchase at own wallet becomes transfer: I3: own_wallet_exact settles alone |
| `8eb8cbf1` | `f923c68b` | spend Utilities 462 SAR 2026-08-03 | nonspend Transfer 462 SAR 2026-08-03 | class | spend -462 SAR 2026-08 | T11 purchase at own wallet becomes transfer: I3: own_wallet_exact settles alone |
| `737c4e4c` | `0c1a609e` | spend Other 0.49 EGP 2026-09-02 | spend Utilities 0.49 EGP 2026-09-03 | date | none | T15 date: UTC day instead of local day: P3-3: the stored day was the UTC day of the arrival, the local day differs |
| `964329e2` | `0c1a609e` | spend Other 0.66 EGP 2026-08-04 | spend Utilities 0.66 EGP 2026-08-05 | date | none | T15 date: UTC day instead of local day: P3-3: the stored day was the UTC day of the arrival, the local day differs |
| `02370960` | `f923c68b` | income income other 6 SAR 2026-09-16 | income income other 6 SAR 2026-09-17 | date | none | T15 date: UTC day instead of local day: P3-3: the stored day was the UTC day of the arrival, the local day differs |
| `0e268220` | `f923c68b` | spend Utilities 815 SAR 2026-10-21 | spend Utilities 815 SAR 2026-10-22 | date | none | T15 date: UTC day instead of local day: P3-3: the stored day was the UTC day of the arrival, the local day differs |
| `1bc06eff` | `f923c68b` | spend Subscription 22.79 SAR 2026-09-17 | spend Subscription 22.79 SAR 2026-09-18 | date | none | T15 date: UTC day instead of local day: P3-3: the stored day was the UTC day of the arrival, the local day differs |
| `1f227acd` | `f923c68b` | income income other 182.46 SAR 2026-10-21 | income income other 182.46 SAR 2026-10-22 | date | none | T15 date: UTC day instead of local day: P3-3: the stored day was the UTC day of the arrival, the local day differs |
| `2696fffc` | `f923c68b` | spend Remittance 986.11 SAR 2026-10-21 | spend Remittance 986.11 SAR 2026-10-22 | date | none | T15 date: UTC day instead of local day: P3-3: the stored day was the UTC day of the arrival, the local day differs |
| `2d489411` | `f923c68b` | income income other 490 SAR 2026-09-06 | income income other 490 SAR 2026-09-07 | date | none | T15 date: UTC day instead of local day: P3-3: the stored day was the UTC day of the arrival, the local day differs |
| `38273fe0` | `f923c68b` | spend Utilities 1.27 SAR 2026-09-22 | spend Utilities 1.27 SAR 2026-09-23 | date | none | T15 date: UTC day instead of local day: P3-3: the stored day was the UTC day of the arrival, the local day differs |
| `418baa26` | `f923c68b` | income income other 11 SAR 2026-10-24 | income income other 11 SAR 2026-10-25 flags=possible_duplicate | date, flags | none | T15 date: UTC day instead of local day: P3-3: the stored day was the UTC day of the arrival, the local day differs |
| `43df3d24` | `f923c68b` | spend Utilities 84.99 SAR 2026-07-27 | spend Utilities 84.99 SAR 2026-07-28 | date | none | T15 date: UTC day instead of local day: P3-3: the stored day was the UTC day of the arrival, the local day differs |
| `5b82b8d1` | `f923c68b` | income income other 500 SAR 2026-09-23 | income income other 500 SAR 2026-09-24 | date | none | T15 date: UTC day instead of local day: P3-3: the stored day was the UTC day of the arrival, the local day differs |
| `5d996a3d` | `f923c68b` | spend Other 16.99 SAR 2026-07-27 | spend Utilities 16.99 SAR 2026-07-28 | date | none | T15 date: UTC day instead of local day: P3-3: the stored day was the UTC day of the arrival, the local day differs |
| `5f30dca3` | `f923c68b` | spend Food 43.05 SAR 2026-09-14 | spend Food 43.05 SAR 2026-09-15 | date | none | T15 date: UTC day instead of local day: P3-3: the stored day was the UTC day of the arrival, the local day differs |
| `603fea1a` | `f923c68b` | income income other 529 SAR 2026-08-02 | income income other 529 SAR 2026-08-03 | date | none | T15 date: UTC day instead of local day: P3-3: the stored day was the UTC day of the arrival, the local day differs |
| `62f1ee29` | `f923c68b` | spend Food 70 SAR 2026-09-21 | spend Food 70 SAR 2026-09-22 | date | none | T15 date: UTC day instead of local day: P3-3: the stored day was the UTC day of the arrival, the local day differs |
| `7d938107` | `f923c68b` | income income other 1.27 SAR 2026-09-22 | income income other 1.27 SAR 2026-09-23 | date | none | T15 date: UTC day instead of local day: P3-3: the stored day was the UTC day of the arrival, the local day differs |
| `8a94eede` | `f923c68b` | nonspend Transfer 225.1 SAR 2026-07-27 | nonspend Transfer 225.1 SAR 2026-07-28 | date | none | T15 date: UTC day instead of local day: P3-3: the stored day was the UTC day of the arrival, the local day differs |
| `9006ea5e` | `f923c68b` | spend Utilities 527 EGP 2026-09-21 | spend Utilities 527 EGP 2026-09-22 | date | none | T15 date: UTC day instead of local day: P3-3: the stored day was the UTC day of the arrival, the local day differs |
| `91e00bb4` | `f923c68b` | spend Food 55 SAR 2026-08-07 | spend Food 55 SAR 2026-08-08 | date | none | T15 date: UTC day instead of local day: P3-3: the stored day was the UTC day of the arrival, the local day differs |
| `9684468b` | `f923c68b` | spend Food 66 SAR 2026-10-20 | spend Food 66 SAR 2026-10-21 | date | none | T15 date: UTC day instead of local day: P3-3: the stored day was the UTC day of the arrival, the local day differs |
| `9c9c11e5` | `f923c68b` | spend Utilities 138 SAR 2026-09-16 | spend Utilities 138 SAR 2026-09-17 | date | none | T15 date: UTC day instead of local day: P3-3: the stored day was the UTC day of the arrival, the local day differs |
| `9d4ba02e` | `f923c68b` | spend Utilities 500 SAR 2026-09-23 | spend Utilities 500 SAR 2026-09-24 | date | none | T15 date: UTC day instead of local day: P3-3: the stored day was the UTC day of the arrival, the local day differs |
| `a16812c9` | `f923c68b` | spend Subscription 1.49 SAR 2026-08-05 | spend Subscription 1.49 SAR 2026-08-06 | date | none | T15 date: UTC day instead of local day: P3-3: the stored day was the UTC day of the arrival, the local day differs |
| `bed3bd49` | `f923c68b` | spend Remittance 1989.54 SAR 2026-08-02 | spend Remittance 1989.54 SAR 2026-08-03 | date | none | T15 date: UTC day instead of local day: P3-3: the stored day was the UTC day of the arrival, the local day differs |
| `c4ff2489` | `f923c68b` | spend Food 29.1 SAR 2026-08-02 | spend Food 29.1 SAR 2026-08-03 | date | none | T15 date: UTC day instead of local day: P3-3: the stored day was the UTC day of the arrival, the local day differs |
| `c923b3eb` | `f923c68b` | income income other 300 SAR 2026-07-28 | income income other 300 SAR 2026-07-29 | date | none | T15 date: UTC day instead of local day: P3-3: the stored day was the UTC day of the arrival, the local day differs |
| `d45ec5c8` | `f923c68b` | spend Other 130 SAR 2026-09-11 | spend Other 130 SAR 2026-09-12 | date | none | T15 date: UTC day instead of local day: P3-3: the stored day was the UTC day of the arrival, the local day differs |
| `d88c2d29` | `f923c68b` | income income other 250 SAR 2026-10-24 | income income other 250 SAR 2026-10-25 | date | none | T15 date: UTC day instead of local day: P3-3: the stored day was the UTC day of the arrival, the local day differs |
| `ded7b224` | `f923c68b` | spend Shopping 5 SAR 2026-10-21 | spend Other 5 SAR 2026-10-22 | date | none | T15 date: UTC day instead of local day: P3-3: the stored day was the UTC day of the arrival, the local day differs |
| `e7d07863` | `f923c68b` | income income other 1449.91 SAR 2026-08-02 | income income other 1449.91 SAR 2026-08-03 | date | none | T15 date: UTC day instead of local day: P3-3: the stored day was the UTC day of the arrival, the local day differs |
| `e97c0b1c` | `f923c68b` | spend Other 75 SAR 2026-09-19 | spend Other 75 SAR 2026-09-20 | date | none | T15 date: UTC day instead of local day: P3-3: the stored day was the UTC day of the arrival, the local day differs |
| `f2fd7bca` | `f923c68b` | spend Utilities 16.99 SAR 2026-07-27 | spend Utilities 16.99 SAR 2026-07-28 | date | none | T15 date: UTC day instead of local day: P3-3: the stored day was the UTC day of the arrival, the local day differs |
| `f41cd3f6` | `f923c68b` | spend Shopping 55.38 SAR 2026-08-09 | spend Other 55.38 SAR 2026-08-10 | date | none | T15 date: UTC day instead of local day: P3-3: the stored day was the UTC day of the arrival, the local day differs |
| `f53ec0e1` | `f923c68b` | spend Utilities 23 SAR 2026-09-16 | spend Utilities 23 SAR 2026-09-17 | date | none | T15 date: UTC day instead of local day: P3-3: the stored day was the UTC day of the arrival, the local day differs |
| `f725fe98` | `f923c68b` | spend Remittance 105.74 SAR 2026-09-22 | spend Remittance 105.74 SAR 2026-09-23 | date | none | T15 date: UTC day instead of local day: P3-3: the stored day was the UTC day of the arrival, the local day differs |
| `fe9b02c1` | `f923c68b` | income income other 815 SAR 2026-10-21 | income income other 815 SAR 2026-10-22 flags=possible_duplicate | date, flags | none | T15 date: UTC day instead of local day: P3-3: the stored day was the UTC day of the arrival, the local day differs |
| `ff197921` | `f923c68b` | spend Utilities 490 SAR 2026-09-06 | spend Utilities 490 SAR 2026-09-07 | date | none | T15 date: UTC day instead of local day: P3-3: the stored day was the UTC day of the arrival, the local day differs |
| `009635ef` | `4fce9265` | income income other 1500 EGP 2026-09-09 | income income other 1500 EGP 2026-09-10 | date | none | T15 date: UTC day instead of local day: P3-3: the stored day was the UTC day of the arrival, the local day differs |
| `052776ad` | `4fce9265` | income income other 220 EGP 2026-08-05 | income income other 220 EGP 2026-08-06 | date | none | T15 date: UTC day instead of local day: P3-3: the stored day was the UTC day of the arrival, the local day differs |
| `0b411178` | `4fce9265` | income income other 260 EGP 2026-09-15 | income income other 260 EGP 2026-09-16 | date | none | T15 date: UTC day instead of local day: P3-3: the stored day was the UTC day of the arrival, the local day differs |
| `0f303bf6` | `4fce9265` | spend Instapay 1500 EGP 2026-09-09 | spend Instapay 1500 EGP 2026-09-10 | date | none | T15 date: UTC day instead of local day: P3-3: the stored day was the UTC day of the arrival, the local day differs |
| `1271e1f5` | `4fce9265` | spend Instapay 1500 EGP 2026-09-09 | spend Instapay 1500 EGP 2026-09-10 flags=possible_duplicate | date, flags | none | T15 date: UTC day instead of local day: P3-3: the stored day was the UTC day of the arrival, the local day differs |
| `15195109` | `4fce9265` | income income other 1500 EGP 2026-09-09 | income income other 1500 EGP 2026-09-10 | date | none | T15 date: UTC day instead of local day: P3-3: the stored day was the UTC day of the arrival, the local day differs |
| `1d5deffc` | `4fce9265` | income income other 1500 EGP 2026-09-09 | income income other 1500 EGP 2026-09-10 flags=possible_duplicate | date, flags | none | T15 date: UTC day instead of local day: P3-3: the stored day was the UTC day of the arrival, the local day differs |
| `223b708e` | `4fce9265` | income income other 1500 EGP 2026-09-09 | income income other 1500 EGP 2026-09-10 flags=possible_duplicate | date, flags | none | T15 date: UTC day instead of local day: P3-3: the stored day was the UTC day of the arrival, the local day differs |
| `267addad` | `4fce9265` | spend Instapay 1500 EGP 2026-09-09 | spend Instapay 1500 EGP 2026-09-10 | date | none | T15 date: UTC day instead of local day: P3-3: the stored day was the UTC day of the arrival, the local day differs |
| `37236069` | `4fce9265` | spend Instapay 95 EGP 2026-10-03 | spend Instapay 95 EGP 2026-10-04 | date | none | T15 date: UTC day instead of local day: P3-3: the stored day was the UTC day of the arrival, the local day differs |
| `38960cf2` | `4fce9265` | income income other 1500 EGP 2026-09-09 | income income other 1500 EGP 2026-09-10 | date | none | T15 date: UTC day instead of local day: P3-3: the stored day was the UTC day of the arrival, the local day differs |
| `39420937` | `4fce9265` | spend Instapay 1500 EGP 2026-09-09 | spend Instapay 1500 EGP 2026-09-10 | date | none | T15 date: UTC day instead of local day: P3-3: the stored day was the UTC day of the arrival, the local day differs |
| `3a49147e` | `4fce9265` | spend Instapay 700 EGP 2026-09-28 | spend Instapay 700 EGP 2026-09-29 | date | none | T15 date: UTC day instead of local day: P3-3: the stored day was the UTC day of the arrival, the local day differs |
| `3c150811` | `4fce9265` | income income other 2635 EGP 2026-10-14 | income income other 2635 EGP 2026-10-15 | date | none | T15 date: UTC day instead of local day: P3-3: the stored day was the UTC day of the arrival, the local day differs |
| `4cbd056b` | `4fce9265` | spend Instapay 1000 EGP 2026-08-20 | spend Instapay 1000 EGP 2026-08-21 | date | none | T15 date: UTC day instead of local day: P3-3: the stored day was the UTC day of the arrival, the local day differs |
| `51f55912` | `4fce9265` | spend Instapay 1500 EGP 2026-09-09 | spend Instapay 1500 EGP 2026-09-10 flags=possible_duplicate | date, flags | none | T15 date: UTC day instead of local day: P3-3: the stored day was the UTC day of the arrival, the local day differs |
| `56dfbf6d` | `4fce9265` | spend Instapay 1500 EGP 2026-09-09 | spend Instapay 1500 EGP 2026-09-10 | date | none | T15 date: UTC day instead of local day: P3-3: the stored day was the UTC day of the arrival, the local day differs |
| `5ab3bd01` | `4fce9265` | spend Instapay 150 EGP 2026-09-25 | spend Instapay 150 EGP 2026-09-26 | date | none | T15 date: UTC day instead of local day: P3-3: the stored day was the UTC day of the arrival, the local day differs |
| `5bdc7499` | `4fce9265` | spend Instapay 1500 EGP 2026-09-09 | spend Instapay 1500 EGP 2026-09-10 flags=possible_duplicate | date, flags | none | T15 date: UTC day instead of local day: P3-3: the stored day was the UTC day of the arrival, the local day differs |
| `6321e500` | `4fce9265` | income income other 1500 EGP 2026-09-09 | income income other 1500 EGP 2026-09-10 flags=possible_duplicate | date, flags | none | T15 date: UTC day instead of local day: P3-3: the stored day was the UTC day of the arrival, the local day differs |
| `77ee02f0` | `4fce9265` | spend Instapay 1500 EGP 2026-09-09 | spend Instapay 1500 EGP 2026-09-10 flags=possible_duplicate | date, flags | none | T15 date: UTC day instead of local day: P3-3: the stored day was the UTC day of the arrival, the local day differs |
| `8ad101f4` | `4fce9265` | spend Instapay 1500 EGP 2026-09-09 | spend Instapay 1500 EGP 2026-09-10 flags=possible_duplicate | date, flags | none | T15 date: UTC day instead of local day: P3-3: the stored day was the UTC day of the arrival, the local day differs |
| `97fca7d5` | `4fce9265` | spend Instapay 1500 EGP 2026-09-09 | spend Instapay 1500 EGP 2026-09-10 flags=possible_duplicate | date, flags | none | T15 date: UTC day instead of local day: P3-3: the stored day was the UTC day of the arrival, the local day differs |
| `ab14b78e` | `4fce9265` | income income other 4396 EGP 2026-09-16 | income income other 4396 EGP 2026-09-17 | date | none | T15 date: UTC day instead of local day: P3-3: the stored day was the UTC day of the arrival, the local day differs |
| `ab5411e0` | `4fce9265` | income income other 1500 EGP 2026-09-09 | income income other 1500 EGP 2026-09-10 flags=possible_duplicate | date, flags | none | T15 date: UTC day instead of local day: P3-3: the stored day was the UTC day of the arrival, the local day differs |
| `ad65a2d0` | `4fce9265` | income income other 220 EGP 2026-10-15 | income income other 220 EGP 2026-10-16 | date | none | T15 date: UTC day instead of local day: P3-3: the stored day was the UTC day of the arrival, the local day differs |
| `b45c86b1` | `4fce9265` | spend Instapay 600 EGP 2026-09-16 | spend Instapay 600 EGP 2026-09-17 | date | none | T15 date: UTC day instead of local day: P3-3: the stored day was the UTC day of the arrival, the local day differs |
| `bdc14d28` | `4fce9265` | income income other 1500 EGP 2026-09-09 | income income other 1500 EGP 2026-09-10 flags=possible_duplicate | date, flags | none | T15 date: UTC day instead of local day: P3-3: the stored day was the UTC day of the arrival, the local day differs |
| `d6a4de7d` | `4fce9265` | income income other 27000 EGP 2026-08-06 | income income other 27000 EGP 2026-08-07 | date | none | T15 date: UTC day instead of local day: P3-3: the stored day was the UTC day of the arrival, the local day differs |
| `e9a89f51` | `4fce9265` | spend Instapay 310 EGP 2026-09-30 | spend Instapay 310 EGP 2026-10-01 | date | spend -310 EGP 2026-09; spend +310 EGP 2026-10 | T15 date: UTC day instead of local day: P3-3: the stored day was the UTC day of the arrival, the local day differs |
| `e9b96491` | `4fce9265` | spend Utilities 315.6 EGP 2026-09-18 | spend Utilities 315.6 EGP 2026-09-19 | date | none | T15 date: UTC day instead of local day: P3-3: the stored day was the UTC day of the arrival, the local day differs |
| `f1c965f0` | `4fce9265` | income income other 155 EGP 2026-09-30 | income income other 155 EGP 2026-10-01 | date | income -155 EGP 2026-09; income +155 EGP 2026-10 | T15 date: UTC day instead of local day: P3-3: the stored day was the UTC day of the arrival, the local day differs |
| `f7ca66eb` | `4fce9265` | spend Instapay 75 EGP 2026-09-29 | spend Instapay 75 EGP 2026-09-30 | date | none | T15 date: UTC day instead of local day: P3-3: the stored day was the UTC day of the arrival, the local day differs |
| `bfe884e3` | `4fce9265` | netzero Instapay 5000 EGP 2026-10-06 refund<-baab5343 | spend Instapay 5000 EGP 2026-10-06 | class, refund mark | spend +5000 EGP 2026-10 | T2a refund mark moves away: I1 rule (b): the same refund matches another row first (same account, same amount, 15 minutes) |
| `e8b0e3ed` | `4fce9265` | spend Instapay 5000 EGP 2026-10-07 | netzero Instapay 5000 EGP 2026-10-07 refund<-baab5343 | class, refund mark | spend -5000 EGP 2026-10 | T2b refund mark moves here: I1 rule (b): same account, same amount, 15 minutes |
| `4b5d53d7` | `f923c68b` | income income other 1004.17 SAR 2026-08-13 | none | class | income -1004.17 SAR 2026-08 | T3 collected-notice income removed: I3: a "collected" notice is not a transaction |
| `65921ad1` | `f923c68b` | income income other 1989.54 SAR 2026-08-04 | none | class | income -1989.54 SAR 2026-08 | T3 collected-notice income removed: I3: a "collected" notice is not a transaction |
| `93e7ec95` | `f923c68b` | income income other 1989.76 SAR 2026-09-15 | none | class | income -1989.76 SAR 2026-09 | T3 collected-notice income removed: I3: a "collected" notice is not a transaction |
| `cb25279f` | `f923c68b` | income income other 1994.63 SAR 2026-09-03 | none | class | income -1994.63 SAR 2026-09 | T3 collected-notice income removed: I3: a "collected" notice is not a transaction |
| `d35340ff` | `f923c68b` | income income other 986.11 SAR 2026-10-22 | none | class | income -986.11 SAR 2026-10 | T3 collected-notice income removed: I3: a "collected" notice is not a transaction |
| `0812aa55` | `f923c68b` | income income other 50 SAR 2026-09-21 | nonspend Transfer 50 SAR 2026-09-21 flags=cash_deposit | class, flags | income -50 SAR 2026-09 | T4 cash deposit becomes transfer from cash: council verdict (46aec162): neither income nor spending, a transfer from Cash, flagged cash_deposit |
| `78e0b305` | `f923c68b` | income income other 700 SAR 2026-08-10 | nonspend Transfer 700 SAR 2026-08-10 flags=possible_duplicate,cash_deposit | class, flags | income -700 SAR 2026-08 | T4 cash deposit becomes transfer from cash: council verdict (46aec162): neither income nor spending, a transfer from Cash, flagged cash_deposit |
| `818b0736` | `f923c68b` | nonspend ATM Cash Withdrawal 1150 SAR 2026-09-21 | nonspend Transfer 1150 SAR 2026-09-21 flags=cash_deposit | flags | none | T4 cash deposit becomes transfer from cash: council verdict (46aec162): neither income nor spending, a transfer from Cash, flagged cash_deposit |
| `cb5fd476` | `f923c68b` | income income other 700 SAR 2026-08-10 | nonspend Transfer 700 SAR 2026-08-10 flags=cash_deposit | class, flags | income -700 SAR 2026-08 | T4 cash deposit becomes transfer from cash: council verdict (46aec162): neither income nor spending, a transfer from Cash, flagged cash_deposit |
| `540077ff` | `f923c68b` | none | spend Subscription 99.99 SAR 2026-08-10 | class | spend +99.99 SAR 2026-08 | T6 lost row (confirmed, never booked): P3-4: book it (the claim returned 409 to the twin, or the answer was lost) |
| `916e58d4` | `f923c68b` | none | income income other 100 SAR 2026-09-11 | class | income +100 SAR 2026-09 | T6 lost row (confirmed, never booked): P3-4: book it (the claim returned 409 to the twin, or the answer was lost) |
| `acbe9dd7` | `f923c68b` | none | income income other 100 SAR 2026-08-13 | class | income +100 SAR 2026-08 | T6 lost row (confirmed, never booked): P3-4: book it (the claim returned 409 to the twin, or the answer was lost) |
| `ad8523cb` | `b85f074d` | none | nonspend ATM Cash Withdrawal 1000 EGP 2026-07-12 | class | none | T6 lost row (confirmed, never booked): P3-4: book it (the claim returned 409 to the twin, or the answer was lost) |
| `fa2a8ec2` | `b85f074d` | none | spend Other 499.05 EGP 2026-07-13 | class | spend +499.05 EGP 2026-07 | T6 lost row (confirmed, never booked): P3-4: book it (the claim returned 409 to the twin, or the answer was lost) |
| `0fe8887c` | `f923c68b` | none | netzero Other 4000 EGP 2026-09-09 refund<-0fe8887c | class | none | T7b own net-zero row for a decline or unmatched refund: I2 and refund rule: books one net-zero row of its own (no money effect) |
| `4a7d7250` | `6090c8e7` | none | netzero Other 5.7 USD 2026-10-27 refund<-4a7d7250 | class | none | T7b own net-zero row for a decline or unmatched refund: I2 and refund rule: books one net-zero row of its own (no money effect) |
| `a19ff882` | `f923c68b` | income income refund 0.23 SAR 2026-10-21 | netzero Other 0.23 SAR 2026-10-21 refund<-a19ff882 flags=refund_unmatched | class, refund mark, flags | income -0.23 SAR 2026-10 | T8 unmatched refund leaves income: I1 and refund rule: no match, so outside income and spending, flagged refund_unmatched |
| `ec6ae237` | `f923c68b` | income income refund 29 SAR 2026-09-03 | netzero Other 29 SAR 2026-09-03 refund<-ec6ae237 flags=refund_unmatched | class, refund mark, flags | income -29 SAR 2026-09 | T8 unmatched refund leaves income: I1 and refund rule: no match, so outside income and spending, flagged refund_unmatched |
| `858f6536` | `f923c68b` | income income other 740 SAR 2026-09-02 | none | class, pairing | income -740 SAR 2026-09 | T9 income leg retracted by a new pair: I1 exception 2: pairing retracts the other leg |

### 2.7 Every row held

| log | user | live state | proposed state | fields | money effect | repair type: reason |
|---|---|---|---|---|---|---|
| `388b74fb` | `f923c68b` | nonspend Transfer 182.46 SAR 2026-10-22 | spend Utilities 182.46 SAR 2026-10-22 | class | spend +182.46 SAR 2026-10 | T10 non-spend category on a purchase: live category was changed after booking (log category differs): a user correction or an old relabel |
| `4d8580f2` | `f923c68b` | nonspend Transfer 470 SAR 2026-08-23 | spend Utilities 470 SAR 2026-08-23 | class | spend +470 SAR 2026-08 | T10 non-spend category on a purchase: live category was changed after booking (log category differs): a user correction or an old relabel |
| `6a6aef1a` | `f923c68b` | nonspend Transfer 2 SAR 2026-07-16 | spend Other 2 SAR 2026-07-16 | class | spend +2 SAR 2026-07 | T10 non-spend category on a purchase: live category was changed after booking (log category differs): a user correction or an old relabel |
| `a54e5313` | `f923c68b` | nonspend Transfer 29.41 SAR 2026-06-29 | spend Other 29.41 SAR 2026-06-30 | class, date | spend +29.41 SAR 2026-06 | T10 non-spend category on a purchase: live category was changed after booking (log category differs): a user correction or an old relabel |
| `c3be6295` | `f923c68b` | nonspend Transfer 529 SAR 2026-08-02 | spend Other 529 SAR 2026-08-03 | class, date | spend +529 SAR 2026-08 | T10 non-spend category on a purchase: live category was changed after booking (log category differs): a user correction or an old relabel |
| `c41534f7` | `f923c68b` | nonspend Transfer 1449.91 SAR 2026-08-02 | spend Other 1449.91 SAR 2026-08-03 | class, date | spend +1449.91 SAR 2026-08 | T10 non-spend category on a purchase: live category was changed after booking (log category differs): a user correction or an old relabel |
| `d5b973a5` | `f923c68b` | nonspend Transfer 999 SAR 2026-08-11 | spend Other 999 SAR 2026-08-11 | class | spend +999 SAR 2026-08 | T10 non-spend category on a purchase: live category was changed after booking (log category differs): a user correction or an old relabel |
| `0e860c96` | `f923c68b` | spend Food 8 SAR 2026-10-25 | spend Other 8 SAR 2026-10-24 | date | none | T15b date differs, not the UTC pattern: live day is neither the UTC nor the local day of arrival (body day, user edit, or November zone) |
| `22493241` | `f923c68b` | spend Food 46 SAR 2026-10-24 | spend Other 46 SAR 2026-10-23 | date | none | T15b date differs, not the UTC pattern: live day is neither the UTC nor the local day of arrival (body day, user edit, or November zone) |
| `631138e3` | `f923c68b` | spend Food 76 SAR 2026-10-26 | spend Food 76 SAR 2026-10-25 | date | none | T15b date differs, not the UTC pattern: live day is neither the UTC nor the local day of arrival (body day, user edit, or November zone) |
| `69ab914c` | `f923c68b` | spend Fuel 50 SAR 2026-10-23 | spend Other 50 SAR 2026-10-22 | date | none | T15b date differs, not the UTC pattern: live day is neither the UTC nor the local day of arrival (body day, user edit, or November zone) |
| `73dbe2a3` | `f923c68b` | spend Subscription 40.66 SAR 2026-10-23 | spend Other 40.66 SAR 2026-10-22 | date | none | T15b date differs, not the UTC pattern: live day is neither the UTC nor the local day of arrival (body day, user edit, or November zone) |
| `b7734262` | `f923c68b` | spend Food 22.5 SAR 2026-10-25 | spend Other 22.5 SAR 2026-10-24 | date | none | T15b date differs, not the UTC pattern: live day is neither the UTC nor the local day of arrival (body day, user edit, or November zone) |
| `b9be748c` | `f923c68b` | spend Food 2 SAR 2026-10-19 | spend Food 2 SAR 2026-10-18 | date | none | T15b date differs, not the UTC pattern: live day is neither the UTC nor the local day of arrival (body day, user edit, or November zone) |
| `f3dd7ae0` | `f923c68b` | spend Shopping 1 SAR 2026-10-24 | spend Other 1 SAR 2026-10-23 | date | none | T15b date differs, not the UTC pattern: live day is neither the UTC nor the local day of arrival (body day, user edit, or November zone) |
| `2a4f0fb7` | `1f0b4fcb` | spend Food 370.27 EGP 2026-11-14 | spend Food 370.27 EGP 2026-11-13 | date | none | T15b date differs, not the UTC pattern: live day is neither the UTC nor the local day of arrival (body day, user edit, or November zone) |
| `fe626ae2` | `1f0b4fcb` | spend Groceries 249.24 EGP 2026-11-01 | spend Food 249.24 EGP 2026-10-31 | date | spend +249.24 EGP 2026-10; spend -249.24 EGP 2026-11 | T15b date differs, not the UTC pattern: live day is neither the UTC nor the local day of arrival (body day, user edit, or November zone) |
| `3bb1b11f` | `0c1a609e` | spend Utilities 5 EGP 2026-09-05 | spend Utilities 5 EGP 2026-09-05 flags=possible_duplicate | flags | none | T16 flag only: possible_duplicate is an upper bound on masked text; no money effect |
| `5e412763` | `0c1a609e` | spend Subscription 57 EGP 2026-08-10 | spend Utilities 57 EGP 2026-08-10 flags=possible_duplicate | flags | none | T16 flag only: possible_duplicate is an upper bound on masked text; no money effect |
| `8c49d517` | `0c1a609e` | nonspend ATM Cash Withdrawal 12000 EGP 2026-08-02 | nonspend ATM Cash Withdrawal 12000 EGP 2026-08-02 flags=possible_duplicate | flags | none | T16 flag only: possible_duplicate is an upper bound on masked text; no money effect |
| `8e2a41a7` | `0c1a609e` | nonspend ATM Cash Withdrawal 6000 EGP 2026-08-02 | nonspend ATM Cash Withdrawal 6000 EGP 2026-08-02 flags=possible_duplicate | flags | none | T16 flag only: possible_duplicate is an upper bound on masked text; no money effect |
| `4705a6e2` | `f923c68b` | spend Food 9 SAR 2026-08-20 | spend Food 9 SAR 2026-08-20 flags=possible_duplicate | flags | none | T16 flag only: possible_duplicate is an upper bound on masked text; no money effect |
| `707f77cc` | `f923c68b` | nonspend ATM Cash Withdrawal 1800 EGP 2026-08-24 | nonspend ATM Cash Withdrawal 1800 EGP 2026-08-24 flags=possible_duplicate | flags | none | T16 flag only: possible_duplicate is an upper bound on masked text; no money effect |
| `8a0ccb11` | `f923c68b` | nonspend ATM Cash Withdrawal 2800 EGP 2026-09-09 | nonspend ATM Cash Withdrawal 2800 EGP 2026-09-09 flags=possible_duplicate | flags | none | T16 flag only: possible_duplicate is an upper bound on masked text; no money effect |
| `b2fe5da1` | `f923c68b` | spend Other 2 SAR 2026-08-19 | spend Other 2 SAR 2026-08-19 flags=possible_duplicate | flags | none | T16 flag only: possible_duplicate is an upper bound on masked text; no money effect |
| `e3ee87c9` | `f923c68b` | spend Other 10 SAR 2026-08-18 | spend Other 10 SAR 2026-08-18 flags=possible_duplicate | flags | none | T16 flag only: possible_duplicate is an upper bound on masked text; no money effect |
| `f25cba8f` | `f923c68b` | spend Shopping 10 SAR 2026-07-29 | spend Other 10 SAR 2026-07-29 flags=possible_duplicate | flags | none | T16 flag only: possible_duplicate is an upper bound on masked text; no money effect |
| `f08c9b48` | `1f0b4fcb` | spend Enjoyment 10613.1 EGP 2026-11-10 | spend Other 10613.1 EGP 2026-11-10 flags=possible_duplicate | flags | none | T16 flag only: possible_duplicate is an upper bound on masked text; no money effect |
| `3a1eeaf4` | `4fce9265` | spend Instapay 250 EGP 2026-09-30 | spend Instapay 250 EGP 2026-09-30 flags=possible_duplicate | flags | none | T16 flag only: possible_duplicate is an upper bound on masked text; no money effect |
| `6eec932a` | `4fce9265` | spend Instapay 250 EGP 2026-09-30 | spend Instapay 250 EGP 2026-09-30 flags=possible_duplicate | flags | none | T16 flag only: possible_duplicate is an upper bound on masked text; no money effect |
| `707315d5` | `4fce9265` | income income other 1135 EGP 2026-10-14 | income income other 1135 EGP 2026-10-14 flags=possible_duplicate | flags | none | T16 flag only: possible_duplicate is an upper bound on masked text; no money effect |
| `9aebe05f` | `4fce9265` | spend Instapay 1135 EGP 2026-10-14 | spend Instapay 1135 EGP 2026-10-14 flags=possible_duplicate | flags | none | T16 flag only: possible_duplicate is an upper bound on masked text; no money effect |
| `a10b5ac2` | `4fce9265` | spend Instapay 1500 EGP 2026-10-14 | spend Instapay 1500 EGP 2026-10-14 flags=possible_duplicate | flags | none | T16 flag only: possible_duplicate is an upper bound on masked text; no money effect |
| `b314d295` | `4fce9265` | spend Instapay 500 EGP 2026-10-10 | spend Instapay 500 EGP 2026-10-10 flags=possible_duplicate | flags | none | T16 flag only: possible_duplicate is an upper bound on masked text; no money effect |
| `d7def9bb` | `4fce9265` | spend Instapay 1500 EGP 2026-10-14 | spend Instapay 1500 EGP 2026-10-14 flags=possible_duplicate | flags | none | T16 flag only: possible_duplicate is an upper bound on masked text; no money effect |
| `e5ed6fd8` | `4fce9265` | income income other 1500 EGP 2026-10-14 | income income other 1500 EGP 2026-10-14 flags=possible_duplicate | flags | none | T16 flag only: possible_duplicate is an upper bound on masked text; no money effect |
| `fb0c8e1a` | `4fce9265` | spend Instapay 2635 EGP 2026-10-14 | spend Instapay 2635 EGP 2026-10-14 flags=possible_duplicate | flags | none | T16 flag only: possible_duplicate is an upper bound on masked text; no money effect |
| `ee609c01` | `5f502bf2` | income income other 1 EGP 2026-11-13 | income income other 1 EGP 2026-11-13 flags=possible_duplicate | flags | none | T16 flag only: possible_duplicate is an upper bound on masked text; no money effect |
| `cb96873d` | `f923c68b` | netzero Shopping 20.4 SAR 2026-07-22 refund<-9e9ec3e7 | spend Shopping 20.4 SAR 2026-07-22 | class, refund mark | spend +20.4 SAR 2026-07 | T2c refund stamp the new rules would not place: live stamp placed by the old exact-amount rule; the replay cannot read the payment reference, so it may have been right |
| `51966294` | `f923c68b` | nonspend CC Payoff 225.1 SAR 2026-07-22 | spend Other 225.1 SAR 2026-07-22 flags=model_kind_unproven | class, flags | spend +225.1 SAR 2026-07 | T5 via-card payment becomes spending: I3 default, but the balance check on b61afd88 leans the other way (the payment raised the card balance): owner to read it first |
| `5fe0a498` | `f923c68b` | nonspend CC Payoff 950 SAR 2026-08-10 | spend Other 950 SAR 2026-08-10 flags=model_kind_unproven | class, flags | spend +950 SAR 2026-08 | T5 via-card payment becomes spending: I3 default, but the balance check on b61afd88 leans the other way (the payment raised the card balance): owner to read it first |
| `6cde6c02` | `f923c68b` | nonspend CC Payoff 450 SAR 2026-08-23 | spend Other 450 SAR 2026-08-23 flags=model_kind_unproven | class, flags | spend +450 SAR 2026-08 | T5 via-card payment becomes spending: I3 default, but the balance check on b61afd88 leans the other way (the payment raised the card balance): owner to read it first |
| `81144634` | `f923c68b` | nonspend CC Payoff 750 SAR 2026-08-24 | spend Other 750 SAR 2026-08-24 flags=model_kind_unproven | class, flags | spend +750 SAR 2026-08 | T5 via-card payment becomes spending: I3 default, but the balance check on b61afd88 leans the other way (the payment raised the card balance): owner to read it first |
| `82133010` | `f923c68b` | nonspend CC Payoff 500 SAR 2026-08-14 | spend Other 500 SAR 2026-08-14 flags=model_kind_unproven | class, flags | spend +500 SAR 2026-08 | T5 via-card payment becomes spending: I3 default, but the balance check on b61afd88 leans the other way (the payment raised the card balance): owner to read it first |
| `b61afd88` | `f923c68b` | nonspend CC Payoff 6 SAR 2026-10-26 | spend Other 6 SAR 2026-10-26 flags=model_kind_unproven | class, flags | spend +6 SAR 2026-10 | T5 via-card payment becomes spending: I3 default, but the balance check on b61afd88 leans the other way (the payment raised the card balance): owner to read it first |
| `c18dabf3` | `f923c68b` | nonspend CC Payoff 1600 SAR 2026-09-03 | spend Other 1600 SAR 2026-09-03 flags=model_kind_unproven | class, flags | spend +1600 SAR 2026-09 | T5 via-card payment becomes spending: I3 default, but the balance check on b61afd88 leans the other way (the payment raised the card balance): owner to read it first |
| `aa5ece0a` | `f923c68b` | none | spend Other 22 SAR 2026-09-13 | class | spend +22 SAR 2026-09 | T6a never surfaced (add_failed): held row never answered; book or confirm absent |
| `029bb171` | `f923c68b` | none | income income other 400 SAR 2026-07-05 | class | income +400 SAR 2026-07 | T6c income with an equal partner message: looks like a wallet top-up or own-transfer credit; the replay cannot see the wallet state at arrival |
| `1836b194` | `f923c68b` | none | income income other 2 SAR 2026-07-16 | class | income +2 SAR 2026-07 | T6c income with an equal partner message: looks like a wallet top-up or own-transfer credit; the replay cannot see the wallet state at arrival |
| `3a23c230` | `f923c68b` | none | income income other 88 SAR 2026-09-21 | class | income +88 SAR 2026-09 | T6c income with an equal partner message: looks like a wallet top-up or own-transfer credit; the replay cannot see the wallet state at arrival |
| `5d039bb4` | `f923c68b` | none | income income other 104.92 SAR 2026-09-19 | class | income +104.92 SAR 2026-09 | T6c income with an equal partner message: looks like a wallet top-up or own-transfer credit; the replay cannot see the wallet state at arrival |
| `db68d2cb` | `f923c68b` | none | income income other 98 SAR 2026-09-22 | class | income +98 SAR 2026-09 | T6c income with an equal partner message: looks like a wallet top-up or own-transfer credit; the replay cannot see the wallet state at arrival |
| `41911e9c` | `f923c68b` | none | income income other 16 SAR 2026-07-05 | class | income +16 SAR 2026-07 | T6d confirmed income with no row: confirmed but never booked; the replay cannot see why (wallet state at arrival) |
| `aea556b8` | `f923c68b` | none | income income other 29.41 SAR 2026-06-30 | class | income +29.41 SAR 2026-06 | T6d confirmed income with no row: confirmed but never booked; the replay cannot see why (wallet state at arrival) |
| `d54d2ac1` | `f923c68b` | none | income income other 64.14 SAR 2026-06-30 flags=possible_duplicate | class | income +64.14 SAR 2026-06 | T6d confirmed income with no row: confirmed but never booked; the replay cannot see why (wallet state at arrival) |
| `f2fc0bcc` | `ad3c0295` | none | income income other 2 EGP 2026-06-16 | class | income +2 EGP 2026-06 | T6e booked then removed: the log points at a money row that no longer exists; a user purge cannot be told from a server removal |
| `aba475f2` | `b85f074d` | none | income income other 1 EGP 2026-07-05 | class | income +1 EGP 2026-07 | T6e booked then removed: the log points at a money row that no longer exists; a user purge cannot be told from a server removal |
| `9e9ec3e7` | `f923c68b` | none | netzero Shopping 20.4 SAR 2026-07-25 refund<-9e9ec3e7 flags=refund_unmatched | class | none | T7b own net-zero row for a decline or unmatched refund: I2 and refund rule: books one net-zero row of its own (no money effect) | held with the stamp it replaces (T2c) |

### 2.8 Every row with no change

| log | user | live state | proposed state | fields | money effect | repair type: reason |
|---|---|---|---|---|---|---|
| `50641027` | `1f0b4fcb` | none | nonspend Currency Exchange 532.87 USD 2026-11-05 | class, pairing | none | B replay-blind pair: live pair the replay cannot reproduce from masked text (direction or reference masked) |
| `6ad46d1d` | `1f0b4fcb` | nonspend Transfer 8508.5 EGP 2026-11-06 | nonspend Transfer 8508.5 EGP 2026-11-06 | pairing | none | B replay-blind pair: live pair the replay cannot reproduce from masked text (direction or reference masked) |
| `985f7ad6` | `1f0b4fcb` | none | nonspend Currency Exchange 30196.5 EGP 2026-11-10 | class, pairing | none | B replay-blind pair: live pair the replay cannot reproduce from masked text (direction or reference masked) |
| `b0854359` | `1f0b4fcb` | nonspend Currency Exchange 567.07 USD 2026-11-10 | nonspend Currency Exchange 567.07 USD 2026-11-10 | pairing | none | B replay-blind pair: live pair the replay cannot reproduce from masked text (direction or reference masked) |
| `cafcae46` | `1f0b4fcb` | nonspend Currency Exchange 28705.7 EGP 2026-11-05 | nonspend Currency Exchange 28705.7 EGP 2026-11-05 | pairing | none | B replay-blind pair: live pair the replay cannot reproduce from masked text (direction or reference masked) |
| `eedf39da` | `1f0b4fcb` | none | income income other 8500 EGP 2026-11-06 | class, pairing | income +8500 EGP 2026-11 | B replay-blind pair: live pair the replay cannot reproduce from masked text (direction or reference masked) |
| `04ee053d` | `f923c68b` | spend Shopping 30 SAR 2026-11-14 | none | class | spend -30 SAR 2026-11 | P post-deploy row (booked by the new code): created after the S2c code push; the new code already decided it |
| `bee80656` | `f923c68b` | income income other 125 SAR 2026-11-14 | income income other 125 SAR 2026-11-14 | - | none | P post-deploy row (booked by the new code): created after the S2c code push; the new code already decided it |
| `d80f99a9` | `f923c68b` | spend Shopping 30 SAR 2026-11-14 | none | class | spend -30 SAR 2026-11 | P post-deploy row (booked by the new code): created after the S2c code push; the new code already decided it |
| `ed392c08` | `f923c68b` | spend Utilities 86.25 SAR 2026-06-29 | spend Utilities 86.25 SAR 2026-06-30 | date | none | T15 date: UTC day instead of local day: P3-3: the stored day was the UTC day of the arrival, the local day differs | USER-TOUCHED: notes written |
| `c02108e0` | `f923c68b` | none | spend Remittance 105.74 SAR 2026-09-23 | class | spend +105.74 SAR 2026-09 | T6 no live row, replay books: user-deleted row |
| `05a44d78` | `50028067` | none | nonspend Transfer 98.57 EGP 2026-10-19 | class | none | T6 no live row, replay books: user-deleted row |
| `53b0e31c` | `50028067` | none | nonspend ATM Cash Withdrawal 2000 EGP 2026-10-22 | class | none | T6 no live row, replay books: user-deleted row |
| `b3996230` | `50028067` | none | spend Groceries 17 EGP 2026-10-19 | class | spend +17 EGP 2026-10 | T6 no live row, replay books: user-deleted row |
| `ff52e170` | `50028067` | none | nonspend Transfer 98.57 EGP 2026-10-22 | class | none | T6 no live row, replay books: user-deleted row |
| `1bc3859b` | `ec2cad5d` | none | spend Utilities 257.14 EGP 2026-11-05 | class | spend +257.14 EGP 2026-11 | T6 no live row, replay books: user-deleted row |
| `76184aa7` | `ec2cad5d` | none | spend Utilities 98.57 EGP 2026-10-26 | class | spend +98.57 EGP 2026-10 | T6 no live row, replay books: user-deleted row |
| `aed03417` | `ec2cad5d` | none | spend Utilities 98.57 EGP 2026-10-30 | class | spend +98.57 EGP 2026-10 | T6 no live row, replay books: user-deleted row |
| `cc8e8c43` | `ec2cad5d` | none | spend Instapay 100.5 EGP 2026-10-30 | class | spend +100.5 EGP 2026-10 | T6 no live row, replay books: user-deleted row |
| `fddf22c2` | `ec2cad5d` | none | spend Instapay 1761.76 EGP 2026-10-29 | class | spend +1761.76 EGP 2026-10 | T6 no live row, replay books: user-deleted row |

## 3. The section 8 repair list, item by item

Status: **confirmed** (the replay reproduces the claim), **changed** (the replay or the evidence says something different), **not reproducible** (the replay cannot see it).

| Item | Status | What the replay and the data say |
|---|---|---|
| `9e75b537` un-reverse | confirmed | live row stamped refunded by the decline `0fe8887c`; replay leaves it untouched and books the decline's own net-zero row. Apply (T1, T7b): ATM row counts again (non-spend, no spend effect). |
| `572aaf39` un-reverse, keep counted | confirmed | live row stamped by the decline `4a7d7250`; replay: no same-second exception, the charge stays counted (+5.70 USD spending, 2026-10) and the decline books its own net-zero row. |
| `baab5343` move the refund mark | confirmed | the replay matches the return to `e8b0e3ed` (rule: same account, amount, 15 minutes), not `bfe884e3`. Apply as a pair (T2a, T2b): spending -5,000 EGP on `e8b0e3ed`, +5,000 EGP on `bfe884e3`, both in 2026-10, net 0. |
| `fb2d543a`, `e66b72ae`, `a602aba1`, `34a081d4` | confirmed correct | no difference between live and replay. |
| `af7e8c15` book | not reproducible | the log failed before parse: no kind, no amount, no raw text left (raw expired). Nothing to book from stored data. Needs the owner's statement or a re-parse on the phone's copy. |
| five collected-notice incomes | confirmed | the rule hits exactly `65921ad1`, `4b5d53d7`, `cb25279f`, `93e7ec95`, `d35340ff` and nothing else of the 960 (`isCollectedNotice` over the masked bodies). Apply (T3): income -7,964.21 SAR (user `f923c68b`: 2026-08 -2,993.71, 2026-09 -3,984.39, 2026-10 -986.11). |
| four cash deposits (`cb5fd476`, `78e0b305`, `0812aa55`, `818b0736`) | confirmed, now by the code itself | at `46aec162` the replay books all four as a non-spend Transfer flagged `cash_deposit` (the closing note's wording "transfer from cash"). Money effect: income -1,450.00 SAR for the three income rows (2026-08 -1,400.00, 2026-09 -50.00); `818b0736` is a withdrawal today (non-spend both ways: no spend effect, but its effect on the cash and account balances reverses). `cb5fd476` and `78e0b305` are two 700 SAR messages 34 seconds apart; the replay flags the second `possible_duplicate`. One deposit read twice, or two deposits: the owner should check. |
| seven "payment via card" rows | confirmed by the replay, **held** on evidence | with digits restored (run C) all seven become spending flagged `model_kind_unproven` (+4,481.10 SAR, user `f923c68b`); with masked digits (A, B) they wait for the user. The balance check (part 6) leans against spending: not applied. |
| `ff52e170` rebook as spending | changed | the live row was deleted by its user (no retraction marker): the repair never overwrites a user's own correction, so no change. For the record: replay mode A books it as a non-spend transfer, mode B as spending. |
| `fa2a8ec2` | confirmed lost | no live row, status confirmed; the replay books spending 499.05 EGP (2026-07). Apply (T6). Its same-capture copy `41c80815` is refused by the copy guard and has no row. |
| `ad8523cb` | confirmed lost | replay books a non-spend ATM withdrawal 1,000 EGP (2026-07-12); no spend effect. Copy `e23c899a` refused, no row. Apply (T6). |
| `10ac8181` | not reproducible | rejected by the code tier as not a transaction; the replay does not re-run the parse tiers and no raw text is left. |
| `540077ff` | confirmed lost | replay books spending 99.99 SAR (2026-08). Apply (T6). |
| `acbe9dd7`, `916e58d4` | confirmed lost, with a caveat | replay books income 100 SAR each (2026-08, 2026-09). No same-amount partner message within 30 minutes, so they do not look like wallet top-ups. Apply (T6); the owner may prefer to confirm against a statement. |
| `aa5ece0a` | held | status `add_failed`, awaiting confirmation true, never surfaced: the replay books spending 22 SAR; the right repair is to surface it in the held list. |
| the 49 wrong-day rows | changed | the replay finds **71 rows** whose live day is the UTC day of arrival and whose local day differs (45 expenses, 26 incomes; users `f923c68b` 36, `4fce9265` 33, `0c1a609e` 2; 2026-06 to 2026-10), 2 of them across a month boundary (user `4fce9265`: spending -310.00 / +310.00 EGP and income -155.00 / +155.00 EGP between 2026-09 and 2026-10). 10 more differ by a day but the live day is neither the UTC nor the local day (held: body day or a user edit). 1 more carries a user note (no change). The first review's 49 counted expenses with a different method; I could not reproduce that list, and the replay's 45 expenses are close. Valid only before 2026-10-30 (Cairo and Riyadh are both UTC+3 then); November rows are excluded. `02370960` is one of the 71. |
| the 24 top-up incomes | not reproducible | S2's forward fix needs the wallet's own-name signal and the account state at arrival, both hidden by masking. Proxy: the wallet user (`f923c68b`) has 19 live income rows (12,273.64 SAR) with a same-amount debit message within 30 minutes; for 5 of them the partner is the purchase the replay already turns into an own-wallet transfer (T11). The replay moves one pair (`42136093` with `858f6536`, T11 and T9: spending -740.00 SAR, income -740.00 SAR). The other incomes need a run with the wallet state. |
| `02370960` | changed | not a lost row: a day shift (income 6 SAR, 2026-09-16 to 2026-09-17). |
| `dac3937a` | not reproducible | live and replay agree on class, amount and day (spending 83.51 SAR, 2026-06-28); the difference the first review saw is not in what the replay reads. |
| `e23c899a`, `41c80815` | confirmed | same-capture copies of `ad8523cb` and `fa2a8ec2`; refused as copies; no rows. Repair them with their originals (nothing to do for the copies). |

Held items that are new in this run: 7 purchases carrying a non-spend category (T10: 3,661.78 SAR of spending if reversed; the live category was changed after booking, log category differs, so a user's recategorisation is likely, and one carries a note); `bfe884e3`-like stamps the new rules would not place (T2c: `cb96873d`, 20.40 SAR, stamped by `9e9ec3e7`: the replay cannot read the payment reference); 5 incomes with an equal partner message and 3 confirmed incomes with no row (T6c, T6d: 692.92 SAR and 109.55 SAR, probably wallet top-up credits that were deliberately not booked); 2 rows booked then removed (T6e, 3.00 EGP); 21 `possible_duplicate` flags with no money effect (an upper bound on masked text); 10 day differences outside the UTC pattern.

## 4. Rows the user has touched: proposed "no change"

**How they were detected** (all columns read from `expenses` and `income_events` joined to `sms_parse_log`; query 4 of `scripts/qa/s3-live-inputs.sql`): a row deleted with `deleted_at` set and no `retracted_by_sms_log_id` (11 rows); `notes` written (20 rows); `spend_exclusion` or income `exclusion` set (0); `sms_flags_ack` non-empty (0); a held row answered ("tapped", 1 row). A repair that would have touched any such row is demoted to "no change". 12 of the 177 differing messages carry a strong signal (11 no change, 1 held; the deleted rows appear as "T6 no live row, replay books"):

| log | user | what the replay would have done | live state | strong signal | decision |
|---|---|---|---|---|---|
| `a54e5313` | `f923c68b` | T10 non-spend category on a purchase | nonspend Transfer 29.41 SAR 2026-06-29 | notes written | hold |
| `c02108e0` | `f923c68b` | T6 no live row, replay books | none | row deleted by user (deleted_at set, no retraction marker) | no change |
| `ed392c08` | `f923c68b` | T15 date: UTC day instead of local day | spend Utilities 86.25 SAR 2026-06-29 | notes written | no change |
| `05a44d78` | `50028067` | T6 no live row, replay books | none | row deleted by user (deleted_at set, no retraction marker) | no change |
| `53b0e31c` | `50028067` | T6 no live row, replay books | none | row deleted by user (deleted_at set, no retraction marker) | no change |
| `b3996230` | `50028067` | T6 no live row, replay books | none | row deleted by user (deleted_at set, no retraction marker) | no change |
| `ff52e170` | `50028067` | T6 no live row, replay books | none | row deleted by user (deleted_at set, no retraction marker) | no change |
| `1bc3859b` | `ec2cad5d` | T6 no live row, replay books | none | row deleted by user (deleted_at set, no retraction marker) | no change |
| `76184aa7` | `ec2cad5d` | T6 no live row, replay books | none | row deleted by user (deleted_at set, no retraction marker) | no change |
| `aed03417` | `ec2cad5d` | T6 no live row, replay books | none | row deleted by user (deleted_at set, no retraction marker) | no change |
| `cc8e8c43` | `ec2cad5d` | T6 no live row, replay books | none | row deleted by user (deleted_at set, no retraction marker) | no change |
| `fddf22c2` | `ec2cad5d` | T6 no live row, replay books | none | row deleted by user (deleted_at set, no retraction marker) | no change |

**What could not be detected.**
- `edited_at` is set on every row and cannot separate a user's edit from the app's own sync: 379 of 585 expense rows have it more than a minute after creation, and three timestamps are shared by 257, 41 and 32 rows (2026-10-26 04:48:31, 2026-08-14 11:37:21, 2026-10-18 13:29:53 UTC): bulk writes, not people. It is not used.
- A user's change of category, amount, date or account cannot be told from a server change: the log keeps the category and account the pipeline chose, so a difference (22 rows differ in category, 115 in account, 239 in description) is a hint, not proof. Of the 99 apply rows, 53 carry such a weak signal (16 only the `edited_at` one, 37 a category, account or description difference); they are listed in `.claude/s3-diff.json` (`weak`).
- A row deleted without a marker may have been removed by an older server rule, not by the user: the marker only exists since migration 0269. The 11 deleted rows (users `ec2cad5d` 6, `50028067` 4, `f923c68b` 1) are treated as the user's deletions; 10 of them differ from the replay (listed below), the 11th, `4a382257`, is a same-capture copy the replay also refuses.
- Answers to prompts: the own-transfer answers table is empty, so no answer exists to protect.

## 5. Carried items

- **Old rows lacking `bank_source`, `format_key`, `shape_key`:** query 2. All 960 lack `bank_source` and `format_key`, the newest rows included; 952 lack `shape_key` (the 8 that have it are rejected rows). Masked bodies exist for all 960 (raw only for 196).
  - What the masked body gives: `format_key` can be computed for 781 of 783 bodies (2 null), 109 distinct keys. `shape_key` from the masked body equals the stored value on only **3 of the 8** rows that have one, because the key counts numeric slots and masking replaces digits: a masked-body `shape_key` is not the same key as a live one. A backfill must use `format_key` (sender-free) and not mix the two definitions.
  - Bank: 263 of 960 rows carry `bank_name`, 697 do not, 53 have a sender. `bank_source` cannot be derived from the masked body alone (the history and format stages need live state); it would be left null.
- **Rows with `template_revoked_at`:** 0 of 960. No repair input from this.
- **The 15 S1 relabels** still awaiting the owner (docs/launch/S2-closing.md: "All stay out until S3", 2 to 2): not touched, list only. They are labels in the gold set (`src/lib/sms/gold/goldSet.json`), not live rows.

## 6. The capped balance check on `b61afd88`

Method: the raw text still exists for this row. Read in the database only (query 6, figures never copied).
- The printed card balance after the payment is the same size as the payment itself.
- One minute later, on the same card digits, an online purchase (plus a small fee) prints a balance lower than that, by about the purchase plus fee (within a few cents).
- No neighbouring row of the same user stores a balance or a balance report (`balance_after` is null on both rows), and the other six via-card rows have no raw text left, so no second payment can be tested.
- Reading: the "Visa balance" behaves like money available on the card: it fell with the purchase, and after the "payment" it equalled the payment. A purchase made with the card would have lowered it. This leans towards the payment **raising** the card balance (a load or top-up of a prepaid card, five of the seven amounts are round), the opposite of the default rule.

**Verdict: inconclusive as proof, leaning against "spending".** One message pair, a few cents unexplained. Recommendation: hold all seven (done in this report) until the owner reads `b61afd88`; if the owner confirms a load, the seven stay non-spend (no change) and only the flag question is dropped.

## 7. Proposed apply plan (not executed)

**Adjusted by section 11 (council verdicts); where this part and section 11 differ, section 11 wins.** Via-card rows are not repaired (flag only); the two 700 SAR deposits are both kept; T11 and T9 wait for the S2d "treated as a top-up, undo?" flag; T15 applies to the 69 same-month shifts only; zero-risk types may be applied without the owner, money-moving types need the owner's sample approval; the revert test recomputes per-user per-month totals.

**Preconditions.** SMS batch 2 (S2d) has landed and this report is re-run; the owner approves the sample below (money-moving types); this report is re-run after the last SMS rule change; the working tree is clean; one batch id per run (`s3-YYYYMMDD`).

**Migration shape** (one new migration, additive; apply with `execute_sql`, then regenerate `database.types.ts`):
1. `sms_repair_audit(id bigserial, batch text, repair_type text, user_id uuid, sms_log_id uuid, table_name text, row_id uuid, action text check (action in ('update','soft_delete','insert','relink')), old_values jsonb, new_values jsonb, applied_at timestamptz default now(), reverted_at timestamptz)`, RLS enabled, no policy (service role only), unique `(batch, table_name, row_id, repair_type)` so a run is idempotent.
2. `sms_s3_apply(p_batch text, p_repair_type text, p_log_ids uuid[])` (security definer, one transaction per call): for each log id it re-reads the live row, **refuses if any strong user-touch signal exists or the live value no longer equals the value in this report** (a row that changed since the dry run is skipped and reported), writes the audit row with the full `to_jsonb(old row)` first, then makes the change.
3. `sms_s3_revert(p_batch text, p_repair_type text default null)`: walks the audit rows of the batch in reverse order and restores `old_values` field by field (an inserted row is soft-deleted with its marker; a soft-deleted row is restored by clearing `deleted_at` and the marker), sets `reverted_at`.

**What each type does.** Soft deletes set `retracted_by_sms_log_id` to the causing message in the same write as `deleted_at` (invariant I4), so the existing undo path can restore them. Stamps (`refunded_at`, `refund_kind`, `refund_sms_log_id`) are cleared or set on the two rows named. Inserts (T6 lost rows, T7b decline and unmatched-refund own rows, T4 transfer-from-cash rows, T8 net-zero rows) are **not hand-written SQL**: a one-off server script calls the real booking function (`createSmsTransaction`) with the stored log columns, as the replay does, so every rule applies; each insert is audited. T15 updates `expense_date` or `received_date` only. T9 and T11 relink through the same function as `sms_try_pair`. Server writers leave `edited_at` alone (a client write is defined by it): whether to bump `edited_at` so that a phone holding an older copy cannot push the old category or day back (invariant I8's known limit) is a decision for the reviewer; without it, T11 and T15 may be undone by a stale phone.

**Order** (each step: audit, apply, re-run the replay diff, expect the applied ids to vanish from it, compare the per-user per-month totals with part 2.3):
1. T3 collected notices (soft delete, marker = the message itself).
2. T4 cash deposits (soft delete the income rows, insert transfer-from-cash rows with the flag; the withdrawal row of `818b0736` is retyped).
3. T1 un-reverse and T7b own rows for the declines.
4. T2a, T2b the refund mark move (one transaction, both rows).
5. T8 unmatched refunds out of income.
6. T9, T11 the own-wallet pair and the four own-wallet purchases, each carrying the new "we now treat this as a top-up, undo?" flag; not before that flag is live.
7. T6 lost rows (booked last of the money inserts; each is a new row the phone pulls).
8. T15 day shifts, last, user by user: the 69 that stay within a month only; the two month-crossing rows are skipped and left to the closed-month notice.

Per user, in a transaction, smallest user first; a failed check stops the batch.

**Rollback.** `select sms_s3_revert('<batch>')` for the whole batch, or per repair type. Tested before the real run in a rolled-back transaction on the live database (as S2c did for 0269, 0271, 0273): apply the batch, revert it, compare every touched row with its audit old values, roll back. Because every old value sits in the audit table, a revert needs no backup restore.

**Sample for the owner (20 rows, one per repair type, chosen by id order; apply, or hold where marked):**

| # | log | user | repair type | decision | live | proposed |
|---|---|---|---|---|---|---|
| 1 | `572aaf39` | `6090c8e7` | T1 un-reverse (decline stamp removed) | apply | netzero Subscription 5.7 USD 2026-10-27 refund<-4a7d7250 | spend Other 5.7 USD 2026-10-27 |
| 2 | `388b74fb` | `f923c68b` | T10 non-spend category on a purchase | hold | nonspend Transfer 182.46 SAR 2026-10-22 | spend Utilities 182.46 SAR 2026-10-22 |
| 3 | `08ca4f8f` | `f923c68b` | T11 purchase at own wallet becomes transfer | apply | spend Utilities 1020 SAR 2026-08-20 | nonspend Transfer 1020 SAR 2026-08-20 |
| 4 | `009635ef` | `4fce9265` | T15 date: UTC day instead of local day | apply | income income other 1500 EGP 2026-09-09 | income income other 1500 EGP 2026-09-10 |
| 5 | `0e860c96` | `f923c68b` | T15b date differs, not the UTC pattern | hold | spend Food 8 SAR 2026-10-25 | spend Other 8 SAR 2026-10-24 |
| 6 | `3a1eeaf4` | `4fce9265` | T16 flag only | hold | spend Instapay 250 EGP 2026-09-30 | spend Instapay 250 EGP 2026-09-30 flags=possible_duplicate |
| 7 | `bfe884e3` | `4fce9265` | T2a refund mark moves away | apply | netzero Instapay 5000 EGP 2026-10-06 refund<-baab5343 | spend Instapay 5000 EGP 2026-10-06 |
| 8 | `e8b0e3ed` | `4fce9265` | T2b refund mark moves here | apply | spend Instapay 5000 EGP 2026-10-07 | netzero Instapay 5000 EGP 2026-10-07 refund<-baab5343 |
| 9 | `cb96873d` | `f923c68b` | T2c refund stamp the new rules would not place | hold | netzero Shopping 20.4 SAR 2026-07-22 refund<-9e9ec3e7 | spend Shopping 20.4 SAR 2026-07-22 |
| 10 | `4b5d53d7` | `f923c68b` | T3 collected-notice income removed | apply | income income other 1004.17 SAR 2026-08-13 | none |
| 11 | `0812aa55` | `f923c68b` | T4 cash deposit becomes transfer from cash | apply | income income other 50 SAR 2026-09-21 | nonspend Transfer 50 SAR 2026-09-21 flags=cash_deposit |
| 12 | `51966294` | `f923c68b` | T5 via-card payment becomes spending | hold | nonspend CC Payoff 225.1 SAR 2026-07-22 | spend Other 225.1 SAR 2026-07-22 flags=model_kind_unproven |
| 13 | `540077ff` | `f923c68b` | T6 lost row (confirmed, never booked) | apply | none | spend Subscription 99.99 SAR 2026-08-10 |
| 14 | `aa5ece0a` | `f923c68b` | T6a never surfaced (add_failed) | hold | none | spend Other 22 SAR 2026-09-13 |
| 15 | `029bb171` | `f923c68b` | T6c income with an equal partner message | hold | none | income income other 400 SAR 2026-07-05 |
| 16 | `41911e9c` | `f923c68b` | T6d confirmed income with no row | hold | none | income income other 16 SAR 2026-07-05 |
| 17 | `aba475f2` | `b85f074d` | T6e booked then removed | hold | none | income income other 1 EGP 2026-07-05 |
| 18 | `0fe8887c` | `f923c68b` | T7b own net-zero row for a decline or unmatched refund | apply | none | netzero Other 4000 EGP 2026-09-09 refund<-0fe8887c |
| 19 | `a19ff882` | `f923c68b` | T8 unmatched refund leaves income | apply | income income refund 0.23 SAR 2026-10-21 | netzero Other 0.23 SAR 2026-10-21 refund<-a19ff882 flags=refund_unmatched |
| 20 | `858f6536` | `f923c68b` | T9 income leg retracted by a new pair | apply | income income other 740 SAR 2026-09-02 | none |

## 8. Template promotion (nothing promoted)

Checker: `replayTemplate` and `replayVerdict` in `src/lib/sms/gold/templateReplay.ts` (the replay gate), run over all 960 stored messages (196 with raw text; the held-out split is the messages of users who never contributed to the template). Export `.claude/sms-replay-raw.json` (query 5, git-ignored) and `TZ=Africa/Cairo npx vitest run src/lib/sms/gold/templateReplay.test.ts --reporter=verbose`.

- 60 templates: 45 learned `template` active, 2 quarantined, 1 retired, 12 `curated_db` active. 48 are in the `template` tier that the gate judges; **1 passes**.

| Template | Users | Own matches | Age | Replay matched | Held-out | Independent | Compared exactly | False positives | Disagreements (amount/direction/currency/digits) | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|
| `b32b1cbd` | 1 | 0 | 14 days | 3 | 3 | 3 | 3 | 0 | 0/0/0/0 | pass |

- It passes at the age floor exactly (14 days), with 3 readings (the floor), and has never matched a live message (0 own matches). The eligibility rule of S2 part 3 (2 or more users, or 1 user with 15 or more matches) is **not** met, so it would not be listed even under "Needs staff approval". Recommendation: do not promote.
- Why the other 47 fail: 34 have fewer than 3 independent readings, 6 have recorded failures, 3 are not active, 2 have another tier choosing a different kind, 1 matched a non-transaction, 1 has too few exactly compared readings. (Counts from the run's verdict lines, `.claude/` scratch.)
- Held-out evidence is thin everywhere: most templates were learned from one user and no other user's messages match them.

## 9. Not verified (so no number is over-read)

- **Parse tiers were not re-run.** The replay books from the stored columns (kind, amount, account, counterparty) of each message, as the closing replay does. A message the live tiers parsed differently (`10ac8181`, `af7e8c15`) is invisible to it.
- **Masked references and balances.** Payment references, running balances and the digits after "via" are masked: every refund match is by time and merchant, never by reference (hence T2c is held), and the seven via-card rows only read in mode C.
- **Kind provenance.** A stored `own_transfer` or `cc_payoff` kind is read as code (A) or model (B); the live data does not say which. A and B differ on 5 messages; the report uses A.
- **Account state at arrival.** Payment methods and debts are today's (queries C, D). A top-up, own-transfer or repayment decided with the wallet or card state of the day cannot be replayed: T6c, T6d, the 24 top-up incomes, and the three replay-blind pairs (`50641027`+`cafcae46`, `985f7ad6`+`b0854359`, `6ad46d1d`+`eedf39da`) are left alone.
- **Salary, subscription and own-name matching** never fire in the replay (no data exported).
- **The day rule** uses Cairo time for every user. It is exact for the stored zones (Cairo, Riyadh) before 2026-10-30 and for the 6 users with no stored zone only if they are in Egypt. November rows are excluded.
- **Money effects** are per row and per currency from stored amounts; fees, exchange rates and savings or debt side effects (a `debt_payment`, a funded-from-savings link) are not included.
- **User touches** are detected from columns only (part 4); a user's edit of category, date, amount or account is invisible.
- **The three messages created after the code push** and any message received after this export are not in the diff.
- No raw text of any row but `b61afd88` was read for this report, and none was written to a file except the git-ignored template export.
- This report is a snapshot of the data at 2026-11-14 about 20:00 Cairo.

## Commands, in order

```bash
# 1. export (queries in scripts/qa/sms-s2c-replay-inputs.sql and scripts/qa/s3-live-inputs.sql, SELECT only) into .claude/
TZ=Africa/Cairo npx vitest run src/lib/sms/gold/closingReplay.test.ts --reporter=verbose
TZ=Africa/Cairo npx vitest run -c scripts/qa/s3-vitest.config.ts
python3 scripts/qa/s3-dryrun-report.py
TZ=Africa/Cairo npx vitest run src/lib/sms/gold/templateReplay.test.ts --reporter=verbose
```

## 10. Reviewer conditions (Fable, 2026-11-14)

The planning session accepted this report as provisional. Spot-checks live: the five collected-notice incomes (5 rows, 7,964.21 SAR), the three deposit incomes (1,450 SAR), the refund marks on `572aaf39`, `9e75b537`, `bfe884e3` (none on `e8b0e3ed`), and no `sms_repair_audit` table exists. Conditions before any apply; no database write is made by this report.

1. **Apply waits for SMS batch 2, then the dry run is re-run.** The rules will change, and every repair lands in a closed month (2026-07 to 2026-10) while closed-month handling (N15: carry marked stale, notice, recompute on tap) is not built; applying first would leave month carries silently stale.
2. **No push and no "new transaction" toast for old rows.** The apply script must state where pushes are sent in the booking path and the rolled-back test must prove none fires. Not yet done: part 7 only says inserts go through `createSmsTransaction`, which is the path that notifies, so the script needs a no-notify option or a direct insert.
3. **Bump `edited_at` on every repaired row** (reviewer decision on the open point in part 7), so a phone with an older copy cannot push the old value back. The rolled-back test must prove it against `reject_stale_write` in both orders: a stale push after the repair is rejected, and a genuinely later user edit still wins.
4. **T11 and T9 are no longer "apply" but "apply only with the owner's row-by-row approval".** All six rows are listed in 2.6 for the owner (all user `f923c68b`): T11 `08ca4f8f`, `101646f0`, `170910a1`, `42136093`, `8eb8cbf1` (-4,282.00 SAR spending) and T9 `858f6536` (-740.00 SAR income). Removing spending on today's wallet state is the costliest error.
5. **T6 lost rows** (`fa2a8ec2`, `ad8523cb`, `540077ff`, `acbe9dd7`, `916e58d4`) are inserts months old. The user will see a new row dated in a closed month (2026-07 to 2026-09), with no prompt unless the row carries a flag (none of these five does) and, per condition 2, no notification. They stay last in the order.
6. **Prompts from flags on old rows.** Counted from the apply set (`.claude/s3-diff.json`, flags on the proposed row that the live row lacks, T15 excluded because it changes the date only): user `f923c68b` would receive 4 `cash_deposit` (`0812aa55`, `78e0b305`, `818b0736`, `cb5fd476`), 2 `refund_unmatched` (`a19ff882`, `ec6ae237`) and 1 `possible_duplicate` (`78e0b305`, also a deposit): **7 flags on 6 rows, 6 prompts at most**; every other user 0. If the 13 T15 rows that carry `possible_duplicate` in the replay were stamped as well, that adds 13. The owner approves this number.
7. **Via-card rows: the hold stands.** The forward rule shipped in S2c (this format books as spending, flagged) leans the wrong way on the balance evidence of part 6. If the owner confirms a card load, the forward rule changes in batch 2 and these seven rows stay as they are.
8. **Fresh export and a mandatory staleness check.** One user had 276 SMS expense rows rewritten in a single minute at 17:36 UTC today (a whole-row push from a phone, after this export). The re-run must take a fresh export, and the apply function's check that each live value still equals the value in the report is mandatory, not optional (part 7, step 2).

## 11. Council verdicts on the apply (2026-11-14)

The owner delegated these decisions to the council (via the planning session). Nothing is applied until batch 2 (S2d) lands and this dry run is re-run; no database write is made by this report.

1. **Via-card rows (3 of 3).** The seven rows (`51966294`, `5fe0a498`, `6cde6c02`, `81144634`, `82133010`, `b61afd88`, `c18dabf3`) are not repaired and stay non-spend; they get a flag only, so the user can confirm in one tap. The forward rule changes in batch 2: card balance at least the payment amount means a card load (non-spend, flagged), otherwise spending, flagged. T5 is therefore "flag only", no money effect.
2. **The two 700 SAR deposits 34 seconds apart (3 of 3).** `cb5fd476` and `78e0b305`: keep both, the second flagged `possible_duplicate`. Never remove.
3. **Own-wallet repairs T11 and T9 (3 of 3).** Applied with the batch, but every such row carries a new "we now treat this as a top-up, undo?" flag with a one-tap undo. S2d builds that flag; the repair may not run before it is live. This replaces reviewer condition 4 of section 10 (row-by-row approval). Minority view: one voice wanted the 740 SAR income retraction (`858f6536`) held.
4. **Day shifts (3 of 3).** Apply the 69 that stay within a month; skip the 2 that cross a month (user `4fce9265`, 2026-09 to 2026-10) and leave them for the closed-month notice to raise with the user.
5. **Who approves (2 of 3).** Zero-risk types (decline marks removed T1, the refund mark move T2a/T2b, collected-notice incomes T3, own net-zero rows T7b, same-month day shifts T15) may be applied after the re-run without the owner, if the re-run reproduces the same rows, a Fable reviewer signs off the rolled-back test, and revert is proven. Every money-moving type (cash deposits T4, own-wallet T11/T9, unmatched refunds T8, lost-row inserts T6, the income retraction) needs the owner to approve a sample of those types before it is applied; the council declined to approve those itself.
6. **Revert test (adopted from one voice).** Prove the revert with recomputed per-user per-month totals, not only row values, and prove it does not overwrite an edit the user made to a repaired row after the apply (the audit old-values restore must be skipped for a row whose `edited_at` is later than the repair).
