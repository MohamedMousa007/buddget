# S1: SMS forensic audit (read-only)

Date 2026-11-14, model Fable 5.2. Nothing was changed: code read, live DB read with SELECT only. Scope: 952 `sms_parse_log` rows, 10 SMS users, 2026-06-16 to 2026-11-13. Volume is 433 EGP rows and 333 SAR rows, so this is an Egypt **and Saudi** product in practice. No personal names or message text are reproduced here; rows are cited by the first 8 characters of their log id.

Builds on, and does not repeat, `docs/ACCOUNT_DISCOVERY_AUDIT.md` and `docs/ACCOUNT_BALANCE_ACCURACY_PLAN.md`.

## 1. Root causes

### RC-A. "Marked as cash" is a display default plus missing accounts (confirmed)
- `src/lib/supabase/remote/mappers/expenseMapper.ts:57`: `paymentMethodId: row.payment_method_id ?? DEFAULT_CASH_ID`. Every SMS expense the server could not place on an account reaches the app as the Cash sentinel.
- 449 of 576 SMS expenses (78%) have no account. By month the rate is 64% (Jun), 72%, 88%, 90%, 75%, then 43% in November, so the suffix-match and alias work shipped in early November helped but did not close it.
- The parser is not the problem: the account digits were captured on most rows (U1: 224 of 277 unplaced rows carry digits; U2: 94 of 94). The account simply does not exist in the app. U2 has **zero** payment methods and 94 SMS expenses; U1 has one method with digits and 277 unplaced rows.
- History is not repaired: rows from before the November fixes stay unplaced even where an account now exists.

### RC-B. Categories are wrong because the merchant is lost, not because the regex fails
- 181 of 366 purchases have a raw merchant but **no normalized merchant**. Normalization only runs on the AI path; `template`, `curated_db` and `fully_curated` rows skip it.
- 270 of 366 purchases (74%) are Other or uncategorised.
- Banks truncate merchant names to about 9 or 10 characters, so exact dictionary lookups miss.
- The same merchant gets different categories (one wallet brand is Utilities on 11 rows and Transfer on 4), and case variants are stored as different merchants.
- Payment-gateway prefixes and bill aggregators hide the real merchant and land in Other.
- A telecom bill message (service value plus stamp tax) is typed `fee` / Other instead of a Utilities bill.
- The dictionary is Egypt-leaning; SAR merchants (telecoms, fuel, rent platforms, restaurants) mostly fall to the AI or to Other.

### RC-C. Double counting comes from three different patterns, none of which the pairing handles
Pairing today: 170 outgoing and 135 incoming instant transfers, 1 pair. `own_transfer` fires 8 times.
1. **Wallet top-ups (confirmed double count).** The card message ("online purchase at the wallet brand") becomes an **expense**, and the wallet message ("top-up to your wallet via Apple Pay", a `curated_db` template with 17 matches) becomes **income**. One movement of your own money is counted as spending and as income.
2. **Relay / pass-through (largest by value).** 79 pairs where the same account receives an amount and sends exactly the same amount within 10 minutes (75 pairs for U2, about 111,000 EGP; 3 for U3; 1 for U1). Each pair inflates income and spending by the full amount. These are not own-account transfers, so IPN reference matching can never catch them.
3. **Own transfers between a user's banks.** The receiving bank names the sender; when that is the user, it is an own transfer. Nothing compares the counterparty with the user's own name, and by the time the row is stored the name is masked. Only 7 of 170 outgoing rows carry a counterparty account tail.
Also: a mobile recharge from a wallet is typed `own_transfer`; card-to-account cash advances are `own_transfer` with no destination account.

### RC-D. Currency exchange books an expense on whichever leg arrives first
The 4 FX rows are 2 conversions, correctly paired. In one pair the expense sits on the **credit** leg (EGP received booked as a 28,705 EGP expense); in the other it sits on the debit leg (USD). Neither has `to_payment_method_id`, so the destination account is never credited. The outcome depends on SMS arrival order.

### RC-E. Speed: 57% of parsed messages still use the AI
- 558 distinct skeleton keys for 952 messages: the shape key is too specific (it varies with merchant or digits), so templates rarely generalise.
- The same marketing message was sent to the AI three times and rejected each time: there is no negative cache for rejected shapes.
- **No template was ever auto-promoted because the rule cannot be met**: `sms_promotion_config.min_unique_users = 5`, while every active template has 0 or 1 unique users (10 users across two countries and many banks). This is a threshold problem, not a code bug. `shadow_agreements` is 0 on every template, so shadow mode needs a wiring check in S2.
- One real bill payment (SADAD) was rejected as `not_transaction` by the curated tier (a6299757; may predate the SADAD pattern fix).

