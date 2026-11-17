# Pro, Rewards, Founders and Invites: backend contract

The backend half of `docs/launch/PRO_REWARDS_SPEC.md`, for the Pages and Admin sessions. Migrations `0306` to `0311` are applied to
the live project `tzioppxwsljhlglyducm`; `src/lib/supabase/database.types.ts` is regenerated. TypeScript shapes live in
`src/lib/loyalty/rewardsTypes.ts` (import from there; this file only explains them).

## 1. One read for every screen: `GET /api/entitlements/me`

One database call (`entitlements_state(p_user)`, which first runs the user's upkeep: their own invite activation check, banked
Pro weeks, the tier refresh) plus the plan resolution. Switch and packs are cached server-side. Refresh it with
`useBillingStore().refresh()` (`src/lib/billing/billingStore.ts`, type `BillingMe`).

```ts
interface BillingMe {
  planKey: string; planName: string; status: EntitlementStatus; trialEndsAt: string | null   // as before
  billingEnabled: boolean                                  // now true (live)
  sparks: { left: number; total: number; resetsAt: null } | null
  usage: UsageState | null                                 // as before (ai_usage_state)
  sparkProducts: Array<{ id: string; sparks: number; countries: string[] | null }>  // countries ['EG'] = Egypt only
  rewards: RewardsState | null                             // section 2
  proThisMonth: ProThisMonth | null                        // section 3
  history: HistoryItem[]                                   // section 3
  loyalty: { founderNumber; betaTester; streakWeeks; freezesBanked; lifetimePoints; tier } | null   // legacy, kept
  subscription: { fromStore; billingIssue; graceEndsAt; willRenew; renewsAt; productId; memberSince; canceledAt;
                  bankedProDays: number; purchases: Array<HistoryItem-like>; hasMorePurchases } | null
}
```

Store purchases are not live until RevenueCat is configured: keep the existing `purchasesAvailable` path for every buy button.

## 2. `RewardsState` (Rewards, Founders, Profile badges, Invite card)

| Field | Meaning |
|---|---|
| `tiersEnabled` | `platform_settings.tiers.enabled`. When false `tier` is null: hide tier badges. |
| `tier` | `{ key, name, locked }`. Keys `silver` / `emerald` / `diamond` / `elite` / `founder` (name "Elite Founder"). Elite without active Pro is stored and shown as Diamond. |
| `proActive` | Plan `plus` or `plus_trial` that grants now (the trial counts for Elite). |
| `points` | `{ lifetime, spendable }`. Shop spends `spendable` only; tiers follow `lifetime`. |
| `nextTier` | Next rung `{ key, name, minPoints, pointsToGo, requiresPro }`, or null at the top. Founders see `founder` instead of `elite`. |
| `tiers` | The ladder: `{ key, name, minPoints, requiresPro, requiresFounder, sparksGift, perks[] }`, in order. |
| `streak` | `{ current, best, multiplier (1, 1.5, 2), nextMultiplierAt (4, 8, null), weeks, repair }`. `weeks`: exactly 12, oldest first, `{ week: 'YYYY-MM-DD' (local week start), state: 'kept' / 'frozen' / 'missed' / 'open' / 'before' }`. `repair`: `{ week, cost: 120, until }` while last week can be repaired, else null. `current` is 0 once the streak is past saving. |
| `freezes` | `{ banked, max: 2, earnEvery: 4 or 8, keptWeeksToNext }`. |
| `founder` | `{ number, cohort, creditName, creditNameStatus }` or null. Print the number with `formatFounderNumber` (`#023`). |
| `betaTester`, `memberNumber` | Badge flag; member number by sign-up order (the third fact on the Pro card). |
| `packBonusPercent` | 0 (Free and trial), 15 (Pro), 20 (Pro at Diamond or above). The same rule is in `src/lib/billing/packBonus.ts`. |
| `cosmetics` | `{ cardFinish ('standard' default, 'aurora', 'connector'), buddgyLook ('classic' default, 'midnight'), owned[] }`. |
| `shop` | `{ key, kind, item, cost }`: `repair_week` 120, `streak_freeze` 80, `card_finish_aurora` 150, `buddgy_look_midnight` 120. |
| `earn` | The real earn list: `week_kept` 10 (x1.5 from week 4, x2 from week 8), `budget_set` 10, `month_tracked` 40. |
| `invite` | `{ enabled, code, link, invited, activated, rewarded }` for the invite card. |

