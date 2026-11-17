'use client'

import { InviteCtaCard } from '@/components/features/membership/InviteBlocks'
import { billingOn, useBillingStore } from '@/lib/billing/billingStore'
import { useRewardsCopy } from '@/lib/i18n/rewardsCopy'
import { navigate } from '@/lib/navigation/navigate'
import { inviteReward } from './inviteCode'

/** The invite call to action, wired: it opens Invite friends and names the reward this person earns. Absent while invites are switched off. */
export function InviteCta({ className }: { className?: string }) {
  const me = useBillingStore((s) => s.me)
  const c = useRewardsCopy().invite.cta
  if (!billingOn(me) || !me?.rewards?.invite.enabled) return null
  return <InviteCtaCard className={className} title={inviteReward(me) === 'sparks' ? c.titleSparks : c.title} subtitle={c.sub} actionLabel={c.action} onClick={() => navigate('/settings/invite')} />
}
