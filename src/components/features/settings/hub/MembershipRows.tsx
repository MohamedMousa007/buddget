'use client'

import { ChevronRight, Crown, Gift } from 'lucide-react'
import { ProPlanRow } from '@/components/features/membership/ProPlanRow'
import { TierBadge } from '@/components/features/membership/TierBadge'
import { tierRank } from '@/components/features/membership/tiers'
import { SettingsRow } from '@/components/features/settings/SettingsRow'
import { SettingsSection } from '@/components/features/settings/SettingsSection'
import { AppLink as Link } from '@/components/ui/AppLink'
import { billingOn, useBillingStore } from '@/lib/billing/billingStore'
import { useMembershipCopy } from '@/lib/i18n/membershipCopy'
import { useRewardsCopy } from '@/lib/i18n/rewardsCopy'
import { useSettingsHubCopy } from '@/lib/i18n/settingsHubCopy'
import { formatFounderNumber } from '@/lib/loyalty/loyaltyApi'
import { inviteReward } from '@/components/features/invite/inviteCode'

/** The Membership group of the settings hub: the Pro row, Rewards with the tier badge, Invite friends, and the Founders club for founders and beta testers. Absent while billing is off. */
export function MembershipRows() {
  const r = useRewardsCopy()
  const c = useMembershipCopy()
  const hub = useSettingsHubCopy()
  const me = useBillingStore((s) => s.me)
  if (!billingOn(me)) return null
  const rewards = me?.rewards ?? null
  const tier = rewards?.tier?.key
  return (
    <SettingsSection title={hub.page.membership}>
      <ProPlanRow variant="settings" />
      {tier ? (
        <Link href="/settings/rewards" data-setting-id="rewards" className="group/row flex min-h-14 w-full items-center gap-3 px-4 py-2 text-start transition-[background-color,transform] duration-200 hover:bg-[var(--color-brand-elevated)] active:scale-[0.985]">
          <span className="flex size-9 shrink-0 items-center justify-center"><TierBadge tier={tier} size={28} /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-[0.9375rem] font-semibold leading-tight text-[var(--color-brand-text-primary)]">{r.rewards.hubRow}</span>
            <span className="mt-0.5 block text-xs leading-snug text-[var(--color-brand-text-muted)]">{r.rewards.rowSub(r.tiers[tier].name, tierRank(tier))}</span>
          </span>
          <ChevronRight className="size-4 shrink-0 text-[var(--color-brand-text-muted)] rtl:rotate-180" />
        </Link>
      ) : null}
      {rewards?.invite.enabled ? (
        <SettingsRow icon={Gift} tone={3} title={r.invite.title} subtitle={inviteReward(me) === 'sparks' ? r.invite.cta.titleSparks : r.invite.cta.title} href="/settings/invite" settingId="invite" />
      ) : null}
      {rewards?.founder || rewards?.betaTester ? (
        <SettingsRow icon={Crown} tone={2} title={c.founders.title} subtitle={rewards.founder ? r.profile.founder(formatFounderNumber(rewards.founder.number)) : c.founders.betaBadge} href="/settings/founders" settingId="founders" />
      ) : null}
    </SettingsSection>
  )
}