## 3. `ProThisMonth` and `HistoryItem`

- `proThisMonth`: `aiAnswers`, `receiptsScanned`, `creditsUsed` (each `{ thisMonth, lastMonth }`, calendar months in the user's
  timezone), `monthStart`, and `freeCaps` (`aiCreditsWeek`, `aiCreditsSession`, `balanceViewsPerMonth`, `budgetPlansMax`,
  `advisorFreePerMonth`, `smsAiCallsPerMonth`) for the "vs Free" line.
- `history` (newest first, at most 30): `{ at, kind: 'subscription' | 'sparks', type, store, productId, priceMicros, currency,
  sparks, bonusSparks, refundedAt }`. Subscription types `INITIAL_PURCHASE` / `RENEWAL`; Sparks types `NON_RENEWING_PURCHASE` or
  `ADMIN_GRANT`. `sparks` is the total credited (pack + bonus).

## 4. Client RPCs (signed-in user; call through the wrappers)

| Wrapper (file) | RPC | Returns |
|---|---|---|
| `keepWeek(week)` (`src/lib/loyalty/loyaltyApi.ts`) | `loyalty_record_week_check(p_week)` | `kept` `{ streak, points, freezes, multiplier, sparksGift }`; new: `too_few_records` `{ records, needed: 3 }`; plus the old statuses. |
| `fetchWeekSummary()` | `loyalty_week_summary()` | Old fields plus `recordsThisWeek`, `recordsLastWeek`, `recordsNeeded` (3), `multiplier`. |
| `buyShopItem(key)` | `loyalty_shop_buy(p_item)` | `ok` `{ balance, week }` / `insufficient_points` / `freezes_full` / `nothing_to_repair` / `already_owned` / `unknown_item` / `error`. |
| `applyCosmetic(kind, key)` | `loyalty_apply_cosmetic(p_kind, p_key)` | `ok` / `not_owned` / `invalid` / `error`. |
| `fetchReferralSummary()` (`src/lib/referrals/referralsApi.ts`) | `referral_my_summary()` | `ReferralSummary`: `code`, `link` (`https://buddget.app/i/<code>`), `counts`, `caps` (`month 4`, `year 12`, used), `rewards` (`proDaysEarned`, `proDaysBanked`, `sparksEarned`), `milestones` (3, 5, 10 with `reached`), `friends` (50 newest: `name` = first word of their display name, `status`, `active_days`/3, `transactions`/5, `window_ends_at`, `reward_kind`). |
| `redeemInviteCode(code, deviceId?)` | `referral_redeem(p_code, p_device_id)` | `ok` `{ trialExtended }` / `disabled` / `invalid_code` / `self_invite` / `account_too_old` / `already_redeemed` / `device_used` / `error`. Call right after sign-up, before or after the trial claim (both orders give 37 days). |

The `/i/<code>` web route (Pages) stores the code and sends people to sign-up or the store; the sign-up flow calls `redeemInviteCode`.
Codes are case-insensitive (`AB-7K2`). For an invited friend the trial claim (`POST /api/entitlements/trial`) grants 37 days, shown in
`trialEndsAt`.

## 5. Admin data layer (service role only; Admin session owns the routes)

Use `rewardsAdmin(service, actorUserId)` from `src/lib/server/rewardsAdmin.ts` (`actorUserId` = the staff member's auth user id,
`ctx.user.id`). Every write checks the staff row is active and writes `admin_audit_log` in the same transaction, so the route
needs no separate audit write. Gate with the permission keys from the spec (`billing.grant`, `sparks.manage`, `loyalty.manage`,
`referrals.manage`). Every call returns `{ status, ... }` (`status: 'error', message` on a database error).

