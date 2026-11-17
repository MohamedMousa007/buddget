'use client'

import { billingOn, useBillingStore, type BillingMe } from '@/lib/billing/billingStore'
import { subscriptionView } from '@/lib/billing/subscriptionView'
import { useRewardsCopy, type RewardsCopy } from '@/lib/i18n/rewardsCopy'
import { formatFounderNumber } from '@/lib/loyalty/loyaltyApi'
import type { TierKey } from '@/lib/loyalty/rewardsTypes'

export interface MemberMarks {
  /** The tier badge that follows the name; null while tiers are off. */
  tier: TierKey | null
  tierName: string | null
  tierLabel: string | undefined
  /** "PRO" on the avatar for Pro and trial members. */
  proTag: string | undefined
  /** "#023" for a founder: the avatar ring and the numbered chip. */
  founderNumber: string | null
  /** "buddget Pro · Emerald" / "Founder #023 · Emerald". */
  line: string
}

/** The marks a member carries wherever their name shows (profile option A). Pure: the store read is in `useMemberMarks`. */
export function memberMarks(me: BillingMe | null, r: RewardsCopy): MemberMarks {
  const none: MemberMarks = { tier: null, tierName: null, tierLabel: undefined, proTag: undefined, founderNumber: null, line: '' }
  if (!billingOn(me) || !me) return none
  const view = subscriptionView(me)
  const tier = me.rewards?.tier?.key ?? null
  const tierName = tier ? r.tiers[tier].name : null
  const founderNumber = me.rewards?.founder ? formatFounderNumber(me.rewards.founder.number) : null
  const plan = view.kind === 'trial' ? r.profile.trial : view.proActive ? r.profile.pro : r.profile.free
  return {
    tier,
    tierName,
    tierLabel: tierName ? r.tierLabel(tierName) : undefined,
    proTag: view.proActive ? r.profile.proTag : undefined,
    founderNumber,
    line: [founderNumber ? r.profile.founder(founderNumber) : plan, tierName].filter(Boolean).join(' · '),
  }
}

export function useMemberMarks(): MemberMarks {
  const me = useBillingStore((s) => s.me)
  return memberMarks(me, useRewardsCopy())
}
