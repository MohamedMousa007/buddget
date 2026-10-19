'use client'

import { Switch } from '@/components/ui/switch'
import { SettingsChip, type RowTone } from '@/components/features/settings/SettingsRow'
import { SETTING_ICONS } from '@/components/features/settings/settingIcons'
import { SETTING_BY_ID, type SettingId } from '@/lib/settings/registry'
import { useLocale } from '@/lib/i18n'
import { cn } from '@/lib/utils'

interface SettingsSwitchRowProps {
  id: SettingId
  label: string
  tone?: RowTone
  hint?: string
  checked: boolean
  onChange: (next: boolean) => void
  disabled?: boolean
}

/** A whole-row switch for settings whose state does not live in a plain store field (SMS, notifications, 2-step). */
export function SettingsSwitchRow({ id, label, tone = 'neutral', hint, checked, onChange, disabled }: SettingsSwitchRowProps) {
  const { locale } = useLocale()
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
      <span className={cn('min-w-0 flex-1', locale === 'ar' && 'text-end')}>
        <span className="block text-[15px] font-semibold leading-tight text-[var(--color-brand-text-primary)]">{label}</span>
        {hint ? <span className="mt-0.5 block text-xs leading-snug text-[var(--color-brand-text-muted)]">{hint}</span> : null}
      </span>
      <Switch size="touch" aria-label={label} checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </label>
  )
}
