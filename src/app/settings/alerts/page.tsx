'use client'

import { Card } from '@/components/ui/card'
import { SettingsChip } from '@/components/features/settings/SettingsRow'
import { SettingsSection } from '@/components/features/settings/SettingsSection'
import { SettingsSubPageShell } from '@/components/features/settings/SettingsSubPageShell'
import { SettingsToggleRow } from '@/components/features/settings/SettingsToggleRow'
import { SETTING_ICONS } from '@/components/features/settings/settingIcons'
import { ROOM_TONE } from '@/components/features/settings/roomMeta'
import { usePushPermission } from '@/hooks/usePushPermission'
import { useSettingsHubCopy } from '@/lib/i18n/settingsHubCopy'
import { cn } from '@/lib/utils'

export default function SettingsAlertsPage() {
  const copy = useSettingsHubCopy()
  const a = copy.alertsPage
  const push = usePushPermission()
  const tone = ROOM_TONE.alerts
  const status = { checking: '', allowed: a.allowed, blocked: a.blocked, notAsked: a.notAsked, unsupported: a.unsupported }[push]
  const ok = push === 'allowed'

  return (
    <SettingsSubPageShell title={copy.rooms.alerts.title}>
      <Card padding="none" data-setting-id="pushStatus" className="flex items-center gap-3 px-4 py-3.5">
        <SettingsChip icon={SETTING_ICONS.bell} tone={tone} />
        <span className="min-w-0 flex-1">
          <span className="block text-base font-semibold text-[var(--color-brand-text-primary)]">{a.master}</span>
          <span className="mt-0.5 flex items-center gap-1.5 text-xs text-[var(--color-brand-text-muted)]">
            <span className={cn('size-2 rounded-full', ok ? 'bg-[var(--color-brand-green)]' : 'bg-[var(--color-brand-amber)]')} aria-hidden />
            {status}
          </span>
        </span>
      </Card>
      {push === 'blocked' || push === 'notAsked' ? (
        <p className="px-1 text-xs text-[var(--color-brand-text-muted)]">{a.pushHint}</p>
      ) : null}

      <SettingsSection title={a.subscriptions}>
        <SettingsToggleRow id="subDueReminders" tone={tone} hint={a.dueHint} />
        <SettingsToggleRow id="subPriceAlerts" tone={tone} hint={a.priceHint} />
      </SettingsSection>
      <SettingsSection title={a.goals}>
        <SettingsToggleRow id="goalProgressAlerts" tone={tone} hint={a.progressHint} />
        <SettingsToggleRow id="goalAlerts" tone={tone} hint={a.behindHint} />
      </SettingsSection>
    </SettingsSubPageShell>
  )
}
