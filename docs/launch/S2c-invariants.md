# S2c: invariants for the SMS pipeline

Date 2026-11-14. Written before any S2c code. Source: `docs/launch/S2b2-second-review.md` sections 3, 4, 7 and 10. Where this file and that review differ, this file records why. Every S2c step and every test names the invariant it serves (I1 to I8). No personal names or message text appear here; rows are cited by the first 8 characters of the log id.

Terms. A **message** is one `sms_parse_log` row. A **money row** is an `expenses` or `income_events` row. A message **owns** the money rows whose `sms_log_id` is its id. A **client write** is an UPDATE that changes `edited_at` (the app's row push); every server-side writer leaves `edited_at` alone.

## The eight invariants

**I1. A message changes only the rows it owns.** Three exceptions, and no others:
1. A **refund** may stamp one earlier row as refunded, by the first rule that hits: (a) the same payment reference as an earlier message of the same user; (b) same account, same amount, same currency, within 15 minutes, where the earlier row was created by a message and is a purchase, online purchase or transfer out; (c) same account and same merchant, exact amount and currency, within 90 days, same restriction on the earlier row. Never a hand-entered row, a cash withdrawal, a fee, a card repayment or an instalment. (Rule (c) is in review section 3.1 and step 2 but not in the one-line invariant in section 7; it is kept because step 2 is "P0-1 with the 3.1 variant".)
2. A **pairing** may retract or retag the other leg's row, and only by setting the retraction marker (I4) or through the one pairing change of step 3.
3. A **funding leg** may fill the funding account on the repayment row it funded, and the second leg of a currency exchange may fill its side of the first leg's row.

**I2. A decline changes nothing but its own row.** A message of kind `declined`, or worded declined, rejected or refused, never reads another row to change it and never writes one. It books one net-zero row. A repeat of the same decline within 3 days is acknowledged against the earlier row only when that earlier row is itself a decline's own row. A decline never creates a provisional account. There is no same-second exception (council, review section 10 item 1). "Reversed" wording is a refund, not a decline.

**I3. Nothing leaves spending or income on one signal.** The signals and the combinations that settle are listed once, below. Anything short of a settling combination is booked as its plain kind (spending or income) and at most asks.

**I4. Every retraction carries its cause; every restore requires it.** When the pipeline soft-deletes a money row it sets `retracted_by_sms_log_id` to the message that caused it, in the same write as `deleted_at`. A restore touches only rows whose marker names a message of the pair being undone, and clears the marker with `deleted_at`. A row with `deleted_at` set and no marker was deleted by the user and is never restored by the server.

**I5. A second copy of a capture is never booked; a possible second copy is booked and flagged.** Same user, same normalised text, same capture time to the second: the same message, whatever its capture id, with no time limit, refused by a unique index. Same text with a different capture time inside 3 minutes: a duplicate only when the text carries a payment reference or a running balance; otherwise it is booked and carries the flag `possible_duplicate`. Never held, never dropped. The flag does not clear by itself.

**I6. No answer that makes the phone delete a message unless the message is booked, a proven duplicate, or classified as not a transaction.** Every 2xx answer from the ingest route is one of those three, or "held for review" with a row the user can see in the app. A date that cannot be trusted never rejects: the row falls back to the capture day, then the arrival day, and carries the flag `date_unsure`.

**I7. Unknown never refuses a pair and never settles one.** A currency, direction, account tail or counterparty tail that is null on either side is "unknown": a guard passes it, and no settling combination may count it as a match. A guard refuses only two known, conflicting values.

**I8. A column the server stamps cannot be changed by a client write.** Server-owned on `expenses`: `sms_log_id`, `refunded_at`, `refund_kind`, `refund_sms_log_id`, `retracted_by_sms_log_id`, `sms_flags`, and `deleted_at` while the marker is set. On `income_events`: `sms_log_id`, `retracted_by_sms_log_id`, `sms_flags`, and `deleted_at` while the marker is set. Enforced in the stale-write trigger, not in the client. What the user decides about a flag lives in a separate client-owned column (`sms_flags_ack`).
Known limit, stated so nobody assumes more: columns both sides may write (`category`, `amount`, `payment_method_id`, `to_payment_method_id`, `spend_exclusion`) are not covered. A phone holding an older copy can still undo a server retag of `category` to Transfer. Closing that needs a row version in the push and is not in batch 1.

## Safe when unanswered

Every prompt or flag leaves totals in its stated default when the user never answers:

| Prompt or flag | Default while unanswered |
|---|---|
| `possible_duplicate` | Both rows booked and counted |
| `date_unsure` | Row counted on the fallback day |
| Unmatched refund, "which purchase was this for?" | Credit in neither income nor spending; the purchase stays counted |
| "Is this your own account?" (one-leg transfer to own digits) | Row counted as its plain kind (spending or income) |
| Transfer or repayment kind asserted only by the AI or a learned template | Row counted as spending, flagged |
| "No" on file but the legs share a reference | Both rows counted as their plain kinds |
| Cash deposit, "this was my own cash" | Row counted as income |
| Pass-through pair after the first "Yes" | Labelled only; both rows counted until the legs prove it or the user says so |

## Signals

A signal is a fact about one message or a pair of messages. The names are the ones the code uses where a name exists.

| Signal | Meaning | Source |
|---|---|---|
| `device` | A debit on account A and a credit on a different account B, captured by the same device, inside the pairing window, same amount (a fee difference only with `reference`) | two messages |
| `reference` | Both messages carry the same payment reference | two messages |
| `name` | Same counterparty-name hash on both messages (per-user salt) | two messages |
| `account` | The counterparty digits answer to one of the user's accounts, registered or provisional, by the alias- and length-aware tail match | one message |
| `registered` | As `account`, and the account is one the user confirmed (not provisional, not closed) | one message |
| `counterparty_bank` | The counterparty bank named in the message is the bank of the account that `registered` found. Not available in batch 1: no tier parses the counterparty's bank into a field, so no rule may use it yet | one message |
| `answered_yes` / `answered_no` | The user's stored answer for this pair of tails | stored |
| `profile` | The counterparty matches the user's own name | one message |
| `own_wallet_exact` | The merchant is exactly one of the user's own stored-value methods (with top-up wording when the brand also sells goods) | one message, code rule |
| `own_wallet_named` | The text names one of the user's own stored-value methods | one message |
| `sibling_exact` | An unclaimed opposite leg of exactly the same amount inside the window | two messages |
| `kind_by_code` | The kind was set by a code-tier pattern or a code rule | provenance |
| `kind_by_model` | The kind was asserted only by the AI or a learned template | provenance |
| `paid_into_card` | Repayment wording that names the card as the place the money went ("paid into / to your card") | wording |
| `card_as_instrument` | Repayment-kind message whose wording names the card as the means ("via card") | wording |

## What settles

"Settles" means the row or pair is taken out of spending and income without asking.

**Own transfer, two legs.** `device` plus one of `reference`, `name`, `account`, `answered_yes`. Unchanged from S2. `profile` only ever supports a question. `answered_no` blocks settling; `answered_no` together with `reference` asks again instead of doing nothing (P2-11). The same account on both legs never settles.

**Own transfer, one leg (the counterparty digits are the user's own).** `registered` plus one of: `answered_yes` for (own tail, counterparty tail), `counterparty_bank`, `reference` or `device` with a sibling. `registered` alone, the first time: the row is booked as its plain kind and the user is asked once. Yes settles this row and every later one-leg transfer on that pair of tails, with the destination credited. No never asks again for that pair.

**Wallet top-up, funding leg.** `own_wallet_exact` settles alone. This is the one single-signal rule that stays: the rule is exact-string, set by code, and nobody buys goods from their own wallet. It is listed here so I3 has no unlisted exception.

**Wallet's own message.** `own_wallet_named` plus `sibling_exact` (with the pairing guards of step 3). Without the sibling it stays income or a remittance.

**Card repayment.** `kind_by_code`, or `paid_into_card` with any provenance: non-spend whether or not a debt is registered. `kind_by_model` plus `card_as_instrument`: spending, flagged. A repayment pairs with a funding leg when the funding leg's counterparty digits equal the card, or the amounts are exactly equal, or the funding leg is already an own transfer; a fee difference is allowed only with `reference` or matching digits. A transfer out that names a different person or different digits is never a funding leg.

**Transfer or own-transfer kind with `kind_by_model` only** (no sibling, no own digits, no own wallet): spending, with the question.

**Currency exchange.** Two legs of opposite known direction and different known currency. Unchanged.

**Refund.** I1 exception 1. No hit: the credit is booked outside income and outside spending and asks. It is stored as an expense row already marked refunded (the same net-zero form a decline's own row uses, which every total already treats as zero), flagged `refund_unmatched`. It is not an income row, because several income views ignore the income exclusion column. Known limit: on a tracked account the balance misses that credit until the user picks the purchase.

**Never settles anything:** `profile` alone, `account` on a provisional account alone, `sibling_exact` alone between two transfers out or two transfers in, any signal whose value is unknown (I7).

## Pairing guards (step 3), each read under I7

A candidate leg is refused only when: it is a duplicate, failed, rejected or held for confirmation; both legs are on the same known account; both have a known and equal direction; both have a known and different currency (exchanges excepted); or the claim names a different sibling than the one the decision read. A `processing` sibling is allowed and waited for. When a claimed sibling turns out to have no money row, both rows are unpaired before the claiming leg books its plain kind.

## Map from step to invariant

| Step | Serves |
|---|---|
| 1 retraction marker, server-owned columns | I4, I8 |
| 2 declines and refunds | I1, I2 |
| 3 pairing change | I1, I3, I4, I7 |
| 4 duplicate guard | I5 |
| 5 date and plausibility answers | I6 |
| 6 pass-through | I3, I8 |
| 7 unpair and discard | I4 |
| 8 "collected" notices, deposits, kind validation, sender scope, wording guard (count only) | I3 |
| 9 masking | privacy (no invariant above) |
| 10 category overwrite | I1 (a message does not overwrite the user's choice) |
| 11 native repeat rule, worker retry, currency list | I5, I6 |
