'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useAuth } from '@/components/auth/AuthProvider'
import { MemberHead } from '@/components/features/membership/MemberHead'
import { Card } from '@/components/ui/card'
import { useSetupProgress } from '@/hooks/useSetupProgress'
import { useLocale, useT } from '@/lib/i18n'
import { useSettingsHubCopy } from '@/lib/i18n/settingsHubCopy'
import { resolveProfileAvatarSrc } from '@/lib/profile/avatarDisplay'
import { useFinanceStore } from '@/lib/store/useFinanceStore'

/** The signed-in person's row at the top of Settings; it opens the profile. */
export function ProfileBanner() {
  const t = useT()
  const copy = useSettingsHubCopy()
  const { locale } = useLocale()
  const { user } = useAuth()
  const profile = useFinanceStore(useShallow((s) => s.profile))
  const { pct } = useSetupProgress()
  const Chevron = locale === 'ar' ? ChevronLeft : ChevronRight
  if (!user) return null

  return (
    <Card padding="none" className="overflow-hidden">
      <MemberHead
        variant="settings"
        name={profile.name}
        avatarSrc={resolveProfileAvatarSrc(profile)}
        hint={user.email || profile.email || copy.page.editProfile}
        trailing={<Chevron className="pointer-events-none size-5 shrink-0 text-[var(--color-brand-text-muted)]" aria-hidden />}
      />
      {pct < 100 ? (
        <div role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={t.setup.chipAria(pct)} className="h-[3px] w-full bg-[var(--color-brand-border-strong)]">
          <div className="h-full bg-[var(--color-brand-primary)]" style={{ width: `${pct}%` }} />
        </div>
      ) : null}
    </Card>
  )
}
