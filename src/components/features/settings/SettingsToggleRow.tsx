'use client'

import type { RowTone } from '@/components/features/settings/SettingsRow'
import { SettingsSwitchRow } from '@/components/features/settings/SettingsSwitchRow'
import { useSettingToggle, type ToggleSettingId } from '@/hooks/useSettingToggle'
import { useSettingsHubCopy } from '@/lib/i18n/settingsHubCopy'

interface SettingsToggleRowProps {
  id: ToggleSettingId
  tone?: RowTone
  hint?: string
  /** Small caption under the hint, e.g. "This device only". */
  tag?: string
  disabled?: boolean
}

/** SettingsSwitchRow fed from the shared store-backed toggle for `id`. */
export function SettingsToggleRow({ id, tone, hint, tag, disabled }: SettingsToggleRowProps) {
  const copy = useSettingsHubCopy()
  const { on, set } = useSettingToggle(id)
  return <SettingsSwitchRow id={id} label={copy.items[id].label} tone={tone} hint={hint} tag={tag} checked={on} onChange={set} disabled={disabled} />
}
