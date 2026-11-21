'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useAuth } from '@/components/auth/AuthProvider'
import { MemberHead } from '@/components/features/membership/MemberHead'
import { SetupChecklistSheet } from '@/components/features/setup/SetupProgressChip'
import { Card } from '@/components/ui/card'
import { Progress, ProgressIndicator, ProgressTrack } from '@/components/ui/progress'
import { useSetupProgress } from '@/hooks/useSetupProgress'
import { useLocale, useT } from '@/lib/i18n'
import { useSettingsHubCopy } from '@/lib/i18n/settingsHubCopy'
import { resolveProfileAvatarSrc } from '@/lib/profile/avatarDisplay'
import { useFinanceStore } from '@/lib/store/useFinanceStore'

/** The signed-in person's row at the top of Settings; it opens the profile. While setup is unfinished, a slim "Finish setup · 3 of 5" row under it opens the checklist. */
export function ProfileBanner() {
  const t = useT()
  const copy = useSettingsHubCopy()
  const { locale } = useLocale()
  const { user } = useAuth()
  const profile = useFinanceStore(useShallow((s) => s.profile))
  const { steps, doneCount, pct } = useSetupProgress()
  const [setupOpen, setSetupOpen] = useState(false)
  const Chevron = locale === 'ar' ? ChevronLeft : ChevronRight
  if (!user) return null
  const count = t.setup.progress(doneCount, steps.length)

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
        <button
          type="button"
          data-raw-button-ok="slim setup row under the profile, 44px tall"
          onClick={() => setSetupOpen(true)}
          aria-label={`${t.setup.chipLabel}, ${count}`}
          className="flex min-h-11 w-full items-center gap-2.5 border-t border-[var(--color-brand-border)] ps-4 pe-3 text-start transition-colors hover:bg-[var(--color-brand-elevated)]"
        >
          <span className="min-w-0 flex-1 truncate text-[0.8125rem] font-semibold text-[var(--color-brand-text-primary)]">
            {t.setup.chipLabel}{' '}
            <span className="font-medium text-[var(--color-brand-text-secondary)]">
              · <span className="font-mono-numbers text-xs">{count}</span>
            </span>
          </span>
          <Progress value={pct} aria-hidden className="w-24 shrink-0">
            <ProgressTrack className="bg-[var(--color-brand-sunken)]">
              <ProgressIndicator className="rounded-full bg-[var(--color-brand-primary)]" />
            </ProgressTrack>
          </Progress>
          <Chevron className="size-4 shrink-0 text-[var(--color-brand-text-muted)]" aria-hidden />
        </button>
      ) : null}
      <SetupChecklistSheet open={setupOpen} onClose={() => setSetupOpen(false)} />
    </Card>
  )
}
