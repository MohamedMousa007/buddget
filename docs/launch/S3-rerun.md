# S3 re-run: the dry run against batch 2

**PROVISIONAL, read only.** Date 2026-11-14. No write was made to the live database (every call was a `SELECT`), nothing was applied, and no database object was created. Rows are cited by the first 8 characters of the log id and users by the first 8 of the user id; no name, message text or account digits appear. This re-runs `docs/launch/S3-dryrun.md` (sections 10 to 12 are the rules applied here) after S2d.

## 1. The run

- Fresh export at 962 messages (960 before; `49170c90` and `72d3196e` arrived since, both after the S2c code push). Checksum of query A verified (md5 of all 962 rows equals the database's). Payment methods, debts and own-transfer answers re-read: same ids as the first run.
- Replayed on a clean detached worktree of **`0087710d`** (batch 2, last code commit `bbd1480d`): `TZ=Africa/Cairo npx vitest run src/lib/sms/gold/closingReplay.test.ts --reporter=verbose` (all 12 checks pass in modes A, B and C: 962 exported, 774 dispatched, 182 skipped, 6 refused as the same capture, 36 `possible_duplicate`, 48 of 962 change outcome class in mode A), then `TZ=Africa/Cairo npx vitest run -c scripts/qa/s3-vitest.config.ts`, then `python3 scripts/qa/s3-dryrun-report.py` and `python3 scripts/qa/s3-rerun-compare.py`.
- Rules of section 11 applied when classifying: the seven via-card rows are **flag only** (stay non-spend, no money effect); both 700 SAR deposits are kept (`78e0b305` flagged `possible_duplicate` by the replay); the five own-wallet purchases carry `topup_repaired`; the 69 same-month day shifts apply, the 2 month-crossers (`e9a89f51`, `f1c965f0`, user `4fce9265`) are skipped (T15c, held); the retracted income leg `858f6536` is retracted with the purchase `42136093`.
- Steps follow section 12: **step 1** zero-risk types, **step 2** money-moving types, a day apart.

Result: 184 messages differ (first run 177): **104 apply** (step 1: 80, step 2: 24), 58 hold, 22 no change.

## 2. Tables

### 2.1 Apply, by repair type

| repair type | rows | net money effect (by currency) |
|---|---|---|
| T1 un-reverse (decline stamp removed) | 2 | spend +5.70 USD |
| T11 purchase at own wallet becomes transfer | 5 | spend -4282.00 SAR |
| T15 date: UTC day instead of local day | 69 | none |
| T2a refund mark moves away | 1 | spend +5000.00 EGP |
| T2b refund mark moves here | 1 | spend -5000.00 EGP |
| T3 collected-notice income removed | 5 | income -7964.21 SAR |
| T4 cash deposit becomes transfer from cash | 4 | income -1450.00 SAR |
| T5 via-card: flag only | 7 | none |
| T6 lost row (confirmed, never booked) | 5 | spend +499.05 EGP; income +200.00 SAR; spend +99.99 SAR |
| T7b own net-zero row for a decline or unmatched refund | 2 | none |
| T8 unmatched refund leaves income | 2 | income -29.23 SAR |
| T9 income leg retracted by a new pair | 1 | income -740.00 SAR |

### 2.2 Apply, by user

| user | rows | net money effect (by currency) |
|---|---|---|
| `0c1a609e` | 2 | none |
| `4fce9265` | 33 | spend +0.00 EGP |
| `6090c8e7` | 2 | spend +5.70 USD |
| `b85f074d` | 2 | spend +499.05 EGP |
| `f923c68b` | 65 | income -9983.44 SAR; spend -4182.01 SAR |

### 2.3 Apply, by user and month (nonzero effect)

| user | currency | month | spending | income |
|---|---|---|---|---|
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
| T15c day shift across a month | 2 | income +0.00 EGP; spend +0.00 EGP |
| T16 flag only | 26 | none |
| T2c refund stamp the new rules would not place | 1 | spend +20.40 SAR |
| T6a never surfaced (add_failed) | 1 | spend +22.00 SAR |
| T6c income with an equal partner message | 5 | income +692.92 SAR |
| T6d confirmed income with no row | 3 | income +109.55 SAR |
| T6e booked then removed | 2 | income +3.00 EGP |
| T7b own net-zero row for a decline or unmatched refund | 1 | none |

### 2.5 No change, by type

| type | rows | net money effect (by currency) |
|---|---|---|
| B replay-blind pair | 6 | income +8500.00 EGP |
| P post-deploy row (booked by the new code) | 5 | spend -30.00 SAR |
| T15 date: UTC day instead of local day | 1 | none |
| T6 no live row, replay books | 10 | spend +2333.54 EGP; spend +105.74 SAR |

### 2.6 Every row proposed

| log | user | live state | proposed state | fields | money effect | repair type: reason |
|---|---|---|---|---|---|---|
| `9e75b537` | `f923c68b` | netzero ATM Cash Withdrawal 4000 EGP 2026-08-24 refund<-0fe8887c | nonspend ATM Cash Withdrawal 4000 EGP 2026-08-24 | class, refund mark | none | T1 un-reverse (decline stamp removed): I2: a decline changes only its own row |
| `572aaf39` | `6090c8e7` | netzero Subscription 5.7 USD 2026-10-27 refund<-4a7d7250 | spend Other 5.7 USD 2026-10-27 | class, refund mark | spend +5.7 USD 2026-10 | T1 un-reverse (decline stamp removed): I2: a decline changes only its own row |
| `08ca4f8f` | `f923c68b` | spend Utilities 1020 SAR 2026-08-20 | nonspend Transfer 1020 SAR 2026-08-20 flags=topup_repaired | class, flags | spend -1020 SAR 2026-08 | T11 purchase at own wallet becomes transfer: I3: own_wallet_exact settles alone |
| `101646f0` | `f923c68b` | spend Utilities 1500 SAR 2026-09-01 | nonspend Transfer 1500 SAR 2026-09-01 flags=topup_repaired | class, flags | spend -1500 SAR 2026-09 | T11 purchase at own wallet becomes transfer: I3: own_wallet_exact settles alone |
| `170910a1` | `f923c68b` | spend Utilities 560 SAR 2026-09-02 | nonspend Transfer 560 SAR 2026-09-02 flags=topup_repaired | class, flags | spend -560 SAR 2026-09 | T11 purchase at own wallet becomes transfer: I3: own_wallet_exact settles alone |
| `42136093` | `f923c68b` | spend Utilities 740 SAR 2026-09-02 | nonspend Transfer 740 SAR 2026-09-02 flags=topup_repaired | class, flags, pairing | spend -740 SAR 2026-09 | T11 purchase at own wallet becomes transfer: I3: own_wallet_exact settles alone |
| `8eb8cbf1` | `f923c68b` | spend Utilities 462 SAR 2026-08-03 | nonspend Transfer 462 SAR 2026-08-03 flags=topup_repaired | class, flags | spend -462 SAR 2026-08 | T11 purchase at own wallet becomes transfer: I3: own_wallet_exact settles alone |
| `737c4e4c` | `0c1a609e` | spend Other 0.49 EGP 2026-09-02 | spend Utilities 0.49 EGP 2026-09-03 | date | none | T15 date: UTC day instead of local day: P3-3: the stored day was the UTC day of the arrival, the local day differs |
| `964329e2` | `0c1a609e` | spend Other 0.66 EGP 2026-08-04 | spend Utilities 0.66 EGP 2026-08-05 | date | none | T15 date: UTC day instead of local day: P3-3: the stored day was the UTC day of the arrival, the local day differs |
| `02370960` | `f923c68b` | income income other 6 SAR 2026-09-16 | income income other 6 SAR 2026-09-17 | date | none | T15 date: UTC day instead of local day: P3-3: the stored day was the UTC day of the arrival, the local day differs |
| `0e268220` | `f923c68b` | spend Utilities 815 SAR 2026-10-21 | spend Utilities 815 SAR 2026-10-22 | date | none | T15 date: UTC day instead of local day: P3-3: the stored day was the UTC day of the arrival, the local day differs |
| `1bc06eff` | `f923c68b` | spend Subscription 22.79 SAR 2026-09-17 | spend Subscription 22.79 SAR 2026-09-18 | date | none | T15 date: UTC day instead of local day: P3-3: the stored day was the UTC day of the arrival, the local day differs |
| `1f227acd` | `f923c68b` | income income other 182.46 SAR 2026-10-21 | income income other 182.46 SAR 2026-10-22 flags=wallet_unregistered | date, flags | none | T15 date: UTC day instead of local day: P3-3: the stored day was the UTC day of the arrival, the local day differs |
| `2696fffc` | `f923c68b` | spend Remittance 986.11 SAR 2026-10-21 | spend Remittance 986.11 SAR 2026-10-22 | date | none | T15 date: UTC day instead of local day: P3-3: the stored day was the UTC day of the arrival, the local day differs |
| `2d489411` | `f923c68b` | income income other 490 SAR 2026-09-06 | income income other 490 SAR 2026-09-07 flags=wallet_unregistered | date, flags | none | T15 date: UTC day instead of local day: P3-3: the stored day was the UTC day of the arrival, the local day differs |
| `38273fe0` | `f923c68b` | spend Utilities 1.27 SAR 2026-09-22 | spend Utilities 1.27 SAR 2026-09-23 | date | none | T15 date: UTC day instead of local day: P3-3: the stored day was the UTC day of the arrival, the local day differs |
| `418baa26` | `f923c68b` | income income other 11 SAR 2026-10-24 | income income other 11 SAR 2026-10-25 flags=possible_duplicate,wallet_unregistered | date, flags | none | T15 date: UTC day instead of local day: P3-3: the stored day was the UTC day of the arrival, the local day differs |
| `43df3d24` | `f923c68b` | spend Utilities 84.99 SAR 2026-07-27 | spend Utilities 84.99 SAR 2026-07-28 | date | none | T15 date: UTC day instead of local day: P3-3: the stored day was the UTC day of the arrival, the local day differs |
| `5b82b8d1` | `f923c68b` | income income other 500 SAR 2026-09-23 | income income other 500 SAR 2026-09-24 flags=wallet_unregistered | date, flags | none | T15 date: UTC day instead of local day: P3-3: the stored day was the UTC day of the arrival, the local day differs |
| `5d996a3d` | `f923c68b` | spend Other 16.99 SAR 2026-07-27 | spend Utilities 16.99 SAR 2026-07-28 | date | none | T15 date: UTC day instead of local day: P3-3: the stored day was the UTC day of the arrival, the local day differs |
| `5f30dca3` | `f923c68b` | spend Food 43.05 SAR 2026-09-14 | spend Food 43.05 SAR 2026-09-15 | date | none | T15 date: UTC day instead of local day: P3-3: the stored day was the UTC day of the arrival, the local day differs |
| `603fea1a` | `f923c68b` | income income other 529 SAR 2026-08-02 | income income other 529 SAR 2026-08-03 flags=wallet_unregistered | date, flags | none | T15 date: UTC day instead of local day: P3-3: the stored day was the UTC day of the arrival, the local day differs |
| `62f1ee29` | `f923c68b` | spend Food 70 SAR 2026-09-21 | spend Food 70 SAR 2026-09-22 | date | none | T15 date: UTC day instead of local day: P3-3: the stored day was the UTC day of the arrival, the local day differs |
| `7d938107` | `f923c68b` | income income other 1.27 SAR 2026-09-22 | income income other 1.27 SAR 2026-09-23 flags=wallet_unregistered | date, flags | none | T15 date: UTC day instead of local day: P3-3: the stored day was the UTC day of the arrival, the local day differs |
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
| `d88c2d29` | `f923c68b` | income income other 250 SAR 2026-10-24 | income income other 250 SAR 2026-10-25 flags=wallet_unregistered | date, flags | none | T15 date: UTC day instead of local day: P3-3: the stored day was the UTC day of the arrival, the local day differs |
| `ded7b224` | `f923c68b` | spend Shopping 5 SAR 2026-10-21 | spend Other 5 SAR 2026-10-22 | date | none | T15 date: UTC day instead of local day: P3-3: the stored day was the UTC day of the arrival, the local day differs |
| `e7d07863` | `f923c68b` | income income other 1449.91 SAR 2026-08-02 | income income other 1449.91 SAR 2026-08-03 flags=wallet_unregistered | date, flags | none | T15 date: UTC day instead of local day: P3-3: the stored day was the UTC day of the arrival, the local day differs |
| `e97c0b1c` | `f923c68b` | spend Other 75 SAR 2026-09-19 | spend Other 75 SAR 2026-09-20 | date | none | T15 date: UTC day instead of local day: P3-3: the stored day was the UTC day of the arrival, the local day differs |
| `f2fd7bca` | `f923c68b` | spend Utilities 16.99 SAR 2026-07-27 | spend Utilities 16.99 SAR 2026-07-28 | date | none | T15 date: UTC day instead of local day: P3-3: the stored day was the UTC day of the arrival, the local day differs |
| `f41cd3f6` | `f923c68b` | spend Shopping 55.38 SAR 2026-08-09 | spend Other 55.38 SAR 2026-08-10 | date | none | T15 date: UTC day instead of local day: P3-3: the stored day was the UTC day of the arrival, the local day differs |
| `f53ec0e1` | `f923c68b` | spend Utilities 23 SAR 2026-09-16 | spend Utilities 23 SAR 2026-09-17 | date | none | T15 date: UTC day instead of local day: P3-3: the stored day was the UTC day of the arrival, the local day differs |
| `f725fe98` | `f923c68b` | spend Remittance 105.74 SAR 2026-09-22 | spend Remittance 105.74 SAR 2026-09-23 | date | none | T15 date: UTC day instead of local day: P3-3: the stored day was the UTC day of the arrival, the local day differs |
| `fe9b02c1` | `f923c68b` | income income other 815 SAR 2026-10-21 | income income other 815 SAR 2026-10-22 flags=possible_duplicate,wallet_unregistered | date, flags | none | T15 date: UTC day instead of local day: P3-3: the stored day was the UTC day of the arrival, the local day differs |
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
| `e9b96491` | `4fce9265` | spend Utilities 315.6 EGP 2026-09-18 | spend Utilities 315.6 EGP 2026-09-19 | date | none | T15 date: UTC day instead of local day: P3-3: the stored day was the UTC day of the arrival, the local day differs |
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
| `51966294` | `f923c68b` | nonspend CC Payoff 225.1 SAR 2026-07-22 | nonspend CC Payoff 225.1 SAR 2026-07-22 flags=card_flag | flags | none | T5 via-card: flag only: council verdict 1: not repaired, stays non-spend, a flag lets the user confirm in one tap |
| `5fe0a498` | `f923c68b` | nonspend CC Payoff 950 SAR 2026-08-10 | nonspend CC Payoff 950 SAR 2026-08-10 flags=card_flag | flags | none | T5 via-card: flag only: council verdict 1: not repaired, stays non-spend, a flag lets the user confirm in one tap |
| `6cde6c02` | `f923c68b` | nonspend CC Payoff 450 SAR 2026-08-23 | nonspend CC Payoff 450 SAR 2026-08-23 flags=card_flag | flags | none | T5 via-card: flag only: council verdict 1: not repaired, stays non-spend, a flag lets the user confirm in one tap |
| `81144634` | `f923c68b` | nonspend CC Payoff 750 SAR 2026-08-24 | nonspend CC Payoff 750 SAR 2026-08-24 flags=card_flag | flags | none | T5 via-card: flag only: council verdict 1: not repaired, stays non-spend, a flag lets the user confirm in one tap |
| `82133010` | `f923c68b` | nonspend CC Payoff 500 SAR 2026-08-14 | nonspend CC Payoff 500 SAR 2026-08-14 flags=card_flag | flags | none | T5 via-card: flag only: council verdict 1: not repaired, stays non-spend, a flag lets the user confirm in one tap |
| `b61afd88` | `f923c68b` | nonspend CC Payoff 6 SAR 2026-10-26 | nonspend CC Payoff 6 SAR 2026-10-26 flags=card_flag | flags | none | T5 via-card: flag only: council verdict 1: not repaired, stays non-spend, a flag lets the user confirm in one tap |
| `c18dabf3` | `f923c68b` | nonspend CC Payoff 1600 SAR 2026-09-03 | nonspend CC Payoff 1600 SAR 2026-09-03 flags=card_flag | flags | none | T5 via-card: flag only: council verdict 1: not repaired, stays non-spend, a flag lets the user confirm in one tap |
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
| `e9a89f51` | `4fce9265` | spend Instapay 310 EGP 2026-09-30 | spend Instapay 310 EGP 2026-10-01 | date | spend -310 EGP 2026-09; spend +310 EGP 2026-10 | T15c day shift across a month: council verdict 4: skipped, left for the closed-month notice to raise with the user |
| `f1c965f0` | `4fce9265` | income income other 155 EGP 2026-09-30 | income income other 155 EGP 2026-10-01 | date | income -155 EGP 2026-09; income +155 EGP 2026-10 | T15c day shift across a month: council verdict 4: skipped, left for the closed-month notice to raise with the user |
| `3bb1b11f` | `0c1a609e` | spend Utilities 5 EGP 2026-09-05 | spend Utilities 5 EGP 2026-09-05 flags=possible_duplicate | flags | none | T16 flag only: possible_duplicate is an upper bound on masked text; no money effect |
| `5e412763` | `0c1a609e` | spend Subscription 57 EGP 2026-08-10 | spend Utilities 57 EGP 2026-08-10 flags=possible_duplicate | flags | none | T16 flag only: possible_duplicate is an upper bound on masked text; no money effect |
| `8c49d517` | `0c1a609e` | nonspend ATM Cash Withdrawal 12000 EGP 2026-08-02 | nonspend ATM Cash Withdrawal 12000 EGP 2026-08-02 flags=possible_duplicate | flags | none | T16 flag only: possible_duplicate is an upper bound on masked text; no money effect |
| `8e2a41a7` | `0c1a609e` | nonspend ATM Cash Withdrawal 6000 EGP 2026-08-02 | nonspend ATM Cash Withdrawal 6000 EGP 2026-08-02 flags=possible_duplicate | flags | none | T16 flag only: possible_duplicate is an upper bound on masked text; no money effect |
| `4705a6e2` | `f923c68b` | spend Food 9 SAR 2026-08-20 | spend Food 9 SAR 2026-08-20 flags=possible_duplicate | flags | none | T16 flag only: possible_duplicate is an upper bound on masked text; no money effect |
| `707f77cc` | `f923c68b` | nonspend ATM Cash Withdrawal 1800 EGP 2026-08-24 | nonspend ATM Cash Withdrawal 1800 EGP 2026-08-24 flags=possible_duplicate | flags | none | T16 flag only: possible_duplicate is an upper bound on masked text; no money effect |
| `7294e4b8` | `f923c68b` | income income other 2000 SAR 2026-09-14 | income income other 2000 SAR 2026-09-14 flags=wallet_unregistered | flags | none | T16 flag only: possible_duplicate is an upper bound on masked text; no money effect |
| `8a0ccb11` | `f923c68b` | nonspend ATM Cash Withdrawal 2800 EGP 2026-09-09 | nonspend ATM Cash Withdrawal 2800 EGP 2026-09-09 flags=possible_duplicate | flags | none | T16 flag only: possible_duplicate is an upper bound on masked text; no money effect |
| `8f95e33b` | `f923c68b` | income income other 999 SAR 2026-08-11 | income income other 999 SAR 2026-08-11 flags=wallet_unregistered | flags | none | T16 flag only: possible_duplicate is an upper bound on masked text; no money effect |
| `99af4bc6` | `f923c68b` | income income other 144 SAR 2026-09-19 | income income other 144 SAR 2026-09-19 flags=wallet_unregistered | flags | none | T16 flag only: possible_duplicate is an upper bound on masked text; no money effect |
| `afaa06c6` | `f923c68b` | income income other 150 SAR 2026-08-18 | income income other 150 SAR 2026-08-18 flags=wallet_unregistered | flags | none | T16 flag only: possible_duplicate is an upper bound on masked text; no money effect |
| `b2fe5da1` | `f923c68b` | spend Other 2 SAR 2026-08-19 | spend Other 2 SAR 2026-08-19 flags=possible_duplicate | flags | none | T16 flag only: possible_duplicate is an upper bound on masked text; no money effect |
| `e3ee87c9` | `f923c68b` | spend Other 10 SAR 2026-08-18 | spend Other 10 SAR 2026-08-18 flags=possible_duplicate | flags | none | T16 flag only: possible_duplicate is an upper bound on masked text; no money effect |
| `e94b14ff` | `f923c68b` | income income other 470 SAR 2026-08-23 | income income other 470 SAR 2026-08-23 flags=wallet_unregistered | flags | none | T16 flag only: possible_duplicate is an upper bound on masked text; no money effect |
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
| `aa5ece0a` | `f923c68b` | none | spend Other 22 SAR 2026-09-13 | class | spend +22 SAR 2026-09 | T6a never surfaced (add_failed): held row never answered; book or confirm absent |
| `029bb171` | `f923c68b` | none | income income other 400 SAR 2026-07-05 | class | income +400 SAR 2026-07 | T6c income with an equal partner message: looks like a wallet top-up or own-transfer credit; the replay cannot see the wallet state at arrival |
| `1836b194` | `f923c68b` | none | income income other 2 SAR 2026-07-16 flags=wallet_unregistered | class | income +2 SAR 2026-07 | T6c income with an equal partner message: looks like a wallet top-up or own-transfer credit; the replay cannot see the wallet state at arrival |
| `3a23c230` | `f923c68b` | none | income income other 88 SAR 2026-09-21 flags=wallet_unregistered | class | income +88 SAR 2026-09 | T6c income with an equal partner message: looks like a wallet top-up or own-transfer credit; the replay cannot see the wallet state at arrival |
| `5d039bb4` | `f923c68b` | none | income income other 104.92 SAR 2026-09-19 flags=wallet_unregistered | class | income +104.92 SAR 2026-09 | T6c income with an equal partner message: looks like a wallet top-up or own-transfer credit; the replay cannot see the wallet state at arrival |
| `db68d2cb` | `f923c68b` | none | income income other 98 SAR 2026-09-22 flags=wallet_unregistered | class | income +98 SAR 2026-09 | T6c income with an equal partner message: looks like a wallet top-up or own-transfer credit; the replay cannot see the wallet state at arrival |
| `41911e9c` | `f923c68b` | none | income income other 16 SAR 2026-07-05 flags=wallet_unregistered | class | income +16 SAR 2026-07 | T6d confirmed income with no row: confirmed but never booked; the replay cannot see why (wallet state at arrival) |
| `aea556b8` | `f923c68b` | none | income income other 29.41 SAR 2026-06-30 flags=wallet_unregistered | class | income +29.41 SAR 2026-06 | T6d confirmed income with no row: confirmed but never booked; the replay cannot see why (wallet state at arrival) |
| `d54d2ac1` | `f923c68b` | none | income income other 64.14 SAR 2026-06-30 flags=possible_duplicate,wallet_unregistered | class | income +64.14 SAR 2026-06 | T6d confirmed income with no row: confirmed but never booked; the replay cannot see why (wallet state at arrival) |
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
| `04ee053d` | `f923c68b` | spend Shopping 30 SAR 2026-11-14 | spend Other 30 SAR 2026-11-14 | - | none | P post-deploy row (booked by the new code): created after the S2c code push; the new code already decided it |
| `bee80656` | `f923c68b` | income income other 125 SAR 2026-11-14 | income income other 125 SAR 2026-11-14 | - | none | P post-deploy row (booked by the new code): created after the S2c code push; the new code already decided it |
| `d80f99a9` | `f923c68b` | spend Shopping 30 SAR 2026-11-14 | none | class | spend -30 SAR 2026-11 | P post-deploy row (booked by the new code): created after the S2c code push; the new code already decided it |
| `49170c90` | `1f0b4fcb` | spend Other 500 EGP 2026-11-14 | spend Other 500 EGP 2026-11-14 | - | none | P post-deploy row (booked by the new code): created after the S2c code push; the new code already decided it |
| `72d3196e` | `1f0b4fcb` | spend Instapay 1601.6 EGP 2026-11-14 | spend Instapay 1601.6 EGP 2026-11-14 | - | none | P post-deploy row (booked by the new code): created after the S2c code push; the new code already decided it |
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

## 3. Row-by-row comparison with the first run

same 146 changed 31 disappeared 0 new 7. "Same" means the same repair type, decision and proposed state; the rows below changed or are new. Nothing disappeared.

Reasons, in short: the seven via-card rows moved from "hold, spending" to "apply, flag only" (verdict 1); `e9a89f51` and `f1c965f0` moved from apply to hold (verdict 4); the five own-wallet purchases now carry `topup_repaired`; S2d stamps `wallet_unregistered` on 21 credits of user `f923c68b`, which changes the proposed state of 16 listed rows (9 day shifts, 7 held incomes; no change of type) and adds 5 flag-only rows; two new rows arrived after the S2c push and are "no change".

| log | user | first run | this run | reason |
|---|---|---|---|---|
| `04ee053d` | `f923c68b` | P post-deploy row (booked by the new code) / no change | P post-deploy row (booked by the new code) / no change | arrived after the first run; booked by newer code |
| `08ca4f8f` | `f923c68b` | T11 purchase at own wallet becomes transfer / apply | T11 purchase at own wallet becomes transfer / apply | carries the new `topup_repaired` flag (S2d) |
| `101646f0` | `f923c68b` | T11 purchase at own wallet becomes transfer / apply | T11 purchase at own wallet becomes transfer / apply | carries the new `topup_repaired` flag (S2d) |
| `170910a1` | `f923c68b` | T11 purchase at own wallet becomes transfer / apply | T11 purchase at own wallet becomes transfer / apply | carries the new `topup_repaired` flag (S2d) |
| `1836b194` | `f923c68b` | T6c income with an equal partner message / hold | T6c income with an equal partner message / hold | S2d stamps `wallet_unregistered` on this credit (forward rule); the repair type is unchanged |
| `1f227acd` | `f923c68b` | T15 date: UTC day instead of local day / apply | T15 date: UTC day instead of local day / apply | S2d stamps `wallet_unregistered` on this credit (forward rule); the repair type is unchanged |
| `2d489411` | `f923c68b` | T15 date: UTC day instead of local day / apply | T15 date: UTC day instead of local day / apply | S2d stamps `wallet_unregistered` on this credit (forward rule); the repair type is unchanged |
| `3a23c230` | `f923c68b` | T6c income with an equal partner message / hold | T6c income with an equal partner message / hold | S2d stamps `wallet_unregistered` on this credit (forward rule); the repair type is unchanged |
| `418baa26` | `f923c68b` | T15 date: UTC day instead of local day / apply | T15 date: UTC day instead of local day / apply | S2d stamps `wallet_unregistered` on this credit (forward rule); the repair type is unchanged |
| `41911e9c` | `f923c68b` | T6d confirmed income with no row / hold | T6d confirmed income with no row / hold | S2d stamps `wallet_unregistered` on this credit (forward rule); the repair type is unchanged |
| `42136093` | `f923c68b` | T11 purchase at own wallet becomes transfer / apply | T11 purchase at own wallet becomes transfer / apply | carries the new `topup_repaired` flag (S2d) |
| `51966294` | `f923c68b` | T5 via-card payment becomes spending / hold | T5 via-card: flag only / apply | council verdict 1: via-card rows flag only, no longer a spending change |
| `5b82b8d1` | `f923c68b` | T15 date: UTC day instead of local day / apply | T15 date: UTC day instead of local day / apply | S2d stamps `wallet_unregistered` on this credit (forward rule); the repair type is unchanged |
| `5d039bb4` | `f923c68b` | T6c income with an equal partner message / hold | T6c income with an equal partner message / hold | S2d stamps `wallet_unregistered` on this credit (forward rule); the repair type is unchanged |
| `5fe0a498` | `f923c68b` | T5 via-card payment becomes spending / hold | T5 via-card: flag only / apply | council verdict 1: via-card rows flag only, no longer a spending change |
| `603fea1a` | `f923c68b` | T15 date: UTC day instead of local day / apply | T15 date: UTC day instead of local day / apply | S2d stamps `wallet_unregistered` on this credit (forward rule); the repair type is unchanged |
| `6cde6c02` | `f923c68b` | T5 via-card payment becomes spending / hold | T5 via-card: flag only / apply | council verdict 1: via-card rows flag only, no longer a spending change |
| `7d938107` | `f923c68b` | T15 date: UTC day instead of local day / apply | T15 date: UTC day instead of local day / apply | S2d stamps `wallet_unregistered` on this credit (forward rule); the repair type is unchanged |
| `81144634` | `f923c68b` | T5 via-card payment becomes spending / hold | T5 via-card: flag only / apply | council verdict 1: via-card rows flag only, no longer a spending change |
| `82133010` | `f923c68b` | T5 via-card payment becomes spending / hold | T5 via-card: flag only / apply | council verdict 1: via-card rows flag only, no longer a spending change |
| `8eb8cbf1` | `f923c68b` | T11 purchase at own wallet becomes transfer / apply | T11 purchase at own wallet becomes transfer / apply | carries the new `topup_repaired` flag (S2d) |
| `aea556b8` | `f923c68b` | T6d confirmed income with no row / hold | T6d confirmed income with no row / hold | S2d stamps `wallet_unregistered` on this credit (forward rule); the repair type is unchanged |
| `b61afd88` | `f923c68b` | T5 via-card payment becomes spending / hold | T5 via-card: flag only / apply | council verdict 1: via-card rows flag only, no longer a spending change |
| `c18dabf3` | `f923c68b` | T5 via-card payment becomes spending / hold | T5 via-card: flag only / apply | council verdict 1: via-card rows flag only, no longer a spending change |
| `d54d2ac1` | `f923c68b` | T6d confirmed income with no row / hold | T6d confirmed income with no row / hold | S2d stamps `wallet_unregistered` on this credit (forward rule); the repair type is unchanged |
| `d88c2d29` | `f923c68b` | T15 date: UTC day instead of local day / apply | T15 date: UTC day instead of local day / apply | S2d stamps `wallet_unregistered` on this credit (forward rule); the repair type is unchanged |
| `db68d2cb` | `f923c68b` | T6c income with an equal partner message / hold | T6c income with an equal partner message / hold | S2d stamps `wallet_unregistered` on this credit (forward rule); the repair type is unchanged |
| `e7d07863` | `f923c68b` | T15 date: UTC day instead of local day / apply | T15 date: UTC day instead of local day / apply | S2d stamps `wallet_unregistered` on this credit (forward rule); the repair type is unchanged |
| `e9a89f51` | `4fce9265` | T15 date: UTC day instead of local day / apply | T15c day shift across a month / hold | council verdict 4: crosses a month, skipped |
| `f1c965f0` | `4fce9265` | T15 date: UTC day instead of local day / apply | T15c day shift across a month / hold | council verdict 4: crosses a month, skipped |
| `fe9b02c1` | `f923c68b` | T15 date: UTC day instead of local day / apply | T15 date: UTC day instead of local day / apply | S2d stamps `wallet_unregistered` on this credit (forward rule); the repair type is unchanged |
| `49170c90` | `1f0b4fcb` | no difference | P post-deploy row (booked by the new code) / no change | arrived after the first run; booked by newer code |
| `7294e4b8` | `f923c68b` | no difference | T16 flag only / hold | S2d stamps `wallet_unregistered` on this credit (forward rule); the repair type is unchanged |
| `72d3196e` | `1f0b4fcb` | no difference | P post-deploy row (booked by the new code) / no change | arrived after the first run; booked by newer code |
| `8f95e33b` | `f923c68b` | no difference | T16 flag only / hold | S2d stamps `wallet_unregistered` on this credit (forward rule); the repair type is unchanged |
| `99af4bc6` | `f923c68b` | no difference | T16 flag only / hold | S2d stamps `wallet_unregistered` on this credit (forward rule); the repair type is unchanged |
| `afaa06c6` | `f923c68b` | no difference | T16 flag only / hold | S2d stamps `wallet_unregistered` on this credit (forward rule); the repair type is unchanged |
| `e94b14ff` | `f923c68b` | no difference | T16 flag only / hold | S2d stamps `wallet_unregistered` on this credit (forward rule); the repair type is unchanged |

## 4. Prompts and stale months the batch would cause

- **Prompts** (flags on the proposed row that the live row lacks; day shifts change the date only): all for user `f923c68b`, none for any other user. 4 `cash_deposit` (one of them also `possible_duplicate`), 2 `refund_unmatched`, 5 `topup_repaired`, 7 via-card flags (flag name to be fixed with the S2d card-load rule): **18 rows, 18 prompts**. If the repair also stamped `wallet_unregistered` on the 21 credits the replay flags (all user `f923c68b`; 9 are day-shift rows, 12 are held), that adds 21: **39**.
- **Stale months** (closed months where a row is written, retyped or moved; the repair moves `updated_at`, so N15 shows them as out of date and asks once): 11 user-months: `4fce9265` 2026-08, 09, 10; `f923c68b` 2026-07, 08, 09, 10; `6090c8e7` 2026-10; `0c1a609e` 2026-08, 09; `b85f074d` 2026-07. Whether each month actually shows stale depends on the 1-base-unit rule of S2d.
- Predicted effect to check after step 1 and 2: table 2.3, with the query `scripts/qa/s3-totals.sql` (part 5).

## 5. The step 1 check query

`scripts/qa/s3-totals.sql`: per user, currency and month, spending and income of the SMS-booked live rows. Run before any step, after step 1 (expect the step 1 rows of table 2.3 only) and after the revert test (expect the starting figures).

## 6. Not done in this turn, and why

Items 2 and 4 of the request (the apply tooling as a migration applied to the live database, the one-off script, and the full rolled-back test on the live database) were **not started**. They create objects in, and write inside a transaction to, the live database, which this task's rules forbade ("no INSERT, UPDATE, DELETE, no migration, no DDL") and the owner has not allowed in this session; the request arrived from another session, and a session cannot grant that. Everything that is read only is done. The design is in `S3-dryrun.md` part 7 and sections 10 to 12; the amended condition 3 (no `edited_at` bump; prove `server_rev` stops a stale phone in both orders) is noted for the test.

## 7. Log ids that pass every check so far

These pass the dry-run checks only (reproduced by the replay, no strong user-touch signal, a live value equal to the one in the export of this run); the rolled-back test and the live-value check at apply time have **not** run.

**Step 1 (80 rows):** `009635ef`, `02370960`, `052776ad`, `0b411178`, `0e268220`, `0f303bf6`, `0fe8887c`, `1271e1f5`, `15195109`, `1bc06eff`, `1d5deffc`, `1f227acd`, `223b708e`, `267addad`, `2696fffc`, `2d489411`, `37236069`, `38273fe0`, `38960cf2`, `39420937`, `3a49147e`, `3c150811`, `418baa26`, `43df3d24`, `4a7d7250`, `4b5d53d7`, `4cbd056b`, `51f55912`, `56dfbf6d`, `572aaf39`, `5ab3bd01`, `5b82b8d1`, `5bdc7499`, `5d996a3d`, `5f30dca3`, `603fea1a`, `62f1ee29`, `6321e500`, `65921ad1`, `737c4e4c`, `77ee02f0`, `7d938107`, `8a94eede`, `8ad101f4`, `9006ea5e`, `91e00bb4`, `93e7ec95`, `964329e2`, `9684468b`, `97fca7d5`, `9c9c11e5`, `9d4ba02e`, `9e75b537`, `a16812c9`, `ab14b78e`, `ab5411e0`, `ad65a2d0`, `b45c86b1`, `bdc14d28`, `bed3bd49`, `bfe884e3`, `c4ff2489`, `c923b3eb`, `cb25279f`, `d35340ff`, `d45ec5c8`, `d6a4de7d`, `d88c2d29`, `ded7b224`, `e7d07863`, `e8b0e3ed`, `e97c0b1c`, `e9b96491`, `f2fd7bca`, `f41cd3f6`, `f53ec0e1`, `f725fe98`, `f7ca66eb`, `fe9b02c1`, `ff197921`

**Step 2 (24 rows):** `0812aa55`, `08ca4f8f`, `101646f0`, `170910a1`, `42136093`, `51966294`, `540077ff`, `5fe0a498`, `6cde6c02`, `78e0b305`, `81144634`, `818b0736`, `82133010`, `858f6536`, `8eb8cbf1`, `916e58d4`, `a19ff882`, `acbe9dd7`, `ad8523cb`, `b61afd88`, `c18dabf3`, `cb5fd476`, `ec6ae237`, `fa2a8ec2`

**Excluded:** held (58 rows, reasons in 2.7); no change (22 rows, reasons in 2.8): user-deleted rows, replay-blind pairs, post-push rows, and `ed392c08` (a user note).

**Nothing applied.**