| Method | RPC | Notes |
|---|---|---|
| `grantPro(userId, endsAt \| null, note?)` | `admin_rewards_pro_grant` | Promo Pro; null end = until removed. |
| `removePro(userId, note?)` | `admin_rewards_pro_remove` | Back to Free (a store subscription would be re-granted by its next event). |
| `startTrial(userId, days = 30)` / `endTrial(userId)` | `admin_rewards_trial_start` / `_trial_end` | 1 to 90 days. Ending starts any banked Pro days. |
| `bankProDays(userId, days)` | `admin_rewards_bank_pro_days` | Banked Pro that starts when current access ends. |
| `adjustSparks(userId, amount, 'reward' \| 'purchased', reason)` | `admin_rewards_sparks_adjust` | Positive adds (reward = 12 months; purchased = test grant, store `admin`); negative removes reward Sparks first, then purchased. Returns `available`. |
| `sparksLedger(userId, limit?)` | `admin_rewards_sparks_ledger` | `{ available, allowances[], purchases[], spend[] }` (read, not audited). |
| `setTier(userId, tier \| null, locked)` | `admin_rewards_set_tier` | `locked: true` pins the tier; false unlocks and recomputes. |
| `addFreezes(userId, n)` | `admin_rewards_add_freezes` | Clamped to 0 to 2. |
| `setStreak(userId, weeks, step?, lastKeptWeek?)` | `admin_rewards_set_streak` | Step defaults to what the weeks earn; last kept week defaults to last week. |
| `setFounder(userId, number?)` / `removeFounder(userId)` | `admin_rewards_founder_set` / `_founder_remove` | `number_taken`, `cap_reached`; removal retires the row (number never reissued). |
| `resetLoyalty(userId)` | `admin_rewards_loyalty_reset` | Points, streak, freezes, lock, owned items, events and ledger cleared; founder kept. |
| `referralsFor(userId)` | `admin_rewards_referrals_for` | `{ code, invites[50], invitedBy, promoGrants[50] }` (read). |
| `approveReferral(id)` / `revokeReferral(id)` / `markReferralActivated(id)` | `admin_rewards_referral_approve` / `_revoke` / `_mark_activated` | Approve pays even past caps or guards; revoke claws back; mark-activated runs the normal reward path. |
| `setSwitch('billing' \| 'tiers' \| 'referrals' \| 'spark_gifts', enabled)` | `admin_rewards_platform_switch` | Also invalidates the server settings caches. Tiers off clears every unlocked tier; on recomputes. |

Existing admin RPCs keep working: `admin_adjust_loyalty_points` (now refreshes the tier and pays tier gifts), `loyalty_decide_founder`,
`admin_founder_candidates`, `loyalty_decide_credit_name`.

## 6. Rules (where they live)

- Tiers, multiplier, freezes, gifts: SQL `0307` (`loyalty_tier_key`, `loyalty_refresh_tier`, `loyalty_record_week_check`), mirror
  `src/lib/loyalty/rules.ts`. Tier refresh runs on every points change, on every `user_entitlements` and `founders` change
  (triggers), on every `/me` read, and nightly for Pro that ran out.
- Pack bonus and clawback: SQL `0306` (`spark_pack_bonus_percent`, `spark_pack_grant`), mirror `src/lib/billing/packBonus.ts`.
- Egypt Pro limits: `platform_settings.pro_regional_limits.EG` applied in `ai_effective_limits` for plan `plus` / `plus_trial` when the
  store country (`user_entitlements.store_country`, from the RevenueCat `country_code`) is EG or the base currency is EGP.
- Invites: SQL `0308`, mirror `src/lib/referrals/rules.ts`. Nightly `rewards_daily` (cron `/api/cron/loyalty`) checks pending friends.
- Settings: `platform_settings` keys `billing`, `tiers`, `referrals`, `spark_gifts` (`{ enabled }`), `sparks_bonus`
  (`{ proPercent: 15, loyalProPercent: 20, loyalMinTier: 'diamond' }`), `pro_regional_limits`.

## 7. Not in this build

Alternate app icons, the monthly recap share card, store offer codes (first month EGP 35, win-back). One alternate card finish
(`aurora`) and one Buddgy look (`midnight`) exist as owned items; the art for them is the Pages/Components sessions' to draw.
