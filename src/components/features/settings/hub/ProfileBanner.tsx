'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useAuth } from '@/components/auth/AuthProvider'
import { MemberHead } from '@/components/features/membership/MemberHead'
import { Card } from '@/components/ui/card'
import { ProgressRing } from '@/components/ui/ProgressRing'
import { useSetupProgress } from '@/hooks/useSetupProgress'
import { useLocale } from '@/lib/i18n'
import { useSettingsHubCopy } from '@/lib/i18n/settingsHubCopy'
import { resolveProfileAvatarSrc } from '@/lib/profile/avatarDisplay'
import { useFinanceStore } from '@/lib/store/useFinanceStore'

/** The signed-in person's row at the top of Settings; it opens the profile. */
export function ProfileBanner() {
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
        hint={copy.page.editProfile}
        trailing={
          <span className="pointer-events-none flex items-center gap-2">
            {pct < 100 ? (
              <ProgressRing pct={pct} size={36} stroke={4} track="var(--color-brand-border-strong)" arc="var(--color-brand-primary)">
                <span className="font-mono-numbers text-[0.5625rem] font-bold text-[var(--color-brand-primary-ink)]">{pct}%</span>
              </ProgressRing>
            ) : null}
            <Chevron className="size-5 shrink-0 text-[var(--color-brand-text-muted)]" aria-hidden />
          </span>
        }
      />
    </Card>
  )
}
