'use client'

import { SearchX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { BuddgyIcon } from '@/components/ai/BuddgyIcon'
import { SettingsRow } from '@/components/features/settings/SettingsRow'
import { SettingsToggleRow } from '@/components/features/settings/SettingsToggleRow'
import { SETTING_ICONS } from '@/components/features/settings/settingIcons'
import { ROOM_TONE } from '@/components/features/settings/roomMeta'
import { isToggleSetting } from '@/hooks/useSettingToggle'
import { useOpenSetting } from '@/hooks/useOpenSetting'
import { useSettingValue } from '@/hooks/useSettingValue'
import { navigate } from '@/lib/navigation/navigate'
import { useSettingsHubCopy } from '@/lib/i18n/settingsHubCopy'
import { SETTING_BY_ID, type SettingId } from '@/lib/settings/registry'

function ValueResult({ id, breadcrumb }: { id: SettingId; breadcrumb: string }) {
  const copy = useSettingsHubCopy()
  const open = useOpenSetting()
  const entry = SETTING_BY_ID[id]
  return (
    <SettingsRow
      icon={SETTING_ICONS[entry.icon]}
      tone={ROOM_TONE[entry.room]}
      title={copy.items[id].label}
      subtitle={breadcrumb}
      value={useSettingValue(id)}
      destructive={entry.kind === 'danger'}
      onClick={() => open(id)}
    />
  )
}

interface Props {
  ids: SettingId[]
  query: string
}

/** Matches for the hub search: switches flip right here, everything else jumps to its page. */
export function SettingsSearchResults({ ids, query }: Props) {
  const copy = useSettingsHubCopy()

  if (ids.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-8 py-10 text-center">
        <span className="text-[var(--color-brand-primary-ink)]">
          <BuddgyIcon mood="curious" size={56} strokeWidth={1.5} alive />
        </span>
        <p className="flex items-center gap-1.5 text-base font-semibold text-[var(--color-brand-text-primary)]">
          <SearchX className="size-4 text-[var(--color-brand-text-muted)]" aria-hidden />
          {copy.search.noResults(query.trim())}
        </p>
        <p className="text-sm text-[var(--color-brand-text-muted)]">{copy.search.noResultsHint}</p>
        <Button variant="outline" size="touch" className="mt-2" onClick={() => navigate('/settings/feedback')}>
          {copy.search.reportMissing}
        </Button>
      </div>
    )
  }

  return (
    <Card padding="none" divide className="overflow-hidden" role="list" aria-live="polite">
      {ids.map((id) => {
        const entry = SETTING_BY_ID[id]
        const breadcrumb = `${copy.rooms[entry.room].title}  ›  ${copy.items[id].label}`
        return (
          <div key={id} role="listitem">
            {isToggleSetting(id) ? (
              <SettingsToggleRow id={id} tone={ROOM_TONE[entry.room]} hint={copy.rooms[entry.room].title} />
            ) : (
              <ValueResult id={id} breadcrumb={breadcrumb} />
            )}
          </div>
        )
      })}
    </Card>
  )
}