### RC-F. Privacy (found in passing, for S4)
- `sms_parse_log.merchant` stores the **full, unmasked name of the other person** on transfer rows.
- `masked_body` leaves the trailing words of some Arabic and Latin names.
- The mask also replaces all-caps merchants with `<NAME>`, so masked bodies cannot be used to re-derive merchants. Only 205 of 952 raw bodies still exist (retention), so replay must take the merchant from the `merchant` column.

## 2. Spot-check sample (please review)
56 rows were sampled across all kinds (deterministic: ordered by md5 of id within kind). I agree with the current result on 41. These 15 are the ones I would change:

| Log id | Now | Should be | Why |
|---|---|---|---|
| 1f227acd, 7d938107 | income | own transfer (wallet top-up, no income) | RC-C1 |
| 6a6aef1a, 388b74fb | purchase, category Transfer | own transfer to the wallet, paired with the top-up | RC-C1 |
| 39420937 + bafa2b2a, e5ed6fd8, 7726f2ce | expense Instapay / income | relay pair, excluded from spend and income once confirmed | RC-C2 |
| 737c4e4c, b9fa6f21, d8be8051 | fee, Other | Utilities bill | RC-B |
| 31f8c293 | Other | Bills (aggregator) | RC-B |
| b91e12d0, 0a268410 | two merchants, Other | one merchant (truncated variants), category from memory | RC-B |
| a6299757 | rejected | bill payment | RC-E |
| 4d5206be | declined, merchant not normalized | fine as declined; merchant should normalize | RC-B |

To check them yourself, open the SMS log in the admin portal and search these id prefixes.

