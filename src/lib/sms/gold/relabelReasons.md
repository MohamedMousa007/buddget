# S1 relabel review (15 rows), council rule: accept only when the fixed wording settles it

goldSet.json stores only split (s) and rule-derived topup / relay / fx links. It has no kind, category or merchant field,
and none of these ids is a key in it. No accepted relabel, so goldSet.json is unchanged.

| id | proposed field: from -> to | verdict | reason |
|---|---|---|---|
| 1f227acd | kind: income -> own transfer (top-up) | STAYS OUT | wording says money arrived in a wallet from a card, but the sender is masked; that it is the user's own card is outside knowledge |
| 7d938107 | kind: income -> own transfer (top-up) | STAYS OUT | same wording as 1f227acd |
| 6a6aef1a | kind/category: purchase, Transfer -> own transfer | STAYS OUT | wording is a generic online purchase; that the merchant is the user's own wallet is outside knowledge |
| 388b74fb | kind/category: purchase, Transfer -> own transfer | STAYS OUT | same as 6a6aef1a |
| 39420937 | relay: none -> pair with bafa2b2a | STAYS OUT | one leg of an instant transfer; being a relay needs the other leg's time and amount, not this wording |
| bafa2b2a | relay: none -> pair with 39420937 | STAYS OUT | same, other leg |
| e5ed6fd8 | relay: none -> pair | STAYS OUT | an incoming instant transfer; same wording as bafa2b2a, pairing is not in the text |
| 7726f2ce | relay: none -> pair | STAYS OUT | same as e5ed6fd8 |
| 737c4e4c | category: Other -> Utilities | STAYS OUT | wording is a service fee plus stamp duty and names no utility |
| b9fa6f21 | category: Other -> Utilities | STAYS OUT | same, wording names no utility |
| d8be8051 | category: Other -> Utilities | STAYS OUT | same, wording names no utility |
| 31f8c293 | category: Other -> Bills | STAYS OUT | a card charge at an aggregator; what it sold is outside knowledge |
| b91e12d0 | merchant: variant -> one merchant | STAYS OUT | whether two truncated names are one merchant is outside knowledge |
| 0a268410 | merchant: variant -> one merchant | STAYS OUT | same |
| a6299757 | status: rejected -> bill payment | STAYS OUT | text gives an amount and a reason label but no direction or outcome wording that settles bill payment vs rejection |
| 4d5206be | merchant: not normalized -> normalized | STAYS OUT | merchant is masked in the text; the label (declined) is already right |
