'use client'

import { Switch } from '@/components/ui/switch'
import { SettingsChip, type RowTone } from '@/components/features/settings/SettingsRow'
import { SETTING_ICONS } from '@/components/features/settings/settingIcons'
import { SETTING_BY_ID, type SettingId } from '@/lib/settings/registry'
import { cn } from '@/lib/utils'

interface SettingsSwitchRowProps {
  /** A registered setting: gives the row its icon chip and search anchor. Omit for a plain switch row in a sheet or form. */
  id?: SettingId
  label: string
  tone?: RowTone
  hint?: string
  /** Small caption under the hint, e.g. "This device only". */
  tag?: string
  checked: boolean
  onChange: (next: boolean) => void
  disabled?: boolean
}

/** A whole-row switch for settings whose state does not live in a plain store field (SMS, notifications, 2-step). */
export function SettingsSwitchRow({ id, label, tone = 'neutral', hint, tag, checked, onChange, disabled }: SettingsSwitchRowProps) {
  const Icon = id ? SETTING_ICONS[SETTING_BY_ID[id].icon] : null
  return (
    <label
      data-setting-id={id}
      className={cn(
        'group/row flex min-h-14 cursor-pointer items-center gap-3 px-4 py-2 transition-colors duration-200 hover:bg-[var(--color-brand-elevated)]',
        disabled && 'pointer-events-none opacity-50',
      )}
    >
      {Icon ? <SettingsChip icon={Icon} tone={tone} /> : null}
      <span className="min-w-0 flex-1">
        <span className="block text-[0.9375rem] font-semibold leading-tight text-[var(--color-brand-text-primary)]">{label}</span>
        {hint ? <span className="mt-0.5 block text-xs leading-snug text-[var(--color-brand-text-muted)]">{hint}</span> : null}
        {tag ? <span className="mt-0.5 block text-[0.625rem] font-medium uppercase tracking-wider text-[var(--color-brand-text-muted)]">{tag}</span> : null}
      </span>
      <Switch size="touch" aria-label={label} checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </label>
  )
}