## 3. Gold set
Not materialised in S1, for two reasons: S1 is read-only, and message bodies must not go into git (RC-F). Definition for S2 slice 0:
- Population: all 952 rows by log id. Holdout: rows where `('x' || left(md5(id::text), 2))::bit(8)::int < 77` (about 30%), never used for tuning or promotion evidence.
- Expected labels: rule-derived for RC-C1 (top-up pairs), RC-C2 (same account, equal amount, opposite direction, within 10 minutes), RC-D (FX pairs) and RC-A (account = the user's account whose tail matches); merchant and category from a reviewed merchant table; plus the overrides in section 2 after your review.
- Stored as a fixture keyed by log id with labels only (no text), loaded through `replayLoader`.

## 4. Fix design for S2 (ordered by user-visible impact)
0. **Harness:** gold-set fixture + one metrics script that prints the numbers in section 5.
1. **Accounts (RC-A):**
   - SMS expenses with no account show as "Unassigned", never as Cash (mapper + UI label).
   - When a message names an account the user does not have, create a **provisional account** (bank, digits, currency from the message) and attribute to it at once; ask the user later to confirm, rename or merge.
   - Re-attribute history whenever an account or alias is added.
2. **Merchant and category (RC-B):** normalize on every tier; case-fold; strip gateway prefixes; prefix matching for truncated names; Egypt + Saudi dictionary ahead of the AI; per-user merchant memory from corrections; one merchant, one category per user; telecom bill pattern.
3. **Transfers (RC-C):**
   - Wallet top-up: pair the card leg and the wallet leg into one own transfer; no expense, no income.
   - Relay: detect in-then-out (or out-then-in) of the same amount on one account within a window; flag the pair; ask once per counterparty pair and remember; confirmed pairs leave spend and income totals.
   - Own name: compare the counterparty with the user's names **before masking**, store only a boolean; let the user list "my names".
   - Counterparty memory by salted hash, so a person labelled once (family, landlord, me) is remembered. Stop storing names in `merchant`.
4. **FX (RC-D):** one event: debit leg is the source, credit leg sets `to_payment_method_id`, rate stored on the pair, never an expense on the credit leg, excluded from spend and income.
5. **Speed (RC-E):** negative cache for rejected shapes; coarser skeleton key; promotion rule that can be met at this scale (to be set with the holdout, for example 2 users, or 1 user with N clean matches and shadow agreement); verify shadow mode increments.

## 5. Acceptance targets (measured on the gold set, train and holdout)
| Metric | Now | Target |
|---|---|---|
| SMS expenses shown as Cash without being cash | 449 | 0 |
| Unplaced SMS expenses, users with at least one account | 78% overall | under 10% |
| Purchases with a normalized merchant | 51% | 95% or more |
| Purchases in Other or uncategorised | 74% | under 25% |
| Same merchant, same category (per user) | broken | 100% |
| Wallet top-ups counted as income or expense | all | 0 |
| Relay pairs flagged | 0 of 79 | 90% or more |
| FX conversions with an expense on a leg | 2 of 2 | 0 |
| Parsed messages needing the AI | 57% | under 35% |
| Repeat rejected shapes sent to the AI | yes | 0 |

## 6a. Decisions taken (council, 2026-11-14; owner delegated approval)
1. **Provisional accounts: yes, with guardrails** (2 of 3; Skeptic preferred "Unassigned + one-tap create"). Auto-create only when bank, digits and currency are all present; otherwise show "Unassigned". Never "Cash". Dedupe on bank + digits + currency; out of balances and net worth until confirmed; merge re-points history and is reversible.
2. **Relay pairs: ask once and remember, label "possible pass-through" meanwhile, never auto-exclude** (3 of 3). Reversible per transaction; show the count affected before applying to history. No relay engine: one remembered answer. 75 of 79 cases are one user.
3. **"My names": yes, as a supporting signal only, after 1 and 2** (2 of 3; Skeptic: not yet). Prefilled from the profile name, compared before masking, stores a boolean. Needs a known own account as well; a name match alone never reclassifies.
4. **Relabels: owner reviews all 15 before they enter the gold set** (2 of 3). Not blocking: S2 measures on rule-derived labels; these 15 stay out until reviewed. Correction to the table above: a6299757 is a payment message that **our parser** rejected as not a transaction, not a payment the bank rejected; it needs your eyes.

Found while reading `dispatch.ts` for S2: wallet top-up and own-transfer pairing already exist (steps 0, 1, 1b, 1c) but depend on the wallet or account being registered. So RC-A is the keystone: once accounts exist, much of RC-C follows from code that is already there. The unplaced rate is spread across all users (60 to 100% each), not one person.

## 6b. Council on the three targets S2 missed (2026-11-14, awaiting owner go-ahead)
- **A. No account (38 to 51%):** build per-user digits-to-bank memory (exactly one bank, dropped if a second bank ever appears, user-correctable); as fallback a provisional "Account ••1234" from digits + currency alone, keyed on user + digits + currency, bank asked at confirmation, never in balances until confirmed (2 of 3; Critic against, fearing junk accounts); have the iOS Shortcut pass the sender if the platform allows it (to verify on a device; it is the root cause for every future iPhone user). Format-to-bank table: wait for real users (3 of 3). The 20% with no digits stay Unassigned.
- **B. Other (35%):** ask once per unknown merchant and remember per user; the AI's guess only pre-fills that question; no new crowd memory; target relaxed to 30% until there is real volume (3 of 3).
- **C. AI share (57%):** replace the hard-coded 5-user floor with: 2+ users, or 1 user with 15+ matches on one shape, zero failures, 14+ days; only after a held-out replay passes, shadow mode on, a kill switch, and templates must keep the direction guard (2 of 3; Skeptic: wait, it only saves pennies and the top tiers are unproven).
- All three voices: these targets were sized for scale; treat the percentages as soft with 10 users.

## 6c. Owner direction + council guards for the follow-up (2026-11-14, sent to the S2 session)
Owner asked for: provider identification from history, body, other users' patterns, then ask-once, with AI as a helper; learning cut-off shop names and manual category edits; promoting existing templates now on evidence and an easier rule later; own-account detection from several signals (same device, same name on both messages) rather than a typed names field. Council (3 of 3 "build, with guards"):
- Nothing learned auto-applies unless reversible, undoable per user and measured in shadow first.
- Cross-user learning only logs until enough distinct users agree (3 for bank formats, 5 for categories); an AI guess only pre-fills a question.
- Promotion: per-template kill switch first; replay split by user with negatives; auto at 2+ users; a single-user template needs staff approval.
- Own transfer: same device is never enough alone; needs one more signal (reference, matching name hash with a per-user salt, or a matching own account). A self-name learned from pairs is log-only. A wrongly hidden expense is the worst error in the app, so every call has an undo.
- Dissent kept: Skeptic and Pragmatist would drop the cross-user and name-hash parts until there are more users; they are built log-only to honour the owner's direction without risk.

## 6. Decisions needed before S2 (as asked on 2026-11-14)
1. Provisional accounts created automatically from messages: yes or no?
2. Relay pairs: ask once per pair of people (recommended), or exclude automatically?
3. Add a "my names" field to the profile for own-transfer detection?
4. Approve the 15 label changes in section 2 (or correct them).
