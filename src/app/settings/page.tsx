'use client'

import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/components/auth/AuthProvider'
import { PageBody } from '@/components/layout/PageContainer'
import { QuickActions } from '@/components/features/settings/QuickActions'
import { AiCard } from '@/components/features/settings/hub/AiCard'
import { DataCard } from '@/components/features/settings/hub/DataCard'
import { DeleteAccountCta } from '@/components/features/settings/hub/DeleteAccountCta'
import { HelpCard } from '@/components/features/settings/hub/HelpCard'
import { NotificationsCard } from '@/components/features/settings/hub/NotificationsCard'
import { ProfileBanner } from '@/components/features/settings/hub/ProfileBanner'
import { SecurityCard } from '@/components/features/settings/hub/SecurityCard'
import { SettingsSearch } from '@/components/features/settings/hub/SettingsSearch'
import { SmsCard } from '@/components/features/settings/hub/SmsCard'
import { Card } from '@/components/ui/card'
import { SkeletonList } from '@/components/ui/SkeletonList'
import { useProfilePage } from '@/hooks/useProfilePage'
import { useSettingsHubCopy } from '@/lib/i18n/settingsHubCopy'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'

const HIGHLIGHT = ['bg-[var(--color-brand-primary-soft)]']
const HIGHLIGHT_MS = 1800

/** Every setting on one screen: profile, quick actions, then short groups. Memory and Profile are the only other screens. */
export default function SettingsPage() {
  const copy = useSettingsHubCopy()
  const { user } = useAuth()
  const p = useProfilePage()
  const dataReady = useFinanceStore((s) => s.dataReady)
  const focusId = useSettingsStore((s) => s.settingsFocusId)
  const setFocusId = useSettingsStore((s) => s.setSettingsFocusId)
  const [searching, setSearching] = useState(false)
  const bodyRef = useRef<HTMLDivElement>(null)

  // Search lands here asking for a row: scroll to it and flash it.
  useEffect(() => {
    if (!focusId || !dataReady) return
    const frame = requestAnimationFrame(() => {
      const el = bodyRef.current?.querySelector<HTMLElement>(`[data-setting-id="${CSS.escape(focusId)}"]`)
      setFocusId(null)
      if (!el) return
      el.scrollIntoView({ block: 'center', behavior: 'smooth' })
      el.classList.add(...HIGHLIGHT)
      window.setTimeout(() => el.classList.remove(...HIGHLIGHT), HIGHLIGHT_MS)
    })
    return () => cancelAnimationFrame(frame)
  }, [focusId, dataReady, setFocusId])

  if (!dataReady) return <div className="p-4"><SkeletonList rows={8} /></div>

  return (
    <div ref={bodyRef}>
      <PageBody narrow className="space-y-4">
        <ProfileBanner onSearch={() => setSearching(true)} />
        <Card padding="none">
          <QuickActions variant="hub" />
        </Card>
        <SecurityCard p={p} />
        {user ? <SmsCard /> : null}
        <AiCard />
        <NotificationsCard />
        <DataCard />
        <HelpCard />
        {user ? <DeleteAccountCta p={p} /> : null}
        <p className="pt-2 text-center text-xs text-[var(--color-brand-text-muted)]">
          <a href="https://www.exchangerate-api.com/" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center underline hover:text-[var(--color-brand-text-secondary)]">
            {copy.footer}
          </a>
        </p>
      </PageBody>
      <SettingsSearch open={searching} onClose={() => setSearching(false)} />
    </div>
  )
}
