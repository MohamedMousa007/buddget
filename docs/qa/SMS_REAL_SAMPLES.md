# SMS samples (live DB tzioppxwsljhlglyducm)

Search scope: table sms_parse_log (~1,028 rows, received_at 2026-06-16 to 2026-11-18, all searched). Columns: masked_body (1,026 rows, digits hashed to #), raw_body (239 rows, raw_expires_at null), kind, category, amount, currency, leg_direction, paired_log_id, own_transfer_verdict, parse_method, received_at. Counts: 4 kind=currency_exchange, 26 atm_withdrawal, 68 HSBC-ish. 8 queries run. Sender column is empty on these rows.

## A. Two transactions in one SMS: NOT FOUND (no clean case)
Regex scans for two purchase/debit clauses or 2+ amounts found nothing. Nearest: Vodafone Cash (2026-11-01), amount plus fee in one text, kind null (not parsed as a transaction):
"##### L.E were successfully transferred to [PHONE] the transfer fee is # LE, your current Vodafone Cash balance is #.# L.E. Transaction date: ... Transaction ID: [REF] ..."
Implication: amount+fee in one body exists; no HSBC double-purchase sample in the data.

## B. HSBC ATM withdrawal: FOUND (3 raw, English)
Disabled pattern hsbc-atm-withdrawal (src/lib/sms/patterns/hsbc.ts, verified:false) expects "Account ****1234 was debited [with] [an] ATM [cash] withdrawal of|for EGP n".
Real wording (raw):
- "From HSBC: 09NOV26 ATM Cash Withdrawal from 103-104***-001 EGP 300.00- Your available balance is EGP 116.63"
- "From HSBC: 31OCT26 ATM Cash Withdrawal from 103-104***-001 EGP 1,000.00- Your available balance is EGP 3,270.17"
- "From HSBC: 12NOV26 ATM Cash Withdrawal from 103-104***-001 EGP 300.00- Your available balance is EGP 2,877.27"
Parsed: kind=atm_withdrawal, category "ATM Cash Withdrawal", account_last4 "001", amount 300 / 1000 EGP, parse_method template (2) and ai_new (1), pattern_id null.
Implication: real wording does NOT match the disabled regex (no "Account ***", no "was debited", "from" instead of "of/for", trailing "-" sign). Needs a new curated pattern like the existing FX ones: `(\d{1,2}[A-Z]{3}\d{2})\s+ATM\s+Cash\s+Withdrawal\s+from\s+([\d\-*]+)\s+([A-Z]{3})\s+([\d,.]+)-`. Account id is the "103-104***-001" form; last4 captured as "001". Also seen from another bank: "ATM Cash Withdrawal of EGP n has been debited from your account XXXX on d/m/y".

## C. HSBC own-account FX pairs: FOUND (2 pairs, both paired)
Pair 1 (2026-11-05)
- credit: "From HSBC: 05NOV26 Phone Banking Transfer to 103-104***-001 EGP 28,705.71+ Your available balance is EGP 28,711.64" received 16:03:23Z
- debit: "From HSBC: 05NOV26 Phone Banking Transfer from 103-104***-110 USD 532.87- Your available balance is USD 0.00" received 16:04:24Z
- Gap 61 s (credit first). Implied rate 28705.71/532.87 = 53.87.
Pair 2 (2026-11-10)
- debit: "... 10NOV26 Phone Banking Transfer from 103-104***-110 USD 567.07- ... balance is USD 0.00" received 14:39:24Z
- credit: "... 10NOV26 Phone Banking Transfer to 103-104***-001 EGP 30,196.48+ ... balance is EGP 30,197.35" received 14:39:31Z
- Gap 7 s (debit first). Implied rate 30196.48/567.07 = 53.25.
Parse (all 4 rows): kind=currency_exchange, parse_method=fully_curated (patterns hsbc-phone-banking-fx-credit/debit), leg_direction credit/debit, account_last4 null, category "Currency Exchange" on one leg and null on the other, paired_log_id set both ways (paired), own_transfer_verdict null. Currency exchange is whole-balance conversion (USD balance goes to 0.00).
Sizing: gap range 7-61 s, so N = 5 min is safe, 10 min generous. Rate varies 53.25 to 53.87 across days (1.2%); within one pair the rate is unknown independently, so use the day's rate +/- about 2-3% margin. Only 2 pairs (n=2), so treat the sizing as indicative. Note account_last4 null on legs: matching must use the 103-104***-NNN account suffix (110 USD, 001 EGP), not last4.
