'use client'

import { useEffect, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { useAuth } from '@/components/auth/AuthProvider'
import { PageBody } from '@/components/layout/PageContainer'
import { MembershipRows } from '@/components/features/settings/hub/MembershipRows'
import { PreferencesCard } from '@/components/features/settings/hub/PreferencesCard'
import { ProfileBanner } from '@/components/features/settings/hub/ProfileBanner'
import { SettingsSearch } from '@/components/features/settings/hub/SettingsSearch'
import { SmsCard } from '@/components/features/settings/hub/SmsCard'
import { SettingsRow } from '@/components/features/settings/SettingsRow'
import { SettingsSection } from '@/components/features/settings/SettingsSection'
import { SETTING_ICONS } from '@/components/features/settings/settingIcons'
import { GROUP_TONE } from '@/components/features/settings/groupMeta'
import { Button } from '@/components/ui/button'
import { SkeletonList } from '@/components/ui/SkeletonList'
import { useSettingsHubCopy } from '@/lib/i18n/settingsHubCopy'
import { useT } from '@/lib/i18n'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'

const HIGHLIGHT = ['bg-[var(--color-brand-primary-soft)]']
const HIGHLIGHT_MS = 1800

/** Settings as one grouped list: profile, Membership, Preferences, Tracking & Buddgy, Privacy & data, Support, Sign out. Each group's detail opens its own screen. */
export default function SettingsPage() {
  const t = useT()
  const copy = useSettingsHubCopy()
  const p = copy.page
  const { user, signOut } = useAuth()
  const dataReady = useFinanceStore((s) => s.dataReady)
  const twoFactor = useFinanceStore((s) => s.settings.twoFactorEmailEnabled)
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

  const aiRow = <SettingsRow icon={SETTING_ICONS.buddgy} tone={GROUP_TONE.ai} title={p.buddgyAi} href="/settings/ai" />

  return (
    <div ref={bodyRef}>
      <PageBody narrow className="space-y-4">
        <div className="flex justify-end">
          <Button variant="ghost" size="touch" aria-label={copy.searchLabel} onClick={() => setSearching(true)} className="-me-2 px-2">
            <Search className="size-5" />
          </Button>
        </div>
        <ProfileBanner />
        {user ? <MembershipRows /> : null}
        <PreferencesCard />
        {user ? <SmsCard title={p.tracking}>{aiRow}</SmsCard> : <SettingsSection title={p.tracking}>{aiRow}</SettingsSection>}
        <SettingsSection title={p.privacy}>
          {user ? <SettingsRow icon={SETTING_ICONS.shield} tone={GROUP_TONE.security} title={copy.security.title} value={twoFactor ? p.twoFactorOn : undefined} href="/settings/security" settingId="security" /> : null}
          <SettingsRow icon={SETTING_ICONS.download} tone={GROUP_TONE.data} title={p.dataBackup} href="/settings/data" />
        </SettingsSection>
        <SettingsSection title={p.support}>
          <SettingsRow icon={SETTING_ICONS.help} tone={GROUP_TONE.help} title={p.helpFeedback} href="/settings/help" />
          <SettingsRow icon={SETTING_ICONS.file} tone={GROUP_TONE.help} title={p.aboutLegal} href="/settings/about" />
        </SettingsSection>
        {user ? (
          <SettingsSection>
            <SettingsRow destructive title={t.common.signOut} onClick={() => void signOut()} trailing={<span />} settingId="signOut" />
          </SettingsSection>
        ) : null}
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
