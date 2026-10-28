'use client'

import { Switch } from '@/components/ui/switch'
import { SettingsChip, type RowTone } from '@/components/features/settings/SettingsRow'
import { SETTING_ICONS } from '@/components/features/settings/settingIcons'
import { useSettingToggle, type ToggleSettingId } from '@/hooks/useSettingToggle'
import { SETTING_BY_ID } from '@/lib/settings/registry'
import { useSettingsHubCopy } from '@/lib/i18n/settingsHubCopy'
import { cn } from '@/lib/utils'

interface SettingsToggleRowProps {
  id: ToggleSettingId
  tone?: RowTone
  hint?: string
  /** Small caption under the hint, e.g. "This device only". */
  tag?: string
  disabled?: boolean
}

/** A whole-row switch: label, optional hint, and the shared store-backed toggle for `id`. */
export function SettingsToggleRow({ id, tone = 'neutral', hint, tag, disabled }: SettingsToggleRowProps) {
  const copy = useSettingsHubCopy()
  const { on, set } = useSettingToggle(id)
  const label = copy.items[id].label
  const Icon = SETTING_ICONS[SETTING_BY_ID[id].icon]

  return (
    <label
      data-setting-id={id}
      className={cn(
        'group/row flex min-h-14 cursor-pointer items-center gap-3 px-4 py-2 transition-colors duration-200 hover:bg-[var(--color-brand-elevated)]',
        disabled && 'pointer-events-none opacity-50',
      )}
    >
      <SettingsChip icon={Icon} tone={tone} />
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold leading-tight text-[var(--color-brand-text-primary)]">{label}</span>
        {hint ? <span className="mt-0.5 block text-xs leading-snug text-[var(--color-brand-text-muted)]">{hint}</span> : null}
        {tag ? <span className="mt-0.5 block text-[10px] font-medium uppercase tracking-wider text-[var(--color-brand-text-muted)]">{tag}</span> : null}
      </span>
      <Switch size="touch" aria-label={label} checked={on} onCheckedChange={set} disabled={disabled} />
    </label>
  )
}
