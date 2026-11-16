# S6 monetization v9, phase 1: database and server

Migrations 0298 and 0299, applied live on 2026-11-16. Selling stays off: `billing.enabled` is false, so every new limit below is inert and testers lose nothing.

## What changed

- **Credits by real cost.** 1 credit = 1 Spark = $0.001 of model cost (`cost_usd_micro / 1000`). Two windows: a 5-hour session anchored at the first AI request after the last session ended (`ai_credit_sessions`), and a week from the user's week-start day in their timezone. Limits are plan settings: Free 6 / 15, Pro and trial 50 / 150 (`ai_credits_session`, `ai_credits_week`). SMS never counts.
- **Crossing request finishes.** A request is admitted while use is under the limit and is not charged to Sparks, however far it overshoots. A request that starts at or over a limit uses Sparks at its real cost (oldest first), or is denied with `session` or `week` and the reset time (the later one when both are reached). Tool hops of an admitted turn are never cut off.
- **Cost accuracy.** Voice is priced by audio seconds from `ai_price_book.audio_usd_per_min`; a grounded web search adds a per-call cost from the `ai_pricing` setting (default 14,000 micro-dollars), both through new `settle` arguments.
- **Advisor gate.** `advisor_gate(user)`: Pro and trial are entitled (feature `buddgy_advisor`); Free gets `advisor_free_per_month` (1) answers, reserved with `p_advisor_free`, kept out of the credit windows and used up only when the answer succeeds.
- **Budget plans.** Trigger `budget_plans_limit` refuses a plan beyond `budget_plans_max` (Free 2) on insert or restore while selling is on; existing plans are never touched.
- **Live balance views.** `balance_view(account)`: counts only a view that shows a bank-confirmed balance, reopening the same account within 24 hours is free, the month follows the user's timezone, and the log has no foreign key to the account so removing and re-adding does not reset it. Free 10 a month, Pro unlimited. `latest_balance_reports` is left as it is (the quiet mismatch warning must not spend views).
- **Sparks packs.** `spark_products` maps a product id to its Spark amount (70, 150 Egypt only, 400, 900, 2,500; ids are settings the owner edits). The webhook adds a pack through `billing_apply`; a paying Pro member gets +25% (`sparks_bonus`); a refund removes the unspent Sparks. Monthly allowances are retired (`sparks_per_month` 0).
- **Trial** is 30 days at Pro limits with no Sparks. Free SMS accounts are unlimited (`sms_accounts_max` null; the cap code stays, inactive).
- **Tables:** `ai_credit_resets` (staff resets, `usage_reset()`), `coming_soon_interest` (`coming_soon_notify()`), `balance_views`, `advisor_free_uses`. `billing_events` now keeps store, product, price and currency.
- **`/api/entitlements/me`** adds `usage` (both windows with percentages and reset times, usage by feature, Sparks, balance views, plans, Advisor, unseen staff resets, interest) and, in `subscription`, `canceledAt` and the last five purchases from our own log.

## Proof

A rolled-back transaction on the live database, billing on, one Free tester: first request allowed and opens the session; the request that costs 7 of 6 credits finishes and is not charged; the next is denied `session` with the reset time; SMS is never metered; with 10 Sparks the next is allowed and a 2.4-credit request leaves 7; a week at its limit is denied `week` with the Saturday 00:00 reset, and a staff reset reopens it; the free Advisor answer drops `free_left` from 1 to 0 and stays outside the week's credits; Pro is entitled with limits 50 / 150 / unlimited views; a 400 pack gives 500 to Pro and 400 to Free, the same transaction never pays twice; the 11th balance view is refused with the reset date, reopening within 24 hours is free; the third plan is refused. The refund returned the wrong number in that run; 0299 fixes it.

## Not verified

- The refund function was fixed after the proof run and not re-run end to end; the webhook route is covered by unit tests only.
- No real store product, RevenueCat call or purchase.
- Fast-tier chat answers are recorded with zero tokens today (31 rows average 0 cost), so chat is under-counted until phase 2 fixes the metering.
