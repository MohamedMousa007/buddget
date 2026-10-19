# Buddgy and the admin portal: how they connect

Both pieces share the same entitlement tables (`plans`, `user_entitlements`). This note is the contract between them.

## What Buddgy reads

`public.ai_effective_limits(user_id)` (service role only) resolves what a user may do, with the same rules as `src/lib/entitlements/resolve.ts`:

1. The user's `user_entitlements` row. A `trialing` row past `trial_ends_at` and an `active` row past `current_period_end` count as expired and fall back to the default plan. `past_due` keeps its plan.
2. Per key: individual `limit_overrides`, then the plan's `limits`, then the built-in default (`ai_default_limits()`).
3. A number sets the limit, an explicit JSON `null` means unlimited, any other value is ignored.

`feature_overrides` set to `false` switches a surface off for that user.

## Keys the admin portal should list

Add these to `LIMIT_CATALOG` (`src/lib/entitlements/limits.ts`) so staff can edit them, with `enforced: true`. Fallbacks match `ai_default_limits()`.

| Key | Unit | Fallback |
|---|---|---|
| `ai_units_5h` | AI units per rolling 5 hours | 600000 |
| `ai_units_24h` | AI units per rolling 24 hours | 1500000 |
| `ai_units_7d` | AI units per rolling 7 days | 6000000 |
| `ai_chat_units_soft` | units per chat before it is compressed harder | 30000 |
| `ai_chat_units_hard` | units per chat before it rolls over | 60000 |
| `ai_chat_turns` | turns per chat | 40 |
| `ai_chats_per_hour` | new chats per hour | 30 |
| `ai_chats_per_day` | new chats per day | 100 |
| `ai_req_per_min` | AI requests per minute | 30 |

Already in the catalog and now enforced by Buddgy: `ai_chat_per_day` (chat messages per day), `receipt_scans_per_month`, `voice_entries_per_day`. Flip their `enforced` flags to `true`. `ai_budget_per_hour` is still enforced by the budget route through `api_rate_hit`.

Feature switches (use as `feature_overrides` names): `ai_assistant` (chat), `receipt_scanning`, `sms_tracking`, `ai_voice`, `ai_budget`, and `ai_tool_<domain>` for a tool group (`ai_tool_budget`, `ai_tool_debts`, and so on). A `false` value disables it for that user.

One unit is 1 fresh input token, 0.1 for cached input, and 4 per output token (thinking included).

## What the admin portal can read

`ai_usage_events` (per call: user, feature, model, tier, tokens, units, latency, status), `ai_chats` (per chat: turns and units, no content) and `ai_reservations` (in-flight holds). All three are service-role writable only. Useful views for the portal: units per day by feature and tier, top users by units, and quota denials (a denial does not write an event, so count denials in logs or add a counter if the portal needs them).

## Things to keep in sync

- The migration that creates these objects is `0128_ai_gateway_quota.sql` (renumbered so it does not clash with the portal's 0126 and 0127).
- `database.types.ts` is generated from the live schema, so regenerate it after merging both branches.
- The budget route now reserves and settles quota and also keeps the portal's per-plan `ai_budget_per_hour` cap. Keep both.
