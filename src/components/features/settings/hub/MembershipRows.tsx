'use client'

import { ChevronLeft, ChevronRight, Crown } from 'lucide-react'
import { ProPlanRow } from '@/components/features/membership/ProPlanRow'
import { TierBadge } from '@/components/features/membership/TierBadge'
import { tierRank } from '@/components/features/membership/tiers'
import { InviteCta } from '@/components/features/invite/InviteCta'
import { SettingsSection } from '@/components/features/settings/SettingsSection'
import { AppLink as Link } from '@/components/ui/AppLink'
import { billingOn, useBillingStore } from '@/lib/billing/billingStore'
import { useMembershipCopy } from '@/lib/i18n/membershipCopy'
import { useRewardsCopy } from '@/lib/i18n/rewardsCopy'
import { useSettingsHubCopy } from '@/lib/i18n/settingsHubCopy'
import { formatFounderNumber } from '@/lib/loyalty/loyaltyApi'
import { useLocale } from '@/lib/i18n'
import { cn } from '@/lib/utils'

/** The Membership group of the settings hub: the Pro row, Rewards with the tier badge, Invite friends, and the Founders club for founders and beta testers. Absent while billing is off. */
export function MembershipRows() {
  const r = useRewardsCopy()
  const c = useMembershipCopy()
  const hub = useSettingsHubCopy()
  const { locale } = useLocale()
  const Chevron = locale === 'ar' ? ChevronLeft : ChevronRight
  const me = useBillingStore((s) => s.me)
  if (!billingOn(me)) return null
  const rewards = me?.rewards ?? null
  const tier = rewards?.tier?.key
  const founder = rewards?.founder
  const elite = founder || rewards?.betaTester
  return (
    <>
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
      </SettingsSection>
      <InviteCta />
      {elite ? (
        <Link
          href="/settings/founders"
          data-setting-id="founders"
          className={cn('flex min-h-16 w-full items-center gap-3 rounded-2xl border px-4 py-3 text-start text-[var(--member-fg)] transition-transform active:scale-[0.985]', 'border-[color-mix(in_oklab,var(--member-gold-hi)_45%,transparent)] bg-[image:var(--member-floor)]')}
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_oklab,var(--member-gold-hi)_16%,transparent)] text-[var(--member-gold-hi)]"><Crown className="size-5" aria-hidden /></span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2 text-[0.9375rem] font-bold leading-tight">
              <span className="bg-[image:var(--member-foil)] bg-clip-text text-transparent">{c.founders.title}</span>
              {founder ? <span dir="ltr" className="font-mono-numbers text-xs font-semibold text-[var(--member-gold-hi)]">{formatFounderNumber(founder.number)}</span> : null}
            </span>
            <span dir="auto" className="mt-0.5 block text-left text-xs leading-snug text-[var(--member-fg-2)]">{founder ? hub.page.founderNote : hub.page.betaNote}</span>
          </span>
          <Chevron className="size-4 shrink-0 text-[var(--member-fg-2)]" aria-hidden />
        </Link>
      ) : null}
    </>
  )
}
