/**
 * The shapes `/api/entitlements/me` returns for Pro, Rewards, Founders and Invites (built by the `entitlements_state` SQL function,
 * migration 0309). docs/launch/PRO_REWARDS_CONTRACT.md documents every field; keep the two in step.
 */

export type TierKey = 'silver' | 'emerald' | 'diamond' | 'elite' | 'founder'
export type WeekState = 'kept' | 'frozen' | 'missed' | 'open' | 'before'
export type ShopItemKind = 'repair' | 'freeze' | 'card_finish' | 'buddgy_look'
export type CosmeticKind = 'card_finish' | 'buddgy_look'

export interface TierInfo {
  key: TierKey
  name: string
  minPoints: number
  requiresPro: boolean
  requiresFounder: boolean
  /** Sparks gifted the first time the tier is reached (Elite Founder pays the Elite gift). */
  sparksGift: number
  perks: string[]
}

export interface RewardsState {
  tiersEnabled: boolean
  /** Null while tiers are switched off. An Elite member without active Pro shows as Diamond. */
  tier: { key: TierKey; name: string; locked: boolean } | null
  proActive: boolean
  points: { lifetime: number; spendable: number }
  nextTier: { key: TierKey; name: string; minPoints: number; pointsToGo: number; requiresPro: boolean } | null
  tiers: TierInfo[]
  streak: {
    current: number
    best: number
    multiplier: 1 | 1.5 | 2
    /** Streak week at which the next multiplier step starts; null at x2. */
    nextMultiplierAt: 4 | 8 | null
    /** Exactly 12 weeks, oldest first; `week` is the local week-start date (YYYY-MM-DD). */
    weeks: Array<{ week: string; state: WeekState }>
    /** Set while last week can be repaired from the shop. */
    repair: { week: string; cost: number; until: string } | null
  }
  freezes: { banked: number; max: 2; earnEvery: 4 | 8; keptWeeksToNext: number }
  founder: { number: number; cohort: 'beta' | 'public'; creditName: string | null; creditNameStatus: 'none' | 'pending' | 'approved' | 'rejected' } | null
  betaTester: boolean
  memberNumber: number | null
  /** 0 (Free or trial), 15 (Pro) or 20 (Pro at Diamond or above). */
  packBonusPercent: number
  cosmetics: { cardFinish: string; buddgyLook: string; owned: Array<{ kind: CosmeticKind; key: string; source: 'shop' | 'milestone' | 'admin' }> }
  shop: Array<{ key: string; kind: ShopItemKind; item: string | null; cost: number }>
  earn: Array<{ key: 'week_kept' | 'budget_set' | 'month_tracked'; points: number; multipliers?: Array<{ fromWeek: number; x: number }> }>
  invite: { enabled: boolean; code: string; link: string; invited: number; activated: number; rewarded: number }
}

export interface MonthPair { thisMonth: number; lastMonth: number }
export interface ProThisMonth {
  aiAnswers: MonthPair
  receiptsScanned: MonthPair
  /** AI credits used (1 credit = $0.001 of model cost), SMS excluded. */
  creditsUsed: MonthPair
  monthStart: string
  freeCaps: {
    aiCreditsWeek: number | null
    aiCreditsSession: number | null
    balanceViewsPerMonth: number | null
    budgetPlansMax: number | null
    advisorFreePerMonth: number | null
    smsAiCallsPerMonth: number | null
  }
}

export interface HistoryItem {
  at: string
  kind: 'subscription' | 'sparks'
  /** INITIAL_PURCHASE / RENEWAL for subscriptions; NON_RENEWING_PURCHASE or ADMIN_GRANT for Sparks. */
  type: string
  store: string | null
  productId: string | null
  priceMicros: number | null
  currency: string | null
  /** Sparks rows: total Sparks credited (pack + bonus) and the bonus part. */
  sparks: number | null
  bonusSparks: number | null
  refundedAt: string | null
}

export interface SubscriptionRow {
  status: string | null
  source: string | null
  planKey: string | null
  willRenew: boolean | null
  currentPeriodEnd: string | null
  trialEndsAt: string | null
  graceEndsAt: string | null
  productId: string | null
  canceledAt: string | null
  storeCountry: string | null
  memberSince: string | null
  /** Pro days banked (invite rewards, staff promos) that start when the current trial or Pro ends. */
  bankedProDays: number
}

export interface SparkProduct { id: string; sparks: number; countries: string[] | null }
