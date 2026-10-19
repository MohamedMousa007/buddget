'use client'

import { Card } from '@/components/ui/card'
import { useAuth } from '@/components/auth/AuthProvider'
import { SettingsRow } from '@/components/features/settings/SettingsRow'
import { SettingsSection } from '@/components/features/settings/SettingsSection'
import { SettingsSubPageShell } from '@/components/features/settings/SettingsSubPageShell'
import { SETTING_ICONS } from '@/components/features/settings/settingIcons'
import { ROOM_TONE } from '@/components/features/settings/roomMeta'
import { useOpenSetting } from '@/hooks/useOpenSetting'
import { useSettingsHubCopy } from '@/lib/i18n/settingsHubCopy'
import { useFinanceStore } from '@/lib/store/useFinanceStore'

export default function SettingsYouPage() {
  const copy = useSettingsHubCopy()
  const { user } = useAuth()
  const open = useOpenSetting()
  const name = useFinanceStore((s) => s.profile.name)
  const methodCount = useFinanceStore((s) => s.paymentMethods.length)
  const tone = ROOM_TONE.you

  return (
    <SettingsSubPageShell title={copy.rooms.you.title}>
      <SettingsSection title={copy.you.account}>
        <SettingsRow icon={SETTING_ICONS.user} tone={tone} title={copy.items.profile.label} value={name || undefined} href="/settings/profile" settingId="profile" />
        {user ? (
          <SettingsRow icon={SETTING_ICONS.shield} tone={tone} title={copy.items.account.label} subtitle={copy.you.security} href="/settings/account" settingId="account" />
        ) : null}
      </SettingsSection>
      {user ? null : (
        <Card padding="md" variant="brand" className="text-sm text-[var(--color-brand-primary-ink)]">{copy.you.signedOutHint}</Card>
      )}
      <SettingsSection title={copy.you.money}>
        <SettingsRow
          icon={SETTING_ICONS.card}
          tone={ROOM_TONE.money}
          title={copy.items.paymentMethods.label}
          subtitle={copy.moneyPage.paymentMethodsHint(methodCount)}
          onClick={() => open('paymentMethods')}
          settingId="paymentMethods"
        />
      </SettingsSection>
    </SettingsSubPageShell>
  )
}
