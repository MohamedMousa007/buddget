# S8f: per-bank SMS accuracy, Egypt

Date 2026-11-19, model Haiku 5.5. Harness commit `a2545c85` (branch `claude/fable-5-prioritization-c5372d`). Read-only: no database writes, no Supabase calls. Only local exports were read. No message text, names, phone or account numbers appear here; banks and counts only.

**Result:** supported 0, partial 2 (National Bank of Egypt, CIB), not enough data 3 (HSBC Egypt, Vodafone Cash, QNB Egypt), one unnamed bucket with no verdict. "Booked correctly" is not measured for any bank. The verdicts rest on an upper bound from the account check (section 2), not on a measured accuracy.

## 1. Table, Egypt (EGP messages)

| Bank or wallet | Messages tested (train / holdout; users) | Booked (a live row exists) | Booked correctly | Main failure kinds (observed) | Verdict |
|---|---|---|---|---|---|
| National Bank of Egypt (`nbe`) | 158 (108 / 50; 3 users) | 154 (97%) | not measured; at most 64 (40%) | No account on 90 of 154 booked expenses (58%); 4 not booked | partial |
| CIB (`cib`) | 137 (98 / 39; 4 users) | 129 (94%) | not measured; at most 79 (58%) | No account on 50 of 129 (39%); category Other on 19 (15%); 8 not booked | partial |
| HSBC Egypt (`hsbceg`) | 53 (37 / 16; 1 user) | 50 (94%) | not measured; at most 49 (92%) | No account on 1; category Other on 3; 3 not booked | not enough data (one user) |
| Vodafone Cash, wallet (`vodafone`) | 10 (9 / 1; 3 users) | 5 (50%) | not measured; at most 0 | All 5 booked expenses have no account; category Other on 2; 5 not booked | not enough data (10 messages) |
| QNB Egypt (`qnbeg`) | 2 (1 / 1; 1 user) | 2 (100%) | not measured; at most 2 | Category Other on 2 | not enough data (2 messages) |
| Bank not named by the cascade (`unknown`) | 54 (42 / 12; 6 users) | 49 (91%) | not measured; at most 12 (22%) | No account on 37 of 49 (76%); category Other on 6 | not a bank; no verdict |
| **Total** | **414 (295 / 119)** | **389 (94%)** | not measured | 183 booked expenses with no account | |

Verdict rule: "supported" needs at least 90% correct on at least 20 messages. "Partial" here means at least 20 messages and the account check alone already caps the bank below 90%. It is a bound, not a measured accuracy. No bank reaches "supported".

## 2. What "booked correctly" needs, and why it is not measured

The S5c gate (`docs/launch/S5c-review.md`, gate 1) defines correct as amount, direction and account all right, with no user fix. The gold set cannot score that today:

- `src/lib/sms/gold/goldSet.json` labels only the split and the pair or FX expectations (top-up partner, relay partner, FX direction). It holds no amount, direction or account label for any message.
- The masked bodies replace digits with `#`, so the account tail cannot be read from them. Raw text survives only for a small recent subset (S3-dryrun: 196 of 960 messages).
- The live rows show what was booked, not whether it was right. The export has no user-confirmed flag.

So the "booked correctly" column is "not measured". The only bound available is the account check: a booked expense with no account (shown as Unassigned) cannot be right on account, so "at most" = booked minus expenses with no account. Income rows have no account column in the export and are counted as placed, which keeps the bound an upper one.

This means S5c gate 1 ("measurable with today's data") does not hold. Testers' messages labelled with amount, direction and account are needed before any bank can be listed with a number.

## 3. Method

- **Harness:** `src/lib/sms/gold` at `a2545c85`. `goldSet.json` gives the labels and split. `replayBanks` in `goldMetrics.ts` gives each message's bank, from the sender, a code pattern, the body, the same user's history of the digits, then other users' format. Nothing new was defined.
- **Gold suite:** `npx vitest run src/lib/sms/gold` passes: 4 files, 27 tests. The train and holdout metrics print only with the local export.
- **Population:** the 936 labelled ids. Egypt means currency EGP: 424 messages. 10 duplicate rows are excluded, leaving 414. 172 labelled rows carry no currency and no bank; they are left out of every table.
- **Booked:** a live expense or income row exists for the message in the local replay export (`.claude/sms-s2c-replay.json`). Account: the expense row has a payment method. Other: the expense category is Other or missing. The export's `sms_flags` column is empty for every row, so flags are not in the table.
- **Split:** the labels' `s` field, `t` for train and `h` for holdout, using the S1 md5 rule (about 30% holdout). Holdout is reported separately in the table.
- **Replay:** not run per bank. The counts above come from the live rows, so they describe what production booked, not what today's code would book.
- **Aggregation:** a scratch script (not committed) calls `replayBanks` and counts the rows. Adding a per-bank function to `goldMetrics.ts` would make this reproducible in the harness.

## 4. UAE and Saudi

- **UAE:** the gold set has no UAE bank. It has 2 AED messages, both under CIB. That is too few to say anything, so there is no UAE table. Testers' real UAE messages are needed.
- **Saudi:** the gold set does have data (327 SAR messages), but no Saudi bank is named by the cascade. 252 are unnamed, 70 are Barq (wallet) and 5 are STC Pay (wallet). There is no Saudi bank table. Saudi banks need testers' messages too.

## 5. Reproduce

Local files only, never committed: `.claude/sms-gold-inputs.json`, `.claude/sms-gold-bodies.json`, `.claude/sms-s2c-replay.json`. Run `npx vitest run src/lib/sms/gold` for the harness; the per-bank counts need the scratch aggregator described in section 3.
