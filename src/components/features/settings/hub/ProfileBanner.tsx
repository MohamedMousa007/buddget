'use client'

import { ChevronLeft, ChevronRight, User } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useAuth } from '@/components/auth/AuthProvider'
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
          <span className="size-12 shrink-0 overflow-hidden rounded-full bg-[var(--color-brand-elevated)] ring-2 ring-[var(--color-brand-primary)] ring-offset-2 ring-offset-[var(--color-brand-card)]">
            {avatarSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarSrc} alt="" className="size-full object-cover" width={48} height={48} />
            ) : (
              <span className="flex size-full items-center justify-center"><User className="size-6 text-[var(--color-brand-text-secondary)]" /></span>
            )}
          </span>
          <span className={cn('min-w-0 flex-1', locale === 'ar' && 'text-end')}>
            <span className="block truncate text-base font-semibold text-[var(--color-brand-text-primary)]">{profile.name || t.common.user}</span>
            <span className="block truncate text-xs text-[var(--color-brand-text-muted)]">{user.email || profile.email || copy.profileHint}</span>
          </span>
          {pct < 100 ? (
            <ProgressRing pct={pct} size={36} stroke={4} track="var(--color-brand-border-strong)" arc="var(--color-brand-primary)">
              <span className="font-mono-numbers text-[9px] font-bold text-[var(--color-brand-primary-ink)]">{pct}%</span>
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
