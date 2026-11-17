'use client'

import { ChevronLeft, ChevronRight, User } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useAuth } from '@/components/auth/AuthProvider'
import { Badge } from '@/components/ui/badge'
import { billingOn, useBillingStore } from '@/lib/billing/billingStore'
import { AvatarBadge, FounderChip } from '@/components/features/membership/AvatarBadge'
import { TierBadge } from '@/components/features/membership/TierBadge'
import { useMemberMarks } from '@/components/features/rewards/useMemberMarks'
import { useMembershipCopy } from '@/lib/i18n/membershipCopy'
import { AppLink as Link } from '@/components/ui/AppLink'
import { Card } from '@/components/ui/card'
import { ProgressRing } from '@/components/ui/ProgressRing'
import { useSetupProgress } from '@/hooks/useSetupProgress'
import { useLocale, useT } from '@/lib/i18n'
import { useSettingsHubCopy } from '@/lib/i18n/settingsHubCopy'
import { resolveProfileAvatarSrc } from '@/lib/profile/avatarDisplay'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { cn } from '@/lib/utils'

/** The signed-in person's card; it opens the profile. */
export function ProfileBanner() {
  const t = useT()
  const copy = useSettingsHubCopy()
  const { locale } = useLocale()
  const { user } = useAuth()
  const profile = useFinanceStore(useShallow((s) => s.profile))
  const { pct } = useSetupProgress()
  const me = useBillingStore((st) => st.me)
  const loyalty = billingOn(me) ? me?.loyalty ?? null : null
  const member = useMembershipCopy().founders
  const marks = useMemberMarks()
  const avatarSrc = resolveProfileAvatarSrc(profile)
  const Chevron = locale === 'ar' ? ChevronLeft : ChevronRight

  return (
    <>
      {user ? (
        <Card
          render={<Link href="/settings/profile" />}
          padding="none"
          className="flex w-full items-center gap-3 px-4 py-3 hover:bg-[var(--color-brand-elevated)]"
        >
          <AvatarBadge size="sm" proTag={marks.proTag} founder={!!marks.founderNumber} className="mb-1">
            {avatarSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarSrc} alt="" width={40} height={40} />
            ) : (
              <User className="size-5" aria-hidden />
            )}
          </AvatarBadge>
          <span className={cn('min-w-0 flex-1', locale === 'ar' && 'text-end')}>
            <span className={cn('flex min-w-0 items-center gap-1.5', locale === 'ar' && 'flex-row-reverse')}>
              <span className="truncate text-base font-semibold text-[var(--color-brand-text-primary)]">{profile.name || t.common.user}</span>
              {marks.tier ? <TierBadge tier={marks.tier} size={16} label={marks.tierLabel} className="shrink-0" /> : null}
              {marks.founderNumber ? <FounderChip number={marks.founderNumber} className="shrink-0" /> : null}
            </span>
            <span className="block truncate text-xs text-[var(--color-brand-text-muted)]">{user.email || profile.email || copy.profileHint}</span>
            {loyalty?.betaTester ? (
              <span className={cn('mt-1 flex flex-wrap gap-1.5', locale === 'ar' && 'justify-end')}>
                <Badge tone="beta" size="sm">{member.betaBadge}</Badge>
              </span>
            ) : null}
          </span>
          {pct < 100 ? (
            <ProgressRing pct={pct} size={36} stroke={4} track="var(--color-brand-border-strong)" arc="var(--color-brand-primary)">
              <span className="font-mono-numbers text-[0.5625rem] font-bold text-[var(--color-brand-primary-ink)]">{pct}%</span>
            </ProgressRing>
          ) : null}
          <Chevron className="size-5 shrink-0 text-[var(--color-brand-text-muted)]" aria-hidden />
        </Card>
      ) : (
        <div className="px-1 text-xl font-bold text-[var(--color-brand-text-primary)]">{copy.title}</div>
      )}
    </>
  )
}
